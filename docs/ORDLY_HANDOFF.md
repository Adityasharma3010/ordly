# Ordly: project handoff (read this first)

Context for a new chat. Ordly is a checklist / list-sharing web app built with the owner (Aditya, a beginner
developer) over several long chats. The latest code is in the zip he attaches; this file explains the decisions,
setup, bugs already solved, current status and how to work with him. **Where this file and the code disagree, trust the code.**
Last updated: end of the 4th long chat (Oct 2026), after sub-lists, enhanced lists, pickers/templates, rich notes, custom accent colour and invite emails.

## 1. What Ordly is
A premium-feeling checklist app: accounts, auto-saving lists, items with optional checkboxes, **sub-items to any depth that finish themselves**,
**sub-lists (lists inside lists)**, drag-to-reorder, search/filter/sort, favorites/archive/duplicate, **due dates + priorities + tags on lists and items**,
**list types (Checklist / Numbered / Notes)**, **starter + saved templates**, **notes written in Markdown or a rich-text editor**, a custom accent colour,
and Google-Docs-style sharing (one link with Viewer/Editor + expiry, plus people added by email, **with real invite emails**). Dark theme default + light. Tagline: "Lists that stay put."

- Live: https://ordly-lists.vercel.app (Vercel, auto-deploys from GitHub on push; the owner commits and pushes himself)
- Repo: https://github.com/Adityasharma3010/ordly
- Backend: Supabase project "ordly" (Free plan). Auth = email + password. Legacy anon key (not the newer publishable keys).
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see section 10). **Never** use the secret / service_role key in the app.
- With the two vars missing/empty/placeholder (`src/lib/config.js`) the app runs in **local dev mode** (localStorage, one pretend user, no accounts, no sharing, amber banner).

## 2. Stack
React 19 + Vite 8, Tailwind CSS v4 (tokens are CSS variables in `src/index.css`: `bg-surface`, `text-muted`, `bg-accent`, `text-on-accent`, `text-accent-ink`...),
Motion (`motion/react`) for some UI animation, **GSAP 3.15** (`src/lib/animations.js`: intro, confetti, `prefersReducedMotion`; `src/lib/landingMotion.js`: landing page, lazy chunk;
**GSAP also drives the date/time pickers, the colour picker panel and the `Collapse` fold-outs**), `@dnd-kit` (item reorder AND sidebar drag-to-nest), `lucide-react`,
`react-router-dom` v7, `@supabase/supabase-js`, **TipTap 3.31.4 (pinned EXACT: `@tiptap/react`, `pm`, `starter-kit`, `markdown`, `extensions`), only inside the lazy rich-notes chunk**.
Fonts: Geist (UI) + Instrument Serif (titles). Per-list accent colour via `--c-accent`.
Tests: Vitest + React Testing Library + jsdom (**300 tests, 23 files, ~2 minutes**; `testTimeout` is 15 s because the suite got heavy). Lint: ESLint 10 (react-hooks v7 rules are strict:
no setState inside effects, no ref reads during render). Commands: `npm run dev | lint | test | build`. Dev server http://localhost:5173.
The owner's editor runs Prettier on save; his files have **CRLF** line endings on disk.

## 3. Architecture (src/)
- `services/api.js` picks `supabaseApi.js` or `localApi.js`; `api.capabilities` = `{ auth, sharing, realtime, inviteEmail }`. UI never talks to Supabase directly.
  New methods: `updateLists(ids, patch)`, `inviteByEmail` now returns the invite id, `sendInviteEmail(inviteId)` (calls the `send-invite` Edge Function; errors carry `.code`/`.detail`).
- `contexts/`: Theme (**`accentColor`**: `#rrggbb` or null, kept in localStorage `ordly.accent.color`), Toast, Auth, Save (serial write queue), Workspace (reducer + `stateRef`).
  Workspace actions added: `moveList`, `setListArchived` (+ `undoArchive`; archiving a parent takes its sub-lists), `deleteList` (removes the subtree like the DB cascade),
  `createListFromTemplate(template, opts)` (opts override the template), `addTemplateToList(listId, template)` (appends items, Undo toast), `createList` takes parent/type/due/priority/tags.
