# CDRRMO Barangay Weather SitRep

Live barangay weather situation reports for the Ozamiz City CDRRMO netcall. Radio controllers encode each barangay during the netcall, and every change appears on the public site immediately.

- Public: `/` (current report), `/reports` (archive), `/reports/<id>` (shareable, with a Facebook preview)
- Staff: `/admin` (Google sign-in; allowlisted accounts only)

## Stack
Next.js 16 · Supabase (schema `cdrrmo` on the shared "Asenso" project) · Tailwind v4 · shadcn/ui · Supabase Realtime Broadcast

## Local setup
1. `cp .env.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or use the local stack below).
2. `npm install`
3. `npm run dev` and open http://localhost:3000

## Local development (Supabase CLI)
Everything can run against a local Supabase stack (Docker required). This project uses ports 553xx.
1. `supabase start` (API 55321, DB 55322, Studio 55323).
2. `supabase status -o env`, then point `.env.local` at it: `NEXT_PUBLIC_SUPABASE_URL=<API_URL>`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
3. `supabase db reset` rebuilds the schema from `supabase/migrations`. Then load the sample report:
   `psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -v ON_ERROR_STOP=1 -f supabase/seed/sample_report_2026-10-07.sql`
4. RLS test: first `psql <DB_URL> -f supabase/tests/local_auth_users.sql` (creates 3 local-only auth users), then `psql <DB_URL> -f supabase/tests/rls_test.sql`. It passes when it fails with `RLS_TESTS_PASSED`.
5. Signed-in sessions for admin pages (Google OAuth is not configured locally): set `LOCAL_SERVICE_ROLE_KEY` from `supabase status -o env` (`SERVICE_ROLE_KEY`), then
   `node --env-file=.env.local scripts/local-session.mjs <email> <out.json>` writes a Playwright `storageState`. Link the users to staff rows with `supabase/tests/local_staff_link.sql`. These tools refuse to run against a non-local URL. Never use them, or the service-role key, with the remote project.

## One-time Supabase setup (Asenso project)
- Project Settings → Data API → **Exposed schemas**: add `cdrrmo`.
- Authentication → URL Configuration → **Redirect URLs**: add `http://localhost:3000/auth/callback` and `https://<production-domain>/auth/callback`.
- Authentication → Providers: enable **Google**.
- Realtime → Settings: public channel access must be allowed.
- Migrations are in `supabase/migrations`. `0001` is already applied to the shared project; apply the rest as described below.

## Deploying the database to the shared Asenso project
Only with the owner's approval. `0001_schema.sql` is already applied remotely. Apply `0002`, `0003` and `0004` (and any later files) in order, either with `supabase link --project-ref jwpaamhdlufycuopiguy` then `supabase db push`, or by pasting each file into the SQL editor. Then expose the `cdrrmo` schema, set the redirect URLs and enable the Google provider (see above). Seed the sample report (`supabase/seed/sample_report_2026-10-07.sql`) only if you want demo data.

## Deploying to Vercel
Import the repo and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` (the production URL, which is used in share links and Facebook previews). Add the production callback URL in Supabase (see above).

## Roles
- **Super admin** (berlcamp@gmail.com, fixed): manages users, barangays, options, header settings; can delete reports.
- **Encoder**: creates and edits reports. Every edit is public immediately.

## Tests
- `npm test`: unit tests (summary rules, formatting, live reducer, validation)
- `E2E_REPORT_ID=<id> npx playwright test`: public site end-to-end. It builds and starts the app unless `E2E_BASE_URL` is set. Tests run on system Google Chrome (`channel: 'chrome'`); set `PW_CHANNEL` (for example `chromium`) to use another browser channel.
- `node scripts/watch-live.mjs <url> <text>`: waits for a Realtime update to appear without reload (also honours `PW_CHANNEL`).
- `supabase/tests/rls_test.sql`: run with `psql`, the Supabase SQL editor or MCP; it passes when it fails with `RLS_TESTS_PASSED`.

## Manual acceptance checklist (needs Google sign-in)
1. Sign in as super admin and land on `/admin/reports`.
2. An unlisted Google account is sent to `/unauthorized`.
3. Start a new report. An open public tab shows the "new netcall report" banner.
4. Change a barangay's wind on a phone. The public page on another device updates within about 1 second.
5. Go offline, change a field, and see "Not saved". Back online, it saves automatically.
6. The super admin deletes a test report by typing its time.
