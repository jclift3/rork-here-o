// Called by the app right after it creates an incident. The work lives in
// _shared/dispatch.ts so missed check-ins are dispatched the same way.

import { dispatchIncident } from "../_shared/dispatch.ts";
import { adminClient, callerFrom, corsHeaders, json, readIncidentId } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);
  const incidentId = await readIncidentId(req);
  if (!incidentId) return json({ error: "incident_id required" }, 400);

  try {
    // Only the incident's own requester can dispatch it.
    return json(await dispatchIncident(adminClient(), incidentId, caller.id));
  } catch (err) {
    console.error("dispatch failed", err);
    return json({ error: err instanceof Error ? err.message : "dispatch failed" }, 500);
  }
});
