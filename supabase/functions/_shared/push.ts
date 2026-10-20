// Expo push notifications. The same request works for iOS and Android.
import type { SupabaseClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
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
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Sends in chunks of 100 (Expo's limit) and returns how many Expo accepted.
 * Failures are logged, never thrown: a push outage must not stop dispatch.
 * With a db client, each push is also saved to notifications for the person
 * whose token it went to.
 */
export async function sendPush(
  messages: PushMessage[],
  db: SupabaseClient | null = null,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    let tickets: PushTicket[] = [];
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        tickets = Array.isArray(json?.data) ? json.data : [];
      } else console.error("push failed", res.status, await res.text());
    } catch (err) {
      console.error("push error", err);
    }
    chunk.forEach((m, j) => {
      const t = tickets[j];
      if (t?.status === "ok") sent++;
      else if (t) console.error("push rejected", m.to, t.details?.error ?? t.message);
    });
    if (db) await recordPushes(db, chunk, tickets);
  }
  return sent;
}

function ticketError(t: PushTicket | undefined): string | null {
  if (!t) return "not sent";
  if (t.status === "ok") return null;
  return t.details?.error ?? t.message ?? "rejected";
}

async function recordPushes(db: SupabaseClient, chunk: PushMessage[], tickets: PushTicket[]) {
  try {
    const { data: owners, error } = await db
      .from("private_profiles")
      .select("id, push_token")
      .in("push_token", chunk.map((m) => m.to));
    if (error) throw error;
    const rows = chunk.flatMap((m, j) =>
      (owners ?? []).filter((o) => o.push_token === m.to).map((o) => ({
        user_id: o.id,
        title: m.title,
        body: m.body,
        data: m.data,
        ticket_id: tickets[j]?.id ?? null,
        accepted: tickets[j]?.status === "ok",
        error: ticketError(tickets[j]),
      }))
    );
    if (rows.length) {
      const { error: insertError } = await db.from("notifications").insert(rows);
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.error("could not record pushes", err);
  }
}

/**
 * Asks Expo whether Apple or Google took the pushes sent in the last day and
 * saves the answer. Receipts appear within about 15 minutes and expire after a day.
 */
export async function checkPushReceipts(db: SupabaseClient, fetchImpl: typeof fetch = fetch): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const settled = new Date(Date.now() - 15_000).toISOString();
  const { data: pending, error } = await db
    .from("notifications")
    .select("ticket_id")
    .not("ticket_id", "is", null)
    .is("delivered", null)
    .gt("created_at", since)
    .lt("created_at", settled)
    .limit(1000);
  if (error) {
    console.error("could not load push tickets", error);
    return 0;
  }
  const ids = [...new Set((pending ?? []).map((r) => r.ticket_id as string))];
  if (!ids.length) return 0;

  let receipts: Record<string, PushTicket> = {};
  try {
    const res = await fetchImpl(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      console.error("push receipts failed", res.status, await res.text());
      return 0;
    }
    receipts = (await res.json())?.data ?? {};
  } catch (err) {
    console.error("push receipts error", err);
    return 0;
  }

  const ok = ids.filter((id) => receipts[id]?.status === "ok");
  if (ok.length) await db.from("notifications").update({ delivered: true }).in("ticket_id", ok);
  const failed = ids.filter((id) => receipts[id]?.status === "error");
  await Promise.all(failed.map((id) => {
    console.error("push undelivered", id, ticketError(receipts[id]));
    return db.from("notifications").update({ delivered: false, error: ticketError(receipts[id]) }).eq("ticket_id", id);
  }));
  return ok.length + failed.length;
}
