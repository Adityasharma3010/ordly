# Ordly — lists that stay put

A checklist app with accounts, automatic saving, and secure list sharing.
React + Vite, Tailwind CSS v4, Motion (Framer Motion), dnd-kit, Lucide, React Router, Supabase.

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in the two Supabase values (below)
npm run dev                    # http://localhost:5173
npm run lint && npm test && npm run build
```

**Without Supabase keys** the app runs in a clearly-labelled *local dev mode*: no accounts, data in this browser's
localStorage, sharing disabled (the Share dialog says so). This is for UI development only.

## Enable the real backend (accounts, sync, sharing)

1. Create a project at https://supabase.com.
2. **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), **Run**.
   It creates the tables, indexes, triggers, Row Level Security policies, and the sharing functions.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   Never use the `service_role` key anywhere in this project.
4. **Authentication → URL Configuration**: set *Site URL* to your app URL (`http://localhost:5173` locally) and add
   `http://localhost:5173/**` plus your production URL to *Redirect URLs* (needed for confirmation and password-reset emails).
5. **Authentication → Providers → Email**: keep email on. If *Confirm email* is on, sign-up shows "check your inbox";
   for quick local testing you can turn it off.
6. Restart `npm run dev`.

## How sharing works

| Mechanism | Detail |
|---|---|
| Private by default | RLS: a list is visible only to its owner and to rows in `list_members`. |
| View link | `/s/<token>` works **without an account** (read-only) via the `get_shared_list` function. |
| Edit link | Visitors see the list read-only until they **sign in**; opening the link while signed in calls `redeem_share`, which adds them to `list_members` as `editor`. RLS then permits item edits for them. |
| Tokens | ~244 bits of randomness, readable only by the list owner. |
| Revoke | Turning a link off sets `revoked_at`; a trigger removes everyone who joined through it. "Replace link" revokes and issues a new token. |
| Signed-in viewers | Opening a view link while signed in also adds you as `viewer`, so it appears under **Shared with me**. |

The browser only ever holds the public anon key; all authorization is enforced in Postgres.

## Test sharing end to end

1. Sign up as **user A** (normal window), create a list with a few items, open **Share**.
2. Turn on **view** link → copy it → open it in an **incognito window**: the list is visible, read-only, no edit controls.
3. In A's Share dialog, turn the view link **off** → refresh incognito (or wait ≤30 s): "This link isn't available".
4. Turn on the **edit** link → open it in incognito: read-only with a "Sign in to edit" banner.
5. Sign up/sign in as **user B** there → B lands in the list with full editing; A sees B under *People with access* and
   changes appear live. B shows the list under **Shared with me**.
6. Revoke the edit link as A → B loses access immediately (list disappears for B; direct edits are rejected by RLS).
7. Private check: as B, open `/app/<A's-private-list-id>` → "List not found".

## Project structure

```
supabase/schema.sql        tables, RLS, triggers, sharing RPCs
src/
  services/                api.js (picks backend) · supabaseApi.js · localApi.js (dev mode)
  contexts/                Auth · Workspace (store) · Save (serial write queue + retry) · Theme · Toast
  components/ui/           Button, Modal, Menu, Checkbox, Switch, Toaster, fields…
  components/layout/       AppShell, Sidebar, Header (+global search), SaveIndicator, Settings
  components/lists/        ListWorkspace, ListHeader, ListFormModal
  components/checklist/    Checklist (dnd), ItemRow, ItemComposer, Toolbar, ProgressBar, EmptyState
  components/sharing/      ShareModal
  pages/                   AuthPage, ResetPasswordPage, SharedListPage, WorkspacePage
  utils/                   position (fractional ordering), listStats (stats/filter/sort/search)
tests/                     unit + UI integration (local mode) + save-queue tests
```

## Design notes

- **Saving:** every write goes through one ordered queue (inserts before edits). Text edits debounce (600 ms);
  checkboxes and structural changes save immediately. Failures keep the operation, show "Unable to save · Retry",
  and retry automatically when the browser comes back online. Items get client-generated UUIDs and are inserted with
  *ignore-duplicates*, so retries or double submits can't create duplicates.
- **No stale overwrites:** live updates (Supabase Realtime) only refetch when no local edits are pending. Writes are
  field-level patches, never whole-record replacements.
- **Reordering:** fractional `position` values, so a drag rewrites one row. Works with mouse, touch (drag the handle)
  and keyboard (focus handle, Space, arrows).
- **Accessibility:** semantic buttons, `role=checkbox/switch/dialog/menu`, focus trap + restore in dialogs, visible focus
  ring, completion shown by tick + strike-through (not colour alone), `prefers-reduced-motion` respected.

## Known limitations

- Favorite and Archive are owner-only (they're properties of the list row).
- `list_shares.expires_at` exists and is enforced by the functions, but there is no UI to set it yet; people who already
  joined via a link that later expires keep access until the link is *revoked* or they're removed.
- Editable sharing requires sign-in (no anonymous guest editing).
- Single-tenant-scale loading: the workspace loads all of your lists and items at once.
