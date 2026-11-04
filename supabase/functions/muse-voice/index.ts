// Muse Voice Transcribe for help requests (Meta hackathon, Nov 2026).
// The requester records a few seconds of speech; we transcribe it with
// speaker turns, put it on the incident timeline, and let the Muse Dispatcher
// reassess. The audio itself is never stored.

import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { formatTranscript, transcribeWav } from "../_shared/muse/client.ts";
import { reassessIncident } from "../_shared/muse/respond.ts";
import { fromBase64 } from "../_shared/muse/shield.ts";

const MAX_BYTES = 4_000_000; // ~2 minutes of 16 kHz mono PCM

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);

  const body = await req.json().catch(() => null);
  const incidentId = typeof body?.incident_id === "string" && /^[0-9a-f-]{36}$/i.test(body.incident_id)
    ? body.incident_id
    : null;
  if (!incidentId || typeof body?.audio_base64 !== "string") {
    return json({ error: "incident_id and audio_base64 required" }, 400);
  }

  const db = adminClient();
  const { data: incident } = await db.from("incidents").select("id, requester_id, status").eq("id", incidentId)
    .maybeSingle();
  if (!incident || incident.requester_id !== caller.id) return json({ error: "not your help request" }, 403);
  if (incident.status !== "active") return json({ status: "closed" });

  const wav = fromBase64(body.audio_base64);
  if (wav.length > MAX_BYTES) return json({ error: "recording too long" }, 413);

  const t = await transcribeWav(wav);
  if (!t || !(t.text || t.turns.length)) {
    return json({ status: "no_transcript" });
  }
  const text = formatTranscript(t).slice(0, 990);
  await db.from("incident_events").insert({ incident_id: incidentId, actor_id: caller.id, kind: "voice", body: text });

  const result = await reassessIncident(db, incidentId);
  return json({ status: "ok", transcript: text, speakers: new Set(t.turns.map((x) => x.speaker)).size, result });
});
