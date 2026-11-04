// Glue between the Muse Dispatcher agent and the database.
// Built during the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026).

import type { SupabaseClient } from "@supabase/supabase-js";
import { composeBrief } from "../brief.ts";
import { buildPushMessages, sendPush } from "../push.ts";
import { firstName } from "../triage.ts";
import type { GuardianCandidate, Incident, ResponderView, Triage, Urgency } from "../types.ts";
import { type AgentOutput, runAgent } from "./agent.ts";

const SEARCH_RADIUS_M = 1500;

/** Saves the agent's decision log so participants can see why things happened. */
export async function recordDecisions(
  db: SupabaseClient,
  incidentId: string,
  phase: "dispatch" | "reassess",
  out: AgentOutput,
): Promise<void> {
  if (!out.decisions.length) return;
  const runId = crypto.randomUUID();
  const { error } = await db.from("agent_decisions").insert(
    out.decisions.map((d) => ({
      incident_id: incidentId,
      run_id: runId,
      phase,
      step: d.step,
      tool: d.tool,
      args: d.args,
      verdict: d.verdict,
      reason: d.reason,
      model: out.model,
      latency_ms: out.latencyMs,
    })),
  );
  if (error) console.error("agent_decisions insert failed", error);
}

/** Converts a dispatch-phase run into the Triage the existing dispatcher uses. */
export function toTriage(out: AgentOutput): Triage {
  return {
    urgency: out.state.urgency,
    category: out.state.category,
    call_911_recommended: out.state.emergencyRecommended,
    summary: out.state.brief ?? "",
    guardian_roles: out.state.assignments.map((a) => ({ user_id: a.user_id, role: a.job })),
  };
}

export async function postNotes(db: SupabaseClient, incidentId: string, out: AgentOutput) {
  if (!out.state.notes.length) return;
  await db.from("incident_events").insert(
    out.state.notes.map((n) => ({
      incident_id: incidentId,
      kind: "agent",
      body: (n.audience === "responders" ? "For heroes: " : n.audience === "requester" ? "For you: " : "") + n.text,
    })),
  );
}

type IncidentRow = Incident & {
  urgency: Urgency;
  category: string | null;
  call_911_recommended: boolean;
  brief: string | null;
};

/**
 * Re-runs the agent on an active incident after new information arrived and
 * applies what the guard allowed. Returns null when the incident is closed.
 */
