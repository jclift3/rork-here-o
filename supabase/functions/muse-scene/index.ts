// Scene photo with a privacy shield (Meta hackathon, Nov 2026).
//
// 1. SAM 3.1 finds every face and number plate; we pixelate them.
//    If SAM is unavailable, the photo is NOT shared (fail closed).
// 2. Only the blurred photo is stored, in the private 'scenes' bucket that
//    only the incident's participants can read.
// 3. Muse Spark looks at the blurred photo and describes the PLACE (shop
//    names, signs, junctions) so heroes can find the person. It never
//    describes people.
// 4. The Muse Dispatcher reassesses with the new description.

import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";
import { samFind, sparkChat } from "../_shared/muse/client.ts";
import { reassessIncident } from "../_shared/muse/respond.ts";
import { decodeAndFit, fromBase64, pixelate, toBase64 } from "../_shared/muse/shield.ts";

const MAX_BYTES = 8_000_000;
const PHRASES = ["face", "license plate"];

const SCENE_SYSTEM =
  `You help volunteer responders find a person who asked for help. You see one photo they took of where they are. Faces and number plates have been blurred on purpose.

Describe the PLACE in at most two short sentences: shop names, signs, street names, bus stops, junctions, buildings, lighting, whether it is busy or quiet. Say which way the camera faces if it is clear. Never describe people's appearance, clothing, ethnicity or identity, and never guess who anyone is. If you can't tell where it is, say what is visible that would help someone recognise the spot.`;

const SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["place", "landmarks"],
  properties: {
    place: { type: "string" },
    landmarks: { type: "array", items: { type: "string" } },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);

  const body = await req.json().catch(() => null);
  const incidentId = typeof body?.incident_id === "string" && /^[0-9a-f-]{36}$/i.test(body.incident_id)
    ? body.incident_id
    : null;
  if (!incidentId || typeof body?.image_base64 !== "string") {
    return json({ error: "incident_id and image_base64 required" }, 400);
  }
  const db = adminClient();
  const { data: incident } = await db.from("incidents").select("id, requester_id, status").eq("id", incidentId)
    .maybeSingle();
  if (!incident || incident.requester_id !== caller.id) return json({ error: "not your help request" }, 403);
  if (incident.status !== "active") return json({ status: "closed" });

  const raw = fromBase64(body.image_base64);
  if (raw.length > MAX_BYTES) return json({ error: "photo too large" }, 413);

  const started = Date.now();
  let img;
  try {
    img = await decodeAndFit(raw);
  } catch {
    return json({ error: "could not read that photo" }, 400);
  }
  const fitted = await img.encodeJPEG(85);
  const dataUrl = `data:image/jpeg;base64,${toBase64(fitted)}`;

  const found = await Promise.all(PHRASES.map((p) => samFind(dataUrl, p)));
  if (found.some((f) => f === null)) {
    await db.from("incident_events").insert({
      incident_id: incidentId,
      kind: "agent",
      body: "Your photo was not shared: the privacy blur was unavailable, so HereO kept it off the record.",
    });
    return json({ status: "not_shared", reason: "segmentation unavailable" });
  }
  const boxes = found.flat() as NonNullable<(typeof found)[number]>;
  const blurred = pixelate(img, boxes);
  const out = await img.encodeJPEG(80);
  const samMs = Date.now() - started;

  const path = `${incidentId}/${Date.now()}.jpg`;
  const { error: upErr } = await db.storage.from("scenes").upload(path, out, { contentType: "image/jpeg" });
  if (upErr) {
    console.error("scene upload failed", upErr);
    return json({ error: "could not save the photo" }, 500);
  }

  // Muse Spark reads the BLURRED photo only.
  const vision = await sparkChat({
    timeoutMs: 10_000,
    reasoning: "low",
    maxTokens: 400,
    json: { name: "scene", schema: SCENE_SCHEMA },
    messages: [
      { role: "system", content: SCENE_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Where is this?" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(out)}` } },
        ],
      },
    ],
  });
  let place = "";
  try {
    const parsed = JSON.parse(vision?.message.content ?? "{}");
    place = typeof parsed.place === "string" ? parsed.place.trim() : "";
    const marks = Array.isArray(parsed.landmarks) ? parsed.landmarks.filter((m: unknown) => typeof m === "string") : [];
    if (marks.length) place += ` Landmarks: ${marks.slice(0, 4).join(", ")}.`;
  } catch {
    place = (vision?.message.content ?? "").trim();
  }
  const description = (place || "Photo shared (faces and plates blurred).").slice(0, 600);

  await db.from("incidents").update({ scene_path: path }).eq("id", incidentId);
  await db.from("incident_events").insert({
    incident_id: incidentId,
    actor_id: caller.id,
    kind: "scene",
    body: `${description} [${blurred} blurred]`,
  });

  const result = await reassessIncident(db, incidentId);
  return json({ status: "ok", path, blurred, sam_ms: samMs, description, result });
});