- `utils/`: `tree.js` (items, non-recursive; `buildRows` also does tag/due filters, due/priority sorts, `number`), `listTree.js` (sub-lists: `listsByParent`, `listDescendantIds`, `buildListRows`,
  `moveTargets`, `resolveDrop`, `TOP_LEVEL_DROP`), `listStats.js` (VIEWS now include `dueSoon`; `listAttention`, `listsWithTag`), `due.js` (due states: overdue/today/soon/later/done; local-time dates),
  `meta.js` (priorities, list types, tags), `calendar.js` (day maths, 12h/24h time), `color.js` (hex/HSV/contrast, `readableOn`, `isHardToSee`), `appearance.js` (`accentHex`, `accentStyle`),
  **`markdown.js`** (own safe Markdown reader, see below), `mdEdit.js` (toolbar edits for the Markdown box), `invite.js` (mailto builder + plain-English error texts), `templates.js`.
- `components/ui/`: Button, Modal (focus trap; Esc handled on document, pickers stop propagation), Menu/Select (portals), **Collapse** (GSAP height fold-out), **DatePicker / TimePicker / PickerPanel / usePopover**
  (own pickers, portal + GSAP; closing is animated from the event handler, never from an effect), **ColorField** (shade square + hue slider + hex box + EyeDropper + ready-made colours),
  MetaFields (due/priority/tags), MetaChips.
- `components/notes/`: `Markdown.jsx` (renders the parse tree as React elements), `NotesEditor.jsx` (Markdown box + toolbar + Preview, or Rich; mode in localStorage `ordly.notes.mode`),
  `NotesToolbar.jsx`, `RichEditor.jsx` (TipTap, lazy-loaded). Notes are stored as **Markdown text** in `list_items.notes` (max 10,000 chars) so old plain notes still work.
- `components/lists/`: `ListFormModal` (redesigned: name + icon/colour tile, "Start from" template chips, Type, "More options" fold), `MoveListModal`, `ListHeader` (breadcrumb, chips, menu incl. "Add items from a template…"), `ListWorkspace`.
- `hooks/useListActions.jsx`: favorite / archive (confirm when sub-lists) / move / delete (confirm names sub-lists and item counts); used by sidebar and list header.
- Routes: `/` landing, `/login`, `/signup`, `/reset-password`, `/s/:token`, `/app/:listId?` (query `?view=`, `?q=`, `?tag=`), `*`.
- Sidebar: views all/myLists/favorites/**dueSoon**/recent/shared/archived; tree (fold arrows, drag-to-nest with a "drop here for top level" strip) only in all/myLists; tag chips filter lists.
- `list.color` is a preset name (`amber`, `coral`...) **or a custom `#rrggbb`** (column allows 24 chars, no migration). An older `"system"` value just shows amber.
- `supabase/functions/send-invite/index.ts` (Deno, **one file, no imports**; `handle(req, env, fetch)` is exported so Vitest tests it) + `SETUP.md`.

## 4. Database (supabase/schema.sql = source of truth for a fresh project)
Run order on the live DB: `schema.sql` (done) -> `sharing-v2.sql` -> `nest-items.sql` -> `templates.sql` -> **`sub-lists.sql` -> `enhanced-lists.sql` -> `invite-emails.sql`**.
Every migration is idempotent with a matching `schema.sql` update; a test proves "old schema + migration (run twice)" dumps identical to the fresh `schema.sql`.
**Confirm with the owner which of the last three he has actually run** (he ran sub-lists/enhanced earlier in testing; `invite-emails.sql` was delivered last and is NOT confirmed).

Tables: `profiles`, `lists`, `list_items`, `list_shares`, `list_members`, `list_invites`, `list_templates`, `invite_email_log`.
- `lists`: + `parent_list_id` (composite FK `(parent_list_id, owner_id) -> lists(id, owner_id)` ON DELETE CASCADE, so a parent is always the same owner; `unique(id, owner_id)`; trigger `check_list_parent` refuses cycles),
  + `list_type` (checklist|notes|numbered), `due_date`, `due_time`, `priority` (0-3), `tags text[]` (<=20 tags, 1-40 chars each, via `tags_ok()`).