export async function reassessIncident(db: SupabaseClient, incidentId: string, budgetMs = 12_000) {
  const { data: incident } = await db.from("incidents").select("*").eq("id", incidentId).maybeSingle<IncidentRow>();
  if (!incident || incident.status !== "active") return null;

  const { data: requester } = await db.from("profiles").select("display_name").eq("id", incident.requester_id)
    .single();
  const requesterName = requester?.display_name || "Someone";

  const { data: responderRows } = await db
    .from("incident_responders")
    .select("user_id, kind, status, role, distance_m, profiles:user_id(display_name)")
    .eq("incident_id", incidentId);
  const responders = (responderRows ?? []).map((r) => ({
    user_id: r.user_id as string,
    kind: r.kind as "circle" | "guardian",
    status: r.status as string,
    role: r.role as string | null,
    distance_m: r.distance_m as number | null,
    display_name: (r.profiles as unknown as { display_name: string } | null)?.display_name ?? "",
  }));

  const { data: eventRows } = await db
    .from("incident_events")
    .select("kind, body, profiles:actor_id(display_name)")
    .eq("incident_id", incidentId)
    .in("kind", ["message", "voice", "scene"])
    .order("id", { ascending: true })
    .limit(60);
  const events = (eventRows ?? []).map((e) => ({
    kind: e.kind as string,
    body: (e.body as string | null) ?? "",
    actor: (e.profiles as unknown as { display_name: string } | null)?.display_name ?? null,
  }));

  let candidates: GuardianCandidate[] = [];
  const guardiansOn = responders.filter((r) => r.kind === "guardian").length;
  if (incident.lat != null && incident.lng != null && guardiansOn < 3) {
    const { data } = await db.rpc("nearby_guardians", {
      p_lat: incident.lat,
      p_lng: incident.lng,
      p_radius_m: SEARCH_RADIUS_M,
      p_her_o_only: incident.mode === "her_o",
      p_exclude: [incident.requester_id, ...responders.map((r) => r.user_id)],
      p_limit: 6,
    });
    candidates = (data ?? []) as GuardianCandidate[];
  }

  const views: ResponderView[] = responders.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    kind: r.kind,
    status: r.status as ResponderView["status"],
    distance_m: r.distance_m,
  }));

  const out = await runAgent({
    phase: "reassess",
    incident,
    requesterName,
    candidates,
    responding: responders.map((r) => ({
      first_name: firstName(r.display_name),
      kind: r.kind,
      status: r.status,
      job: r.role,
    })),
    current: {
      urgency: incident.urgency,
      category: incident.category,
      emergencyRecommended: incident.call_911_recommended,
      brief: incident.brief,
    },
    transcripts: events.filter((e) => e.kind === "voice").map((e) => e.body),
    scenes: events.filter((e) => e.kind === "scene").map((e) => e.body),
    messages: events.filter((e) => e.kind === "message").map((e) => `${firstName(e.actor ?? "Someone")}: ${e.body}`),
    fallbackBrief: incident.brief ?? composeBrief(requesterName, views, incident.call_911_recommended),
    budgetMs,
  });

  // New heroes, each with their own job.
  const byId = new Map(candidates.map((c) => [c.user_id, c]));
  const fresh = out.state.assignments.flatMap((a) => {
    const c = byId.get(a.user_id);
    return c ? [{ ...c, job: a.job }] : [];
  });
  if (fresh.length) {
    await db.from("incident_responders").upsert(
      fresh.map((g) => ({
        incident_id: incidentId,
        user_id: g.user_id,
        kind: "guardian",
        role: g.job,
        distance_m: Math.round(g.distance_m),
      })),
      { onConflict: "incident_id,user_id", ignoreDuplicates: true },
    );
    const deepLink = { incident_id: incidentId, url: `hereo://incident/${incidentId}` };
    await Promise.all(fresh.map((g) =>
      sendPush(
        buildPushMessages([g.push_token], `Someone ${Math.round(g.distance_m)} m away needs help`, g.job, deepLink),
        db,
      )
    ));
  }

  const escalated = out.state.emergencyRecommended && !incident.call_911_recommended;
  await db.from("incidents").update({
    urgency: out.state.urgency,
    category: out.state.category,
    call_911_recommended: out.state.emergencyRecommended,
    brief: out.state.brief,
    brief_at: new Date().toISOString(),
    agent_model: out.model,
  }).eq("id", incidentId);

  await postNotes(db, incidentId, out);
  if (escalated) {
    await db.from("incident_events").insert({
      incident_id: incidentId,
      kind: "agent",
      body: `HereO recommends calling ${out.emergencyNumber}: ${out.state.emergencyReason ?? "danger described"}.`,
    });
    // Tell the circle and heroes already on it, once.
    const { data: tokens } = await db
      .from("private_profiles")
      .select("push_token")
      .in("id", responders.map((r) => r.user_id));
    await sendPush(
      buildPushMessages(
        (tokens ?? []).map((t) => t.push_token as string | null),
        `Call ${out.emergencyNumber} for ${firstName(requesterName)}`,
        out.state.emergencyReason
          ? `HereO thinks this is an emergency: ${out.state.emergencyReason}.`
          : "HereO thinks this is an emergency.",
        { incident_id: incidentId, url: `hereo://incident/${incidentId}` },
      ),
      db,
    );
  }
  await recordDecisions(db, incidentId, "reassess", out);
  return { model: out.model, decisions: out.decisions.length, new_heroes: fresh.length, escalated };
}
