// Refreshes an incident's shared brief after something changes (a message, a
// guardian on the way or on scene). Any participant can call it; calls within
// 10 seconds of the last refresh are skipped.

import { BRIEF_SCHEMA, BRIEF_SYSTEM, buildBriefPrompt, composeBrief } from "../_shared/brief.ts";
import { askJson } from "../_shared/claude.ts";
import { adminClient, callerFrom, corsHeaders, json, readIncidentId } from "../_shared/http.ts";
import { describesImmediateDanger } from "../_shared/safety.ts";
import type { EventView, Incident, ResponderView } from "../_shared/types.ts";

const MIN_INTERVAL_MS = 10_000;
const BRIEF_TIMEOUT_MS = 8000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);
  const incidentId = await readIncidentId(req);
  if (!incidentId) return json({ error: "incident_id required" }, 400);

  const db = adminClient();
  const { data: incident } = await db.from("incidents").select("*").eq("id", incidentId).maybeSingle<
    Incident & { call_911_recommended: boolean }
  >();
  if (!incident || incident.status !== "active") return json({ status: "closed" });

  const { data: responderRows } = await db
    .from("incident_responders")
    .select("user_id, kind, status, distance_m, profiles:user_id(display_name)")
    .eq("incident_id", incidentId);
  const responders: ResponderView[] = (responderRows ?? []).map((r) => ({
    user_id: r.user_id,
    kind: r.kind,
    status: r.status,
    distance_m: r.distance_m,
    display_name: (r.profiles as unknown as { display_name: string } | null)?.display_name ?? "",
  }));
  const isParticipant = incident.requester_id === caller.id || responders.some((r) => r.user_id === caller.id);
  if (!isParticipant) return json({ error: "not part of this incident" }, 403);

  if (incident.brief_at && Date.now() - Date.parse(incident.brief_at) < MIN_INTERVAL_MS) {
    return json({ status: "fresh" });
  }
  // Claim the refresh window before the slow call so concurrent callers skip.
  await db.from("incidents").update({ brief_at: new Date().toISOString() }).eq("id", incidentId);

  const { data: requester } = await db.from("profiles").select("display_name").eq("id", incident.requester_id).single();
  const requesterName = requester?.display_name || "Someone";
  const { data: eventRows } = await db
    .from("incident_events")
    .select("kind, body, created_at, profiles:actor_id(display_name)")
    .eq("incident_id", incidentId)
    .order("id", { ascending: false })
    .limit(30);
  const events: EventView[] = (eventRows ?? []).reverse().map((e) => ({
    kind: e.kind,
    body: e.body,
    created_at: e.created_at,
    actor_name: (e.profiles as unknown as { display_name: string } | null)?.display_name ?? null,
  }));

  const raw = await askJson({
    system: BRIEF_SYSTEM,
    user: buildBriefPrompt(incident, requesterName, responders, events),
    schema: BRIEF_SCHEMA,
    timeoutMs: BRIEF_TIMEOUT_MS,
  }) as { brief?: unknown } | null;
  const messages = events.filter((e) => e.kind === "message").map((e) => e.body ?? "").join(" ");
  const danger = incident.call_911_recommended || describesImmediateDanger(messages);
  let brief = typeof raw?.brief === "string" && raw.brief.trim() ? raw.brief.trim().slice(0, 400) : null;
  if (brief && danger && !/911/.test(brief)) brief += " If anyone is in danger, call 911 now.";
  brief ??= composeBrief(requesterName, responders, danger);

  await db.from("incidents").update({
    brief,
    brief_at: new Date().toISOString(),
    call_911_recommended: danger,
  }).eq("id", incidentId);

  return json({ status: "updated", source: raw ? "ai" : "fallback" });
});
