# CDRRMO Barangay Weather SitRep — Design Spec

- **Date:** 2026-10-07
- **Owner / super admin:** berlcamp@gmail.com
- **Status:** Draft for review

## 1. Purpose

The City Disaster Risk Reduction and Management Office (CDRRMO) of Ozamiz City runs the
*Nagkahiusang Alerto sa Ozamiz Netcall* several times a day. During each netcall, the radio
controller on duty at Rescue Base (radio frequency 148.710) calls every barangay and records
its weather situation. Today this produces a printed/image "Barangay Weather SitRep" that is
posted manually.

This system replaces that with:

1. A staff app where the radio controller encodes the SitRep **while the netcall is running**.
2. A **public, real-time website** showing the same report. Every change an encoder makes
   (e.g. changing one barangay's wind condition) appears on the public site within ~1 second,
   with no draft/publish step.
3. Shareable report links with rich **Facebook previews**.

**Success criteria**

- A radio controller can encode a full 24-barangay netcall on a phone or laptop as fast as the
  barangays report over radio.
- Residents opening the shared Facebook link see the current SitRep, which updates live
  without a page reload.
- The summary (active stations, no response, average weather/wind, rivers/roads/coastal)
  matches what the CDRRMO would have written by hand. For the 2026-10-07 1050H sample it must give
  15 / 9 / "Light to Moderate rain" / "Not windy" / NORMAL / PASSABLE / NORMAL.
- Only accounts the super admin allowed can change data, even though the Supabase project's
  `auth.users` is shared with other apps.

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Stack | Next.js **16.4** (App Router, React 19, Server Components + Server Actions), Tailwind CSS v4, shadcn/ui, Lucide icons |
| Backend | Supabase project **Asenso** (`jwpaamhdlufycuopiguy`), custom schema **`cdrrmo`** |
| Auth | Google OAuth through Supabase Auth; access is limited by an allowlist in `cdrrmo.users` |
| Roles | `super_admin` (exactly berlcamp@gmail.com, cannot be demoted or deactivated) and `encoder` |
| Who encodes | The radio controller encodes every barangay row of a report; barangays do not log in |
| Weather / wind values | Fixed dropdown lists, editable by the super admin, each with a severity order |
| Publishing | **None.** A report is public and live from the moment it is created. Every edit is broadcast in real time |
| Report lifecycle | **Always live, no ending.** The newest report (by `report_at`) is "current"; older ones are history. Reports stay editable |
| Mistaken reports | Only the super admin can delete a report |
| Public layout | Mobile-first: summary tiles plus barangay cards on phones; on desktop, a table modeled on the paper form |
| Facebook preview | Auto-generated 1200×630 summary image per report |
| Hosting | Vercel |

## 3. Architecture

```
Browser (public)  ──SSR page──▶  Next.js 16 (Vercel)  ──supabase-js (anon, schema cdrrmo)──▶  Postgres (RLS)
      ▲                                                                                        │
      └──── Supabase Realtime Broadcast (public channels) ◀── realtime.send() in triggers ◀──┘

Browser (encoder) ──Server Actions──▶ Next.js ──supabase-js (user JWT)──▶ Postgres (RLS)
      ▲
      └──── same Broadcast channels (sees other encoders' edits live)
```

- **Supabase clients:** `@supabase/ssr` with `db: { schema: 'cdrrmo' }`. The browser client is used for
  Realtime subscriptions only; all writes go through Server Actions using the user's session.
  The service-role key is not used by the app.
- **`proxy.ts`** (the Next 16 replacement for middleware) refreshes the Supabase session cookie and
  redirects anyone not signed in away from `/admin/**`. The real authorization check happens in
  the server layout and in RLS.
- **Public pages** render on the server on each request (dynamic) so that the first paint and
  Facebook's crawler always see current data. A client component then subscribes for live updates.
- **Timezone:** all display is in `Asia/Manila`. Report time is shown as "October 7, 2026 – 1050H".

### Manual setup (one time, by the owner)

1. Supabase dashboard → *Project Settings → Data API → Exposed schemas*: add `cdrrmo`.
2. *Authentication → URL Configuration*: add the production URL and `http://localhost:3000` redirect
   URLs (`/auth/callback`). Google provider is already enabled on this project.
3. Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

## 4. Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | public | Current (newest) report, live |
| `/reports` | public | Archive grouped by day, newest first |
| `/reports/[id]` | public | A specific report, live; permanent share URL; `opengraph-image` |
| `/login` | public | "Sign in with Google" |
| `/auth/callback` | public | OAuth code exchange, allowlist check, links `auth_user_id` |
| `/unauthorized` | public | Shown when a Google account is not on the allowlist |
| `/admin` | staff | Redirects to `/admin/reports` |
| `/admin/reports` | staff | Report list and a "New netcall report" button |
| `/admin/reports/[id]` | staff | Live encoding screen |
| `/admin/barangays` | super admin | Manage barangays, callsigns, zones, order, coastal flag |
| `/admin/options` | super admin | Manage weather and wind dropdown lists |
| `/admin/settings` | super admin | Report header text and logos |
| `/admin/users` | super admin | Add, deactivate and set roles for staff by Gmail address |

## 5. Data model (`cdrrmo` schema)

All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`,
and `updated_at timestamptz` maintained by a trigger.

### 5.1 Reference data

**`zones`**: `name text unique`, `sort_order int`.
Seeded with Upland (1), Midland (2), Lowland (3), Coastal (4).

**`barangays`**: `name text`, `callsign text`, `zone_id → zones`, `sort_order int`,
`monitors_coastal bool default false`, `is_active bool default true`.
`sort_order` is the netcall roll-call order. Seed:

| # | Zone | Barangay | Callsign | monitors_coastal |
|---|---|---|---|---|
| 1 | Upland | Stimson Abordo | Sierra 5 | false |
| 2 | Upland | Gala | Golf 2 | false |
| 3 | Upland | Guimad | Golf 5 | false |
| 4 | Upland | Trigos | Tango 3 | false |
| 5 | Upland | Dalapang | Delta 1 | false |
| 6 | Upland | Cogon | Charlie 8 | false |
| 7 | Midland | Embargo | Eagle | false |
| 8 | Midland | Pantaon | Papa 1 | false |
| 9 | Midland | Pulot | Papa 2 | false |
| 10 | Midland | Calabayan | Charlie 1 | false |
| 11 | Midland | Kinuman Sur | Kilo 2 | false |
| 12 | Midland | Sangay Diot | Sierra 1 | false |
| 13 | Midland | Cavinte | Charlie 7 | false |
| 14 | Lowland | Balintawak | Bravo 3 | false |
| 15 | Lowland | Bañadero | Bravo 4 | false |
| 16 | Lowland | Aguada | Alpha | false |
| 17 | Lowland | Dimaluna | Delta 3 | false |
| 18 | Lowland | Lam-an | Lima 3 | false |
| 19 | Lowland | Tabid | Tango 1 | false |
| 20 | Lowland | Bongbong | Bravo 8 | false |
| 21 | Coastal | Baybay Triunfo | Bravo 7 | true |
| 22 | Coastal | Malaubang | Mike 1 | true |
| 23 | Coastal | Catadman-Manabay | Charlie 6 | true |
| 24 | Coastal | San Antonio | Sierra 3 | true |

**`condition_options`**: `kind text check in ('weather','wind')`, `label text`, `severity int`,
`sort_order int`, `is_active bool`. Unique `(kind, label)`. Seed:

- weather: Sunny (0), Cloudy (1), Light rain (2), Moderate rain (3), Heavy rain (4), Torrential rain (5)
- wind: Not windy (0), Light wind (1), Moderate wind (2), Strong wind (3)

**`settings`**: a single row (`id int primary key default 1 check (id = 1)`) with `office_title`
("Office of the Mayor"), `office_lines text[]` (City Disaster Risk Reduction and Management Office;
City of Ozamiz, Misamis Occidental), `network_name` ("Nagkahiusang Alerto sa Ozamiz Radio
Communication Network"), `call_sign` ("Rescue Base"), `radio_frequency` ("148.710"),
`report_title` ("Barangay Weather SitRep"), `logo_urls text[]`.
Logos are stored in a public Storage bucket `cdrrmo-assets`.

### 5.2 People

**`users`**: `email citext unique not null`, `full_name text`, `position text` (default
"Radio Controller on Duty"), `role text check in ('super_admin','encoder')`, `is_active bool default true`,
`auth_user_id uuid unique null references auth.users on delete set null`, `last_sign_in_at timestamptz`.

- Seed: `berlcamp@gmail.com`, role `super_admin`.
- A trigger rejects any update or delete that would demote, deactivate or remove berlcamp@gmail.com.

### 5.3 Reports

**`reports`**:

- `report_at timestamptz not null`: the netcall time (e.g. 2026-10-07 10:50 +08).
- `prepared_by_name text`, `prepared_by_position text`.
- `remarks text`: general remarks, e.g. "All stations reported that their respective AOR are in normal situation."
- Summary overrides, all nullable text: `weather_summary_override`, `wind_summary_override`,
  `rivers_summary_override`, `roads_summary_override`, `coastal_summary_override`.
- `created_by`, `updated_by` → `users`.
- Index on `report_at desc`.

**`report_entries`**: one row per barangay per report.

- `report_id → reports on delete cascade`, `barangay_id → barangays`, unique `(report_id, barangay_id)`.
- A copy of the barangay at creation time: `barangay_name`, `callsign`, `zone_name`, `zone_sort`,
  `sort_order`, `monitors_coastal`. Past reports never change when barangay data is edited later.
- `responded bool not null default false`.
- `weather_option_id → condition_options null`, `wind_option_id → condition_options null`.
- `road text check in ('passable','unpassable') null`.
- `river text check in ('normal','above_normal') null`.
- `coastal text check in ('normal','above_normal') null`.
- `power text check in ('with_power','no_power') null`.
- `remarks text null`.
- `updated_by → users`.

**Rules**

- Creating a report (RPC `cdrrmo.create_report(report_at, prepared_by_name, prepared_by_position)`,
  `security invoker`) inserts the report and one entry per active barangay, ordered by zone and
  `sort_order`, all with `responded = false`.
- When `responded = false`, the UI shows "No response" and the condition fields are cleared.
  A trigger sets them to null, so the data stays consistent no matter which client writes it.
- Any condition field may be null even when `responded = true` (in the sample, Sangay Diot has no power status).
- Adding a barangay later does not change existing reports. An encoder can use "Add missing
  barangays" on a report to insert entries for active barangays that are not in it yet.

### 5.4 Summary logic

The summary logic is implemented once in TypeScript (`lib/summary.ts`), because it has to recompute
on the client as each Realtime update arrives. It is also mirrored in a SQL function,
`cdrrmo.report_summary(report_id)`, used by the archive list and the OG image. Both are tested
against the same fixtures (§11).

Only entries with `responded = true` count, unless stated otherwise.

| Field | Rule |
|---|---|
| Active stations | count of `responded = true` |
| No response | count of `responded = false` |
| Average weather | Take the weather labels whose share among responders with a weather value is **≥ 20%**. If there is one, use that label. If there are several, use the range from the lowest to the highest severity among them. If the two labels share a last word, join them as "Light to Moderate rain"; otherwise as "Cloudy to Light rain". If nobody reported weather, show "—". |
| Average wind | Same rule as weather |
| Rivers / canals | "ABOVE NORMAL (n)" if any entry is `above_normal`, otherwise "NORMAL" if any entry is `normal`, otherwise "—" |
| Roads / bridges | "UNPASSABLE (n)" if any entry is `unpassable`, otherwise "PASSABLE" / "—" |
| Coastal | Same as rivers, but only entries with `monitors_coastal = true` count |
| Power | "NO POWER (n)" if any, otherwise "WITH POWER" / "—" (shown on the website, not on the paper form) |

If a summary override is non-empty, it replaces the computed value.

## 6. Authentication and authorization

**Sign-in flow**

1. `/login` calls `signInWithOAuth({ provider: 'google', redirectTo: SITE_URL + '/auth/callback' })`.
2. `/auth/callback` exchanges the code, then calls the RPC `cdrrmo.claim_staff_account()`
   (`security definer`). The RPC reads the email from `auth.jwt()` and finds a case-insensitive
   match in `cdrrmo.users` where `is_active`. On a match, it sets `auth_user_id = auth.uid()` (only if
   it is null or already equal) and updates `last_sign_in_at`.
3. If there is no active match, the callback signs the user out and redirects to `/unauthorized`.
4. `app/admin/layout.tsx` loads the current staff user on every request and redirects if the user is
   missing or inactive. Each Server Action checks the role again before writing.

**Helper functions** (`security definer`, `stable`, `search_path = ''`):

- `cdrrmo.current_staff()` returns the active `users` row where `auth_user_id = auth.uid()`.
- `cdrrmo.is_staff()` and `cdrrmo.is_super_admin()`.

**RLS policies** (RLS is enabled on every table)

| Table | anon / any signed-in user | encoder | super_admin |
|---|---|---|---|
| zones, barangays, condition_options, settings | select | select | all |
| reports | select | select, insert, update | all (including delete) |
| report_entries | select | select, insert, update | all |
| users | — | select own row | all |

- Signed-in Google users from other apps on the shared project get only the anon-level access.
- Grants: `usage` on schema `cdrrmo` to `anon` and `authenticated`, with table privileges kept in line with the policies above.

## 7. Real-time updates

**Mechanism:** Supabase Realtime **Broadcast**, sent from Postgres triggers via
`realtime.send(payload jsonb, event text, topic text, private boolean)` with `private = false`.
Postgres Changes is not used. With many public viewers during a typhoon, Postgres Changes would run
an RLS check for every subscriber on every change, while Broadcast sends each change once.

**Triggers** (`after insert or update or delete`, `security definer`):

| Source | Topic | Event | Payload |
|---|---|---|---|
| `report_entries` | `cdrrmo:report:<report_id>` | `entry` | the full entry row (or `{ id, deleted: true }`) plus `updated_at` |
| `reports` | `cdrrmo:report:<id>` | `report` | the report row (header, remarks, overrides) or `{ deleted: true }` |
| `reports` insert/delete | `cdrrmo:reports` | `reports_changed` | `{ id, report_at, op }` |

**Client behavior** (`useLiveReport(reportId, initialData)` hook, used by both the public and encoder screens):

- Starts from the server-rendered snapshot, then subscribes to the report's topic.
- Applies each `entry` / `report` event to local state by id. An event is ignored if its `updated_at`
  is older than what the page already has.
- Recomputes the summary with `lib/summary.ts` after every change.
- On (re)connect, `visibilitychange` to visible, or `online`, the hook fetches the whole report again
  (anon select) to cover any events missed while disconnected.
- Shows the connection state: a "LIVE" dot with "Updated hh:mm:ss" when connected, and
  "Reconnecting…" (grey) when not.
- Changed rows get a 1.5-second highlight, skipped under `prefers-reduced-motion`.
- `/` also subscribes to `cdrrmo:reports`. When a newer report is created, a banner appears:
  "A new netcall report (1450H) has started — View".
  Tapping it switches to the new report on the client.
- If a report is deleted while open, the page shows "This report was removed" with a link to the current one.

## 8. UI

### 8.1 Design system (generated with ui-ux-pro-max)

- **Style:** Accessible & Ethical (government/public, high contrast, readable over slow mobile data).
- **Typography:** Atkinson Hyperlegible 400/700 via `next/font/google`; 16px minimum body text;
  tabular figures for numbers and times.
- **Color tokens** (CSS variables in the Tailwind v4 `@theme`):
  - primary `#0F172A` (navy header), accent `#0369A1` (actions), background `#F8FAFC`, card `#FFFFFF`,
    muted foreground `#475569`, border `#E2E8F0`.
  - Status colors: ok `#15803D`, warn `#B45309`, danger `#B91C1C`. A no-response row uses the danger
    color at 8% opacity with a "No response" label.
  - Status is never shown by color alone: every status has an icon and a text label.
  - Dark mode follows `prefers-color-scheme`, with all pairs checked to at least 4.5:1 contrast.
- **Icons:** Lucide (CloudRain, Wind, Route, Waves, Anchor, Zap, ZapOff, Radio). No emoji.
- **Interaction:** touch targets of at least 44×44px, visible 3px focus rings, a skip link, and
  150–200ms transitions only.
- **Components:** shadcn/ui (Button, Dialog, Table, Select, ToggleGroup, Input, Sonner toasts, Badge).

### 8.2 Public report page (`/`, `/reports/[id]`)

1. **Header** (navy): logos from settings, office title and lines, network name, call sign and frequency.
2. **Report bar:** report title, "October 7, 2026 – 1050H" in large text, the live status indicator,
   and a "Latest" badge if this is the newest report (otherwise "Older report — view latest").
3. **Summary tiles:** Active stations shown as "15 / 24" with a progress ring, No response, Average weather,
   Average wind, Rivers/Canals, Roads/Bridges, Coastal, Power.
   Two columns on phones and four on desktop.
4. **Filter bar:** zone chips (All, Upland, Midland, Lowland, Coastal) and an "Issues only" toggle
   (no response, unpassable, above normal, no power).
5. **Barangay list**, grouped by zone in roll-call order:
   - **Below 768px:** cards showing barangay name, callsign, weather and wind chips, and four status
     icons with labels (road, river, coastal when monitored, power) plus remarks.
   - **768px and up:** a table matching the paper form columns: No. · Barangay · Callsign ·
     Weather · Wind · Road · River/Canal · Coastal · Power · Remarks. Zone names appear as group header
     rows, and a cell with an issue shows a colored badge.
6. **Footer section:** general remarks, "Prepared by: NAME, POSITION", Share buttons, and an
   "All reports" link.

### 8.3 Archive (`/reports`)

Grouped by day (Asia/Manila), newest first. Each item shows the time (1050H), active / no response
counts, average weather, and a badge for any issue. The list is paginated 20 days per page.

### 8.4 Encoder screen (`/admin/reports/[id]`)

- **Top:** report time (editable), prepared by (defaults to the encoder's name and position), and the
  live summary strip.
- **Roll-call list:** one row per barangay in netcall order, showing the large callsign, the barangay
  name and a compact status summary. Tapping a row opens an inline editor (a bottom sheet on phones)
  with:
  - **"Responded – all normal"**: sets responded, road passable, river normal, coastal normal (if
    monitored), power with power. Weather and wind stay as selected.
  - **"No response"**: sets `responded = false`.
  - Weather and Wind as chip groups from `condition_options`.
  - Segmented toggles for Road, River, Coastal (only if `monitors_coastal`) and Power.
  - Remarks input.
  - "Next barangay" moves to the next row in roll-call order (also via keyboard: Enter).
- **Saving:** every field change calls the Server Action `updateEntry(entryId, patch)` right away,
  using optimistic UI. Each row shows Saving… / Saved / Failed – retry. Failed saves are retried with
  backoff (1s, 2s, 4s, max 30s) and kept in memory until they succeed. Leaving the page with unsaved
  changes asks for confirmation.
- **Report panel:** general remarks plus the summary override fields, each placeholdered with the
  computed value.
- **Share panel:** public URL, Copy link, Share to Facebook, and a link to the Facebook Sharing
  Debugger to refresh the preview.
- **Concurrent encoders:** both screens apply each other's broadcasts, and the last write wins for each field.

### 8.5 Admin screens

- **Users:** a table of email, name, position, role, active, last sign-in, and an "Add staff" dialog
  (email, name, position, role). The super admin row is locked.
- **Barangays:** a table with inline edit (name, callsign, zone, coastal flag, active) and drag-to-reorder
  within a zone (sets `sort_order`).
- **Options:** two lists (weather and wind) with label, severity, active, and reorder.
- **Settings:** header text fields and logo upload to `cdrrmo-assets`.

## 9. Facebook sharing

- Every report page sets `generateMetadata`:
  - `og:title`: "Barangay Weather SitRep – Oct 7, 2026 1050H"
  - `og:description`: "15/24 stations active · Light to Moderate rain · Not windy · Roads passable · Rivers normal"
  - `og:url` is the canonical `/reports/[id]`, plus `og:type`, `og:site_name` and the Twitter card.
  - `/` uses the current report's metadata, with `og:url` pointing at `/`.
- `app/reports/[id]/opengraph-image.tsx` uses `next/og` ImageResponse at 1200×630 to render the navy
  header and logos, the date and time, a large "15/24 ACTIVE", weather and wind, and status pills for
  roads, rivers and coastal. It uses the Atkinson Hyperlegible font. The image is generated on
  request, so Facebook gets the numbers current at the time it fetches the link.
- Share actions:
  - Facebook: `https://www.facebook.com/sharer/sharer.php?u=<url>`
  - Copy link.
  - `navigator.share` when available (on mobile).

## 10. Error handling

- **Unauthorized Google account:** signed out, then `/unauthorized` with a message to contact the CDRRMO admin.
- **Server Actions** return `{ ok: true, data } | { ok: false, message }`. They never throw to the
  client. Field-level errors are shown next to the field or row.
- **Validation:** zod schemas shared between client and server. The database check constraints are the last line of defense.
- **Realtime disconnects:** handled as described in §7. The public page never shows stale data
  without the "Reconnecting…" indicator.
- **Not found:** an unknown report id returns 404 with links to the current report and the archive.
  `/` with no reports shows "No netcall reports yet".
- **Delete:** super admin only, through a confirmation dialog that requires typing the report time.

## 11. Testing

- **Unit (Vitest):** `lib/summary.ts` against fixtures. One fixture is the full 2026-10-07 1050H
  sample, which must give 15 / 9 / "Light to Moderate rain" / "Not windy" / NORMAL / PASSABLE / NORMAL.
  Edge cases: no responders, a tie at the 20% threshold, a single label, overrides.
- **SQL:** `cdrrmo.report_summary()` checked against the same fixture inserted into a scratch
  report through the Supabase MCP (cleaned up afterward).
- **RLS:** scripted checks for anon, a signed-in non-staff user, an encoder and the super admin. Each
  checks allowed and denied select, insert, update and delete per table, the super-admin protection
  trigger, and `claim_staff_account()`.
- **Realtime:** an integration script subscribes to `cdrrmo:report:<id>` with the anon key, updates
  an entry, and checks that the event arrives within 2 seconds.
- **E2E (Playwright):** public pages (render, filters, OG meta tags, live update when a row changes in
  the database) and the encoder flow, using a test session cookie created for a test encoder.
- **Before completion:** `next build` and lint pass, Supabase security and performance advisors are
  clean for `cdrrmo`, Lighthouse accessibility scores at least 95 on the public page, and a manual check
  at 375, 768, 1024 and 1440px.

## 12. Out of scope (v1)

Map view, SMS or push alerts, barangays reporting for themselves, PDF or image export of the full
table, charts across reports, an edit-history audit log, and offline encoding.

## 13. Project structure (planned)

```
app/
  (public)/page.tsx, reports/page.tsx, reports/[id]/{page.tsx, opengraph-image.tsx}
  login/, auth/callback/route.ts, unauthorized/
  admin/{layout.tsx, reports/, reports/[id]/, barangays/, options/, settings/, users/}
components/  report/ (SummaryTiles, BarangayCards, BarangayTable, LiveIndicator, ShareButtons)
             encoder/ (RollCallList, EntryEditor, ReportPanel)  ui/ (shadcn)
lib/         supabase/{server.ts, client.ts}, summary.ts, auth.ts, format.ts, validation.ts
hooks/       useLiveReport.ts
proxy.ts
supabase/migrations/*.sql
docs/superpowers/specs/, docs/superpowers/plans/
```