- `list_items`: `position`, `has_checkbox`, `completed`, `notes`, `parent_id` (composite FK to same list, cycle trigger), + `due_date`, `due_time`, `priority`, `tags`.
- `list_shares`: one active link per list; permission view|edit; real `expires_at`. `list_members`: viewer|editor; `share_id` set = joined via link (loses access when link expires/is revoked).
- `list_invites`: (list_id, lower-case email, role), owner-only RLS, + **`emailed_at`, `email_count`**. `claim_invites()` (signed-in, confirmed email) turns invites into memberships.
- **`invite_email_log`**: RLS on with NO policies (nobody reaches it through the API). **`invite_email_begin(invite_id)`** (SECURITY DEFINER, `search_path = public, auth`) is the only gate for sending:
  caller must own the list, have a confirmed email, and be within limits (1 min between emails per invite, 5 per invite, 20/hour and 60/day per person); returns list title, invitee, role, inviter name, log id.
  **`invite_email_undo(log_id)`** gives a send back when the email service fails. EXECUTE revoked from public/anon.
- Functions (SECURITY DEFINER, fixed `search_path`): `list_access`, `is_list_member`, `share_is_live`, RPCs `get_shared_list`, `redeem_share`, `list_collaborators`, `set_member_role`, `claim_invites`, `invite_email_begin`, `invite_email_undo`.
- Triggers: `set_updated_at`, `touch_list`, `handle_new_user`, `sync_share_members`, `check_item_parent`, `check_list_parent`. Realtime enabled for lists/list_items/list_members only.
- RLS: owners + members read; owners update/delete lists; owners + editors write items; shares/invites/templates owner-only; no INSERT policy on `list_members`.
- Sharing model: view links work without an account; edit links need sign-in then the visitor becomes `editor`; switching the link off removes everyone who joined through it. **Sub-lists never inherit sharing.**
- Any schema change = a new SQL file the owner pastes into the Supabase SQL Editor (click-by-click steps) AND `schema.sql` updated to match.

## 5. Bugs already solved (don't repeat these)
1. **Dropdown clipped** by `overflow: clip` -> `Menu`/`Select` render in a portal.
2. **RLS error on every insert**: never write a SELECT policy that looks up the same table through a function if any write path upserts (`is_list_member` must never read `lists`).
3. Security Advisor: EXECUTE revoked from `anon` on internal functions; remaining warnings are intentional.
4. **CORS "Method PATCH not allowed" in the owner's Chrome** (extension suspected, never confirmed). If it returns, ask for the Incognito result first; fallback = RPC functions via POST.
5. **Second border on text boxes**: the global `:focus-visible` outline lives in `@layer base`; components that draw their own focus must keep `focus:outline-none` + a border change.
6. **GSAP and CSS fight**: no `transition`/`transition-all` and no Tailwind v4 `scale-*/translate-*/rotate-*` on elements GSAP animates (`transition-colors` is fine). Animate wrapper spans.
7. Animated headings: `Words` renders an sr-only sentence + `aria-hidden` pieces. 8. `gsap.matchMedia` runs if ANY query matches; reduced motion = no animation, finished state (use `prefersReducedMotion()`).
9. Pinned landing story must fit a phone; amber text unreadable on light -> `.text-accent-ink`.
10. Postgres BEFORE ROW triggers can't see rows of the same multi-row INSERT -> composite FKs for "parent in same list/owner"; cycle triggers only on UPDATE.
11. Test flake: Modal moves focus ~30 ms after opening; tests wait until focus is inside the dialog first. 12. My Lists nav was built by the owner.
13. **A `<fieldset>` won't shrink below its content width** -> the wide "Start from" chip row pushed the New list dialog sideways. Fieldsets that hold scrolling rows need `min-w-0`.
14. **`Collapse` has `overflow:hidden`, which clipped focus rings/shadows** (cut-off selected colour). It now has padding cancelled by negative margins.
15. **`window` `resize` events have no element target** -> `listRef.contains(e.target)` threw in `Select`, `Menu` (both fixed) and is guarded in `PickerPanel`. Always check `e.target instanceof Node`.
16. **CSS `AccentColor` does NOT give the Windows accent colour in Chrome/Edge (or Firefox) on Windows** (they return their own default blue; works mainly on macOS). The "System colour" feature was removed;
    replaced by a custom fixed colour picker with the browser **EyeDropper** ("Pick from screen", Chrome/Edge) to copy e.g. the Windows accent from the taskbar. Don't promise OS-accent following on Windows.
