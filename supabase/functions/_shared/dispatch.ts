// The help-request dispatcher, shared by the dispatch function (the app calls
// it after a hold or tap) and the check-ins function (missed check-ins).
//
// 1. Alerts the requester's circle immediately (no AI in this path).
// 2. Finds available guardians nearby (women only in Her-O mode).
// 3. Asks Claude to triage and give each guardian one job, with an 8 second
//    budget and a deterministic fallback.
// 4. Alerts the chosen guardians and records the triage on the incident.
//
// A missed check-in alerts only the circle here. Guardians hear about it later
// through dispatchGuardians(), and only for people who opted in.
//
// Safe to call twice: the first call claims the incident via dispatched_at.

import type { SupabaseClient } from "@supabase/supabase-js";
import { askJson } from "./claude.ts";
import { runAgent } from "./muse/agent.ts";
import { metaKey } from "./muse/client.ts";
import { postNotes, recordDecisions, toTriage } from "./muse/respond.ts";
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
// The circle is already alerted; heroes can wait a few seconds for a better plan.
// Muse Spark answers one full-plan turn in about 4 to 6 s.
const AGENT_BUDGET_MS = 10_000;

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
      db,
    );
  }

  // A missed check-in stops here: no model call, no guardians yet.
  if (incident.trigger === "check_in_missed") {
    const triage = fallbackTriage(incident, [], requesterName);
    await recordTriage(db, incident.id, triage, "fallback");
    return {
      status: "dispatched" as const,
      triage_source: "fallback",
      urgency: triage.urgency,
      call_911_recommended: triage.call_911_recommended,
      circle_alerted: circle.length,
      guardians_sent: 0,
    };
  }

  const sent = await sendGuardians(
    db,
    incident,
    requesterName,
    circle.map((c) => c.user_id),
    circle.map((c) => c.display_name),
  );
  await recordTriage(db, incident.id, sent.triage, sent.source);

  return {
    status: "dispatched" as const,
    triage_source: sent.source,
    urgency: sent.triage.urgency,
    call_911_recommended: sent.triage.call_911_recommended,
    circle_alerted: circle.length,
    guardians_sent: sent.count,
  };
}

/**
 * Alerts nearby guardians about a missed check-in that is still unanswered
 * after the grace period. The check-ins function calls this for incidents it
 * claimed with claim_due_guardian_alerts().
 */
export async function dispatchGuardians(db: SupabaseClient, incidentId: string): Promise<number> {
  const { data: incident } = await db.from("incidents").select("*").eq("id", incidentId).eq("status", "active")
    .maybeSingle<Incident>();
  if (!incident) return 0;
  const { data: requester } = await db.from("profiles").select("display_name").eq("id", incident.requester_id)
    .single();
  const { data: alreadyAlerted } = await db
    .from("incident_responders")
    .select("user_id, profiles:user_id(display_name)")
    .eq("incident_id", incidentId);
  const rows = alreadyAlerted ?? [];
  const sent = await sendGuardians(
    db,
    incident,
    requester?.display_name || "Someone",
    rows.map((r) => r.user_id as string),
    rows.map((r) => (r.profiles as unknown as { display_name: string } | null)?.display_name ?? ""),
  );
  if (sent.count) {
    await db.from("incident_events").insert({
      incident_id: incidentId,
      kind: "triaged",
      body: `No answer yet, so ${
        sent.count === 1 ? "a nearby hero was" : `${sent.count} nearby heroes were`
      } asked to check.`,
    });
  }
  return sent.count;
}

// Finds nearby guardians, asks Claude to give each one a job, and alerts them.
async function sendGuardians(
  db: SupabaseClient,
  incident: Incident,
  requesterName: string,
  excludeIds: string[],
  circleNames: string[],
): Promise<{ triage: Triage; source: "ai" | "fallback"; count: number }> {
  const deepLink = { incident_id: incident.id, url: `hereo://incident/${incident.id}` };
  let candidates: GuardianCandidate[] = [];
  if (incident.lat != null && incident.lng != null) {
    const { data, error } = await db.rpc("nearby_guardians", {
      p_lat: incident.lat,
      p_lng: incident.lng,
      p_radius_m: SEARCH_RADIUS_M,
      p_her_o_only: incident.mode === "her_o",
      p_exclude: [incident.requester_id, ...excludeIds],
      p_limit: CANDIDATE_LIMIT,
    });
    if (error) console.error("nearby_guardians failed", error);
    candidates = (data ?? []) as GuardianCandidate[];
  }

  let aiTriage: Triage | null = null;
  if (metaKey()) {
    // Muse Dispatcher (Meta hackathon): a Muse Spark agent with guarded tools.
    const out = await runAgent({
      phase: "dispatch",
      incident,
      requesterName,
      candidates,
      responding: circleNames.map((n) => ({ first_name: firstName(n), kind: "circle", status: "notified", job: null })),
      transcripts: [],
      scenes: [],
      messages: [],
      fallbackBrief: fallbackTriage(incident, candidates, requesterName).summary,
      budgetMs: AGENT_BUDGET_MS,
    });
    await recordDecisions(db, incident.id, "dispatch", out);
    await postNotes(db, incident.id, out);
    await db.from("incidents").update({ agent_model: out.model }).eq("id", incident.id);
    if (out.modelAnswered) aiTriage = toTriage(out);
  } else {
    const raw = await askJson({
      system: TRIAGE_SYSTEM,
      user: buildTriagePrompt(incident, candidates, circleNames),
      schema: TRIAGE_SCHEMA,
      timeoutMs: TRIAGE_TIMEOUT_MS,
    });
    aiTriage = finalizeTriage(raw, incident, candidates, requesterName);
  }
  const triage: Triage = aiTriage ?? fallbackTriage(incident, candidates, requesterName);

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
    // Each guardian gets their own job in the notification. An unanswered
    // check-in is labelled as such, never as a confirmed emergency.
    const missed = incident.trigger === "check_in_missed";
    await Promise.all(chosen.map((g) =>
      sendPush(
        buildPushMessages(
          [g.push_token],
          missed
            ? `Unanswered check-in ${Math.round(g.distance_m)} m away`
            : `Someone ${Math.round(g.distance_m)} m away needs help`,
          missed ? `Not a confirmed emergency: someone nearby hasn't checked in. ${g.role}` : g.role,
          deepLink,
        ),
        db,
      )
    ));
  }
  return { triage, source: aiTriage ? "ai" : "fallback", count: chosen.length };
}

async function recordTriage(db: SupabaseClient, incidentId: string, triage: Triage, source: "ai" | "fallback") {
  await db.from("incidents").update({
    urgency: triage.urgency,
    category: triage.category,
    call_911_recommended: triage.call_911_recommended,
    brief: triage.summary,
    brief_at: new Date().toISOString(),
    triage_source: source,
  }).eq("id", incidentId);
  await db.from("incident_events").insert({ incident_id: incidentId, kind: "triaged", body: triage.summary });
}
