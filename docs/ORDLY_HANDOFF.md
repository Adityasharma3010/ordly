# Ordly: project handoff (read this first)

Context for a new chat. Ordly is a checklist / list-sharing web app built with the owner (Aditya, a beginner
developer) over one long chat. The latest code is in the attached zip; this file explains the decisions,
setup, bugs already solved, and how to work with him. Where this file and the code disagree, trust the code.

## 1. What Ordly is
A premium-feeling checklist app: accounts, auto-saving lists, items with optional checkboxes (plain-text items allowed),
drag-to-reorder, search/filter/sort, favorites/archive/duplicate, and link-based sharing (view links and edit links).
Dark theme default + light theme. Name: **Ordly**. Tagline on sign-in: "Lists that stay put."

- Live: https://ordly-lists.vercel.app (Vercel, auto-deploys from GitHub)
- Repo: https://github.com/Adityasharma3010/ordly
- Backend: Supabase project "ordly" (Free plan). Auth = email + password.
- Env vars (Vercel + local `.env.local`/`.env`, never committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  The legacy anon key is in use (works; the newer `sb_publishable_...` key would also work). **Never** use the secret/service_role key in the app.
- With no Supabase env vars the app runs in **local dev mode** (localStorage, no accounts, no sharing, yellow banner).

## 2. Stack
React 19 + Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`; design tokens are CSS variables in `src/index.css`, utilities like `bg-surface`, `text-muted`, `bg-accent`),
Motion (`motion/react`) for UI animation, **GSAP** only for three showpiece animations (`src/lib/animations.js`: sign-in intro, completion confetti, one-time workspace load stagger; all skip under reduced motion),
`@dnd-kit` (drag reorder, mouse/touch/keyboard), `lucide-react`, `react-router-dom` v7, `@supabase/supabase-js`.
Fonts: Geist (UI) + Instrument Serif (titles). Per-list accent colour via `--c-accent`.
Tests: Vitest + React Testing Library + jsdom. Lint: ESLint 10 (flat config, react-hooks v7 rules are strict).
Commands: `npm run dev | lint | test | build`.

## 3. Architecture (src/)
- `services/api.js` picks `supabaseApi.js` or `localApi.js`. UI code never talks to Supabase directly. Methods: auth, `fetchWorkspace`, `createList/updateList/deleteList`, `insertItems/updateItem/updateItems/deleteItems`, `subscribe` (realtime), sharing (`listShares/createShare/setSharePermission/revokeShare/getSharedList/redeemShare/collaborators/removeMember`).
- `contexts/`: Theme, Toast, Auth, **Save** (one serial write queue; failed writes are kept in memory with Retry; auto-retry on `online`), **Workspace** (reducer store + `stateRef` mirror updated synchronously on dispatch; text edits debounced 600 ms; checkbox/structure saves immediately; realtime refetch only when no unsaved local edits; Undo toasts for deleting items / clearing completed).
- `utils/`: `position.js` (fractional ordering: moving an item rewrites one row), `listStats.js` (stats, filter/sort, search, **VIEWS + listsForView**), `format.js`, `appearance.js`.
- `components/`: `ui/` (Button, Modal with focus trap, **Menu rendered in a portal**, Checkbox, Switch, Toaster...), `layout/` (AppShell, Sidebar, Header with global search, SaveIndicator, SettingsModal, UserMenu), `lists/`, `checklist/`, `sharing/ShareModal.jsx`.
- Routes: `/` and `/login` (AuthPage), `/signup`, `/reset-password`, `/s/:token` (shared list), `/app/:listId?` (workspace; query `?view=` and `?q=`).
- Sidebar views (key -> label): `all`, `myLists` ("My Lists"), `favorites`, `recent`, `shared`, `archived`. **`list.role`** ("owner" | "editor" | "viewer") is the ownership source of truth; derived in `fetchWorkspace` from `owner_id` + `list_members`.
- Client generates UUIDs for lists/items; inserts use `upsert(..., { ignoreDuplicates: true })` so retries can't create duplicates.
- Code style in the repo: the owner's editor auto-formats on save (double quotes, semicolons). Match the existing formatting of any file you edit.

## 4. Database (supabase/schema.sql; already applied to the live DB)
Tables: `profiles`, `lists`, `list_items` (`position` double precision, `has_checkbox`, `completed`, `notes` text), `list_shares` (token, permission view|edit, `expires_at`, `revoked_at`; one active link per list per permission), `list_members` (role viewer|editor, `share_id`).
Helper functions (SECURITY DEFINER, `search_path` fixed): `list_access(lid)`, `is_list_member(lid)`. RPCs: `get_shared_list(token)` (anon-callable, view links), `redeem_share(token)` (signed-in; adds member; never downgrades an editor), `list_collaborators(list_id)` (owner only).
Triggers: `set_updated_at`, `touch_list` (item edits bump list.updated_at), `handle_new_user` (creates profile), `sync_share_members` (revoking a link removes its members; changing permission changes their role).
RLS: owners + members read; owners update/delete lists; owners + editors write items; shares owner-only; no INSERT policy on `list_members` (joining only via `redeem_share`). Realtime is enabled for lists/list_items/list_members.
Sharing model: view links open without an account (read-only); edit links require sign-in, then the visitor becomes an `editor`; revoking removes everyone who joined through that link.
Any schema change must be written as a new SQL file the owner pastes into Supabase -> SQL Editor (he is new to Supabase; give click-by-click steps), AND schema.sql must be updated to match.

## 5. Bugs already solved (don't repeat these)
1. **Dropdown menu clipped** by the item row's `overflow: clip` -> `Menu` now renders in a portal with fixed positioning.
2. **"Unable to save" / RLS error on every insert**: `INSERT ... ON CONFLICT DO NOTHING` was rejected because the `lists` SELECT policy called `list_access(id)`, which re-reads `lists` and cannot see the row being inserted. Fixed by `lists_select USING (owner_id = auth.uid() OR is_list_member(id))` (supabase/fix-saving.sql, already run). **Lesson: never write a SELECT policy that looks up the same table through a function if any write path uses upsert.**
3. Security Advisor: revoked EXECUTE from `anon` (and trigger functions) on internal functions. Remaining advisor warnings are intentional (`get_shared_list` for anon; `list_access`, `is_list_member`, `list_collaborators`, `redeem_share` for signed-in users; Supabase's own `rls_auto_enable`).
4. **Checkbox / any edit failing with a CORS error** ("Method PATCH is not allowed by Access-Control-Allow-Methods in preflight response") in the owner's Chrome. Insert (POST) worked, every PATCH failed. Console stack included `requests.js`/`200.js` (extension scripts). Suspected a browser extension; told him to test in Incognito. **Outcome not confirmed in the chat.** If it comes back, ask for the Incognito result first. Fallback if it is truly server-side: avoid PATCH (use RPC functions via POST).
5. My Lists nav: he built it himself (commit "added my lists option"); verified correct against requirements. Optional extras given: friendlier empty message and test files.

## 6. How things were verified (useful for new work)
- Jest-style UI tests in `tests/` (local-mode flow, save queue, utils; plus `my-lists.test.jsx` with an in-memory fake backend, if he added it).
- A throwaway harness (not in the repo): embedded Postgres (`pip install pgserver`) + the PostgREST static binary + a tiny proxy mapping `/rest/v1` -> PostgREST, with JWTs minted locally, running the real `supabaseApi.js` through `supabase-js`. This caught real RLS behaviour that plain SQL tests missed. It can be rebuilt if you change schema/RLS and want real verification. The sandbox cannot reach supabase.co, so it cannot test the live project.

## 7. Known minor items / limits
- "My Lists" is title case while other labels are sentence case (one-word edit in `VIEWS`).
- `?view=constructor` (a crafted URL) would pass the `VIEWS[...]` truthiness check; harmless, easy hardening with `Object.hasOwn`.
- Favorite/Archive are owner-only; editors cannot change list details.
- `list_shares.expires_at` is enforced by the functions but has no UI; people who already joined keep access until the link is revoked or they are removed.
- Editable sharing requires sign-in (no anonymous guest editing).
- The whole workspace (all lists + items) loads at once.
- Item `notes` is plain text (max 10,000 chars).
- Free-plan email limits can throttle sign-up confirmation emails during testing.
- Sign-in intro animation is only visible when Supabase is configured (local mode skips the sign-in page).
- `src/lib/animations.js` may show as modified in git (formatting only).

## 8. What's next (owner's stated plans, not yet designed)
Nested lists; images in lists; videos; proper (rich) notes; enhanced sharing; more share/edit-link options.
Things worth deciding up front (suggestions, not decisions):
- **Media:** Supabase Storage bucket(s) with RLS tied to list access; check current Free-plan file-size/storage limits; thumbnails; delete-on-item-delete; signed URLs for private lists vs public URLs.
- **Nesting:** model (`parent_id` on items vs sub-lists vs both), ordering within a parent, progress roll-up rules, RLS inheritance, drag-and-drop across levels, effect on the `position` scheme and the realtime/save queue.
- **Rich notes:** Markdown vs a rich-text editor (e.g. Tiptap); storage format; migration from the plain `notes` column; sanitising on the shared (anonymous) view.
- **Enhanced sharing:** per-person invites by email, expiry UI, revocation list, roles, access-request flow, link analytics; keep the existing token + `list_members` model working.
Every feature should keep: auto-save through the Save queue, RLS enforced in the database, reduced-motion support, and keyboard accessibility.

## 9. How to work with the owner
- He is a **beginner developer**: give practical, click-by-click steps; avoid jargon; explain what each command does.
- He **strongly prefers explicit diffs** over full-file replacements. When a file is large or heavily changed he has asked for "just the updated file and where it goes". Always state the exact file path.
- Casual, direct tone. **Stay within the scope he asks for**; mention extra ideas briefly instead of doing them.
- **Do not commit or push** unless he explicitly asks. Don't print or ask for secret keys; `.env` is gitignored.
- Run lint, tests and build before handing code back, and say honestly what was and wasn't verified (e.g. "not checked in a real browser", "not run against his live Supabase").
- He tests on the live Vercel site and sometimes pastes browser console / Network errors or Supabase advisor CSVs: those are the best debugging input.
