// Retired. Accounts are now created with supabase.auth.signUp and confirmed
// with an emailed code, sent through the project's Resend SMTP. This used to
// create accounts already confirmed; it now refuses so older builds can't
// skip email verification.

import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return json({ error: "Update HereO to create an account." }, 410);
});