17. Hex box must not rewrite a 3-digit colour while typing (only on Enter/blur; 6 digits apply live).
18. Markdown reader: a link whose text is itself a URL lost its text (nested autolink filter) -> `parseInline(..., inLink)` flag.
19. Dev-server artefact (not an app bug): the first browser run right after installing new dependencies can full-reload the page mid-test; warm the Vite server first.
20. GSAP/React rule: closing animations start from event handlers (`usePopover().close()`), enter animations in `useLayoutEffect` with `gsap.context` -> passes the strict lint rules.

## 6. How things were verified (reuse for new work)
- `npm run lint`, `npm test` (ONE full run per tool call; ~2 min), `npm run build`.
- **Postgres harness** (not in the repo): `pip install pgserver --break-system-packages`; bootstrap SQL fakes Supabase (`anon`/`authenticated` roles, `auth.users`, `auth.uid()` from `request.jwt.claim.sub`);
  test through `set role authenticated` + `set_config('request.jwt.claim.sub', ...)`; compare `pg_dump -s` of (old schema + migration run twice) with fresh `schema.sql`.
- **Real browser in the sandbox**: `npm i @sparticuz/chromium puppeteer-core` (headless Chrome); run `npx vite --port 5173 --host 127.0.0.1` in the same tool call; seed `localStorage["ordly.local.v1"]` with lists.
  Used for drag-to-nest with real mouse events, GSAP mid-flight checks, colour picker, TipTap typing, overflow measurements, phone widths. Google Fonts are blocked there.
- **Deno** (`npm i deno`, 2.9.x) type-checks/lints the Edge Function and runs it for real against fake Supabase + Resend servers (`RESEND_API_URL` env override exists only for that).
- `web_search` is useful to confirm browser behaviour before promising a platform feature (see bug 16).
- **Patches**: build from the owner's zip (convert CRLF to LF, fresh `git init` + base commit), make changes, `git diff --cached -- . ':!package-lock.json' > x.patch`, then check
  `git -c core.autocrlf=true apply --check x.patch` AND apply the whole chain of earlier patches to a fresh extract of his zip, then run lint + tests + build there. Don't run Prettier over his CRLF test files.
  **Patches are chained** (delivered in this order): sub-lists, enhanced-lists, pickers-templates, rich-notes, system-accent, custom-accent, invite-emails. (`system-accent` was superseded by `custom-accent`.)
  When a patch adds dependencies, `package-lock.json` is left out: tell him to run `npm install` and commit the lock file.

