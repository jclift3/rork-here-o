// The trip server. Only the database may call it, with the secret the walks
// migration generated in Vault.
//
// * Every minute (pg_cron, body {}): turns trips whose check-in is overdue
//   into help requests for the circle, tells the traveller, and sends nearby
//   guardians to missed check-ins that are still unanswered after the grace
//   period, for people who opted in. Then saves Expo's delivery receipts for
//   recent pushes.
// * When a trip starts or arrives (trip_event trigger, body {event, walk_id}):
//   tells the traveller's circle.

import { dispatchGuardians, dispatchIncident } from "../_shared/dispatch.ts";
import { adminClient, json } from "../_shared/http.ts";
import { buildPushMessages, checkPushReceipts, sendPush } from "../_shared/push.ts";
import { firstName } from "../_shared/triage.ts";
import { isServiceRequest, tripArrivedMessage, type TripForMessage, tripStartedMessage } from "../_shared/walks.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const db = adminClient();
  const { data: secret } = await db.rpc("check_ins_secret");
  if (!isServiceRequest(req.headers.get("Authorization"), typeof secret === "string" ? secret : undefined)) {
    return json({ error: "forbidden" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  if ((body?.event === "started" || body?.event === "arrived") && typeof body.walk_id === "string") {
    return json(await notifyCircle(db, body.walk_id, body.event));
  }

  const { data, error } = await db.rpc("escalate_overdue_walks");
  if (error) {
    console.error("escalate_overdue_walks failed", error);
    return json({ error: error.message }, 500);
  }
  const escalated = (data ?? []) as { walk_id: string; incident_id: string; requester_id: string }[];

  const results = await Promise.all(escalated.map(async (row) => {
    try {
      const result = await dispatchIncident(db, row.incident_id, row.requester_id);
      const { data: me } = await db.from("private_profiles").select("push_token").eq("id", row.requester_id)
        .maybeSingle();
      await sendPush(
        buildPushMessages(
          [me?.push_token],
          "You missed your check-in",
          "We've let your circle know. If you're OK, open HereO and tap I'm safe.",
          { incident_id: row.incident_id, url: `hereo://incident/${row.incident_id}` },
        ),
        db,
      );
      return { walk_id: row.walk_id, incident_id: row.incident_id, ...result };
    } catch (err) {
      console.error("dispatch for missed check-in failed", row, err);
      return { walk_id: row.walk_id, incident_id: row.incident_id, status: "error" };
    }
  }));

  // Unanswered missed check-ins whose guardian grace has run out.
  const { data: due, error: dueError } = await db.rpc("claim_due_guardian_alerts");
  if (dueError) console.error("claim_due_guardian_alerts failed", dueError);
  const guardianAlerts = await Promise.all(
    ((due ?? []) as { incident_id: string }[]).map(async ({ incident_id }) => {
      try {
        return { incident_id, guardians_sent: await dispatchGuardians(db, incident_id) };
      } catch (err) {
        console.error("guardian alert for missed check-in failed", incident_id, err);
        return { incident_id, status: "error" };
      }
    }),
  );

  const receipts = await checkPushReceipts(db);

  return json({ escalated: results.length, results, guardian_alerts: guardianAlerts, receipts });
});

async function notifyCircle(db: SupabaseClient, walkId: string, event: "started" | "arrived") {
  const { data: trip } = await db
    .from("walks")
    .select("id, user_id, kind, destination, due_at, status, arrived_automatically, profiles:user_id(display_name)")
    .eq("id", walkId)
    .maybeSingle();
  if (!trip) return { status: "not_found" };
  if (event === "arrived" && trip.status !== "arrived") return { status: "skipped" };

  const name = firstName((trip.profiles as unknown as { display_name: string } | null)?.display_name || "") ||
    "Someone in your circle";
  const message = event === "started"
    ? tripStartedMessage(name, trip as TripForMessage)
    : tripArrivedMessage(name, trip as TripForMessage);

  const { data: circleRows } = await db
    .from("circle_members")
    .select("member_id, profiles:member_id(private_profiles(push_token))")
    .eq("owner_id", trip.user_id);
  const tokens = (circleRows ?? []).map((row) =>
    (row.profiles as unknown as { private_profiles: { push_token: string | null } | null } | null)
      ?.private_profiles?.push_token ?? null
  );
  await sendPush(
    buildPushMessages(tokens, message.title, message.body, { walk_id: walkId, url: `hereo://walk/${walkId}` }),
    db,
  );
  return { status: "sent", event, circle: tokens.filter(Boolean).length };
}
