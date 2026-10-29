# Ordly sign-in setup: custom emails, email codes and Google

Do these in order. Nothing here needs a code change in the app beyond the patch that came with this file.
**Never paste a key or secret anywhere except into the Supabase / Google box named below.**

## A. Send auth emails through Resend (needed for custom templates)

Supabase only lets you edit email templates once it sends mail through your own SMTP service. Resend already works for that.

1. **Resend** → **API Keys** → **Create API key**: Name `Ordly auth (Supabase SMTP)`, Permission **Sending access**, Domain: your verified sub-domain. Click **Add** and copy the key (it is shown once).
2. **Supabase** → your **ordly** project → **Authentication** → **Emails** (left menu, under NOTIFICATIONS) → **SMTP Settings** tab → turn on **Enable custom SMTP**.
3. Fill in:
   | Field | Value |
   | --- | --- |
   | Sender email | `login@` + your verified sub-domain (the same one your invites use, for example `login@ordly.yourdomain.com`) |
   | Sender name | `Ordly` |
   | Host | `smtp.resend.com` |
   | Port number | `465` |
   | Username | `resend` |
   | Password | the API key from step 1 (type or paste it here only) |
4. Click **Save changes**.
5. **Authentication → Rate Limits**: with your own SMTP the email limit is yours to set. Check "Rate limit for sending emails" is comfortably above what you expect (Resend's free plan is 100 emails a day in total, shared with your invite emails).

## B. Paste the four email templates

**Authentication → Emails → Templates** tab. For each row below: click it, set the **Subject**, open the **Source** (code) tab, select everything, paste the file's contents, **Save changes**.

| Supabase template | File in `supabase/email-templates/` | Subject |
| --- | --- | --- |
| Confirm sign up | `confirm-signup.html` | `Confirm your Ordly account` |
| Magic link | `magic-link-code.html` | `Your Ordly sign-in code: {{ .Token }}` |
| Reset password | `reset-password.html` | `Reset your Ordly password` |
| Change email address | `change-email.html` | `Confirm your new email for Ordly` |

Notes:
- "Magic link" is the template Supabase uses for the **emailed sign-in code**. Our version shows the code first and the link as a backup.
- A brand-new person who signs up with a code is sent the **Confirm sign up** email, which is why that one shows the code as well as the button.
- The logo is loaded from `{{ .SiteURL }}/email-logo.gif`, so keep `public/email-logo.gif` deployed and keep the **Site URL** (next step) correct.
- Invite user and Reauthentication emails are not used by Ordly, so leave them.

## C. Site URL and redirect URLs

**Authentication → URL Configuration**
- **Site URL**: `https://ordly-lists.vercel.app`
- **Redirect URLs** → Add URL, once each: `https://ordly-lists.vercel.app/**` and `http://localhost:5173/**`
- Save.

## D. Email code length (optional)

**Authentication → Sign In / Providers → Email**: "Email OTP Length" (6 is fine) and "Email OTP Expiration". The sign-in screen accepts 6 to 10 digits, so you can change the length later without touching the app.

## E. Continue with Google

The Google button appears on the sign-in and sign-up screens by itself as soon as Google is switched on in Supabase. Until then it stays hidden.

1. Go to https://console.cloud.google.com and pick or create a project (for example `Ordly`).
2. **APIs & Services → OAuth consent screen** (may be called **Google Auth Platform**). Choose **External**. App name `Ordly`, support email and developer email: yours. Under **Branding**, add your site `https://ordly-lists.vercel.app` as the home page and add `vercel.app` and your own domain under authorised domains if it asks. Save.
3. **Audience / Publishing status**: click **Publish app** (move from *Testing* to *In production*). While it says *Testing*, only people you list as test users can sign in. Basic sign-in (email and profile) needs no Google review.
4. **Credentials → Create credentials → OAuth client ID**: type **Web application**, name `Ordly web`.
   - **Authorised JavaScript origins**: `https://ordly-lists.vercel.app` and `http://localhost:5173`
   - **Authorised redirect URIs**: the callback URL Supabase shows you in step 5 (it looks like `https://<your-project-ref>.supabase.co/auth/v1/callback`). Open step 5 in another tab first and copy it from there.
   - **Create**. Copy the **Client ID** and **Client secret**.
5. **Supabase → Authentication → Sign In / Providers → Google**: switch it on, paste the **Client ID** and **Client secret** (only here), **Save**. The "Callback URL (for OAuth)" shown on this page is the redirect URI for step 4.
6. Reload the sign-in page. "Continue with Google" should appear under the Continue button.

## F. Try it

1. **Code sign-in**: sign-in screen → your email → **Continue** → **Email me a sign-in code**. The email should arrive from `Ordly`, with a 6-digit code. Enter it.
2. **New account with a code**: use an address that has no account. You get the Confirm sign up email, and the code signs you in and creates the account.
3. **Password sign-up**: create an account with a password. The Confirm email has a button. After clicking it you land in the app.
4. **Reset password**: Forgot password → the reset email matches the design.
5. **Invite flow**: open an invite link while signed out, then sign in any way. You should land on the invited list (Google and email-confirmation sign-ups come back to `/app` and are then taken to the list).
6. **Google**: Continue with Google, pick an account, land in the app.

If a step fails, the message on screen plus the **Authentication → Logs** page in Supabase usually says why.

## Not covered: phone sign-in

Phone number and SMS codes need a paid SMS provider (Twilio, MessageBird, Vonage) and, for India, DLT registration. It is not set up.
