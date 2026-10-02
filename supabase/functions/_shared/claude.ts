import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";

/**
 * Asks Claude for a JSON object matching `schema`. Returns null on timeout,
 * refusal, or any API error, so callers always have a deterministic fallback
 * and an outage never blocks a person getting help.
 */
export async function askJson(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  timeoutMs: number;
}): Promise<unknown | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set; using fallback");
    return null;
  }
  const client = new Anthropic({ apiKey, timeout: opts.timeoutMs, maxRetries: 0 });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      // Low effort keeps this to a few seconds; the task is short and bounded.
      output_config: { effort: "low", format: { type: "json_schema", schema: opts.schema } },
      // If a safety classifier declines (an incident note can describe
      // violence), re-run on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.warn("claude stopped:", response.stop_reason, response.stop_details);
      return null;
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.error("claude api error", err.status, err.message);
    else console.error("claude call failed", err);
    return null;
  }
}
