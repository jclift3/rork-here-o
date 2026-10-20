// The HereO ring: after her 3 second cancel window the app asks this to ring
// opted-in HereO users nearby, and calls it again when her request ends.
//
// * Neighbours get a pin and a distance, never her name. Matching is done by
//   nearby_ring_responders(): everyone within 100 m, then the nearest up to
//   ten, walkers within half a mile and drivers within a mile.
// * Her circle and guardians are excluded: dispatch already alerted them.
// * Accounts with two false alarms in 30 days, or banned for pranks, ring only
//   their circle and guardians.
// * Ending with the duress PIN leaves the request open; her circle and
//   guardians are told quietly, and nobody is sent "all clear".

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPushMessages, type PushOptions, sendPush } from "./push.ts";
import type { Incident } from "./types.ts";

export const RING_STRIKE_LIMIT = 2;

export const RING_PUSH: PushOptions = {
  sound: "hereo-ring.wav",
  channelId: "hereo-ring",
  interruptionLevel: "time-sensitive",
};

export type Travel = "foot" | "drive";

export interface RingCandidate {
  user_id: string;
  distance_m: number;
  travel: Travel;
  push_token: string | null;
}

export type RingResult =
  | { status: "already_rung_or_closed" }
  | { status: "limited"; strikes: number }
  | { status: "no_location" }
  | { status: "rung"; rung: number };

export function describeRingDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.max(10, Math.round(distanceM / 10) * 10)} m away`;
  return `${(distanceM / 1000).toFixed(1)} km away`;
}

export function ringMessage(c: Pick<RingCandidate, "distance_m" | "travel">): { title: string; body: string } {
  const where = describeRingDistance(c.distance_m);
  return {
    title: "Someone nearby needs help",
    body: c.travel === "drive"
      ? `${where}. Tap for the map. Park first, go with someone if you can, and never confront.`
      : `${where}. Tap for the map. Go with someone if you can, and never confront.`,
  };
}

export const ALL_CLEAR = {
  title: "All clear",
  body: "The person who rang nearby says they're safe. Thank you for being ready to help.",
};

export function duressMessage(name: string): { title: string; body: string } {
  const n = name.trim().split(/\s+/)[0] || "Someone";
  return {
    title: `${n} may not be safe`,
    body:
      `${n} ended their alert with their duress PIN. Their phone shows all clear but help is still needed. Call 911, then tap for their location.`,
  };
}

/** Rings neighbours for the caller's open request, once. */
export async function sendRing(db: SupabaseClient, incidentId: string, requesterId: string): Promise<RingResult> {
  const { data: strikes, error: strikeError } = await db.rpc("ring_strikes", { p_user: requesterId });
  if (strikeError) throw strikeError;
  const { data: secret } = await db.from("ring_secrets").select("banned_at").eq("user_id", requesterId).maybeSingle();
  if ((strikes ?? 0) >= RING_STRIKE_LIMIT || secret?.banned_at) {
    return { status: "limited", strikes: strikes ?? 0 };
  }

  // Claim the ring so it happens once.
  const { data: incident, error } = await db
    .from("incidents")
    .update({ ring_at: new Date().toISOString() })
    .eq("id", incidentId)
    .eq("requester_id", requesterId)
    .eq("status", "active")
    .is("ring_at", null)
    .select("*")
    .maybeSingle<Incident>();
  if (error) throw error;
  if (!incident) return { status: "already_rung_or_closed" };
  if (incident.lat == null || incident.lng == null) {
    // Without a point there is nobody to ring; release the claim so a retry
    // with a location can.
    await db.from("incidents").update({ ring_at: null }).eq("id", incidentId);
    return { status: "no_location" };
  }

  const [{ data: circle }, { data: responders }] = await Promise.all([
    db.from("circle_members").select("member_id").eq("owner_id", requesterId),
    db.from("incident_responders").select("user_id").eq("incident_id", incidentId),
  ]);
  const exclude = [
    requesterId,
    ...(circle ?? []).map((r) => r.member_id as string),
    ...(responders ?? []).map((r) => r.user_id as string),
  ];
  const { data, error: matchError } = await db.rpc("nearby_ring_responders", {
    p_lat: incident.lat,
    p_lng: incident.lng,
    p_her_o_only: incident.mode === "her_o",
    p_exclude: exclude,
  });
  if (matchError) throw matchError;
  const rung = (data ?? []) as RingCandidate[];

  if (rung.length) {
    await db.from("ring_responders").upsert(
      rung.map((c) => ({
        incident_id: incidentId,
        user_id: c.user_id,
        travel: c.travel,
        distance_m: Math.round(c.distance_m),
      })),
      { onConflict: "incident_id,user_id", ignoreDuplicates: true },
    );
    const link = { ring_id: incidentId, url: `hereo://ring/${incidentId}` };
    await Promise.all(rung.map((c) => {
      const m = ringMessage(c);
      return sendPush(buildPushMessages([c.push_token], m.title, m.body, link, RING_PUSH), db);
    }));
  }
  await db.from("incident_events").insert({
    incident_id: incidentId,
    kind: "triaged",
    body: rung.length === 0
      ? "No HereO neighbours were close enough to ring."
      : rung.length === 1
      ? "1 HereO neighbour nearby was rung."
      : `${rung.length} HereO neighbours nearby were rung.`,
  });
  return { status: "rung", rung: rung.length };
}

