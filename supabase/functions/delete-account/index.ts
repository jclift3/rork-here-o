// Deletes the caller's account and everything tied to it (App Store
// guideline 5.1.1(v): accounts must be deletable inside the app).
//
// Every table hangs off profiles -> auth.users with ON DELETE CASCADE, so
// deleting the auth user removes profile, circle, trips, help requests and
// their events, ring settings and the notification log. Scene photos live in
// Storage, which does not cascade, so they are removed first.

import { adminClient, callerFrom, corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const caller = await callerFrom(req);
  if (!caller) return json({ error: "sign in required" }, 401);

  let confirm: unknown = null;
  try {
    confirm = (await req.json())?.confirm;
  } catch {
    // fall through
  }
  if (confirm !== "DELETE") return json({ error: 'send {"confirm":"DELETE"}' }, 400);

  const db = adminClient();

  // Photos from this person's help requests.
  const { data: incidents } = await db.from("incidents").select("id").eq("requester_id", caller.id);
  for (const { id } of incidents ?? []) {
    const { data: files } = await db.storage.from("scenes").list(id, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${id}/${f.name}`);
    if (paths.length) {
      const { error } = await db.storage.from("scenes").remove(paths);
      if (error) console.error("scene cleanup failed", id, error);
    }
  }

  const { error } = await db.auth.admin.deleteUser(caller.id);
  if (error) {
    console.error("deleteUser failed", error);
    return json({ error: "Could not delete your account. Please try again." }, 500);
  }
  return json({ status: "deleted" });
});
