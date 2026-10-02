// Runs every minute (pg_cron, see the walks migration). Turns walks whose
// check-in is overdue into help requests and dispatches them exactly like a
// held button, then tells the walker what happened.
//
// Only the scheduler may call this: it must present the secret the walks
// migration generated in Vault.

import { dispatchIncident } from "../_shared/dispatch.ts";
import { adminClient, json } from "../_shared/http.ts";
import { buildPushMessages, sendPush } from "../_shared/push.ts";
import { isServiceRequest } from "../_shared/walks.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const db = adminClient();
  const { data: secret } = await db.rpc("check_ins_secret");
  if (!isServiceRequest(req.headers.get("Authorization"), typeof secret === "string" ? secret : undefined)) {
    return json({ error: "forbidden" }, 403);
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
      );
      return { walk_id: row.walk_id, incident_id: row.incident_id, ...result };
    } catch (err) {
      console.error("dispatch for missed check-in failed", row, err);
      return { walk_id: row.walk_id, incident_id: row.incident_id, status: "error" };
    }
  }));

  return json({ escalated: results.length, results });
});