/** After she ends her request: all clear to neighbours, or a duress alert to her people. */
export async function ringEnded(
  db: SupabaseClient,
  incidentId: string,
  requesterId: string,
): Promise<{ status: "all_clear" | "duress" | "open"; notified: number }> {
  const { data: incident } = await db.from("incidents").select("*").eq("id", incidentId)
    .eq("requester_id", requesterId).maybeSingle<Incident>();
  if (!incident) return { status: "open", notified: 0 };

  if (incident.status === "active" && incident.duress_at) {
    const { data: claimed } = await db.from("incidents").update({ duress_alerted_at: new Date().toISOString() })
      .eq("id", incidentId).is("duress_alerted_at", null).select("id").maybeSingle();
    if (!claimed) return { status: "duress", notified: 0 };
    const { data: requester } = await db.from("profiles").select("display_name").eq("id", requesterId).single();
    const { data: people } = await db
      .from("incident_responders")
      .select("user_id, profiles:user_id(private_profiles(push_token))")
      .eq("incident_id", incidentId);
    const tokens = (people ?? []).map((p) =>
      (p.profiles as unknown as { private_profiles: { push_token: string | null } | null } | null)
        ?.private_profiles?.push_token
    );
    const m = duressMessage(requester?.display_name || "Someone");
    const notified = await sendPush(
      buildPushMessages(tokens, m.title, m.body, { incident_id: incidentId, url: `hereo://incident/${incidentId}` }),
      db,
    );
    return { status: "duress", notified };
  }

  if (incident.status === "active") return { status: "open", notified: 0 };
  const { data: claimed } = await db.from("incidents").update({ all_clear_at: new Date().toISOString() })
    .eq("id", incidentId).not("ring_at", "is", null).is("all_clear_at", null).select("id").maybeSingle();
  if (!claimed) return { status: "all_clear", notified: 0 };

  // Everyone rung who did not decline hears it is over.
  const { data: rung } = await db
    .from("ring_responders")
    .select("user_id, status, profiles:user_id(private_profiles(push_token))")
    .eq("incident_id", incidentId)
    .neq("status", "declined");
  const tokens = (rung ?? []).map((p) =>
    (p.profiles as unknown as { private_profiles: { push_token: string | null } | null } | null)
      ?.private_profiles?.push_token
  );
  const notified = await sendPush(
    buildPushMessages(tokens, ALL_CLEAR.title, ALL_CLEAR.body, { ring_id: incidentId }, { channelId: "hereo-ring" }),
    db,
  );
  return { status: "all_clear", notified };
}
