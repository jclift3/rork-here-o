// The HereO ring. The app calls this after the 3 second cancel window
// ({ action: "send" }) and again when her request ends ({ action: "ended" }).
// The work lives in _shared/ring.ts.

import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { ringEnded, sendRing } from "../_shared/ring.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);
  let body: { incident_id?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "json body required" }, 400);
  }
  const incidentId = typeof body.incident_id === "string" && /^[0-9a-f-]{36}$/i.test(body.incident_id)
    ? body.incident_id
    : null;
  if (!incidentId) return json({ error: "incident_id required" }, 400);

  try {
    // Both actions only touch the caller's own request.
    if (body.action === "send") return json(await sendRing(adminClient(), incidentId, caller.id));
    if (body.action === "ended") return json(await ringEnded(adminClient(), incidentId, caller.id));
    return json({ error: "action must be send or ended" }, 400);
  } catch (err) {
    console.error("ring failed", err);
    return json({ error: err instanceof Error ? err.message : "ring failed" }, 500);
  }
});
