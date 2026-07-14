# Tinker Waitlist — Backend Setup

This makes the "Get notified" modal fully functional: it **saves emails to a
database**, **rejects duplicates**, and **sends a branded confirmation email** —
all from a secure serverless function. No secrets ever touch the frontend.

**Stack:** Supabase (Postgres database) + Resend (email) + one serverless
function. All have free tiers. Total setup ≈ 15 minutes.

---

## What you need

| Service   | Why                       | Cost (to start) |
|-----------|---------------------------|-----------------|
| Supabase  | Stores the emails         | Free            |
| Resend    | Sends confirmation emails | Free            |
| Vercel *(or Netlify)* | Hosts the site + API function | Free |

---

## Step 1 — Database (Supabase)

1. Create a project at **supabase.com** (Free plan).
2. Open **SQL Editor**, paste the contents of `schema.sql`, and run it.
   This creates the `waitlist` table, a **unique index** (dedupe), and turns on
   row-level security so the table can't be read from the browser.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **`service_role` secret key** → `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ This is a secret. It goes only in server env vars, never in frontend code.

## Step 2 — Email (Resend)

1. Sign up at **resend.com**.
2. **Add & verify your domain** (Domains → Add Domain → add the DNS records they
   show you). This lets you send from `hello@tinkerdesktop.com`.
   *(For a quick test before your domain verifies, you can send from
   `onboarding@resend.dev`.)*
3. Create an **API key** → copy it → `RESEND_API_KEY`.
4. Set `FROM_EMAIL` to an address on your verified domain, e.g.
   `Tinker <hello@tinkerdesktop.com>`.

## Step 3 — Deploy the function (Vercel)

1. Put your site and the `backend/` folder in one repo. The file
   `backend/api/waitlist.js` becomes the endpoint **`/api/waitlist`**
   automatically (Vercel treats any file in `api/` as a function).
   - Simplest layout: copy `backend/api/` to the repo root as `api/`.
2. Import the repo at **vercel.com → New Project**.
3. In **Settings → Environment Variables**, add all five keys from
   `.env.example` (real values). Redeploy.

Your endpoint is now: `https://YOUR-SITE.vercel.app/api/waitlist`

> **Netlify instead?** Move `api/waitlist.js` to
> `netlify/functions/waitlist.js`, set the same env vars under
> Site settings → Environment variables. Endpoint becomes
> `/.netlify/functions/waitlist`.

## Step 4 — Point the site at the endpoint

The site reads the endpoint from a single tweak/prop called
**`waitlistEndpoint`** — no code edit needed:

- In the editor, open the **Tweaks** panel and paste your endpoint URL into
  **Waitlist → waitlistEndpoint**
  (e.g. `https://tinkerdesktop.com/api/waitlist`).

That's it. If the site is on the **same domain** as the function you can use the
relative path `/api/waitlist`.

---

## How it behaves

- **Valid new email** → saved to DB → confirmation email sent → modal shows the
  polished "You're on the list." success state.
- **Duplicate email** → the DB's unique index returns `409`; the API and UI
  treat it as success (they're already in), no error shown, no second email.
- **Invalid email** → validated on both the client and the server; inline error.
- **Endpoint unreachable** → the email is still saved in the visitor's browser
  (`localStorage` key `tinker_waitlist`) and a friendly retry error is shown.
- **Before you configure anything** → the modal already works and stores locally,
  so nothing is broken while you set up the backend.

## Security notes

- Secrets live only in server env vars. The frontend bundle contains none.
- The `service_role` key bypasses RLS **on the server only**; with RLS enabled
  and no policies, the browser-facing anon key cannot read or write the table.
- Keep `ALLOWED_ORIGIN` set to your real domain in production (not `*`).
