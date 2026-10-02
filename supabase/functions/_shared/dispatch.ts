// The help-request dispatcher, shared by the dispatch function (the app calls
// it after a hold or tap) and the check-ins function (missed check-ins).
//
// 1. Alerts the requester's circle immediately (no AI in this path).
// 2. Finds available guardians nearby (women only in Her-O mode).
// 3. Asks Claude to triage and give each guardian one job, with an 8 second
//    budget and a deterministic fallback.
// 4. Alerts the chosen guardians and records the triage on the incident.
//
// Safe to call twice: the first call claims the incident via dispatched_at.

import type { SupabaseClient } from "@supabase/supabase-js";
import { askJson } from "./claude.ts";
import { buildPushMessages, sendPush } from "./push.ts";
import {
  buildTriagePrompt,
  fallbackTriage,
  finalizeTriage,
  firstName,
  MAX_GUARDIANS,
  TRIAGE_SCHEMA,
  TRIAGE_SYSTEM,
} from "./triage.ts";
import type { GuardianCandidate, Incident, Triage } from "./types.ts";

const SEARCH_RADIUS_M = 1500;
const CANDIDATE_LIMIT = 6;
const TRIAGE_TIMEOUT_MS = 8000;

export type DispatchResult =
  | { status: "already_dispatched_or_closed" }
  | {
    status: "dispatched";
    triage_source: "ai" | "fallback";
    urgency: Triage["urgency"];
    call_911_recommended: boolean;
    circle_alerted: number;
    guardians_sent: number;
  };

export async function dispatchIncident(
  db: SupabaseClient,
  incidentId: string,
  requesterId: string,
): Promise<DispatchResult> {
  // Claim the incident so it is dispatched once, however many callers race.
  const { data: claimed, error: claimError } = await db
    .from("incidents")
    .update({ dispatched_at: new Date().toISOString() })
    .eq("id", incidentId)
    .eq("requester_id", requesterId)
    .eq("status", "active")
    .is("dispatched_at", null)
    .select("*")
    .maybeSingle<Incident>();
  if (claimError) throw claimError;
  if (!claimed) return { status: "already_dispatched_or_closed" };
  const incident = claimed;

  const { data: requester } = await db.from("profiles").select("display_name").eq("id", requesterId).single();
  const requesterName = requester?.display_name || "Someone";
  const deepLink = { incident_id: incident.id, url: `hereo://incident/${incident.id}` };

  // 1. Circle first: they are alerted before any model call.
  const { data: circleRows } = await db
    .from("circle_members")
    .select("member_id, profiles:member_id(display_name, private_profiles(push_token))")
    .eq("owner_id", requesterId);
  const circle = (circleRows ?? []).map((row) => {
    const p = row.profiles as unknown as
      | { display_name: string; private_profiles: { push_token: string | null } | null }
      | null;
    return {
      user_id: row.member_id as string,
      display_name: p?.display_name ?? "",
      push_token: p?.private_profiles?.push_token ?? null,
    };
  });
  if (circle.length) {
    await db.from("incident_responders").upsert(
      circle.map((c) => ({
        incident_id: incident.id,
        user_id: c.user_id,
        kind: "circle",
        role: `Call ${firstName(requesterName)} now. Open HereO to see where they are.`,
      })),
      { onConflict: "incident_id,user_id", ignoreDuplicates: true },
    );
    await sendPush(
      buildPushMessages(
        circle.map((c) => c.push_token),
        incident.trigger === "check_in_missed"
          ? `${firstName(requesterName)} missed a check-in`
          : `${firstName(requesterName)} needs help`,
        incident.trigger === "check_in_missed"
          ? "They didn't check in when they expected to. Call them, then tap to see their last location."
          : incident.note?.trim()
          ? `"${incident.note.trim().slice(0, 120)}" Tap to see where they are.`
          : "They pressed their HereO help button. Tap to see where they are.",
        deepLink,
      ),
    );
  }

  // 2. Nearby guardians, excluding people already alerted as circle.
  let candidates: GuardianCandidate[] = [];
  if (incident.lat != null && incident.lng != null) {
    const { data, error } = await db.rpc("nearby_guardians", {
      p_lat: incident.lat,
      p_lng: incident.lng,
      p_radius_m: SEARCH_RADIUS_M,
      p_her_o_only: incident.mode === "her_o",
      p_exclude: [requesterId, ...circle.map((c) => c.user_id)],
      p_limit: CANDIDATE_LIMIT,
    });
    if (error) console.error("nearby_guardians failed", error);
    candidates = (data ?? []) as GuardianCandidate[];
  }

  // 3. Triage.
  const raw = await askJson({
    system: TRIAGE_SYSTEM,
    user: buildTriagePrompt(incident, candidates, circle.map((c) => c.display_name)),
    schema: TRIAGE_SCHEMA,
    timeoutMs: TRIAGE_TIMEOUT_MS,
  });
  const aiTriage = finalizeTriage(raw, incident, candidates, requesterName);
  const triage: Triage = aiTriage ?? fallbackTriage(incident, candidates, requesterName);

  // 4. Send the chosen guardians.
  const byId = new Map(candidates.map((c) => [c.user_id, c]));
  const chosen = triage.guardian_roles.slice(0, MAX_GUARDIANS).flatMap((r) => {
    const c = byId.get(r.user_id);
    return c ? [{ ...c, role: r.role }] : [];
  });
  if (chosen.length) {
    await db.from("incident_responders").upsert(
      chosen.map((g) => ({
        incident_id: incident.id,
        user_id: g.user_id,
        kind: "guardian",
        role: g.role,
        distance_m: Math.round(g.distance_m),
      })),
      { onConflict: "incident_id,user_id", ignoreDuplicates: true },
    );
    // Each guardian gets their own job in the notification.
    await Promise.all(chosen.map((g) =>
      sendPush(
        buildPushMessages(
          [g.push_token],
          `Someone ${Math.round(g.distance_m)} m away needs help`,
          g.role,
          deepLink,
        ),
      )
    ));
  }

  await db.from("incidents").update({
    urgency: triage.urgency,
    category: triage.category,
    call_911_recommended: triage.call_911_recommended,
    brief: triage.summary,
    brief_at: new Date().toISOString(),
    triage_source: aiTriage ? "ai" : "fallback",
  }).eq("id", incident.id);
  await db.from("incident_events").insert({ incident_id: incident.id, kind: "triaged", body: triage.summary });

  return {
    status: "dispatched" as const,
    triage_source: aiTriage ? "ai" : "fallback",
    urgency: triage.urgency,
    call_911_recommended: triage.call_911_recommended,
    circle_alerted: circle.length,
    guardians_sent: chosen.length,
  };
}
