// Review and demo accounts (profiles.is_demo, set by the HereO team).
//
// App Review has to try the help loop without alerting real people. A demo
// account's request is answered only by demo heroes, who are placed a short
// walk from it and start heading over; nobody real is alerted or rung. Real
// requests never reach demo heroes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineM } from "./geo.ts";
import type { GuardianCandidate, Incident } from "./types.ts";

export async function isDemo(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("is_demo").eq("id", userId).maybeSingle();
  return data?.is_demo === true;
}

/** Every demo account, so real requests can leave them out. */
export async function demoIds(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.from("profiles").select("id").eq("is_demo", true).limit(100);
  if (error) console.error("demoIds failed", error);
  return (data ?? []).map((r) => r.id as string);
}

// Roughly 150 m and 400 m away, in different directions.
const OFFSETS: [number, number][] = [[0.0011, 0.0012], [-0.0026, 0.0024]];

/**
 * Puts up to two demo heroes near the request and returns them as dispatch
 * candidates. They get no push (no real phone behind them).
 */
export async function stageDemoHeroes(db: SupabaseClient, incident: Incident): Promise<GuardianCandidate[]> {
  if (incident.lat == null || incident.lng == null) return [];
  const { data } = await db.from("profiles").select("id, display_name")
    .eq("is_demo", true).eq("is_guardian", true).neq("id", incident.requester_id).order("display_name").limit(2);
  const heroes = data ?? [];
  const out: GuardianCandidate[] = [];
  for (const [i, h] of heroes.entries()) {
    const [dLat, dLng] = OFFSETS[i];
    const lat = incident.lat + dLat;
    const lng = incident.lng + dLng;
    await db.from("private_profiles").update({ last_lat: lat, last_lng: lng, last_seen_at: new Date().toISOString() })
      .eq("id", h.id);
    out.push({
      user_id: h.id,
      display_name: h.display_name,
      distance_m: haversineM(incident.lat, incident.lng, lat, lng),
      push_token: null,
      trainings: ["first_aid"],
    });
  }
  return out;
}

/** The first demo hero says they're on the way, so the reviewer sees the loop move. */
export async function demoHeroesRespond(db: SupabaseClient, incidentId: string, heroIds: string[]) {
  const first = heroIds[0];
  if (!first) return;
  await db.from("incident_responders").update({ status: "en_route" }).eq("incident_id", incidentId).eq(
    "user_id",
    first,
  );
  await db.from("incident_events").insert({
    incident_id: incidentId,
    actor_id: first,
    kind: "message",
    body: "On my way. Stay where people can see you. (Demo hero)",
  });
}
