// Latency probe for the Meta Model API (Meta hackathon, Nov 2026).
// Same Vault-secret auth as check-ins and muse-eval; called only from SQL.

const BASE = Deno.env.get("META_API_BASE") ?? "https://api.meta.ai/v1";
const MODEL = Deno.env.get("MUSE_SPARK_MODEL") ?? "muse-spark-1.3";

async function vaultSecret(): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/rpc/check_ins_secret`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return res.ok ? await res.json() : null;
}

const TOOL = {
  type: "function",
  function: {
    name: "set_assessment",
    description: "Record how urgent this is.",
    parameters: {
      type: "object",
      properties: { urgency: { type: "string", enum: ["low", "medium", "high", "critical"] } },
      required: ["urgency"],
    },
  },
};

async function probe(label: string, extra: Record<string, unknown>, timeoutMs: number) {
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${Deno.env.get("META_API_KEY") ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Someone is following me home. Assess urgency." }],
        max_completion_tokens: 300,
        ...extra,
      }),
    });
    const headersMs = Date.now() - started;
    const text = await res.text();
    return {
      label,
      status: res.status,
      headers_ms: headersMs,
      total_ms: Date.now() - started,
      body: text.slice(0, 600),
    };
  } catch (err) {
    return { label, error: err instanceof Error ? err.message : String(err), total_ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const secret = await vaultSecret();
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  const t = 60_000;
  const results = await Promise.all([
    probe("minimal", { reasoning_effort: "minimal" }, t),
    probe("low", { reasoning_effort: "low" }, t),
    probe("low+tools", { reasoning_effort: "low", tools: [TOOL], parallel_tool_calls: true }, t),
    probe("default", {}, t),
  ]);
  return new Response(JSON.stringify({ base: BASE, model: MODEL, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
