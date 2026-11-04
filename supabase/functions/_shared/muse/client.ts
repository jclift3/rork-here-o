// Meta Model API client for HereO's Muse Dispatcher.
// Built during the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026).
//
// Three Meta models, one key:
// * Muse Spark 1.3 (chat completions with tools and image input) runs the
//   response agent and reads scene photos.
// * Muse Voice Transcribe turns a few seconds of panicked speech into text,
//   with speaker turns, so someone who can't type can still say what's wrong.
// * SAM 3.1 finds faces and number plates so they can be blurred before any
//   hero sees a photo.
//
// Every call has a hard timeout and returns null on failure: a model outage
// must never stop help from going out.

export const META_BASE = Deno.env.get("META_API_BASE") ?? "https://api.meta.ai/v1";
export const SPARK_MODEL = Deno.env.get("MUSE_SPARK_MODEL") ?? "muse-spark-1.3";
export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
export const SAM_MODEL = "sam-3.1";

export function metaKey(): string | null {
  return Deno.env.get("META_API_KEY") ?? Deno.env.get("MODEL_API_KEY") ?? null;
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await run(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Muse Spark: chat completions with tools
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatResult {
  message: { content: string | null; tool_calls?: ToolCall[] };
  finish_reason: string;
}

export async function sparkChat(opts: {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  timeoutMs: number;
  reasoning?: "minimal" | "low" | "medium" | "high";
  maxTokens?: number;
  json?: { name: string; schema: Record<string, unknown> };
}): Promise<ChatResult | null> {
  const key = metaKey();
  if (!key) return null;
  try {
    return await withTimeout(opts.timeoutMs, async (signal) => {
      const res = await fetch(`${META_BASE}/chat/completions`, {
        method: "POST",
        signal,
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: SPARK_MODEL,
          messages: opts.messages,
          ...(opts.tools?.length ? { tools: opts.tools, parallel_tool_calls: true } : {}),
          reasoning_effort: opts.reasoning ?? "low",
          max_completion_tokens: opts.maxTokens ?? 1500,
          ...(opts.json
            ? {
              response_format: { type: "json_schema", json_schema: { name: opts.json.name, schema: opts.json.schema } },
            }
            : {}),
        }),
      });
      if (!res.ok) {
        console.error("muse spark error", res.status, (await res.text()).slice(0, 500));
        return null;
      }
      const body = await res.json();
      const choice = body?.choices?.[0];
      if (!choice?.message) return null;
      return { message: choice.message, finish_reason: choice.finish_reason ?? "stop" };
    });
  } catch (err) {
    console.error("muse spark call failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Muse Voice Transcribe
// ---------------------------------------------------------------------------

export interface Transcript {
  text: string;
  durationMs: number;
  /** Speaker-labelled turns, when the model could separate voices. */
  turns: { speaker: string | null; text: string; startMs: number }[];
}

export async function transcribeWav(wav: Uint8Array<ArrayBuffer>, timeoutMs = 12_000): Promise<Transcript | null> {
  const key = metaKey();
  if (!key) return null;
  try {
    return await withTimeout(timeoutMs, async (signal) => {
      const form = new FormData();
      form.append(
        "request",
        new Blob([JSON.stringify({ mode: "DIARIZATION", model: TRANSCRIBE_MODEL, audioEncoding: "WAV" })], {
          type: "application/json",
        }),
      );
      form.append("audio", new Blob([wav as Uint8Array<ArrayBuffer>], { type: "audio/wav" }), "alert.wav");
      const res = await fetch(`${META_BASE}/asr/transcribe`, {
        method: "POST",
        signal,
        headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" },
        body: form,
      });
      if (!res.ok) {
        console.error("muse transcribe error", res.status, (await res.text()).slice(0, 500));
        return null;
      }
      const body = await res.json();
      const turns = Array.isArray(body?.turns)
        ? body.turns.map((t: Record<string, unknown>) => ({
          speaker: typeof t.speaker === "string" || typeof t.speaker === "number" ? String(t.speaker) : null,
          text: String(t.transcript ?? "").trim(),
          startMs: Number(t.startMs ?? 0),
        })).filter((t: { text: string }) => t.text)
        : [];
      return { text: String(body?.transcript ?? "").trim(), durationMs: Number(body?.audioDurationMs ?? 0), turns };
    });
  } catch (err) {
    console.error("muse transcribe failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// SAM 3.1 segmentation (boxes only; we blur whole boxes)
// ---------------------------------------------------------------------------

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  confidence: number | null;
}

/** Parses SAM's text output into boxes. Masks are ignored. Exported for tests. */
export function parseSamBoxes(text: string): Box[] {
  const boxes: Box[] = [];
  const re = /<\|box;([^|]*)\|>/g;
  for (const m of text.matchAll(re)) {
    const fields: Record<string, number> = {};
    for (const part of m[1].split(";")) {
      const [k, v] = part.split("=");
      if (k && v !== undefined && !Number.isNaN(Number(v))) fields[k.trim()] = Number(v);
    }
    if (["x1", "y1", "x2", "y2", "w", "h"].every((k) => k in fields)) {
      boxes.push({
        x1: fields.x1,
        y1: fields.y1,
        x2: fields.x2,
        y2: fields.y2,
        w: fields.w,
        h: fields.h,
        confidence: "c" in fields ? fields.c : null,
      });
    }
  }
  return boxes;
}

/** Finds every match for a short noun phrase ("face", "license plate"). */
export async function samFind(imageDataUrl: string, phrase: string, timeoutMs = 10_000): Promise<Box[] | null> {
  const key = metaKey();
  if (!key) return null;
  try {
    return await withTimeout(timeoutMs, async (signal) => {
      const res = await fetch(`${META_BASE}/responses`, {
        method: "POST",
        signal,
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          model: SAM_MODEL,
          stream: true,
          metadata: { include_confidence: "true", mask_encoding: "one_bit" },
          input: [{
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: phrase }, { type: "input_image", image_url: imageDataUrl }],
          }],
        }),
      });
      if (!res.ok || !res.body) {
        console.error("sam error", res.status, res.ok ? "" : (await res.text()).slice(0, 500));
        return null;
      }
      // Server-sent events: collect output_text deltas until completed.
      let text = "";
      let buffer = "";
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
          if (!data || data === "[DONE]") continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
          } catch { /* keep-alive or partial line */ }
        }
      }
      return parseSamBoxes(text);
    });
  } catch (err) {
    console.error("sam call failed", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Formats diarized turns as "Voice 1: ... / Voice 2: ...", or plain text for one speaker. */
export function formatTranscript(t: { text: string; turns: { speaker: string | null; text: string }[] }): string {
  const speakers = new Set(t.turns.map((x) => x.speaker).filter(Boolean));
  if (speakers.size < 2) return t.text || t.turns.map((x) => x.text).join(" ");
  const order = [...speakers];
  return t.turns.map((x) => `Voice ${order.indexOf(x.speaker) + 1}: ${x.text}`).join(" / ");
}