## 7. Known limits / minor items
- **Windows accent colour can't be read by web pages** (bug 16). Custom colour is fixed per device (Settings) or per list; it does not follow Windows if changed later.
- Notes are now Markdown: look-alike text such as `# something` at the start of a line becomes a heading; links need http(s)/mailto; raw HTML is shown as text (by design, safe).
- Rich editor chunk is ~460 kB (~145 kB gzip), only downloaded when someone picks "Rich text". Main bundle ~650 kB (over Vite's 500 kB warning).
- Invite emails: Resend free plan = 100/day, 3,000/month; invitees land on `/login` (not straight on the list). If the project later uses the newer API keys, turn "Verify JWT" off for `send-invite` (safe: the DB re-checks the caller).
- Drag-to-nest is mouse/touch only (touch needs a 250 ms long-press; **touch not tested on a real phone**); keyboard users use "Move to…". Item drag-reorder still among siblings only.
- Archiving a parent archives its sub-lists; restoring restores the subtree. Duplicating a list does not copy its sub-lists. Templates keep notes but not ticks, due dates, priorities or tags.
- Editors can add items and set item due/priority/tags, but only the owner edits list details. Favorite/Archive owner-only. The whole workspace loads at once.
- A "System" list colour from the removed feature just shows amber until edited.
- Landing page has no social-preview image; its copy only mentions features that exist (no fake stats).
- `?view=constructor` passes the `VIEWS[...]` truthiness check (harmless; harden with `Object.hasOwn`). "My Lists" is title case while other labels are sentence case.

## 8. Status and what's next
**Delivered in this chat (all as patches; the owner tests on the live site):** sub-lists + breadcrumb + drag-to-nest; due dates/priority/tags/list types + Due soon view + tag filters;
custom GSAP date/time pickers; decluttered New list dialog with templates + "Add items from a template…"; Markdown and rich-text notes (safe rendering, also on the public shared page);
Select/Menu resize fix; custom accent colour with picker + eyedropper (app-wide in Settings, per list); **invite emails** (Edge Function + SQL + UI + mailto backup).
**Confirmed working by the owner:** everything up to templates, sub-lists, enhanced lists, pickers and dialog (he reported the overflow bugs, fixed), system-accent (found it doesn't work on Windows).
**Delivered, not yet confirmed:** rich notes, custom-accent, invite-emails.
**Owner still has to do for invite emails (Claude can't):** follow `supabase/functions/send-invite/SETUP.md`: (1) Resend account + verify a sending domain/sub-domain (he owns a domain) + create an API key,
(2) run `supabase/invite-emails.sql`, (3) deploy the Edge Function named exactly `send-invite` (Dashboard > Edge Functions > Via Editor, paste `index.ts`), (4) add secrets `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`.
He types the key into Supabase himself: Claude must never ask for it. Until then the app says email isn't set up and the "open in your email app" button works.
**Other pending small owner tasks:** add `http://localhost:5173/**` to Supabase Auth Redirect URLs; decide landing sections (`SECTIONS` flags in `LandingPage.jsx`); optionally a separate Supabase project for local testing (local dev uses the live data);
run `npm install` after applying rich-notes (TipTap).
**Ideas for next chat (he said more features can come; ask short-choice design questions first):** in-app due-date reminders; a bug-fix/polish pass over everything built; invite link that opens the list directly;
real-phone testing of touch drag; images/videos in lists (he skipped them: Supabase Free storage is 1 GB; revisit only if he asks); code-splitting the main bundle.
Every feature should keep: auto-save through the Save queue, RLS enforced in the database, reduced-motion support, keyboard accessibility, and honest tests.

## 9. How to work with the owner
- He is a **beginner developer** on **Windows + PowerShell + VS Code** (Edge browser): practical, click-by-click steps; no jargon; explain what each command does.
- He **strongly prefers explicit diffs**: deliver changes as a `.patch` he applies with `git apply --check x.patch` then `git apply x.patch` from the project folder (add `--ignore-whitespace` if line endings complain, then delete the patch).
  State exact file paths. Supabase work = a new `.sql` file with click-by-click run steps AND `schema.sql` updated. Dashboard work (Resend, Edge Functions) = a written SETUP guide.
- Casual, direct tone. **Stay within the scope he asks for**; mention extra ideas briefly instead of doing them. He is fine with a tiny adjacent fix of the identical bug if it's clearly flagged (e.g. `Menu` alongside `Select`).
- **Ask design questions with short choices (buttons) before big features**; he often answers with a preference ("both", "fixed colour") that changes the plan: read answers carefully, and if ambiguous pick the most literal reading and say so.
- **Do not commit or push** unless he explicitly asks. Never ask for or print secret keys; `.env*` is gitignored. His zips have included a `.env`: don't open it, and ask him to leave `.env*`, `node_modules` and `.vercel` out.
- **Update this handoff only when he says we're moving to a new chat.**
- Run lint, tests and build before handing code back and say honestly what was and wasn't verified (real browser? live Supabase? real Windows?). Admit and fix mistakes plainly (e.g. the Windows accent claim).
- He tests on the live Vercel site/localhost and sends **screenshots** and console errors: the best debugging input (the New list overflow bugs came from his screenshots).
- If `git apply --check` fails for him, a fresh zip lets you rebase the patch chain.

## 10. Local setup (he hit this once)
Local runs use real Supabase only if `.env.local` (project root, gitignored) has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. On Vercel those two are marked **Sensitive**
(hidden), so he copied the URL and anon key from the Supabase dashboard (Project Settings -> API). **Never copy the other integration variables** (service role, JWT secret, secret key, Postgres password);
anything `VITE_` is public in the browser. `.env.local` overrides `.env`; Vite reads env files only at start, so restart `npm run dev` after editing. Sessions are per origin, so he signs in separately on localhost.
Edge Function secrets live in the Supabase dashboard (Edge Functions > Secrets), never in the repo or `.env*`.
