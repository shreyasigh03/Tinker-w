const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY,
  FROM_EMAIL,
  ALLOWED_ORIGIN,
} = process.env;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  const origin = ALLOWED_ORIGIN || "*";

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const email = (body?.email || "").trim().toLowerCase();
  const source = (body?.source || "web").slice(0, 120);

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({
      error: "Please enter a valid email address.",
    });
  }

  try {
    const insert = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ email, source }),
    });

    if (insert.status === 409) {
      return res.status(409).json({
        ok: true,
        duplicate: true,
      });
    }

    if (!insert.ok) {
      const detail = await insert.text();

      console.error("Supabase insert failed:", insert.status, detail);

      return res.status(500).json({
        error: "Could not save your email. Please try again.",
      });
    }

    if (RESEND_API_KEY && FROM_EMAIL) {
      try {
        const mailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject: "You're on the Tinker waitlist",
            html: confirmationEmailHtml(),
          }),
        });

        if (!mailResponse.ok) {
          const detail = await mailResponse.text();
          console.error("Resend email failed:", mailResponse.status, detail);
        }
      } catch (mailErr) {
        console.error("Resend email failed:", mailErr);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Waitlist handler error:", err);

    return res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }
}

function confirmationEmailHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 16px;">
<tr>
<td align="center">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#101116;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

<tr>
<td style="padding:40px 36px 32px;">

<div style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#EEF1FF,#98A0FA 45%,#5A5FEA 78%,#3E3FC9);margin-bottom:24px;"></div>

<h1 style="margin:0 0 18px;font-size:25px;font-weight:700;letter-spacing:-0.03em;color:#F2F4F8;">
You're on the list.
</h1>

<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#9AA3B2;">
Thanks for joining Tinker.
</p>

<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#9AA3B2;">
We believe using your computer should feel less like navigating software and more like simply asking for what you need.
</p>

<p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#9AA3B2;">
Tinker is our take on that idea. You'll be among the first to know when it's ready.
</p>

<p style="margin:0;font-size:15px;font-weight:600;color:#F2F4F8;">
See you on the desktop.
</p>

</td>
</tr>

<tr>
<td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;font-size:12px;color:#6A7280;">
© 2026 Tinker Desktop
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>

</body>
</html>`;
}
