// ─────────────────────────────────────────────────────────────
//  Tinker waitlist — serverless API  (Vercel / Netlify compatible)
//  Path when deployed on Vercel:  POST /api/waitlist
//
//  Saves the email to Supabase (Postgres), rejects duplicates,
//  and sends a branded confirmation email via Resend.
//
//  NO secrets live in this file — they come from environment
//  variables you set in your hosting dashboard (see README.md).
// ─────────────────────────────────────────────────────────────

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY,
  FROM_EMAIL,          // e.g.  "Tinker <hello@tinkerdesktop.com>"
  ALLOWED_ORIGIN,      // e.g.  "https://tinkerdesktop.com"  (or "*")
} = process.env;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  // ── CORS ──
  const origin = ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── parse + validate ──
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const email = (body?.email || "").trim().toLowerCase();
  const source = (body?.source || "web").slice(0, 120);

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  try {
    // ── 1. insert into Supabase (unique index on email dedupes) ──
    const insert = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ email, source }),
    });

    if (insert.status === 409) {
      // duplicate — already on the list. Not an error for the user.
      return res.status(409).json({ ok: true, duplicate: true });
    }
    if (!insert.ok) {
      const detail = await insert.text();
      console.error("Supabase insert failed:", insert.status, detail);
      return res.status(500).json({ error: "Could not save your email. Please try again." });
    }

    // ── 2. send branded confirmation email (best-effort) ──
    if (RESEND_API_KEY && FROM_EMAIL) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject: "You're on the Tinker waitlist",
            html: confirmationEmailHtml(),
          }),
        });
      } catch (mailErr) {
        // The signup itself succeeded; don't fail the request over email.
        console.error("Resend email failed:", mailErr);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("waitlist handler error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

// ── Branded HTML email (dark, matches the Tinker orb aesthetic) ──
function confirmationEmailHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:linear-gradient(180deg,#16171F,#0D0E14);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <tr><td style="padding:40px 36px 30px;">
          <div style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#EEF1FF,#98A0FA 45%,#5A5FEA 78%,#3E3FC9);margin-bottom:22px;"></div>
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;letter-spacing:-0.03em;color:#F2F4F8;">You're on the list.</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#9AA3B2;">
            Thanks for joining the Tinker waitlist. Tinker is an AI assistant that lives on your Mac as a floating orb — it opens apps, plays media, builds presentations, and answers anything, right on your desktop.
          </p>
          <p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#9AA3B2;">
            We'll email you the moment it's ready to download. That's the only email you'll get from us until launch.
          </p>
          <a href="https://tinkerdesktop.com" style="display:inline-block;background:#F2F4F8;color:#08080B;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;">Visit tinkerdesktop.com</a>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:12px;color:#6A7280;">© 2026 Tinker Desktop · Your email is stored securely and never sold.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
