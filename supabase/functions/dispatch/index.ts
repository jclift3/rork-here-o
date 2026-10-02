// Called by the app right after it creates an incident.
//
// 1. Alerts the requester's circle immediately (no AI in this path).
// 2. Finds available guardians nearby (women only in Her-O mode).
// 3. Asks Claude to triage and give each guardian one job, with an 8 second
//    budget and a deterministic fallback.
// 4. Alerts the chosen guardians and records the triage on the incident.
//
// Safe to call twice: the first call claims the incident via dispatched_at.

import { askJson } from "../_shared/claude.ts";
import { adminClient, callerFrom, corsHeaders, json, readIncidentId } from "../_shared/http.ts";
import { buildPushMessages, sendPush } from "../_shared/push.ts";
import {
  buildTriagePrompt,
  fallbackTriage,
  finalizeTriage,
  firstName,
  MAX_GUARDIANS,
  TRIAGE_SCHEMA,
  TRIAGE_SYSTEM,
} from "../_shared/triage.ts";
import type { GuardianCandidate, Incident, Triage } from "../_shared/types.ts";

const SEARCH_RADIUS_M = 1500;
const CANDIDATE_LIMIT = 6;
const TRIAGE_TIMEOUT_MS = 8000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);
  const incidentId = await readIncidentId(req);
  if (!incidentId) return json({ error: "incident_id required" }, 400);

  const db = adminClient();

  // Claim the incident. Only its requester can dispatch it, only once.
  const { data: claimed, error: claimError } = await db
    .from("incidents")
    .update({ dispatched_at: new Date().toISOString() })
    .eq("id", incidentId)
    .eq("requester_id", caller.id)
    .eq("status", "active")
    .is("dispatched_at", null)
    .select("*")
    .maybeSingle<Incident>();
  if (claimError) return json({ error: claimError.message }, 500);
  if (!claimed) return json({ status: "already_dispatched_or_closed" });
  const incident = claimed;

  const { data: requester } = await db.from("profiles").select("display_name").eq("id", caller.id).single();
  const requesterName = requester?.display_name || "Someone";
  const deepLink = { incident_id: incident.id, url: `hereo://incident/${incident.id}` };

  // 1. Circle first: they are alerted before any model call.
  const { data: circleRows } = await db
    .from("circle_members")
    .select("member_id, profiles:member_id(display_name, private_profiles(push_token))")
    .eq("owner_id", caller.id);
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
        `${firstName(requesterName)} needs help`,
        incident.note?.trim()
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
      p_exclude: [caller.id, ...circle.map((c) => c.user_id)],
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

  return json({
    status: "dispatched",
    triage_source: aiTriage ? "ai" : "fallback",
    urgency: triage.urgency,
    call_911_recommended: triage.call_911_recommended,
    circle_alerted: circle.length,
    guardians_sent: chosen.length,
  });
});
