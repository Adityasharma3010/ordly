# Setting up invite emails (one time)

Ordly sends invite emails through [Resend](https://resend.com) (free plan: 100 emails a day,
3,000 a month). The sending is done by a small Supabase "Edge Function" called `send-invite`.
You do three things: set up Resend, run one SQL file, and deploy the function.

Nothing here needs a secret to be shared with anyone: you type the Resend key straight into the
Supabase dashboard, and nobody else (including Claude) needs to see it.

## 1. Resend: verify your domain and get a key

Use a sub-domain just for mail, like `mail.yourdomain.com`, so it never touches your website's
or your own mailbox's email settings.

1. Go to resend.com and sign up.
2. Left menu **Domains** → **Add Domain** → type `mail.yourdomain.com` → Add.
3. Resend shows a few DNS records (usually 1 `MX`, 1 `TXT` for SPF, 1 `TXT` for DKIM).
   Open the DNS settings of wherever your domain is managed (your registrar, or Cloudflare…)
   and add each record exactly as shown (Type, Name, Value). Then click **Verify** in Resend.
   It can take a few minutes up to an hour. Wait until it says **Verified**.
4. Left menu **API Keys** → **Create API Key** → name it `ordly`, permission **Sending access**,
   domain = your domain → Create. **Copy the key now** (it is only shown once). Keep it for step 3.

## 2. Supabase: run the SQL

1. Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/invite-emails.sql`, copy everything, paste it, click **Run**. It should say
   Success. (Safe to run twice.)

## 3. Supabase: deploy the function and add its settings

1. **Edge Functions** (left menu) → **Deploy a new function** → **Via Editor**.
2. Name it exactly `send-invite`.
3. Delete the sample code, then paste in the whole of `supabase/functions/send-invite/index.ts`.
4. Click **Deploy function**.
5. **Edge Functions** → **Secrets** (or the project's Edge Function secrets page) → **Add new
   secret**, three times:
   - `RESEND_API_KEY` = the key you copied in step 1
   - `MAIL_FROM` = `Ordly <invites@mail.yourdomain.com>` (any name before `@` works, but the
     domain part must be the one you verified)
   - `APP_URL` = `https://ordly-lists.vercel.app`
6. Optional: `ALLOWED_ORIGINS` = extra websites allowed to use it (for example a Vercel preview
   address). Your live site and `http://localhost:5173` are always allowed.

## 4. Try it

Open a list → Share → add an email address you own. You should see "Invite emailed to …" and
the email arrives within a few seconds (check spam the first time). The pending invite then
shows "Emailed just now", and the buttons next to it let you email it again or open your own
email app with the message ready.

## If something goes wrong

The message in Ordly says what is wrong:

| Message | What to do |
| --- | --- |
| "Email sending isn't set up on this Ordly yet" | The function isn't deployed, or is named differently. It must be called `send-invite`. |
| "…isn't finished being set up (missing: …)" | Add the secrets it names in step 3.5. |
| "The email service couldn't send it: … domain is not verified" | Finish step 1.3 (DNS records) and wait for **Verified**. |
| "The email service couldn't send it: API key is invalid" | Create a new key (step 1.4) and replace `RESEND_API_KEY`. |
| "Invalid JWT" / the email never goes | In Edge Functions → `send-invite` → Details, switch **Verify JWT** off and deploy again. It is safe: the database re-checks who is calling on every send. (Only needed if your project uses the newer API keys.) |
| "Confirm your own email address first" | Your own Ordly account's email must be confirmed. |
| "Try again in a minute" / "this hour" / "tomorrow" | Sending limits: 1 minute between emails to the same invite, 5 emails per invite, 20 an hour and 60 a day per person. |

Nothing is lost when sending fails: the invite is saved either way, and "Open in your email app"
always works as a backup.
