// Expo push notifications. The same request works for iOS and Android.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
  priority: "high";
  channelId: string;
  interruptionLevel?: "active" | "time-sensitive" | "critical";
}

export interface PushOptions {
  /** A sound bundled with the app (iOS), or "default". */
  sound?: string;
  /** Android channel; its sound is set when the app creates it. */
  channelId?: string;
  interruptionLevel?: PushMessage["interruptionLevel"];
}

export function buildPushMessages(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data: Record<string, unknown>,
  options: PushOptions = {},
): PushMessage[] {
  const unique = [...new Set(tokens.filter((t): t is string => !!t && TOKEN_RE.test(t)))];
  return unique.map((to) => ({
    to,
    title,
    body,
    data,
    sound: options.sound ?? "default",
    priority: "high",
    channelId: options.channelId ?? "help-requests",
    ...(options.interruptionLevel ? { interruptionLevel: options.interruptionLevel } : {}),
  }));
}

interface PushTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Expo answers 200 even when it rejects single messages (a stale token, a bad
 * credential), with one ticket per message. Counts the accepted ones and logs the rest.
 */
function countAccepted(chunk: PushMessage[], body: { data?: PushTicket[] } | null): number {
  const tickets = body?.data;
  if (!Array.isArray(tickets)) {
    console.error("push sent but no tickets came back", JSON.stringify(body));
    return chunk.length;
  }
  let accepted = 0;
  tickets.forEach((ticket, i) => {
    if (ticket.status === "ok") accepted++;
    else console.error("push rejected", ticket.details?.error ?? "", ticket.message ?? "", chunk[i]?.to.slice(-8) ?? "");
  });
  return accepted;
}

/** Sends in chunks of 100 (Expo's limit). Failures are logged, never thrown: a push outage must not stop dispatch. */
export async function sendPush(messages: PushMessage[], fetchImpl: typeof fetch = fetch): Promise<number> {
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error("push failed", res.status, await res.text());
        continue;
      }
      sent += countAccepted(chunk, await res.json().catch(() => null));
    } catch (err) {
      console.error("push error", err);
    }
  }
  return sent;
}
