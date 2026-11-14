// Sends the hereo.app confirmation email for a new site_signups row.
// Called by the site_signups AFTER INSERT trigger via pg_net with a shared secret.
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FROM = "HereO <team@hereo.app>";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function shell(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#0B0B0F;font-family:Inter,Helvetica,Arial,sans-serif;color:#fff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0F"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#14141B;border:1px solid rgba(255,255,255,.12);border-radius:24px">
<tr><td style="padding:32px 32px 8px"><img src="https://hereo.app/apple-touch-icon.png" width="48" height="48" alt="HereO" style="border-radius:12px;display:block"></td></tr>
<tr><td style="padding:8px 32px 0"><h1 style="margin:0;font-size:26px;line-height:1.2;color:#fff">${title}</h1></td></tr>
<tr><td style="padding:12px 32px 28px;font-size:16px;line-height:1.6;color:rgba(255,255,255,.78)">${bodyHtml}</td></tr>
<tr><td style="padding:0 32px 32px;font-size:12px;line-height:1.5;color:rgba(255,255,255,.45)">You're getting this because you signed up at hereo.app. Reply "unsubscribe" and we'll remove you. In an emergency, always call 999 in the UK or 911 in the US.</td></tr>
</table></td></tr></table></body></html>`;
}

function compose(r: any) {
  const hi = r.name ? `Hi ${esc(r.name)},` : "Hi,";
  const btn = (href: string, label: string) =>
    `<p style="margin:24px 0 0"><a href="${href}" style="display:inline-block;background:#E8338B;background:linear-gradient(120deg,#E8338B,#F2602E);color:#fff;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:999px">${label}</a></p>`;
  if (r.kind === "hero" && r.founding_no) {
    const no = String(r.founding_no).padStart(3, "0");
    return {
      subject: `You're applicant #${no} for the Founding 100 Heroes`,
      html: shell(`You're applicant #${no}.`,
        `<p style="margin:0 0 14px">${hi}</p>
<p style="margin:0 0 14px">Thank you for putting your hand up to be one of HereO's first heroes in Cambridge. ${r.founding_no <= 100 ? "You're in the running for the Founding 100: a numbered enamel cape pin, your name on the founding wall, and HereO Plus free for life." : "The first 100 founding spots are spoken for, but we need many more heroes, and you're on the list."}</p>
<p style="margin:0 0 14px"><b style="color:#fff">What happens next.</b> Before our Cambridge launch we'll email you to do a quick ID check and a short training. The one rule you'll learn first: be present, don't pursue.</p>
<p style="margin:0">Know someone who'd make a good hero? Send them hereo.app. Heroes work best in numbers.</p>
${btn("https://hereo.app/?ref=hero-email#apply", "Share HereO")}`),
    };
  }
  if (r.kind === "hero") {
    return {
      subject: "Thanks for offering to be a HereO hero",
      html: shell("Thank you.", `<p style="margin:0 0 14px">${hi}</p>
<p style="margin:0 0 14px">We're starting the hero network in Cambridge, UK, then growing city by city. We'll email you as soon as heroes are needed near you, with a quick ID check and short training.</p>
<p style="margin:0">Until then, the fastest way to bring HereO to your area is to get a few friends to sign up too.</p>
${btn("https://hereo.app/?ref=hero-email#apply", "Share HereO")}`),
    };
  }
  const where = r.city === "cambridge" ? "Cambridge" : r.city === "sarasota" ? "Sarasota" : "your area";
  return {
    subject: "You're on the HereO waitlist",
    html: shell("You're on the list.", `<p style="margin:0 0 14px">${hi}</p>
<p style="margin:0 0 14px">Thanks for joining the HereO waitlist. We'll email you as soon as HereO is ready in ${where}.</p>
<p style="margin:0 0 14px">HereO is one button: hold it, and the people nearby and the people who love you know exactly where you are and what to do. Walks home, check-ins and a fake call are in there too.</p>
<p style="margin:0">Want to help sooner? Become one of the heroes who answer the call.</p>
${btn("https://hereo.app/?ref=waitlist-email#apply", "Become a hero")}`),
  };
}

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: secret } = await sb.rpc("site_email_secret");
  if (!secret || auth !== secret) return new Response("forbidden", { status: 403 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return new Response("missing id", { status: 400 });
  const { data: r, error } = await sb.from("site_signups").select("*").eq("id", id).maybeSingle();
  if (error || !r) return new Response("not found", { status: 404 });
  if (r.emailed_at) return Response.json({ ok: true, skipped: "already sent" });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    await sb.from("site_signups").update({ email_error: "RESEND_API_KEY not set" }).eq("id", id);
    return new Response("no key", { status: 500 });
  }
  const { subject, html } = compose(r);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [r.email], subject, html, reply_to: "team@hereo.app", tags: [{ name: "type", value: `site_${r.kind}` }] }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    await sb.from("site_signups").update({ email_error: JSON.stringify(out).slice(0, 500) }).eq("id", id);
    return Response.json({ ok: false, out }, { status: 502 });
  }
  await sb.from("site_signups").update({ emailed_at: new Date().toISOString(), email_error: null, email_id: out.id ?? null }).eq("id", id);
  return Response.json({ ok: true, id: out.id });
});
