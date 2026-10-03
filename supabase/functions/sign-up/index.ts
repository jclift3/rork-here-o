// Creates an email + password account. The hosted project can't send custom
// emails without its own SMTP, so accounts are confirmed here instead of by
// email. The app signs in with the password right after.

import { adminClient, corsHeaders, json } from "../_shared/http.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return json({ error: "Send an email and a password." }, 400);
  }
  if (!EMAIL.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < MIN_PASSWORD || password.length > 72) {
    return json({ error: `Use a password of at least ${MIN_PASSWORD} characters.` }, 400);
  }

  const db = adminClient();
  const { data: existing, error: lookupError } = await db.rpc("auth_user_by_email", { p_email: email });
  if (lookupError) return json({ error: "Something went wrong. Please try again." }, 500);
  const user = existing?.[0] as { id: string; confirmed: boolean; has_signed_in: boolean } | undefined;

  if (user) {
    // An account someone started with an email code but never finished can
    // be claimed. Anything that has been used is never overwritten.
    if (user.confirmed || user.has_signed_in) {
      return json({ error: "That email already has an account. Sign in instead." }, 409);
    }
    const { error } = await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) return json({ error: "Something went wrong. Please try again." }, 500);
    return json({ ok: true });
  }

  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return json({ error: "Something went wrong. Please try again." }, 500);
  return json({ ok: true });
});
