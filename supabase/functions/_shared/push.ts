// Expo push notifications. The same request works for iOS and Android.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  priority: "high";
  channelId: string;
}

export function buildPushMessages(
  tokens: (string | null | undefined)[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): PushMessage[] {
  const unique = [...new Set(tokens.filter((t): t is string => !!t && TOKEN_RE.test(t)))];
  return unique.map((to) => ({
    to,
    title,
    body,
    data,
    sound: "default",
    priority: "high",
    channelId: "help-requests",
  }));
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
      if (res.ok) sent += chunk.length;
      else console.error("push failed", res.status, await res.text());
    } catch (err) {
      console.error("push error", err);
    }
  }
  return sent;
}
