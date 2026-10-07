# CDRRMO Barangay Weather SitRep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 16 + Supabase app where CDRRMO radio controllers encode the Barangay Weather SitRep during the netcall, and the public sees every change live on a shareable, Facebook-ready website.

**Architecture:**
- **Data and access:** Postgres (schema `cdrrmo` on the shared Supabase project "Asenso") holds all data. Access is enforced with row-level security (RLS) and an email allowlist (`cdrrmo.users`).
- **Writes:** go through Next.js Server Actions using the signed-in user's session.
- **Live updates:** Postgres triggers push every row change to public Supabase Realtime **Broadcast** channels, and a client hook applies them to the server-rendered page.
- **Summary:** one pure TypeScript module (`lib/summary.ts`) computes the summary on both server and client.

**Tech Stack:**
- Next.js 16.4 (App Router, React 19, `proxy.ts`), TypeScript, Tailwind CSS v4, shadcn/ui, lucide-react.
- @supabase/ssr 0.12.7 and @supabase/supabase-js 2.117.2, zod 4.6.
- Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-10-07-cdrrmo-weather-sitrep-design.md`

## Global Constraints

- Next.js **16.4.0**. Use `proxy.ts` (not `middleware.ts`). `params`/`searchParams` are Promises and must be awaited.
- Supabase project ref **`jwpaamhdlufycuopiguy`** (Asenso), shared with other apps. Everything lives in schema **`cdrrmo`**. Never touch other schemas.
- Super admin is exactly **`berlcamp@gmail.com`**. It cannot be demoted, deactivated, renamed or deleted, and no other user can be super admin.
- Roles: `super_admin`, `encoder` only.
- Emails are stored lowercase (`check (email = lower(email))`).
- **No draft/publish.** Reports are public from creation and are always live. Only the super admin deletes reports.
- Realtime uses **Broadcast** via `realtime.send(payload, event, topic, false)`. Topics: `cdrrmo:report:<id>` (events `entry`, `report`) and `cdrrmo:reports` (event `reports_changed`).
- Average weather/wind rule: count only labels with share **≥ 20%** of responders that reported that field. Use the range from the lowest to the highest severity among them. If no label reaches 20%, use the range over all reported labels.
- Display timezone **Asia/Manila** (fixed +08:00). Report time format: `October 7, 2026 – 1050H`.
- UI: Atkinson Hyperlegible, body ≥ 16px, touch targets ≥ 44px, visible focus rings, status never shown by color alone, Lucide icons (no emoji), dark mode via `prefers-color-scheme`.
- Colors:
  - Navy header `--brand #0F172A`, action blue `--primary #0369A1`, background `#F8FAFC`.
  - Status: ok `#15803D`, warn `#B45309`, danger `#B91C1C`.
- The app never uses the Supabase service-role key.
- Every Server Action re-checks the role and returns `ActionResult` (`{ ok: true, data } | { ok: false, message, retryable }`). Actions never throw to the client, except for `redirect()`.

## Review Focus

1. **An encoder loses connectivity mid-netcall.** Their change must stay visible as "Not saved", retry with backoff (1s → 2s → 4s … ≤ 30s), and never be silently dropped. Leaving the page warns first. Pinned by `backoff` and `merge/omit` tests (Task 8) and the saver logic (Task 15).
2. **A viewer's phone sleeps or the network drops.** On resume the page re-fetches everything, and a late broadcast carrying an **older** `updated_at` must not overwrite newer data. Pinned by the reducer staleness tests (Task 7).
3. **A Google user from another app on the shared project signs in.** They must get no write access and land on `/unauthorized`. A non-Google sign-in using a staff email must not claim the account. Mixed-case Google emails must still match. Pinned by the RLS script (Task 3) and the `safeNextPath` tests (Task 9).
4. **Odd condition data:** zero responders, every barangay reporting a different weather label (all below 20%), or a tie exactly at 20%. The summary must show `—` or a sensible range and never crash. Pinned in the summary tests (Task 6).
5. **A netcall just after midnight (e.g. 0005H).** It must show and group under the correct Manila date, not the UTC date. Pinned in the format tests (Task 5) and archive grouping tests (Task 12).

---

## File Structure

```
app/
  layout.tsx                         root layout: font, metadataBase, skip link, Toaster
  globals.css                        design tokens (light/dark), Tailwind v4 theme
  page.tsx                           current report (live)
  not-found.tsx
  reports/page.tsx                   archive
  reports/[id]/page.tsx              one report (live, shareable)
  reports/[id]/og/route.tsx          1200×630 Open Graph image
  login/page.tsx, login/login-button.tsx
  auth/callback/route.ts             code exchange + allowlist claim
  unauthorized/page.tsx
  admin/layout.tsx, admin/admin-nav.tsx, admin/auth-actions.ts, admin/page.tsx
  admin/reports/{page.tsx, new-report-dialog.tsx, actions.ts}
  admin/reports/[id]/{page.tsx, actions.ts}
  admin/users/{page.tsx, users-manager.tsx, actions.ts}
  admin/barangays/{page.tsx, barangays-manager.tsx, actions.ts}
  admin/options/{page.tsx, options-manager.tsx, actions.ts}
  admin/settings/{page.tsx, settings-form.tsx, actions.ts}
components/
  ui/*                               shadcn (generated)
  form-field.tsx                     label + control + error
  facebook-icon.tsx
  report/                            public report UI (header, bar, tiles, cards, table, filters, share, banner, footer, live view)
  encoder/                           encoding UI (encoder-view, roll-call-list, entry-editor, choice-group, blur-input, report-details, report-remarks, delete-report-dialog)
hooks/
  use-live-report.ts                 SSR snapshot + Broadcast + resync
  use-newer-report.ts                "new netcall started" watcher
  use-entry-saver.ts                 optimistic per-row save queue with retry
lib/
  env.ts, site.ts, types.ts, ids.ts, format.ts, labels.ts, summary.ts, filter.ts, archive.ts,
  reorder.ts, validation.ts, encoder-patches.ts, backoff.ts, action-result.ts, auth-redirect.ts,
  auth.ts, report-metadata.ts, settings-defaults.ts
  live/report-state.ts               pure reducer for live updates
  supabase/{server.ts, browser.ts, public.ts, db.ts}
  data/{report-bundle.ts, public.ts, admin.ts}
proxy.ts
supabase/migrations/0001_schema.sql, 0002_auth_rls.sql, 0003_realtime.sql, 0004_storage.sql
supabase/seed/sample_report_2026-10-07.sql
supabase/tests/rls_test.sql
scripts/check-realtime.mjs, scripts/watch-live.mjs
tests/unit/*.test.ts, tests/fixtures/sample-sitrep.ts
e2e/public.spec.ts, playwright.config.ts, vitest.config.ts
assets/fonts/AtkinsonHyperlegible-{Regular,Bold}.ttf
```

**How Supabase is called:** clients are untyped, and every query goes through `cdrrmo(client)` (= `client.schema('cdrrmo')`). Results are cast to the domain types in `lib/types.ts`.

---

### Task 1: Scaffold the Next.js 16 app, tooling and design tokens

**Files:**
- Create: whole Next.js scaffold, `app/globals.css`, `app/layout.tsx`, `lib/env.ts`, `lib/site.ts`, `vitest.config.ts`, `tests/unit/site.test.ts`, `.env.example`, `.env.local`, `assets/fonts/*.ttf`, `components/facebook-icon.tsx`, `components/form-field.tsx`
- Modify: `package.json` (scripts), `next.config.ts`, `.gitignore`

**Interfaces:**
- Produces:
  - `env.supabaseUrl: string`, `env.supabaseKey: string` (`lib/env.ts`).
  - `SITE_NAME`, `siteUrl(): string`, `reportUrl(id: string): string`, `facebookShareUrl(url: string): string`, `facebookDebuggerUrl(url: string): string` (`lib/site.ts`).
  - `FormField({ label, htmlFor, hint?, error?, children })`.
  - `FacebookIcon(props: SVGProps<SVGSVGElement>)`.
  - Tailwind color utilities: `bg-brand text-brand-foreground`, `ok/warn/danger` + `-soft`, shadcn tokens. `animate-flash`. `.tabular`.

- [ ] **Step 1: Create the app** (the folder already holds `.git` and `docs/`, which create-next-app allows)

```bash
cd /Users/berltreasurecampomanes/Documents/GithubBuilds/cdrrmo-alert-system
npx create-next-app@16.4.0 . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```
Expected: "Success! Created cdrrmo-alert-system". If it asks about React Compiler, answer **No**.

- [ ] **Step 2: Install dependencies**

```bash
npm i @supabase/supabase-js@2.117.2 @supabase/ssr@0.12.7 zod@4.6.5 lucide-react server-only
npm i -D vitest@5.0.3 @playwright/test@1.63.0
```

- [ ] **Step 3: Initialize shadcn/ui and add components**

```bash
npx shadcn@4.21.3 init --defaults --yes
npx shadcn@4.21.3 add button input label dialog badge textarea sonner --yes
```
If `init` prompts, choose: style default, base color **Neutral**, CSS variables **yes**, component library **Radix** if asked. Components in this plan never use `asChild` or `render` props, so they work with either primitive library. Expected files: `components/ui/{button,input,label,dialog,badge,textarea,sonner}.tsx` and `lib/utils.ts` (exports `cn`).

- [ ] **Step 4: Replace `app/globals.css` with the design tokens**

```css
@import "tailwindcss";
@import "tw-animate-css";

:root {
  --radius: 0.625rem;
  --background: #f8fafc;
  --foreground: #020617;
  --card: #ffffff;
  --card-foreground: #020617;
  --popover: #ffffff;
  --popover-foreground: #020617;
  --primary: #0369a1;
  --primary-foreground: #ffffff;
  --secondary: #e8ecf1;
  --secondary-foreground: #0f172a;
  --muted: #e8ecf1;
  --muted-foreground: #475569;
  --accent: #e8ecf1;
  --accent-foreground: #0f172a;
  --destructive: #b91c1c;
  --border: #e2e8f0;
  --input: #cbd5e1;
  --ring: #0369a1;
  --brand: #0f172a;
  --brand-foreground: #ffffff;
  --ok: #15803d;
  --ok-soft: #dcfce7;
  --warn: #b45309;
  --warn-soft: #fef3c7;
  --danger: #b91c1c;
  --danger-soft: #fee2e2;
  --on-status: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #020617;
    --foreground: #f1f5f9;
    --card: #0f172a;
    --card-foreground: #f1f5f9;
    --popover: #0f172a;
    --popover-foreground: #f1f5f9;
    --primary: #38bdf8;
    --primary-foreground: #082f49;
    --secondary: #1e293b;
    --secondary-foreground: #f1f5f9;
    --muted: #1e293b;
    --muted-foreground: #cbd5e1;
    --accent: #1e293b;
    --accent-foreground: #f1f5f9;
    --destructive: #f87171;
    --border: #1e293b;
    --input: #334155;
    --ring: #38bdf8;
    --brand: #0b1220;
    --brand-foreground: #f8fafc;
    --ok: #4ade80;
    --ok-soft: #052e16;
    --warn: #fbbf24;
    --warn-soft: #451a03;
    --danger: #f87171;
    --danger-soft: #450a0a;
    --on-status: #020617;
  }
}

@theme inline {
  --font-sans: var(--font-atkinson), ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-ok: var(--ok);
  --color-ok-soft: var(--ok-soft);
  --color-warn: var(--warn);
  --color-warn-soft: var(--warn-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-on-status: var(--on-status);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --animate-flash: flash 1.5s ease-out;

  @keyframes flash {
    0% { background-color: color-mix(in oklab, var(--primary) 22%, transparent); }
    100% { background-color: transparent; }
  }
}

@layer base {
  * { @apply border-border outline-ring/50; }
  html { font-size: 16px; }
  body { @apply bg-background text-foreground antialiased; line-height: 1.5; }
  :focus-visible { outline: 3px solid var(--ring); outline-offset: 2px; }
  .tabular { font-variant-numeric: tabular-nums; }
}
```

- [ ] **Step 5: Download the OG-image fonts** (OFL-licensed)

```bash
mkdir -p assets/fonts
curl -fL -o assets/fonts/AtkinsonHyperlegible-Regular.ttf https://github.com/google/fonts/raw/main/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf
curl -fL -o assets/fonts/AtkinsonHyperlegible-Bold.ttf https://github.com/google/fonts/raw/main/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Bold.ttf
file assets/fonts/*.ttf
```
Expected: both reported as "TrueType Font data".

- [ ] **Step 6: Write `lib/env.ts`, `lib/site.ts`, `components/facebook-icon.tsx`, `components/form-field.tsx`**

`lib/env.ts`:
```ts
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  supabaseUrl: required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
  supabaseKey: required(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
};
```

`lib/site.ts`:
```ts
export const SITE_NAME = 'CDRRMO Ozamiz – Barangay Weather SitRep';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function reportUrl(id: string): string {
  return `${siteUrl()}/reports/${id}`;
}

export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function facebookDebuggerUrl(url: string): string {
  return `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(url)}`;
}
```

`components/facebook-icon.tsx`:
```tsx
import type { SVGProps } from 'react';

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}
```

`components/form-field.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export function FormField({ label, htmlFor, hint, error, children }: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-bold">{label}</Label>
      {children}
      {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Replace `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { SITE_NAME, siteUrl } from '@/lib/site';
import './globals.css';

const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: '%s · CDRRMO Ozamiz' },
  description: 'Live barangay weather situation reports from the Ozamiz City Disaster Risk Reduction and Management Office.',
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_PH' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f172a' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={atkinson.variable}>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:font-bold"
        >
          Skip to content
        </a>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
```
Delete the scaffold's `app/page.module.css` if present, and replace `app/page.tsx` with a placeholder (Task 11 replaces it):
```tsx
export default function HomePage() {
  return <main id="main" className="p-6">CDRRMO SitRep</main>;
}
```

- [ ] **Step 8: Config files**

`next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/reports/[id]/og': ['./assets/fonts/**'],
  },
};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
```

In `package.json` `"scripts"`, keep `dev`/`build`/`start`/`lint` and add:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit",
"test:e2e": "playwright test"
```

Append to `.gitignore`:
```
/test-results
/playwright-report
/blob-report
```
(`.env*` is already ignored by the scaffold. Confirm with `grep -n "env" .gitignore` and add `.env*.local` if missing.)

- [ ] **Step 9: Environment values**

Call the Supabase MCP tools `get_project_url` and `get_publishable_keys` with `project_id: "jwpaamhdlufycuopiguy"`. Use the key whose name starts with `sb_publishable_` if present, otherwise the legacy `anon` key.

`.env.example` (committed):
```
NEXT_PUBLIC_SUPABASE_URL=https://jwpaamhdlufycuopiguy.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
`.env.local` (not committed): the same three lines with the real key filled in.

- [ ] **Step 10: Write the failing test `tests/unit/site.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { facebookDebuggerUrl, facebookShareUrl, reportUrl, siteUrl } from '@/lib/site';

describe('site urls', () => {
  it('builds absolute report and share urls', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://sitrep.example.ph/';
    expect(siteUrl()).toBe('https://sitrep.example.ph');
    expect(reportUrl('abc')).toBe('https://sitrep.example.ph/reports/abc');
    expect(facebookShareUrl('https://x.ph/reports/a?b=1')).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fx.ph%2Freports%2Fa%3Fb%3D1',
    );
    expect(facebookDebuggerUrl('https://x.ph/r')).toBe('https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fx.ph%2Fr');
  });
});
```

- [ ] **Step 11: Run tests, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: 1 test passes, lint has no errors, build succeeds.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with design tokens and tooling"
```

---

### Task 2: Database schema and seed data (`0001_schema.sql`)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces: tables `cdrrmo.zones, barangays, condition_options, settings, users, reports, report_entries` (columns exactly as below); trigger functions `cdrrmo.set_updated_at()`, `cdrrmo.clear_unresponded_entry()`, `cdrrmo.protect_super_admin()`; seeded reference data.

- [ ] **Step 1: Write `supabase/migrations/0001_schema.sql`**

```sql
-- CDRRMO Barangay Weather SitRep: schema, constraints, triggers, seed data.
create schema if not exists cdrrmo;

create or replace function cdrrmo.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table cdrrmo.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cdrrmo.barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  callsign text not null,
  zone_id uuid not null references cdrrmo.zones (id) on delete restrict,
  sort_order int not null default 0,
  monitors_coastal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index barangays_zone_id_idx on cdrrmo.barangays (zone_id);

create table cdrrmo.condition_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('weather', 'wind')),
  label text not null,
  severity int not null default 0,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, label)
);

create table cdrrmo.settings (
  id int primary key default 1 check (id = 1),
  office_title text not null default 'Office of the Mayor',
  office_lines text[] not null default array['City Disaster Risk Reduction and Management Office', 'City of Ozamiz, Misamis Occidental'],
  network_name text not null default 'Nagkahiusang Alerto sa Ozamiz Radio Communication Network',
  call_sign text not null default 'Rescue Base',
  radio_frequency text not null default '148.710',
  report_title text not null default 'Barangay Weather SitRep',
  logo_urls text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table cdrrmo.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null default '',
  position text not null default 'Radio Controller on Duty',
  role text not null default 'encoder' check (role in ('super_admin', 'encoder')),
  is_active boolean not null default true,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint only_owner_is_super_admin check (role <> 'super_admin' or email = 'berlcamp@gmail.com')
);

create table cdrrmo.reports (
  id uuid primary key default gen_random_uuid(),
  report_at timestamptz not null,
  prepared_by_name text not null default '',
  prepared_by_position text not null default 'Radio Controller on Duty',
  remarks text not null default '',
  weather_summary_override text,
  wind_summary_override text,
  rivers_summary_override text,
  roads_summary_override text,
  coastal_summary_override text,
  created_by uuid references cdrrmo.users (id) on delete set null,
  updated_by uuid references cdrrmo.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_report_at_idx on cdrrmo.reports (report_at desc);
create index reports_created_by_idx on cdrrmo.reports (created_by);
create index reports_updated_by_idx on cdrrmo.reports (updated_by);

create table cdrrmo.report_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references cdrrmo.reports (id) on delete cascade,
  barangay_id uuid not null references cdrrmo.barangays (id) on delete restrict,
  barangay_name text not null,
  callsign text not null,
  zone_name text not null,
  zone_sort int not null,
  sort_order int not null,
  monitors_coastal boolean not null,
  responded boolean not null default false,
  weather_option_id uuid references cdrrmo.condition_options (id) on delete set null,
  wind_option_id uuid references cdrrmo.condition_options (id) on delete set null,
  road text check (road in ('passable', 'unpassable')),
  river text check (river in ('normal', 'above_normal')),
  coastal text check (coastal in ('normal', 'above_normal')),
  power text check (power in ('with_power', 'no_power')),
  remarks text,
  updated_by uuid references cdrrmo.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, barangay_id)
);
create index report_entries_barangay_id_idx on cdrrmo.report_entries (barangay_id);
create index report_entries_weather_idx on cdrrmo.report_entries (weather_option_id);
create index report_entries_wind_idx on cdrrmo.report_entries (wind_option_id);
create index report_entries_updated_by_idx on cdrrmo.report_entries (updated_by);

-- updated_at on every table
do $$
declare t text;
begin
  foreach t in array array['zones', 'barangays', 'condition_options', 'settings', 'users', 'reports', 'report_entries'] loop
    execute format('create trigger set_updated_at before update on cdrrmo.%I for each row execute function cdrrmo.set_updated_at()', t);
  end loop;
end $$;

-- "No response" rows never keep condition values; coastal only where monitored.
create or replace function cdrrmo.clear_unresponded_entry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.responded then
    new.weather_option_id := null;
    new.wind_option_id := null;
    new.road := null;
    new.river := null;
    new.coastal := null;
    new.power := null;
  end if;
  if not new.monitors_coastal then
    new.coastal := null;
  end if;
  return new;
end $$;
create trigger clear_unresponded before insert or update on cdrrmo.report_entries
  for each row execute function cdrrmo.clear_unresponded_entry();

-- The owner account can never be demoted, deactivated, renamed or deleted.
create or replace function cdrrmo.protect_super_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.email = 'berlcamp@gmail.com' then
      raise exception 'The super admin account cannot be removed';
    end if;
    return old;
  end if;
  if old.email = 'berlcamp@gmail.com'
     and (new.email <> old.email or new.role <> 'super_admin' or not new.is_active) then
    raise exception 'The super admin account cannot be demoted, deactivated or renamed';
  end if;
  return new;
end $$;
create trigger protect_super_admin before update or delete on cdrrmo.users
  for each row execute function cdrrmo.protect_super_admin();

-- Seed data
insert into cdrrmo.zones (name, sort_order) values
  ('Upland', 1), ('Midland', 2), ('Lowland', 3), ('Coastal', 4);

insert into cdrrmo.barangays (name, callsign, zone_id, sort_order, monitors_coastal)
select v.name, v.callsign, z.id, v.sort_order, v.monitors_coastal
from (values
  ('Stimson Abordo', 'Sierra 5', 'Upland', 1, false),
  ('Gala', 'Golf 2', 'Upland', 2, false),
  ('Guimad', 'Golf 5', 'Upland', 3, false),
  ('Trigos', 'Tango 3', 'Upland', 4, false),
  ('Dalapang', 'Delta 1', 'Upland', 5, false),
  ('Cogon', 'Charlie 8', 'Upland', 6, false),
  ('Embargo', 'Eagle', 'Midland', 7, false),
  ('Pantaon', 'Papa 1', 'Midland', 8, false),
  ('Pulot', 'Papa 2', 'Midland', 9, false),
  ('Calabayan', 'Charlie 1', 'Midland', 10, false),
  ('Kinuman Sur', 'Kilo 2', 'Midland', 11, false),
  ('Sangay Diot', 'Sierra 1', 'Midland', 12, false),
  ('Cavinte', 'Charlie 7', 'Midland', 13, false),
  ('Balintawak', 'Bravo 3', 'Lowland', 14, false),
  ('Bañadero', 'Bravo 4', 'Lowland', 15, false),
  ('Aguada', 'Alpha', 'Lowland', 16, false),
  ('Dimaluna', 'Delta 3', 'Lowland', 17, false),
  ('Lam-an', 'Lima 3', 'Lowland', 18, false),
  ('Tabid', 'Tango 1', 'Lowland', 19, false),
  ('Bongbong', 'Bravo 8', 'Lowland', 20, false),
  ('Baybay Triunfo', 'Bravo 7', 'Coastal', 21, true),
  ('Malaubang', 'Mike 1', 'Coastal', 22, true),
  ('Catadman-Manabay', 'Charlie 6', 'Coastal', 23, true),
  ('San Antonio', 'Sierra 3', 'Coastal', 24, true)
) as v (name, callsign, zone, sort_order, monitors_coastal)
join cdrrmo.zones z on z.name = v.zone;

insert into cdrrmo.condition_options (kind, label, severity, sort_order) values
  ('weather', 'Sunny', 0, 0),
  ('weather', 'Cloudy', 1, 1),
  ('weather', 'Light rain', 2, 2),
  ('weather', 'Moderate rain', 3, 3),
  ('weather', 'Heavy rain', 4, 4),
  ('weather', 'Torrential rain', 5, 5),
  ('wind', 'Not windy', 0, 0),
  ('wind', 'Light wind', 1, 1),
  ('wind', 'Moderate wind', 2, 2),
  ('wind', 'Strong wind', 3, 3);

insert into cdrrmo.settings (id) values (1);

insert into cdrrmo.users (email, full_name, position, role)
values ('berlcamp@gmail.com', 'Super Admin', 'CDRRMO Administrator', 'super_admin');
```

- [ ] **Step 2: Apply the migration**

Call the Supabase MCP `apply_migration` with `project_id: "jwpaamhdlufycuopiguy"`, `name: "cdrrmo_0001_schema"` and `query` set to the file contents.
Expected: success.

- [ ] **Step 3: Verify the seed and constraints** (MCP `execute_sql`)

```sql
select
  (select count(*) from cdrrmo.zones) as zones,
  (select count(*) from cdrrmo.barangays) as barangays,
  (select count(*) from cdrrmo.barangays where monitors_coastal) as coastal,
  (select count(*) from cdrrmo.condition_options) as options,
  (select count(*) from cdrrmo.settings) as settings,
  (select role from cdrrmo.users where email = 'berlcamp@gmail.com') as owner_role;
```
Expected: `zones 4, barangays 24, coastal 4, options 10, settings 1, owner_role super_admin`.

Then check that the owner protection rejects changes:
```sql
update cdrrmo.users set is_active = false where email = 'berlcamp@gmail.com';
```
Expected: ERROR "The super admin account cannot be demoted, deactivated or renamed".

- [ ] **Step 4: Ask the owner to expose the schema** (manual, blocks Task 11 onward)

Tell the user: "In the Supabase dashboard for **Asenso** → Project Settings → Data API → *Exposed schemas*, add `cdrrmo` and save." Then verify, replacing `<KEY>` with the publishable key from `.env.local`:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://jwpaamhdlufycuopiguy.supabase.co/rest/v1/zones?select=name" \
  -H "apikey: <KEY>" -H "Accept-Profile: cdrrmo"
```
Expected after Task 3 grants exist: `200`. Before the owner exposes the schema the response is `406` (PGRST106). Re-run this check at the end of Task 3.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat(db): add cdrrmo schema, constraints and seed data"
```

---

### Task 3: Auth helpers, RPCs, RLS and grants (`0002_auth_rls.sql`) with an RLS test script

**Files:**
- Create: `supabase/migrations/0002_auth_rls.sql`, `supabase/tests/rls_test.sql`

**Interfaces:**
- Consumes: Task 2 tables.
- Produces (callable by `authenticated`):
  - `cdrrmo.current_staff() returns setof cdrrmo.users`
  - `cdrrmo.is_staff() returns boolean`
  - `cdrrmo.is_super_admin() returns boolean`
  - `cdrrmo.claim_staff_account() returns setof cdrrmo.users`
  - `cdrrmo.create_report(p_report_at timestamptz, p_prepared_by_name text, p_prepared_by_position text) returns uuid`
  - `cdrrmo.add_missing_barangays(p_report_id uuid) returns integer`

- [ ] **Step 1: Write the test first, `supabase/tests/rls_test.sql`**

```sql
-- RLS / auth acceptance test. Run the whole file with the Supabase MCP execute_sql.
-- PASS = the call fails with exactly: RLS_TESTS_PASSED
-- (that final RAISE rolls back every fixture). Any other error names the failing check.
do $test$
declare
  v_taken uuid[];
  v_admin_auth uuid;
  v_encoder_auth uuid;
  v_outsider_auth uuid;
  v_report uuid;
  v_entry uuid;
  v_new_report uuid;
  n int;
begin
  select coalesce(array_agg(auth_user_id) filter (where auth_user_id is not null), '{}')
    into v_taken from cdrrmo.users;
  select auth_user_id into v_admin_auth from cdrrmo.users where email = 'berlcamp@gmail.com';
  if v_admin_auth is null then
    select id into v_admin_auth from auth.users where id <> all (v_taken) order by created_at limit 1;
    update cdrrmo.users set auth_user_id = v_admin_auth where email = 'berlcamp@gmail.com';
  end if;
  select id into v_encoder_auth from auth.users
    where id <> all (v_taken) and id <> v_admin_auth order by created_at limit 1;
  select id into v_outsider_auth from auth.users
    where id <> all (v_taken) and id not in (v_admin_auth, v_encoder_auth) order by created_at limit 1;
  if v_encoder_auth is null or v_outsider_auth is null then
    raise exception 'SETUP: need at least 3 auth users';
  end if;

  insert into cdrrmo.users (email, full_name, role) values ('rls-test-encoder@example.com', 'RLS Test Encoder', 'encoder');
  insert into cdrrmo.reports (report_at, prepared_by_name) values (now(), 'RLS fixture') returning id into v_report;
  insert into cdrrmo.report_entries (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal)
    select v_report, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal
    from cdrrmo.barangays b join cdrrmo.zones z on z.id = b.zone_id;
  select id into v_entry from cdrrmo.report_entries where report_id = v_report order by sort_order limit 1;

  ---------------------------------------------------------------- anon
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from cdrrmo.report_entries where report_id = v_report;
  if n = 0 then raise exception 'FAIL anon: cannot read report entries'; end if;
  select count(*) into n from cdrrmo.barangays;
  if n = 0 then raise exception 'FAIL anon: cannot read barangays'; end if;
  begin
    select count(*) into n from cdrrmo.users;
    if n > 0 then raise exception 'FAIL anon: can read users'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into cdrrmo.zones (name, sort_order) values ('rls-zone', 99);
    raise exception 'FAIL anon: inserted a zone';
  exception when insufficient_privilege then null;
  end;
  begin
    update cdrrmo.report_entries set remarks = 'anon' where id = v_entry;
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL anon: updated an entry'; end if;
  exception when insufficient_privilege then null;
  end;

  ---------------------------------------------------------------- outsider (Google user, not staff)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_outsider_auth, 'role', 'authenticated', 'email', 'outsider@example.com',
    'app_metadata', json_build_object('provider', 'google'))::text, true);
  select count(*) into n from cdrrmo.report_entries where report_id = v_report;
  if n = 0 then raise exception 'FAIL outsider: cannot read entries'; end if;
  select count(*) into n from cdrrmo.users;
  if n > 0 then raise exception 'FAIL outsider: can read users'; end if;
  select count(*) into n from cdrrmo.claim_staff_account();
  if n > 0 then raise exception 'FAIL outsider: claimed a staff account'; end if;
  update cdrrmo.report_entries set remarks = 'outsider' where id = v_entry;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL outsider: updated an entry'; end if;
  begin
    insert into cdrrmo.reports (report_at) values (now());
    raise exception 'FAIL outsider: inserted a report';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cdrrmo.create_report(now(), 'x', 'y');
    raise exception 'FAIL outsider: create_report succeeded';
  exception when insufficient_privilege then null;
  end;

  ---------------------------------------------------------------- staff email via a non-Google provider must not claim
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_encoder_auth, 'role', 'authenticated', 'email', 'rls-test-encoder@example.com',
    'app_metadata', json_build_object('provider', 'email', 'providers', json_build_array('email')))::text, true);
  select count(*) into n from cdrrmo.claim_staff_account();
  if n > 0 then raise exception 'FAIL: non-Google sign-in claimed a staff account'; end if;

  ---------------------------------------------------------------- encoder (Google, mixed-case email)
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_encoder_auth, 'role', 'authenticated', 'email', 'RLS-Test-Encoder@Example.com',
    'app_metadata', json_build_object('provider', 'google'))::text, true);
  select count(*) into n from cdrrmo.claim_staff_account();
  if n <> 1 then raise exception 'FAIL encoder: could not claim staff account'; end if;
  if not cdrrmo.is_staff() then raise exception 'FAIL encoder: is_staff() false after claim'; end if;
  if cdrrmo.is_super_admin() then raise exception 'FAIL encoder: is_super_admin() true'; end if;
  update cdrrmo.report_entries set remarks = 'encoder', responded = true, road = 'passable' where id = v_entry;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL encoder: could not update entry'; end if;
  v_new_report := cdrrmo.create_report(now(), 'Encoder Test', '');
  select count(*) into n from cdrrmo.report_entries where report_id = v_new_report;
  if n <> (select count(*) from cdrrmo.barangays where is_active) then
    raise exception 'FAIL encoder: create_report made % entries', n;
  end if;
  if (select prepared_by_position from cdrrmo.reports where id = v_new_report) <> 'Radio Controller on Duty' then
    raise exception 'FAIL encoder: blank position not defaulted';
  end if;
  select count(*) into n from cdrrmo.users;
  if n <> 1 then raise exception 'FAIL encoder: sees % user rows (expected only own)', n; end if;
  delete from cdrrmo.reports where id = v_report;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL encoder: deleted a report'; end if;
  update cdrrmo.barangays set callsign = callsign;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL encoder: updated barangays'; end if;
  begin
    insert into cdrrmo.users (email, role) values ('x@example.com', 'encoder');
    raise exception 'FAIL encoder: added a user';
  exception when insufficient_privilege then null;
  end;

  ---------------------------------------------------------------- trigger: no response clears conditions
  update cdrrmo.report_entries set responded = false where id = v_entry;
  if (select road from cdrrmo.report_entries where id = v_entry) is not null then
    raise exception 'FAIL trigger: road not cleared on no response';
  end if;

  ---------------------------------------------------------------- super admin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_auth, 'role', 'authenticated', 'email', 'berlcamp@gmail.com',
    'app_metadata', json_build_object('provider', 'google'))::text, true);
  if not cdrrmo.is_super_admin() then raise exception 'FAIL admin: is_super_admin() false'; end if;
  select count(*) into n from cdrrmo.users;
  if n < 2 then raise exception 'FAIL admin: cannot list users'; end if;
  update cdrrmo.barangays set callsign = callsign;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FAIL admin: cannot update barangays'; end if;
  begin
    update cdrrmo.users set is_active = false where email = 'berlcamp@gmail.com';
    raise exception 'FAIL admin: super admin was deactivated';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    insert into cdrrmo.users (email, role) values ('second-admin@example.com', 'super_admin');
    raise exception 'FAIL admin: second super admin allowed';
  exception when check_violation then null;
  end;
  delete from cdrrmo.reports where id = v_report;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL admin: could not delete report'; end if;

  raise exception 'RLS_TESTS_PASSED';
end
$test$;
```

- [ ] **Step 2: Run it and confirm it fails**

Run the file through MCP `execute_sql`.
Expected: an error such as `function cdrrmo.claim_staff_account() does not exist` (not `RLS_TESTS_PASSED`).

- [ ] **Step 3: Write `supabase/migrations/0002_auth_rls.sql`**

```sql
-- Staff helpers (security definer: they read cdrrmo.users regardless of the caller's RLS)
create or replace function cdrrmo.current_staff() returns setof cdrrmo.users
language sql stable security definer set search_path = '' as $$
  select u.* from cdrrmo.users u
  where u.auth_user_id = (select auth.uid()) and u.is_active
  limit 1
$$;

create or replace function cdrrmo.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cdrrmo.users u
    where u.auth_user_id = (select auth.uid()) and u.is_active
  )
$$;

create or replace function cdrrmo.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cdrrmo.users u
    where u.auth_user_id = (select auth.uid()) and u.is_active and u.role = 'super_admin'
  )
$$;

-- Links the signed-in Google account to its allowlisted staff row (case-insensitive email).
create or replace function cdrrmo.claim_staff_account() returns setof cdrrmo.users
language sql volatile security definer set search_path = '' as $$
  with c as (
    select
      (select auth.uid()) as uid,
      lower(coalesce((select auth.jwt()) ->> 'email', '')) as email,
      coalesce((select auth.jwt()) -> 'app_metadata', '{}'::jsonb) as app
  )
  update cdrrmo.users u
     set auth_user_id = c.uid, last_sign_in_at = now()
    from c
   where c.uid is not null
     and c.email <> ''
     and (c.app ->> 'provider' = 'google' or coalesce(c.app -> 'providers', '[]'::jsonb) ? 'google')
     and u.email = c.email
     and u.is_active
     and (u.auth_user_id is null or u.auth_user_id = c.uid)
  returning u.*
$$;

-- Adds one "No response" entry per active barangay missing from the report.
create or replace function cdrrmo.add_missing_barangays(p_report_id uuid) returns integer
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_staff_id uuid;
  v_count integer;
begin
  select s.id into v_staff_id from cdrrmo.current_staff() s;
  if v_staff_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into cdrrmo.report_entries
    (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal, updated_by)
  select p_report_id, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal, v_staff_id
  from cdrrmo.barangays b
  join cdrrmo.zones z on z.id = b.zone_id
  where b.is_active
    and not exists (
      select 1 from cdrrmo.report_entries e
      where e.report_id = p_report_id and e.barangay_id = b.id
    );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function cdrrmo.create_report(
  p_report_at timestamptz,
  p_prepared_by_name text,
  p_prepared_by_position text
) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_staff_id uuid;
  v_report_id uuid;
begin
  select s.id into v_staff_id from cdrrmo.current_staff() s;
  if v_staff_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into cdrrmo.reports (report_at, prepared_by_name, prepared_by_position, created_by, updated_by)
  values (
    p_report_at,
    coalesce(p_prepared_by_name, ''),
    coalesce(nullif(trim(p_prepared_by_position), ''), 'Radio Controller on Duty'),
    v_staff_id,
    v_staff_id
  )
  returning id into v_report_id;
  perform cdrrmo.add_missing_barangays(v_report_id);
  return v_report_id;
end $$;

-- Row-level security
alter table cdrrmo.zones enable row level security;
alter table cdrrmo.barangays enable row level security;
alter table cdrrmo.condition_options enable row level security;
alter table cdrrmo.settings enable row level security;
alter table cdrrmo.users enable row level security;
alter table cdrrmo.reports enable row level security;
alter table cdrrmo.report_entries enable row level security;

-- Reference tables: everyone reads, the super admin writes.
do $$
declare t text;
begin
  foreach t in array array['zones', 'barangays', 'condition_options', 'settings'] loop
    execute format('create policy %s_read on cdrrmo.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy %s_insert on cdrrmo.%I for insert to authenticated with check ((select cdrrmo.is_super_admin()))', t, t);
    execute format('create policy %s_update on cdrrmo.%I for update to authenticated using ((select cdrrmo.is_super_admin())) with check ((select cdrrmo.is_super_admin()))', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_super_admin()))', t, t);
  end loop;
end $$;

-- Reports and entries: public read, staff write, super admin delete.
do $$
declare t text;
begin
  foreach t in array array['reports', 'report_entries'] loop
    execute format('create policy %s_read on cdrrmo.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy %s_insert on cdrrmo.%I for insert to authenticated with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_update on cdrrmo.%I for update to authenticated using ((select cdrrmo.is_staff())) with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_super_admin()))', t, t);
  end loop;
end $$;

-- Users: own row, or everything for the super admin.
create policy users_read on cdrrmo.users for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select cdrrmo.is_super_admin()));
create policy users_insert on cdrrmo.users for insert to authenticated
  with check ((select cdrrmo.is_super_admin()));
create policy users_update on cdrrmo.users for update to authenticated
  using ((select cdrrmo.is_super_admin())) with check ((select cdrrmo.is_super_admin()));
create policy users_delete on cdrrmo.users for delete to authenticated
  using ((select cdrrmo.is_super_admin()));

-- Grants
grant usage on schema cdrrmo to anon, authenticated, service_role;
grant select on cdrrmo.zones, cdrrmo.barangays, cdrrmo.condition_options, cdrrmo.settings,
  cdrrmo.reports, cdrrmo.report_entries to anon;
grant select, insert, update, delete on all tables in schema cdrrmo to authenticated;
grant all on all tables in schema cdrrmo to service_role;

alter default privileges in schema cdrrmo revoke execute on functions from public;
revoke execute on all functions in schema cdrrmo from public, anon, authenticated;
grant execute on function
  cdrrmo.current_staff(),
  cdrrmo.is_staff(),
  cdrrmo.is_super_admin(),
  cdrrmo.claim_staff_account(),
  cdrrmo.create_report(timestamptz, text, text),
  cdrrmo.add_missing_barangays(uuid)
to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 4: Apply it**

MCP `apply_migration`: `name: "cdrrmo_0002_auth_rls"`, with the file contents as `query`.

- [ ] **Step 5: Run the RLS test again**

Run `supabase/tests/rls_test.sql` via MCP `execute_sql`.
Expected: error message exactly `RLS_TESTS_PASSED`. If a `FAIL …` message appears, fix the migration (write a corrective migration `0002b_…` with `apply_migration`, and keep the `.sql` file in sync), then re-run.

Then confirm nothing leaked from the rolled-back test:
```sql
select count(*) from cdrrmo.users where email like 'rls-test%';
```
Expected: `0`.

- [ ] **Step 6: Re-run the Exposed-schema check from Task 2 Step 4**

Expected: `200`. If it is still `406`, remind the owner to expose `cdrrmo` and wait before starting Task 11.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0002_auth_rls.sql supabase/tests/rls_test.sql
git commit -m "feat(db): add staff helpers, report RPCs, RLS policies and RLS test"
```

---

### Task 4: Realtime broadcast triggers (`0003_realtime.sql`) and a live check script

**Files:**
- Create: `supabase/migrations/0003_realtime.sql`, `scripts/check-realtime.mjs`

**Interfaces:**
- Consumes: Task 2 tables.
- Produces broadcasts:
  - Topic `cdrrmo:report:<report_id>`:
    - event `entry`, payload = the full `report_entries` row, or `{ id, deleted: true }`
    - event `report`, payload = the full `reports` row, or `{ id, deleted: true }`
  - Topic `cdrrmo:reports`:
    - event `reports_changed`, payload `{ id, report_at, op: 'INSERT' | 'UPDATE' | 'DELETE' }`

- [ ] **Step 1: Write `scripts/check-realtime.mjs`** (this is the test)

```js
// Usage: node --env-file=.env.local scripts/check-realtime.mjs <reportId>
// Subscribes like a public visitor (anon key). Exits 0 when an `entry` broadcast arrives.
import { createClient } from '@supabase/supabase-js';

const [reportId] = process.argv.slice(2);
if (!reportId) {
  console.error('usage: node --env-file=.env.local scripts/check-realtime.mjs <reportId>');
  process.exit(2);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const timer = setTimeout(() => {
  console.error('FAIL: no entry broadcast within 90s');
  process.exit(1);
}, 90_000);

supabase
  .channel(`cdrrmo:report:${reportId}`)
  .on('broadcast', { event: 'entry' }, ({ payload }) => {
    console.log('RECEIVED entry', payload.id, JSON.stringify(payload.remarks));
    clearTimeout(timer);
    process.exit(0);
  })
  .subscribe((status) => console.log('channel status:', status));
```

- [ ] **Step 2: Create a scratch report and confirm no broadcast arrives yet**

MCP `execute_sql`:
```sql
with r as (
  insert into cdrrmo.reports (report_at, prepared_by_name) values (now(), 'REALTIME CHECK') returning id
)
insert into cdrrmo.report_entries (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal)
select r.id, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal
from r, cdrrmo.barangays b join cdrrmo.zones z on z.id = b.zone_id
returning report_id;
```
Note the `report_id`. Check `node --version` (it must be ≥ 22 for the global WebSocket). Then run `node --env-file=.env.local scripts/check-realtime.mjs <report_id>` in the background, wait for `channel status: SUBSCRIBED`, and run:
```sql
update cdrrmo.report_entries set remarks = 'realtime check 1'
where id = (select id from cdrrmo.report_entries where report_id = '<report_id>' order by sort_order limit 1);
```
Expected: the script prints nothing new; there are no triggers yet. Stop the script.

- [ ] **Step 3: Write `supabase/migrations/0003_realtime.sql`**

```sql
-- Public Broadcast of every report / entry change (one message per change, fanned out by Realtime).
create or replace function cdrrmo.broadcast_entry_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'entry', 'cdrrmo:report:' || old.report_id, false);
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'entry', 'cdrrmo:report:' || new.report_id, false);
  return new;
end $$;

create trigger broadcast_entry_change
  after insert or update or delete on cdrrmo.report_entries
  for each row execute function cdrrmo.broadcast_entry_change();

create or replace function cdrrmo.broadcast_report_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'report', 'cdrrmo:report:' || old.id, false);
    perform realtime.send(jsonb_build_object('id', old.id, 'report_at', old.report_at, 'op', 'DELETE'), 'reports_changed', 'cdrrmo:reports', false);
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'report', 'cdrrmo:report:' || new.id, false);
  if tg_op = 'INSERT' or new.report_at is distinct from old.report_at then
    perform realtime.send(jsonb_build_object('id', new.id, 'report_at', new.report_at, 'op', tg_op), 'reports_changed', 'cdrrmo:reports', false);
  end if;
  return new;
end $$;

create trigger broadcast_report_change
  after insert or update or delete on cdrrmo.reports
  for each row execute function cdrrmo.broadcast_report_change();

revoke execute on function cdrrmo.broadcast_entry_change(), cdrrmo.broadcast_report_change() from public, anon, authenticated;
```

- [ ] **Step 4: Apply it and re-run the check**

Run MCP `apply_migration` with `name: "cdrrmo_0003_realtime"`. Start the script again (background) and wait for `SUBSCRIBED`. Then run:
```sql
update cdrrmo.report_entries set remarks = 'realtime check 2'
where id = (select id from cdrrmo.report_entries where report_id = '<report_id>' order by sort_order limit 1);
```
Expected: the script prints `RECEIVED entry … "realtime check 2"` and exits 0.
If the status is `SUBSCRIBED` but nothing arrives: in the dashboard → Realtime → Settings, make sure **"Allow public access"** to channels is enabled (ask the owner), then retry.

- [ ] **Step 5: Clean up the scratch report**

```sql
delete from cdrrmo.reports where prepared_by_name = 'REALTIME CHECK';
```

- [ ] **Step 6: Re-run the RLS test** (the triggers must not break it)

Expected: `RLS_TESTS_PASSED`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_realtime.sql scripts/check-realtime.mjs
git commit -m "feat(db): broadcast report and entry changes over public Realtime channels"
```

---
### Task 5: Domain types, ids and Manila time formatting

**Files:**
- Create: `lib/types.ts`, `lib/ids.ts`, `lib/format.ts`
- Test: `tests/unit/format.test.ts`, `tests/unit/ids.test.ts`

**Interfaces:**
- Produces:
  - Types `Role, ConditionKind, Road, Level, Power, Zone, Barangay, ConditionOption, Settings, StaffUser, Report, ReportEntry, ReportBundle, ReportSummary`.
  - `isUuid(value: string): boolean`.
  - `MANILA_TZ`, `formatReportDate`, `formatMilitaryTime`, `formatReportHeading`, `formatShortHeading`, `formatClock`, `manilaDayKey`, `formatDayHeading(dayKey)`, `toManilaInputValue(iso)`, `fromManilaInputValue(value)`. Every function takes an ISO string and returns a string.

- [ ] **Step 1: Write `lib/types.ts`**

```ts
export type Role = 'super_admin' | 'encoder';
export type ConditionKind = 'weather' | 'wind';
export type Road = 'passable' | 'unpassable';
export type Level = 'normal' | 'above_normal';
export type Power = 'with_power' | 'no_power';

export interface Zone {
  id: string;
  name: string;
  sort_order: number;
}

export interface Barangay {
  id: string;
  name: string;
  callsign: string;
  zone_id: string;
  sort_order: number;
  monitors_coastal: boolean;
  is_active: boolean;
}

export interface ConditionOption {
  id: string;
  kind: ConditionKind;
  label: string;
  severity: number;
  sort_order: number;
  is_active: boolean;
}

export interface Settings {
  office_title: string;
  office_lines: string[];
  network_name: string;
  call_sign: string;
  radio_frequency: string;
  report_title: string;
  logo_urls: string[];
}

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  position: string;
  role: Role;
  is_active: boolean;
  auth_user_id: string | null;
  last_sign_in_at: string | null;
}

export interface Report {
  id: string;
  report_at: string;
  prepared_by_name: string;
  prepared_by_position: string;
  remarks: string;
  weather_summary_override: string | null;
  wind_summary_override: string | null;
  rivers_summary_override: string | null;
  roads_summary_override: string | null;
  coastal_summary_override: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportEntry {
  id: string;
  report_id: string;
  barangay_id: string;
  barangay_name: string;
  callsign: string;
  zone_name: string;
  zone_sort: number;
  sort_order: number;
  monitors_coastal: boolean;
  responded: boolean;
  weather_option_id: string | null;
  wind_option_id: string | null;
  road: Road | null;
  river: Level | null;
  coastal: Level | null;
  power: Power | null;
  remarks: string | null;
  updated_at: string;
}

export interface ReportBundle {
  report: Report;
  entries: ReportEntry[];
}

export interface ReportSummary {
  total: number;
  active: number;
  noResponse: number;
  weather: string;
  wind: string;
  rivers: string;
  roads: string;
  coastal: string;
  power: string;
  hasIssues: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/ids.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isUuid } from '@/lib/ids';

describe('isUuid', () => {
  it('accepts uuids and rejects anything else', () => {
    expect(isUuid('3f2b6a0e-9c1d-4e5f-8a7b-1c2d3e4f5a6b')).toBe(true);
    expect(isUuid('3F2B6A0E-9C1D-4E5F-8A7B-1C2D3E4F5A6B')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid("1' or '1'='1")).toBe(false);
  });
});
```

`tests/unit/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  formatClock, formatDayHeading, formatMilitaryTime, formatReportDate, formatReportHeading,
  formatShortHeading, fromManilaInputValue, manilaDayKey, toManilaInputValue,
} from '@/lib/format';

const AT_1050 = '2026-10-07T02:50:00.000Z'; // 10:50 in Manila

describe('Manila formatting', () => {
  it('formats the report heading like the paper form', () => {
    expect(formatReportDate(AT_1050)).toBe('October 7, 2026');
    expect(formatMilitaryTime(AT_1050)).toBe('1050H');
    expect(formatReportHeading(AT_1050)).toBe('October 7, 2026 – 1050H');
    expect(formatShortHeading(AT_1050)).toBe('Oct 7, 2026 1050H');
  });

  it('uses the Manila date just after midnight, not the UTC date', () => {
    const justAfterMidnight = '2026-10-06T16:05:00.000Z'; // 00:05 on Oct 7 in Manila
    expect(formatMilitaryTime(justAfterMidnight)).toBe('0005H');
    expect(formatReportDate(justAfterMidnight)).toBe('October 7, 2026');
    expect(manilaDayKey(justAfterMidnight)).toBe('2026-10-07');
  });

  it('formats clock and day headings', () => {
    expect(formatClock('2026-10-07T02:52:14.000Z')).toBe('10:52:14');
    expect(formatDayHeading('2026-10-07')).toBe('Wednesday, October 7, 2026');
  });

  it('round-trips datetime-local values in Manila time', () => {
    expect(toManilaInputValue(AT_1050)).toBe('2026-10-07T10:50');
    expect(fromManilaInputValue('2026-10-07T10:50')).toBe(AT_1050);
    expect(() => fromManilaInputValue('10:50')).toThrow('Invalid date/time');
  });

  it('accepts Postgres timestamps with microseconds and offsets', () => {
    expect(formatMilitaryTime('2026-10-07T10:50:00.123456+08:00')).toBe('1050H');
  });
});
```

- [ ] **Step 3: Run them to confirm they fail**

Run: `npx vitest run tests/unit/format.test.ts tests/unit/ids.test.ts`
Expected: FAIL, "Failed to resolve import '@/lib/format'".

- [ ] **Step 4: Implement `lib/ids.ts` and `lib/format.ts`**

`lib/ids.ts`:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
```

`lib/format.ts`:
```ts
export const MANILA_TZ = 'Asia/Manila';

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, month: 'long', day: 'numeric', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric', year: 'numeric' });
const dayHeadingFmt = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

function parts(fmt: Intl.DateTimeFormat, iso: string): Record<string, string> {
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

export function formatReportDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatMilitaryTime(iso: string): string {
  const p = parts(timeFmt, iso);
  return `${p.hour}${p.minute}H`;
}

export function formatReportHeading(iso: string): string {
  return `${formatReportDate(iso)} – ${formatMilitaryTime(iso)}`;
}

export function formatShortHeading(iso: string): string {
  return `${shortDateFmt.format(new Date(iso))} ${formatMilitaryTime(iso)}`;
}

export function formatClock(iso: string): string {
  const p = parts(timeFmt, iso);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function manilaDayKey(iso: string): string {
  const p = parts(dayKeyFmt, iso);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatDayHeading(dayKey: string): string {
  return dayHeadingFmt.format(new Date(`${dayKey}T12:00:00+08:00`));
}

export function toManilaInputValue(iso: string): string {
  const d = parts(dayKeyFmt, iso);
  const t = parts(timeFmt, iso);
  return `${d.year}-${d.month}-${d.day}T${t.hour}:${t.minute}`;
}

export function fromManilaInputValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Invalid date/time');
  return new Date(`${value}:00+08:00`).toISOString();
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/format.test.ts tests/unit/ids.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/ids.ts lib/format.ts tests/unit/format.test.ts tests/unit/ids.test.ts
git commit -m "feat: add domain types and Manila time formatting"
```

---

### Task 6: Summary rules, labels and filtering (with the 2026-10-07 1050H fixture)

**Files:**
- Create: `lib/summary.ts`, `lib/labels.ts`, `lib/filter.ts`, `tests/fixtures/sample-sitrep.ts`
- Test: `tests/unit/summary.test.ts`, `tests/unit/filter.test.ts`

**Interfaces:**
- Consumes: `lib/types.ts`.
- Produces:
  - `lib/summary.ts`:
    - `NONE = '—'`, `SHARE_THRESHOLD = 0.2`
    - `joinRange(low, high): string`
    - `summarizeCondition(optionIds: (string|null)[], options: ConditionOption[]): string`
    - `summarizeReport(report: SummaryOverrides, entries: ReportEntry[], options: ConditionOption[]): ReportSummary`
    - `entryHasIssue(e: ReportEntry): boolean`
    - `describeSummary(s: ReportSummary): string`
    - type `SummaryOverrides`
  - `lib/labels.ts`:
    - `type Tone = 'ok'|'warn'|'danger'|'none'`
    - `ROAD_LABEL`, `LEVEL_LABEL`, `POWER_LABEL`
    - `valueTone(value): Tone`, `summaryTone(text): Tone`
    - `makeOptionLabeler(options): (id: string|null) => string`
  - `lib/filter.ts`:
    - `filterEntries(entries, zone: string, issuesOnly: boolean): ReportEntry[]` (`zone` is `'all'` or a zone name)
    - `groupByZone(entries): { zone: string; entries: ReportEntry[] }[]`
    - `zoneNames(entries): string[]`

- [ ] **Step 1: Write the fixture `tests/fixtures/sample-sitrep.ts`** (the paper report from 2026-10-07 1050H)

```ts
import type { ConditionOption, Report, ReportEntry } from '@/lib/types';

function opt(id: string, kind: 'weather' | 'wind', label: string, severity: number): ConditionOption {
  return { id, kind, label, severity, sort_order: severity, is_active: true };
}

export const OPTIONS: ConditionOption[] = [
  opt('w-sunny', 'weather', 'Sunny', 0),
  opt('w-cloudy', 'weather', 'Cloudy', 1),
  opt('w-light', 'weather', 'Light rain', 2),
  opt('w-moderate', 'weather', 'Moderate rain', 3),
  opt('w-heavy', 'weather', 'Heavy rain', 4),
  opt('w-torrential', 'weather', 'Torrential rain', 5),
  opt('n-none', 'wind', 'Not windy', 0),
  opt('n-light', 'wind', 'Light wind', 1),
  opt('n-moderate', 'wind', 'Moderate wind', 2),
  opt('n-strong', 'wind', 'Strong wind', 3),
];

const ZONE_SORT: Record<string, number> = { Upland: 1, Midland: 2, Lowland: 3, Coastal: 4 };

const ok = (weather: string, extra: Partial<ReportEntry> = {}): Partial<ReportEntry> => ({
  responded: true,
  weather_option_id: weather,
  wind_option_id: 'n-none',
  road: 'passable',
  power: 'with_power',
  ...extra,
});

const ROWS: [number, string, string, string, Partial<ReportEntry>?][] = [
  [1, 'Stimson Abordo', 'Sierra 5', 'Upland', ok('w-moderate')],
  [2, 'Gala', 'Golf 2', 'Upland'],
  [3, 'Guimad', 'Golf 5', 'Upland'],
  [4, 'Trigos', 'Tango 3', 'Upland', ok('w-moderate', { river: 'normal' })],
  [5, 'Dalapang', 'Delta 1', 'Upland', ok('w-moderate')],
  [6, 'Cogon', 'Charlie 8', 'Upland', ok('w-light')],
  [7, 'Embargo', 'Eagle', 'Midland', ok('w-moderate', { river: 'normal' })],
  [8, 'Pantaon', 'Papa 1', 'Midland'],
  [9, 'Pulot', 'Papa 2', 'Midland', ok('w-moderate', { river: 'normal' })],
  [10, 'Calabayan', 'Charlie 1', 'Midland', ok('w-light', { river: 'normal' })],
  [11, 'Kinuman Sur', 'Kilo 2', 'Midland', ok('w-light', { river: 'normal' })],
  [12, 'Sangay Diot', 'Sierra 1', 'Midland', ok('w-light', { river: 'normal', power: null })],
  [13, 'Cavinte', 'Charlie 7', 'Midland'],
  [14, 'Balintawak', 'Bravo 3', 'Lowland', ok('w-moderate')],
  [15, 'Bañadero', 'Bravo 4', 'Lowland', ok('w-light', { river: 'normal' })],
  [16, 'Aguada', 'Alpha', 'Lowland', ok('w-moderate', { river: 'normal' })],
  [17, 'Dimaluna', 'Delta 3', 'Lowland', ok('w-moderate', { river: 'normal' })],
  [18, 'Lam-an', 'Lima 3', 'Lowland'],
  [19, 'Tabid', 'Tango 1', 'Lowland'],
  [20, 'Bongbong', 'Bravo 8', 'Lowland'],
  [21, 'Baybay Triunfo', 'Bravo 7', 'Coastal', ok('w-light', { river: 'normal', coastal: 'normal' })],
  [22, 'Malaubang', 'Mike 1', 'Coastal', ok('w-light', { river: 'normal', coastal: 'normal', wind_option_id: 'n-light' })],
  [23, 'Catadman-Manabay', 'Charlie 6', 'Coastal'],
  [24, 'San Antonio', 'Sierra 3', 'Coastal'],
];

export function makeEntry(no: number, name: string, callsign: string, zone: string, data: Partial<ReportEntry> = {}): ReportEntry {
  return {
    id: `e${no}`,
    report_id: 'r1',
    barangay_id: `b${no}`,
    barangay_name: name,
    callsign,
    zone_name: zone,
    zone_sort: ZONE_SORT[zone],
    sort_order: no,
    monitors_coastal: zone === 'Coastal',
    responded: false,
    weather_option_id: null,
    wind_option_id: null,
    road: null,
    river: null,
    coastal: null,
    power: null,
    remarks: null,
    updated_at: '2026-10-07T02:50:00.000Z',
    ...data,
  };
}

export const SAMPLE_ENTRIES: ReportEntry[] = ROWS.map(([no, name, callsign, zone, data]) => makeEntry(no, name, callsign, zone, data));

export const SAMPLE_REPORT: Report = {
  id: 'r1',
  report_at: '2026-10-07T02:50:00.000Z',
  prepared_by_name: 'Romeo P. De Los Angeles Jr',
  prepared_by_position: 'Radio Controller on Duty',
  remarks: 'All stations reported that their respective AOR are in normal situation.',
  weather_summary_override: null,
  wind_summary_override: null,
  rivers_summary_override: null,
  roads_summary_override: null,
  coastal_summary_override: null,
  created_at: '2026-10-07T02:50:00.000Z',
  updated_at: '2026-10-07T02:50:00.000Z',
};
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/summary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { describeSummary, entryHasIssue, joinRange, NONE, summarizeCondition, summarizeReport } from '@/lib/summary';
import { summaryTone, valueTone, makeOptionLabeler } from '@/lib/labels';
import { makeEntry, OPTIONS, SAMPLE_ENTRIES, SAMPLE_REPORT } from '../fixtures/sample-sitrep';

describe('summarizeReport', () => {
  it('reproduces the 2026-10-07 1050H paper summary', () => {
    const s = summarizeReport(SAMPLE_REPORT, SAMPLE_ENTRIES, OPTIONS);
    expect(s).toEqual({
      total: 24,
      active: 15,
      noResponse: 9,
      weather: 'Light to Moderate rain',
      wind: 'Not windy',
      rivers: 'NORMAL',
      roads: 'PASSABLE',
      coastal: 'NORMAL',
      power: 'WITH POWER',
      hasIssues: false,
    });
    expect(describeSummary(s)).toBe('15/24 stations active · Light to Moderate rain · Not windy · Roads passable · Rivers normal');
  });

  it('shows dashes when nobody has responded yet', () => {
    const entries = SAMPLE_ENTRIES.map((e) => ({ ...makeEntry(e.sort_order, e.barangay_name, e.callsign, e.zone_name) }));
    const s = summarizeReport(SAMPLE_REPORT, entries, OPTIONS);
    expect(s.active).toBe(0);
    expect(s.noResponse).toBe(24);
    expect([s.weather, s.wind, s.rivers, s.roads, s.coastal, s.power]).toEqual([NONE, NONE, NONE, NONE, NONE, NONE]);
  });

  it('counts problems and flags issues', () => {
    const entries = [
      makeEntry(1, 'A', 'A1', 'Upland', { responded: true, road: 'unpassable', power: 'no_power' }),
      makeEntry(2, 'B', 'B1', 'Lowland', { responded: true, river: 'above_normal', road: 'passable' }),
      makeEntry(3, 'C', 'C1', 'Coastal', { responded: true, coastal: 'above_normal' }),
      makeEntry(4, 'D', 'D1', 'Upland', { responded: true, coastal: 'above_normal' }), // not monitored: ignored
    ];
    const s = summarizeReport(SAMPLE_REPORT, entries, OPTIONS);
    expect(s.roads).toBe('UNPASSABLE (1)');
    expect(s.rivers).toBe('ABOVE NORMAL (1)');
    expect(s.coastal).toBe('ABOVE NORMAL (1)');
    expect(s.power).toBe('NO POWER (1)');
    expect(s.hasIssues).toBe(true);
  });

  it('lets non-empty overrides win', () => {
    const report = { ...SAMPLE_REPORT, weather_summary_override: '  Heavy rain ', rivers_summary_override: '   ' };
    const s = summarizeReport(report, SAMPLE_ENTRIES, OPTIONS);
    expect(s.weather).toBe('Heavy rain');
    expect(s.rivers).toBe('NORMAL');
  });
});

describe('summarizeCondition', () => {
  it('returns the single label when everyone agrees', () => {
    expect(summarizeCondition(['w-light', 'w-light'], OPTIONS)).toBe('Light rain');
  });
  it('includes a label at exactly 20%', () => {
    expect(summarizeCondition(['w-light', 'w-light', 'w-light', 'w-light', 'w-heavy'], OPTIONS)).toBe('Light to Heavy rain');
  });
  it('drops a label below 20%', () => {
    expect(summarizeCondition(['w-light', 'w-light', 'w-light', 'w-light', 'w-light', 'w-heavy'], OPTIONS)).toBe('Light rain');
    expect(summarizeCondition(['n-none', ...Array(13).fill('n-none'), 'n-light'], OPTIONS)).toBe('Not windy');
  });
  it('falls back to the full range when no label reaches 20%', () => {
    const six = ['w-sunny', 'w-cloudy', 'w-light', 'w-moderate', 'w-heavy', 'w-torrential'];
    expect(summarizeCondition(six, OPTIONS)).toBe('Sunny to Torrential rain');
  });
  it('ignores nulls and unknown ids', () => {
    expect(summarizeCondition([null, 'nope'], OPTIONS)).toBe(NONE);
  });
});

describe('joinRange', () => {
  it('shares the last word when both labels end with it', () => {
    expect(joinRange('Light rain', 'Moderate rain')).toBe('Light to Moderate rain');
    expect(joinRange('Cloudy', 'Light rain')).toBe('Cloudy to Light rain');
    expect(joinRange('Not windy', 'Light wind')).toBe('Not windy to Light wind');
  });
});

describe('labels', () => {
  it('maps values and summaries to tones', () => {
    expect(valueTone('passable')).toBe('ok');
    expect(valueTone('above_normal')).toBe('warn');
    expect(valueTone('no_power')).toBe('danger');
    expect(valueTone(null)).toBe('none');
    expect(summaryTone('ABOVE NORMAL (2)')).toBe('warn');
    expect(summaryTone('UNPASSABLE (1)')).toBe('danger');
    expect(summaryTone('NORMAL')).toBe('ok');
    expect(summaryTone(NONE)).toBe('none');
  });
  it('labels option ids', () => {
    const label = makeOptionLabeler(OPTIONS);
    expect(label('w-moderate')).toBe('Moderate rain');
    expect(label(null)).toBe(NONE);
    expect(label('missing')).toBe(NONE);
  });
  it('treats no response as an issue', () => {
    expect(entryHasIssue(makeEntry(1, 'A', 'A', 'Upland'))).toBe(true);
    expect(entryHasIssue(SAMPLE_ENTRIES[0])).toBe(false);
  });
});
```

`tests/unit/filter.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { filterEntries, groupByZone, zoneNames } from '@/lib/filter';
import { SAMPLE_ENTRIES } from '../fixtures/sample-sitrep';

describe('filter', () => {
  it('lists zones in roll-call order', () => {
    expect(zoneNames(SAMPLE_ENTRIES)).toEqual(['Upland', 'Midland', 'Lowland', 'Coastal']);
  });
  it('groups by zone keeping order', () => {
    expect(groupByZone(SAMPLE_ENTRIES).map((g) => [g.zone, g.entries.length])).toEqual([
      ['Upland', 6], ['Midland', 7], ['Lowland', 7], ['Coastal', 4],
    ]);
  });
  it('filters by zone and issues', () => {
    expect(filterEntries(SAMPLE_ENTRIES, 'Coastal', false).map((e) => e.barangay_name)).toEqual([
      'Baybay Triunfo', 'Malaubang', 'Catadman-Manabay', 'San Antonio',
    ]);
    expect(filterEntries(SAMPLE_ENTRIES, 'all', true)).toHaveLength(9);
    expect(filterEntries(SAMPLE_ENTRIES, 'Coastal', true).map((e) => e.barangay_name)).toEqual(['Catadman-Manabay', 'San Antonio']);
  });
});
```

- [ ] **Step 3: Run them to confirm they fail**

Run: `npx vitest run tests/unit/summary.test.ts tests/unit/filter.test.ts`
Expected: FAIL, "Failed to resolve import '@/lib/summary'".

- [ ] **Step 4: Implement `lib/summary.ts`**

```ts
import type { ConditionOption, Level, Power, Report, ReportEntry, ReportSummary, Road } from './types';

export const NONE = '—';
export const SHARE_THRESHOLD = 0.2;

export type SummaryOverrides = Pick<
  Report,
  'weather_summary_override' | 'wind_summary_override' | 'rivers_summary_override' | 'roads_summary_override' | 'coastal_summary_override'
>;

export function joinRange(low: string, high: string): string {
  const a = low.trim().split(/\s+/);
  const b = high.trim().split(/\s+/);
  if (a.length > 1 && b.length > 1 && a[a.length - 1].toLowerCase() === b[b.length - 1].toLowerCase()) {
    return `${a.slice(0, -1).join(' ')} to ${high}`;
  }
  return `${low} to ${high}`;
}

const bySeverity = (x: ConditionOption, y: ConditionOption) => x.severity - y.severity || x.sort_order - y.sort_order;

export function summarizeCondition(optionIds: (string | null)[], options: ConditionOption[]): string {
  const byId = new Map(options.map((o) => [o.id, o]));
  const counts = new Map<string, number>();
  let total = 0;
  for (const id of optionIds) {
    if (!id || !byId.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return NONE;
  const reported = [...counts.keys()].map((id) => byId.get(id)!).sort(bySeverity);
  const significant = reported.filter((o) => counts.get(o.id)! / total >= SHARE_THRESHOLD);
  const pool = significant.length > 0 ? significant : reported;
  const low = pool[0];
  const high = pool[pool.length - 1];
  return low.id === high.id ? low.label : joinRange(low.label, high.label);
}

function countOf<T>(values: T[], target: T): number {
  return values.filter((v) => v === target).length;
}

function levelSummary(values: (Level | null)[]): string {
  const above = countOf(values, 'above_normal');
  if (above > 0) return `ABOVE NORMAL (${above})`;
  return values.includes('normal') ? 'NORMAL' : NONE;
}

function roadSummary(values: (Road | null)[]): string {
  const closed = countOf(values, 'unpassable');
  if (closed > 0) return `UNPASSABLE (${closed})`;
  return values.includes('passable') ? 'PASSABLE' : NONE;
}

function powerSummary(values: (Power | null)[]): string {
  const out = countOf(values, 'no_power');
  if (out > 0) return `NO POWER (${out})`;
  return values.includes('with_power') ? 'WITH POWER' : NONE;
}

function pick(override: string | null, computed: string): string {
  const text = override?.trim();
  return text ? text : computed;
}

export function entryHasIssue(e: ReportEntry): boolean {
  return (
    !e.responded ||
    e.road === 'unpassable' ||
    e.river === 'above_normal' ||
    (e.monitors_coastal && e.coastal === 'above_normal') ||
    e.power === 'no_power'
  );
}

export function summarizeReport(report: SummaryOverrides, entries: ReportEntry[], options: ConditionOption[]): ReportSummary {
  const responded = entries.filter((e) => e.responded);
  const coastal = responded.filter((e) => e.monitors_coastal);
  return {
    total: entries.length,
    active: responded.length,
    noResponse: entries.length - responded.length,
    weather: pick(report.weather_summary_override, summarizeCondition(responded.map((e) => e.weather_option_id), options)),
    wind: pick(report.wind_summary_override, summarizeCondition(responded.map((e) => e.wind_option_id), options)),
    rivers: pick(report.rivers_summary_override, levelSummary(responded.map((e) => e.river))),
    roads: pick(report.roads_summary_override, roadSummary(responded.map((e) => e.road))),
    coastal: pick(report.coastal_summary_override, levelSummary(coastal.map((e) => e.coastal))),
    power: powerSummary(responded.map((e) => e.power)),
    hasIssues: responded.some(entryHasIssue),
  };
}

export function describeSummary(s: ReportSummary): string {
  return [
    `${s.active}/${s.total} stations active`,
    s.weather,
    s.wind,
    `Roads ${s.roads.toLowerCase()}`,
    `Rivers ${s.rivers.toLowerCase()}`,
  ].join(' · ');
}
```

- [ ] **Step 5: Implement `lib/labels.ts` and `lib/filter.ts`**

`lib/labels.ts`:
```ts
import { NONE } from './summary';
import type { ConditionOption, Level, Power, Road } from './types';

export type Tone = 'ok' | 'warn' | 'danger' | 'none';

export const ROAD_LABEL: Record<Road, string> = { passable: 'Passable', unpassable: 'Unpassable' };
export const LEVEL_LABEL: Record<Level, string> = { normal: 'Normal', above_normal: 'Above normal' };
export const POWER_LABEL: Record<Power, string> = { with_power: 'With power', no_power: 'No power' };

export function valueTone(value: Road | Level | Power | null): Tone {
  switch (value) {
    case 'passable':
    case 'normal':
    case 'with_power':
      return 'ok';
    case 'above_normal':
      return 'warn';
    case 'unpassable':
    case 'no_power':
      return 'danger';
    default:
      return 'none';
  }
}

export function summaryTone(text: string): Tone {
  const t = text.trim().toUpperCase();
  if (t === '' || t === NONE) return 'none';
  if (t.startsWith('ABOVE NORMAL')) return 'warn';
  if (t.startsWith('UNPASSABLE') || t.startsWith('NO POWER')) return 'danger';
  return 'ok';
}

export function makeOptionLabeler(options: ConditionOption[]): (id: string | null) => string {
  const labels = new Map(options.map((o) => [o.id, o.label]));
  return (id) => (id ? labels.get(id) ?? NONE : NONE);
}
```

`lib/filter.ts`:
```ts
import { entryHasIssue } from './summary';
import type { ReportEntry } from './types';

export function filterEntries(entries: ReportEntry[], zone: string, issuesOnly: boolean): ReportEntry[] {
  return entries.filter((e) => (zone === 'all' || e.zone_name === zone) && (!issuesOnly || entryHasIssue(e)));
}

export function groupByZone(entries: ReportEntry[]): { zone: string; entries: ReportEntry[] }[] {
  const groups: { zone: string; entries: ReportEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.zone === entry.zone_name) last.entries.push(entry);
    else groups.push({ zone: entry.zone_name, entries: [entry] });
  }
  return groups;
}

export function zoneNames(entries: ReportEntry[]): string[] {
  return [...new Set(entries.map((e) => e.zone_name))];
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/summary.test.ts tests/unit/filter.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/summary.ts lib/labels.ts lib/filter.ts tests/fixtures/sample-sitrep.ts tests/unit/summary.test.ts tests/unit/filter.test.ts
git commit -m "feat: add SitRep summary rules, labels and filters"
```

---

### Task 7: Live report state reducer

**Files:**
- Create: `lib/live/report-state.ts`
- Test: `tests/unit/report-state.test.ts`

**Interfaces:**
- Consumes: `Report`, `ReportEntry`, `ReportBundle` from `lib/types.ts`.
- Produces:
  - `LiveState { report: Report; entries: ReportEntry[]; deleted: boolean }`
  - `Deleted { id: string; deleted: true }`
  - `LiveAction = { type: 'reset'; bundle: ReportBundle } | { type: 'entry'; payload: ReportEntry | Deleted } | { type: 'report'; payload: Report | Deleted }`
  - `sortEntries(entries)`, `initLiveState(bundle)`, `liveReducer(state, action)`
  - `lastUpdatedAt(bundle: { report: Report; entries: ReportEntry[] }): string`

- [ ] **Step 1: Write the failing test `tests/unit/report-state.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { initLiveState, lastUpdatedAt, liveReducer } from '@/lib/live/report-state';
import { makeEntry, SAMPLE_ENTRIES, SAMPLE_REPORT } from '../fixtures/sample-sitrep';

const base = () => initLiveState({ report: SAMPLE_REPORT, entries: [...SAMPLE_ENTRIES].reverse() });

describe('liveReducer', () => {
  it('sorts entries into roll-call order on init', () => {
    expect(base().entries.map((e) => e.sort_order).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('applies a newer entry update', () => {
    const updated = { ...SAMPLE_ENTRIES[1], responded: true, updated_at: '2026-10-07T02:51:00.000Z' };
    const next = liveReducer(base(), { type: 'entry', payload: updated });
    expect(next.entries.find((e) => e.id === 'e2')?.responded).toBe(true);
    expect(next.entries).toHaveLength(24);
  });

  it('ignores a stale broadcast that arrives late', () => {
    const fresh = liveReducer(base(), { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'new', updated_at: '2026-10-07T02:55:00.000Z' } });
    const stale = liveReducer(fresh, { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'old', updated_at: '2026-10-07T02:54:00.000Z' } });
    expect(stale.entries.find((e) => e.id === 'e2')?.remarks).toBe('new');
  });

  it('applies an update with the same timestamp', () => {
    const same = liveReducer(base(), { type: 'entry', payload: { ...SAMPLE_ENTRIES[1], remarks: 'same-ts' } });
    expect(same.entries.find((e) => e.id === 'e2')?.remarks).toBe('same-ts');
  });

  it('inserts a new entry in order and removes deleted ones', () => {
    const added = liveReducer(base(), { type: 'entry', payload: makeEntry(25, 'New Brgy', 'Zulu', 'Upland') });
    expect(added.entries.map((e) => e.barangay_name).indexOf('New Brgy')).toBe(6);
    const removed = liveReducer(added, { type: 'entry', payload: { id: 'e25', deleted: true } });
    expect(removed.entries).toHaveLength(24);
  });

  it('ignores entries from another report', () => {
    const other = { ...SAMPLE_ENTRIES[0], id: 'x1', report_id: 'other' };
    expect(liveReducer(base(), { type: 'entry', payload: other }).entries).toHaveLength(24);
  });

  it('updates the report header and marks deletion', () => {
    const renamed = liveReducer(base(), { type: 'report', payload: { ...SAMPLE_REPORT, remarks: 'Updated', updated_at: '2026-10-07T03:00:00.000Z' } });
    expect(renamed.report.remarks).toBe('Updated');
    const stale = liveReducer(renamed, { type: 'report', payload: { ...SAMPLE_REPORT, remarks: 'Old' } });
    expect(stale.report.remarks).toBe('Updated');
    expect(liveReducer(renamed, { type: 'report', payload: { id: 'r1', deleted: true } }).deleted).toBe(true);
  });

  it('resets to a fresh server snapshot', () => {
    const deleted = { ...base(), deleted: true };
    const reset = liveReducer(deleted, { type: 'reset', bundle: { report: SAMPLE_REPORT, entries: SAMPLE_ENTRIES } });
    expect(reset.deleted).toBe(false);
  });

  it('reports the latest change time', () => {
    const entries = [...SAMPLE_ENTRIES];
    entries[5] = { ...entries[5], updated_at: '2026-10-07T03:10:00.123456+00:00' };
    expect(lastUpdatedAt({ report: SAMPLE_REPORT, entries })).toBe('2026-10-07T03:10:00.123456+00:00');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/unit/report-state.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/live/report-state.ts`**

```ts
import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export interface LiveState {
  report: Report;
  entries: ReportEntry[];
  deleted: boolean;
}

export interface Deleted {
  id: string;
  deleted: true;
}

export type LiveAction =
  | { type: 'reset'; bundle: ReportBundle }
  | { type: 'entry'; payload: ReportEntry | Deleted }
  | { type: 'report'; payload: Report | Deleted };

export function sortEntries(entries: ReportEntry[]): ReportEntry[] {
  return [...entries].sort(
    (a, b) => a.zone_sort - b.zone_sort || a.sort_order - b.sort_order || a.barangay_name.localeCompare(b.barangay_name),
  );
}

export function initLiveState(bundle: ReportBundle): LiveState {
  return { report: bundle.report, entries: sortEntries(bundle.entries), deleted: false };
}

function isDeleted(payload: object): payload is Deleted {
  return (payload as Deleted).deleted === true;
}

function isOlder(incoming: string, current: string): boolean {
  return Date.parse(incoming) < Date.parse(current);
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'reset':
      return initLiveState(action.bundle);
    case 'entry': {
      const payload = action.payload;
      if (isDeleted(payload)) {
        return { ...state, entries: state.entries.filter((e) => e.id !== payload.id) };
      }
      if (payload.report_id !== state.report.id) return state;
      const current = state.entries.find((e) => e.id === payload.id);
      if (current && isOlder(payload.updated_at, current.updated_at)) return state;
      return { ...state, entries: sortEntries([...state.entries.filter((e) => e.id !== payload.id), payload]) };
    }
    case 'report': {
      const payload = action.payload;
      if (payload.id !== state.report.id) return state;
      if (isDeleted(payload)) return { ...state, deleted: true };
      if (isOlder(payload.updated_at, state.report.updated_at)) return state;
      return { ...state, report: payload };
    }
  }
}

export function lastUpdatedAt(bundle: { report: Report; entries: ReportEntry[] }): string {
  return [bundle.report.updated_at, ...bundle.entries.map((e) => e.updated_at)].reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/report-state.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/live/report-state.ts tests/unit/report-state.test.ts
git commit -m "feat: add live report reducer with stale-update protection"
```

---

### Task 8: Encoder logic — validation, patches, backoff, reorder and action results

**Files:**
- Create: `lib/validation.ts`, `lib/encoder-patches.ts`, `lib/backoff.ts`, `lib/action-result.ts`, `lib/reorder.ts`
- Test: `tests/unit/validation.test.ts`, `tests/unit/encoder-patches.test.ts`, `tests/unit/reorder.test.ts`

**Interfaces:**
- Produces:
  - `lib/validation.ts`:
    - schemas `entryPatchSchema`, `reportPatchSchema`, `newReportSchema`, `staffSchema`, `barangaySchema`, `optionSchema`, `settingsSchema`
    - types `EntryPatch`, `ReportPatch`
  - `lib/encoder-patches.ts`:
    - `allNormalPatch(entry: Pick<ReportEntry,'monitors_coastal'>): EntryPatch`
    - `noResponsePatch(): EntryPatch`
    - `conditionPatch(field, value): EntryPatch`, where `field` is one of `weather_option_id | wind_option_id | road | river | coastal | power`
    - `remarksPatch(text: string): EntryPatch`
    - `applyPatch(entry, patch?)`, `mergePatch(a, b)`, `omitKey(record, key)`
  - `lib/backoff.ts`: `backoffDelay(attempt: number): number`
  - `lib/action-result.ts`: `ActionResult<T>`, `ok(data)`, `fail(message, retryable = false)`
  - `lib/reorder.ts`: `moveWithinGroup(group, id, direction: 'up'|'down'): { id: string; sort_order: number }[]` (only the rows whose `sort_order` changes)

- [ ] **Step 1: Write the failing tests**

`tests/unit/validation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { entryPatchSchema, newReportSchema, reportPatchSchema, staffSchema } from '@/lib/validation';

const UUID = '3f2b6a0e-9c1d-4e5f-8a7b-1c2d3e4f5a6b';

describe('entryPatchSchema', () => {
  it('accepts valid partial patches', () => {
    expect(entryPatchSchema.safeParse({ road: 'passable' }).success).toBe(true);
    expect(entryPatchSchema.safeParse({ weather_option_id: UUID, responded: true }).success).toBe(true);
    expect(entryPatchSchema.safeParse({ wind_option_id: null }).success).toBe(true);
  });
  it('rejects bad values, unknown keys and empty patches', () => {
    expect(entryPatchSchema.safeParse({ road: 'closed' }).success).toBe(false);
    expect(entryPatchSchema.safeParse({ report_id: UUID }).success).toBe(false);
    expect(entryPatchSchema.safeParse({}).success).toBe(false);
    expect(entryPatchSchema.safeParse({ remarks: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('reportPatchSchema', () => {
  it('accepts ISO times and trims text', () => {
    const r = reportPatchSchema.safeParse({ report_at: '2026-10-07T02:50:00.000Z', remarks: '  ok  ' });
    expect(r.success && r.data.remarks).toBe('ok');
  });
  it('requires a preparer name when provided', () => {
    expect(reportPatchSchema.safeParse({ prepared_by_name: '  ' }).success).toBe(false);
  });
});

describe('newReportSchema', () => {
  it('requires a datetime-local value', () => {
    expect(newReportSchema.safeParse({ report_at_local: '2026-10-07 10:50', prepared_by_name: 'A', prepared_by_position: '' }).success).toBe(false);
    expect(newReportSchema.safeParse({ report_at_local: '2026-10-07T10:50', prepared_by_name: 'A', prepared_by_position: '' }).success).toBe(true);
  });
});

describe('staffSchema', () => {
  it('normalizes emails to lowercase', () => {
    const r = staffSchema.safeParse({ email: '  Juan.Dela@Gmail.com ', full_name: 'Juan', position: '' });
    expect(r.success && r.data.email).toBe('juan.dela@gmail.com');
    expect(staffSchema.safeParse({ email: 'not-an-email', full_name: 'J', position: '' }).success).toBe(false);
  });
});
```

`tests/unit/encoder-patches.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { backoffDelay } from '@/lib/backoff';
import { allNormalPatch, applyPatch, conditionPatch, mergePatch, noResponsePatch, omitKey, remarksPatch } from '@/lib/encoder-patches';
import { makeEntry } from '../fixtures/sample-sitrep';

describe('encoder patches', () => {
  it('fills the common "all normal" answer, coastal only where monitored', () => {
    expect(allNormalPatch({ monitors_coastal: true })).toEqual({ responded: true, road: 'passable', river: 'normal', coastal: 'normal', power: 'with_power' });
    expect(allNormalPatch({ monitors_coastal: false }).coastal).toBeNull();
  });
  it('clears everything for no response', () => {
    expect(noResponsePatch()).toEqual({ responded: false, weather_option_id: null, wind_option_id: null, road: null, river: null, coastal: null, power: null });
  });
  it('marks a barangay responded when a condition is chosen', () => {
    expect(conditionPatch('road', 'unpassable')).toEqual({ road: 'unpassable', responded: true });
  });
  it('turns blank remarks into null', () => {
    expect(remarksPatch('   ')).toEqual({ remarks: null });
    expect(remarksPatch(' Flooded street ')).toEqual({ remarks: 'Flooded street' });
  });
  it('overlays pending patches', () => {
    const e = makeEntry(1, 'A', 'A1', 'Upland');
    expect(applyPatch(e, { responded: true, road: 'passable' }).road).toBe('passable');
    expect(applyPatch(e, undefined)).toBe(e);
    expect(mergePatch({ road: 'passable', power: 'with_power' }, { road: 'unpassable' })).toEqual({ road: 'unpassable', power: 'with_power' });
    expect(omitKey({ a: 1, b: 2 }, 'a')).toEqual({ b: 2 });
  });
});

describe('backoffDelay', () => {
  it('doubles from 1s and caps at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
```

`tests/unit/reorder.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { moveWithinGroup } from '@/lib/reorder';

const group = [
  { id: 'a', sort_order: 14 },
  { id: 'b', sort_order: 15 },
  { id: 'c', sort_order: 16 },
];

describe('moveWithinGroup', () => {
  it('swaps with the neighbour and returns only changed rows', () => {
    expect(moveWithinGroup(group, 'b', 'up')).toEqual([{ id: 'b', sort_order: 14 }, { id: 'a', sort_order: 15 }]);
    expect(moveWithinGroup(group, 'b', 'down')).toEqual([{ id: 'c', sort_order: 15 }, { id: 'b', sort_order: 16 }]);
  });
  it('does nothing at the edges or for unknown ids', () => {
    expect(moveWithinGroup(group, 'a', 'up')).toEqual([]);
    expect(moveWithinGroup(group, 'c', 'down')).toEqual([]);
    expect(moveWithinGroup(group, 'zzz', 'up')).toEqual([]);
  });
  it('renumbers when sort orders are duplicated', () => {
    const dupes = [{ id: 'a', sort_order: 5 }, { id: 'b', sort_order: 5 }, { id: 'c', sort_order: 5 }];
    expect(moveWithinGroup(dupes, 'c', 'up')).toEqual([{ id: 'c', sort_order: 6 }, { id: 'b', sort_order: 7 }]);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run tests/unit/validation.test.ts tests/unit/encoder-patches.test.ts tests/unit/reorder.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `lib/validation.ts`**

```ts
import { z } from 'zod';

const level = z.enum(['normal', 'above_normal']).nullable();
const optionalOverride = z.string().trim().max(120).nullable().optional();

export const entryPatchSchema = z
  .strictObject({
    responded: z.boolean().optional(),
    weather_option_id: z.uuid().nullable().optional(),
    wind_option_id: z.uuid().nullable().optional(),
    road: z.enum(['passable', 'unpassable']).nullable().optional(),
    river: level.optional(),
    coastal: level.optional(),
    power: z.enum(['with_power', 'no_power']).nullable().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update.' });
export type EntryPatch = z.infer<typeof entryPatchSchema>;

export const reportPatchSchema = z
  .strictObject({
    report_at: z.iso.datetime({ offset: true }).optional(),
    prepared_by_name: z.string().trim().min(1, 'Enter who prepared the report.').max(120).optional(),
    prepared_by_position: z.string().trim().max(120).optional(),
    remarks: z.string().trim().max(2000).optional(),
    weather_summary_override: optionalOverride,
    wind_summary_override: optionalOverride,
    rivers_summary_override: optionalOverride,
    roads_summary_override: optionalOverride,
    coastal_summary_override: optionalOverride,
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update.' });
export type ReportPatch = z.infer<typeof reportPatchSchema>;

export const newReportSchema = z.object({
  report_at_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose the netcall date and time.'),
  prepared_by_name: z.string().trim().min(1, 'Enter who prepared the report.').max(120),
  prepared_by_position: z.string().trim().max(120),
});

export const staffSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid Gmail address.')),
  full_name: z.string().trim().min(1, 'Enter the full name.').max(120),
  position: z.string().trim().max(120),
});

export const barangaySchema = z.object({
  name: z.string().trim().min(1, 'Enter the barangay name.').max(80),
  callsign: z.string().trim().min(1, 'Enter the callsign.').max(40),
  zone_id: z.uuid('Choose a zone.'),
  monitors_coastal: z.boolean(),
  is_active: z.boolean(),
});

export const optionSchema = z.object({
  kind: z.enum(['weather', 'wind']),
  label: z.string().trim().min(1, 'Enter a label.').max(60),
  severity: z.coerce.number().int().min(0).max(20),
  is_active: z.boolean(),
});

export const settingsSchema = z.object({
  office_title: z.string().trim().min(1).max(120),
  office_lines: z.array(z.string().trim().min(1).max(160)).max(5),
  network_name: z.string().trim().min(1).max(160),
  call_sign: z.string().trim().min(1).max(60),
  radio_frequency: z.string().trim().min(1).max(30),
  report_title: z.string().trim().min(1).max(120),
});
```

- [ ] **Step 4: Implement `lib/encoder-patches.ts`, `lib/backoff.ts`, `lib/action-result.ts`, `lib/reorder.ts`**

`lib/encoder-patches.ts`:
```ts
import type { Level, Power, ReportEntry, Road } from './types';
import type { EntryPatch } from './validation';

type ConditionField = 'weather_option_id' | 'wind_option_id' | 'road' | 'river' | 'coastal' | 'power';
type ConditionValue = string | Road | Level | Power | null;

export function allNormalPatch(entry: Pick<ReportEntry, 'monitors_coastal'>): EntryPatch {
  return {
    responded: true,
    road: 'passable',
    river: 'normal',
    coastal: entry.monitors_coastal ? 'normal' : null,
    power: 'with_power',
  };
}

export function noResponsePatch(): EntryPatch {
  return { responded: false, weather_option_id: null, wind_option_id: null, road: null, river: null, coastal: null, power: null };
}

export function conditionPatch(field: ConditionField, value: ConditionValue): EntryPatch {
  return { [field]: value, responded: true } as EntryPatch;
}

export function remarksPatch(text: string): EntryPatch {
  const trimmed = text.trim();
  return { remarks: trimmed === '' ? null : trimmed };
}

export function applyPatch(entry: ReportEntry, patch: EntryPatch | undefined): ReportEntry {
  return patch ? ({ ...entry, ...patch } as ReportEntry) : entry;
}

export function mergePatch(a: EntryPatch | undefined, b: EntryPatch): EntryPatch {
  return { ...a, ...b };
}

export function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
```

`lib/backoff.ts`:
```ts
export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt), 30_000);
}
```

`lib/action-result.ts`:
```ts
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; message: string; retryable: boolean };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(message: string, retryable = false): { ok: false; message: string; retryable: boolean } {
  return { ok: false, message, retryable };
}
```

`lib/reorder.ts`:
```ts
export function moveWithinGroup<T extends { id: string; sort_order: number }>(
  group: T[],
  id: string,
  direction: 'up' | 'down',
): { id: string; sort_order: number }[] {
  const ordered = [...group].sort((a, b) => a.sort_order - b.sort_order);
  const i = ordered.findIndex((row) => row.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return [];
  const values = ordered.map((row) => row.sort_order);
  const slots = new Set(values).size === values.length ? values : values.map((_, k) => values[0] + k);
  const original = new Map(ordered.map((row) => [row.id, row.sort_order]));
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  return ordered
    .map((row, k) => ({ id: row.id, sort_order: slots[k] }))
    .filter((row) => original.get(row.id) !== row.sort_order);
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/validation.test.ts tests/unit/encoder-patches.test.ts tests/unit/reorder.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/validation.ts lib/encoder-patches.ts lib/backoff.ts lib/action-result.ts lib/reorder.ts tests/unit/validation.test.ts tests/unit/encoder-patches.test.ts tests/unit/reorder.test.ts
git commit -m "feat: add encoder validation, patches, retry backoff and reorder helpers"
```

---

### Task 9: Supabase clients, `proxy.ts` and the Google sign-in flow

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/public.ts`, `lib/supabase/db.ts`, `lib/auth.ts`, `lib/auth-redirect.ts`, `proxy.ts`, `app/login/page.tsx`, `app/login/login-button.tsx`, `app/auth/callback/route.ts`, `app/unauthorized/page.tsx`
- Test: `tests/unit/auth-redirect.test.ts`

**Interfaces:**
- Consumes: `env` (Task 1), `StaffUser` (Task 5).
- Produces:
  - `createClient(): Promise<SupabaseClient>` (server, cookie session)
  - `getBrowserClient(): SupabaseClient` (singleton)
  - `getPublicClient(): SupabaseClient` (server, no session)
  - `cdrrmo(client: SupabaseClient)` returns `client.schema('cdrrmo')`
  - `getCurrentStaff(): Promise<StaffUser | null>` (React-cached), `requireStaff(): Promise<StaffUser>`, `requireSuperAdmin(): Promise<StaffUser>`
  - `safeNextPath(next): string`, `DEFAULT_ADMIN_PATH = '/admin/reports'`

- [ ] **Step 1: Write the failing test `tests/unit/auth-redirect.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_ADMIN_PATH, safeNextPath } from '@/lib/auth-redirect';

describe('safeNextPath', () => {
  it('keeps admin paths', () => {
    expect(safeNextPath('/admin/reports/abc')).toBe('/admin/reports/abc');
  });
  it('rejects external, protocol-relative and non-admin targets', () => {
    for (const bad of [null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/reports', '/admin\\..\\x']) {
      expect(safeNextPath(bad)).toBe(DEFAULT_ADMIN_PATH);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/unit/auth-redirect.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/auth-redirect.ts`**

```ts
export const DEFAULT_ADMIN_PATH = '/admin/reports';

export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) return DEFAULT_ADMIN_PATH;
  return next;
}
```
Run: `npx vitest run tests/unit/auth-redirect.test.ts`
Expected: PASS.

- [ ] **Step 4: Supabase clients**

`lib/supabase/server.ts`:
```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy.ts refreshes the session.
        }
      },
    },
  });
}
```

`lib/supabase/browser.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | undefined;

export function getBrowserClient(): SupabaseClient {
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseKey);
  return client;
}
```

`lib/supabase/public.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | undefined;

/** Session-less client for public, read-only server rendering. */
export function getPublicClient(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
```

`lib/supabase/db.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export const SCHEMA = 'cdrrmo';

export function cdrrmo(client: SupabaseClient) {
  return client.schema(SCHEMA);
}
```

- [ ] **Step 5: `lib/auth.ts`**

```ts
import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { StaffUser } from '@/lib/types';

export const getCurrentStaff = cache(async (): Promise<StaffUser | null> => {
  const supabase = await createClient();
  const { data, error } = await cdrrmo(supabase).rpc('current_staff').maybeSingle();
  if (error || !data) return null;
  return data as StaffUser;
});

export async function requireStaff(): Promise<StaffUser> {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  return staff;
}

export async function requireSuperAdmin(): Promise<StaffUser> {
  const staff = await requireStaff();
  if (staff.role !== 'super_admin') redirect('/admin/reports');
  return staff;
}
```

- [ ] **Step 6: `proxy.ts`** (Next 16: replaces middleware; runs only for `/admin`)

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

- [ ] **Step 7: Login, callback and unauthorized pages**

`app/login/login-button.tsx`:
```tsx
'use client';

import { LoaderCircle, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/browser';

export function LoginButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await getBrowserClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (oauthError) {
      setError(oauthError.message);
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" size="lg" onClick={signIn} disabled={pending} className="h-12 w-full cursor-pointer text-base">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        Sign in with Google
      </Button>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-danger">{error}</p>}
    </>
  );
}
```

`app/login/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { Radio } from 'lucide-react';
import { safeNextPath } from '@/lib/auth-redirect';
import { LoginButton } from './login-button';

export const metadata: Metadata = { title: 'Staff sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-brand px-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 text-card-foreground shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <Radio className="size-8 text-primary" aria-hidden />
          <div>
            <p className="text-sm text-muted-foreground">CDRRMO Ozamiz</p>
            <h1 className="text-xl font-bold">Staff sign in</h1>
          </div>
        </div>
        <p className="mb-6 text-muted-foreground">Use the Google account your CDRRMO administrator added.</p>
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 font-bold text-danger">
            Sign-in failed. Please try again.
          </p>
        )}
        <LoginButton next={safeNextPath(next)} />
      </div>
    </main>
  );
}
```

`app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/auth-redirect';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange`);

  const { data: staff } = await cdrrmo(supabase).rpc('claim_staff_account').maybeSingle();
  if (!staff) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/unauthorized`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
```

`app/unauthorized/page.tsx`:
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = { title: 'Not authorized', robots: { index: false } };

export default function UnauthorizedPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 size-10 text-danger" aria-hidden />
        <h1 className="mb-2 text-xl font-bold">This account isn&apos;t authorized</h1>
        <p className="mb-6 text-muted-foreground">
          Your Google account is not on the CDRRMO staff list. Contact the CDRRMO administrator to be added.
        </p>
        <div className="flex justify-center gap-4 font-bold">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">Try another account</Link>
          <Link href="/" className="text-primary underline-offset-4 hover:underline">Public reports</Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Verify the build and the `/admin` redirect**

Run: `npm run typecheck && npm run build`
Expected: success, and the build output lists `ƒ Proxy (Middleware)`.
Then run `npm run start` (background) and `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin/reports`.
Expected: `307 http://localhost:3000/login?next=%2Fadmin%2Freports`. Stop the server.

- [ ] **Step 9: Ask the owner for the auth redirect URLs** (manual)

Tell the user: "In Supabase → Authentication → URL Configuration → *Redirect URLs*, add `http://localhost:3000/auth/callback` (and later `https://<your-domain>/auth/callback`)."

- [ ] **Step 10: Commit**

```bash
git add lib/supabase lib/auth.ts lib/auth-redirect.ts proxy.ts app/login app/auth app/unauthorized tests/unit/auth-redirect.test.ts
git commit -m "feat(auth): add Supabase clients, admin proxy and Google sign-in with allowlist"
```

---

### Task 10: Data access layer and live hooks

**Files:**
- Create: `lib/settings-defaults.ts`, `lib/data/report-bundle.ts`, `lib/data/public.ts`, `lib/data/admin.ts`, `hooks/use-live-report.ts`, `hooks/use-newer-report.ts`

**Interfaces:**
- Consumes: Task 5 to Task 9.
- Produces:
  - `DEFAULT_SETTINGS: Settings`
  - `fetchReportBundle(client: SupabaseClient, id: string): Promise<ReportBundle | null>`
  - `getReportBundle(id)`, `getLatestReportMeta(): Promise<{ id: string; report_at: string } | null>`, `getReferenceData(): Promise<{ options: ConditionOption[]; settings: Settings }>`, `getArchivePage(page): Promise<{ items: { report: Report; summary: ReportSummary }[]; hasMore: boolean }>`, `ARCHIVE_PAGE_SIZE = 50` (server-only, React-cached, dynamic)
  - `listRecentReports()`, `listStaff()`, `listZones()`, `listBarangays()`, `listOptions()`, `getSettings()` (server-only, use the staff session)
  - `useLiveReport(initial: ReportBundle)` returns `{ report, entries, deleted, status: ConnectionStatus, lastUpdated: string, flashIds: ReadonlySet<string>, applyEntry(entry), applyReport(report) }`
  - `ConnectionStatus = 'connecting' | 'live' | 'reconnecting'`
  - `useNewerReport(currentId: string, currentReportAt: string): { id: string; report_at: string } | null`

- [ ] **Step 1: `lib/settings-defaults.ts` and `lib/data/report-bundle.ts`**

```ts
// lib/settings-defaults.ts
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  office_title: 'Office of the Mayor',
  office_lines: ['City Disaster Risk Reduction and Management Office', 'City of Ozamiz, Misamis Occidental'],
  network_name: 'Nagkahiusang Alerto sa Ozamiz Radio Communication Network',
  call_sign: 'Rescue Base',
  radio_frequency: '148.710',
  report_title: 'Barangay Weather SitRep',
  logo_urls: [],
};
```

```ts
// lib/data/report-bundle.ts — isomorphic (server + browser)
import type { SupabaseClient } from '@supabase/supabase-js';
import { cdrrmo } from '@/lib/supabase/db';
import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export async function fetchReportBundle(client: SupabaseClient, id: string): Promise<ReportBundle | null> {
  const db = cdrrmo(client);
  const [reportRes, entriesRes] = await Promise.all([
    db.from('reports').select('*').eq('id', id).maybeSingle(),
    db.from('report_entries').select('*').eq('report_id', id).order('zone_sort').order('sort_order'),
  ]);
  if (reportRes.error) throw new Error(`Could not load the report: ${reportRes.error.message}`);
  if (entriesRes.error) throw new Error(`Could not load the barangay rows: ${entriesRes.error.message}`);
  if (!reportRes.data) return null;
  return { report: reportRes.data as Report, entries: (entriesRes.data ?? []) as ReportEntry[] };
}
```

- [ ] **Step 2: `lib/data/public.ts`**

```ts
import 'server-only';
import { connection } from 'next/server';
import { cache } from 'react';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { isUuid } from '@/lib/ids';
import { DEFAULT_SETTINGS } from '@/lib/settings-defaults';
import { summarizeReport } from '@/lib/summary';
import { cdrrmo } from '@/lib/supabase/db';
import { getPublicClient } from '@/lib/supabase/public';
import type { ConditionOption, Report, ReportEntry, ReportSummary, Settings } from '@/lib/types';

export const ARCHIVE_PAGE_SIZE = 50;

export const getReportBundle = cache(async (id: string) => {
  await connection();
  if (!isUuid(id)) return null;
  return fetchReportBundle(getPublicClient(), id);
});

export const getLatestReportMeta = cache(async (): Promise<{ id: string; report_at: string } | null> => {
  await connection();
  const { data, error } = await cdrrmo(getPublicClient())
    .from('reports')
    .select('id, report_at')
    .order('report_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the latest report: ${error.message}`);
  return data as { id: string; report_at: string } | null;
});

export const getReferenceData = cache(async (): Promise<{ options: ConditionOption[]; settings: Settings }> => {
  await connection();
  const db = cdrrmo(getPublicClient());
  const [optionsRes, settingsRes] = await Promise.all([
    db.from('condition_options').select('*').order('kind').order('sort_order'),
    db.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (optionsRes.error) throw new Error(`Could not load options: ${optionsRes.error.message}`);
  if (settingsRes.error) throw new Error(`Could not load settings: ${settingsRes.error.message}`);
  return {
    options: (optionsRes.data ?? []) as ConditionOption[],
    settings: { ...DEFAULT_SETTINGS, ...((settingsRes.data as Settings | null) ?? {}) },
  };
});

export async function getArchivePage(page: number): Promise<{ items: { report: Report; summary: ReportSummary }[]; hasMore: boolean }> {
  await connection();
  const from = (page - 1) * ARCHIVE_PAGE_SIZE;
  const [{ data, error }, { options }] = await Promise.all([
    cdrrmo(getPublicClient())
      .from('reports')
      .select('*, report_entries(*)')
      .order('report_at', { ascending: false })
      .range(from, from + ARCHIVE_PAGE_SIZE),
    getReferenceData(),
  ]);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  const rows = (data ?? []) as (Report & { report_entries: ReportEntry[] })[];
  const items = rows.slice(0, ARCHIVE_PAGE_SIZE).map(({ report_entries, ...report }) => ({
    report,
    summary: summarizeReport(report, report_entries, options),
  }));
  return { items, hasMore: rows.length > ARCHIVE_PAGE_SIZE };
}
```

- [ ] **Step 3: `lib/data/admin.ts`**

```ts
import 'server-only';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { Barangay, ConditionOption, Report, Settings, StaffUser, Zone } from '@/lib/types';

async function db() {
  return cdrrmo(await createClient());
}

export async function listRecentReports(limit = 50): Promise<{ report: Report; active: number; total: number }[]> {
  const { data, error } = await (await db())
    .from('reports')
    .select('*, report_entries(responded)')
    .order('report_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return ((data ?? []) as (Report & { report_entries: { responded: boolean }[] })[]).map(({ report_entries, ...report }) => ({
    report,
    active: report_entries.filter((e) => e.responded).length,
    total: report_entries.length,
  }));
}

export async function listStaff(): Promise<StaffUser[]> {
  const { data, error } = await (await db()).from('users').select('*').order('role', { ascending: false }).order('email');
  if (error) throw new Error(`Could not load users: ${error.message}`);
  return (data ?? []) as StaffUser[];
}

export async function listZones(): Promise<Zone[]> {
  const { data, error } = await (await db()).from('zones').select('id, name, sort_order').order('sort_order');
  if (error) throw new Error(`Could not load zones: ${error.message}`);
  return (data ?? []) as Zone[];
}

export async function listBarangays(): Promise<Barangay[]> {
  const { data, error } = await (await db()).from('barangays').select('*').order('sort_order');
  if (error) throw new Error(`Could not load barangays: ${error.message}`);
  return (data ?? []) as Barangay[];
}

export async function listOptions(): Promise<ConditionOption[]> {
  const { data, error } = await (await db()).from('condition_options').select('*').order('kind').order('sort_order');
  if (error) throw new Error(`Could not load options: ${error.message}`);
  return (data ?? []) as ConditionOption[];
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await (await db()).from('settings').select('*').eq('id', 1).single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return data as Settings;
}
```

- [ ] **Step 4: `hooks/use-live-report.ts`**

```ts
'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { initLiveState, lastUpdatedAt, liveReducer, type Deleted } from '@/lib/live/report-state';
import { getBrowserClient } from '@/lib/supabase/browser';
import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

const FLASH_MS = 1500;

export function useLiveReport(initial: ReportBundle) {
  const [state, dispatch] = useReducer(liveReducer, initial, initLiveState);
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    // New server snapshot (router.refresh or navigation): adopt it.
    setSeenInitial(initial);
    dispatch({ type: 'reset', bundle: initial });
  }

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reportId = state.report.id;

  const flash = useCallback((id: string) => {
    setFlashIds((prev) => new Set(prev).add(id));
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        setFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, FLASH_MS),
    );
  }, []);

  const resync = useCallback(async () => {
    try {
      const bundle = await fetchReportBundle(getBrowserClient(), reportId);
      if (bundle) dispatch({ type: 'reset', bundle });
      else dispatch({ type: 'report', payload: { id: reportId, deleted: true } });
    } catch {
      // Keep showing current data; the status indicator tells the viewer we're reconnecting.
    }
  }, [reportId]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`cdrrmo:report:${reportId}`)
      .on('broadcast', { event: 'entry' }, ({ payload }) => {
        const entry = payload as ReportEntry | Deleted;
        dispatch({ type: 'entry', payload: entry });
        if (!('deleted' in entry)) flash(entry.id);
      })
      .on('broadcast', { event: 'report' }, ({ payload }) => {
        dispatch({ type: 'report', payload: payload as Report | Deleted });
      })
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('live');
          void resync(); // catch anything that changed between server render and subscribe
        } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
          setStatus('reconnecting');
        }
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') void resync();
    };
    const onOnline = () => void resync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const pending = timers.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      pending.forEach(clearTimeout);
      void supabase.removeChannel(channel);
    };
  }, [reportId, resync, flash]);

  const applyEntry = useCallback((entry: ReportEntry) => dispatch({ type: 'entry', payload: entry }), []);
  const applyReport = useCallback((report: Report) => dispatch({ type: 'report', payload: report }), []);
  const lastUpdated = useMemo(() => lastUpdatedAt(state), [state]);

  return {
    report: state.report,
    entries: state.entries,
    deleted: state.deleted,
    status,
    lastUpdated,
    flashIds,
    applyEntry,
    applyReport,
  };
}
```

- [ ] **Step 5: `hooks/use-newer-report.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/browser';

interface NewerReport {
  forId: string;
  id: string;
  report_at: string;
}

export function useNewerReport(currentId: string, currentReportAt: string): { id: string; report_at: string } | null {
  const [newer, setNewer] = useState<NewerReport | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel('cdrrmo:reports')
      .on('broadcast', { event: 'reports_changed' }, ({ payload }) => {
        const p = payload as { id: string; report_at: string; op: 'INSERT' | 'UPDATE' | 'DELETE' };
        if (p.op !== 'DELETE' && p.id !== currentId && Date.parse(p.report_at) > Date.parse(currentReportAt)) {
          setNewer({ forId: currentId, id: p.id, report_at: p.report_at });
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentId, currentReportAt]);

  return newer && newer.forId === currentId ? { id: newer.id, report_at: newer.report_at } : null;
}
```

- [ ] **Step 6: Typecheck, lint and run all unit tests**

Run: `npm run typecheck && npm run lint && npm test`
Expected: no type or lint errors, and all unit tests pass. If a `react-hooks/*` lint rule flags the `seenInitial` block in `useLiveReport`, keep the pattern (it is React's documented "adjusting state when a prop changes" pattern) and add `// eslint-disable-next-line <the exact rule name reported>` above the `if` line.

- [ ] **Step 7: Commit**

```bash
git add lib/settings-defaults.ts lib/data hooks
git commit -m "feat: add data access layer and live report hooks"
```

---
### Task 11: Public live report page (`/` and `/reports/[id]`)

**Files:**
- Create: `components/report/report-header.tsx`, `report-bar.tsx`, `live-indicator.tsx`, `status-badge.tsx`, `summary-tiles.tsx`, `report-filters.tsx`, `entry-parts.tsx`, `barangay-cards.tsx`, `barangay-table.tsx`, `share-buttons.tsx`, `new-report-banner.tsx`, `report-footer.tsx`, `no-reports.tsx`, `live-report-view.tsx` (all under `components/report/`), `lib/report-metadata.ts`, `app/reports/[id]/page.tsx`, `app/not-found.tsx`, `supabase/seed/sample_report_2026-10-07.sql`
- Modify: `app/page.tsx` (replace the placeholder)

**Interfaces:**
- Consumes: `useLiveReport`, `useNewerReport` (Task 10); `summarizeReport`, `describeSummary`, `entryHasIssue` (Task 6); labels and filter helpers (Task 6); format helpers (Task 5); `getReportBundle`, `getLatestReportMeta`, `getReferenceData` (Task 10); `reportUrl`, `facebookShareUrl` (Task 1).
- Produces:
  - `StatusBadge({ tone, label, icon? })`
  - `SummaryTiles({ summary })`
  - `ShareButtons({ url, title })`
  - `LiveIndicator({ status, lastUpdated })`
  - `ReportHeader({ settings })`
  - `ConditionChip`, `StatusItem`, `NoResponseLabel` (from `entry-parts.tsx`)
  - `reportMetadata(bundle, options, { canonicalPath }): Metadata`
  - The encoder screen (Task 15) reuses these components.

- [ ] **Step 1: Seed the real 2026-10-07 1050H report** so there is something to render. This is the CDRRMO's actual report from the sample image. It stays as the first archived report, and the owner can delete it later.

`supabase/seed/sample_report_2026-10-07.sql`:
```sql
-- The 2026-10-07 1050H netcall from the paper SitRep. Idempotent.
do $$
declare v_report uuid;
begin
  if exists (select 1 from cdrrmo.reports where report_at = '2026-10-07 10:50+08' and prepared_by_name = 'Romeo P. De Los Angeles Jr') then
    return;
  end if;
  insert into cdrrmo.reports (report_at, prepared_by_name, prepared_by_position, remarks)
  values ('2026-10-07 10:50+08', 'Romeo P. De Los Angeles Jr', 'Radio Controller on Duty',
          'All stations reported that their respective AOR are in normal situation.')
  returning id into v_report;

  insert into cdrrmo.report_entries (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal)
  select v_report, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal
  from cdrrmo.barangays b join cdrrmo.zones z on z.id = b.zone_id
  where b.is_active;

  update cdrrmo.report_entries e set
    responded = true,
    weather_option_id = (select o.id from cdrrmo.condition_options o where o.kind = 'weather' and o.label = v.weather),
    wind_option_id = (select o.id from cdrrmo.condition_options o where o.kind = 'wind' and o.label = v.wind),
    road = 'passable',
    river = nullif(v.river, ''),
    coastal = nullif(v.coastal, ''),
    power = nullif(v.power, '')
  from (values
    ('Stimson Abordo', 'Moderate rain', 'Not windy', '', '', 'with_power'),
    ('Trigos', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Dalapang', 'Moderate rain', 'Not windy', '', '', 'with_power'),
    ('Cogon', 'Light rain', 'Not windy', '', '', 'with_power'),
    ('Embargo', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Pulot', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Calabayan', 'Light rain', 'Not windy', 'normal', '', 'with_power'),
    ('Kinuman Sur', 'Light rain', 'Not windy', 'normal', '', 'with_power'),
    ('Sangay Diot', 'Light rain', 'Not windy', 'normal', '', ''),
    ('Balintawak', 'Moderate rain', 'Not windy', '', '', 'with_power'),
    ('Bañadero', 'Light rain', 'Not windy', 'normal', '', 'with_power'),
    ('Aguada', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Dimaluna', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Baybay Triunfo', 'Light rain', 'Not windy', 'normal', 'normal', 'with_power'),
    ('Malaubang', 'Light rain', 'Light wind', 'normal', 'normal', 'with_power')
  ) as v (name, weather, wind, river, coastal, power)
  where e.report_id = v_report and e.barangay_name = v.name;
end $$;

select r.id, count(*) filter (where e.responded) as active, count(*) as total
from cdrrmo.reports r join cdrrmo.report_entries e on e.report_id = r.id
where r.report_at = '2026-10-07 10:50+08' group by r.id;
```
Run it with MCP `execute_sql`.
Expected: one row with `active 15, total 24`. Record the `id` as `SAMPLE_REPORT_ID` (it is needed in Steps 9–10 and in Task 19).

- [ ] **Step 2: Small building blocks**

`components/report/status-badge.tsx`:
```tsx
import { CircleCheck, CircleX, Minus, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/lib/labels';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  none: 'bg-muted text-muted-foreground',
};

const TONE_ICON: Record<Tone, LucideIcon> = { ok: CircleCheck, warn: TriangleAlert, danger: CircleX, none: Minus };

export function StatusBadge({ tone, label, icon }: { tone: Tone; label: string; icon?: LucideIcon }) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold', TONE_CLASS[tone])}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
```

`components/report/live-indicator.tsx`:
```tsx
import type { ConnectionStatus } from '@/hooks/use-live-report';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  live: 'LIVE',
  reconnecting: 'Reconnecting…',
};

export function LiveIndicator({ status, lastUpdated }: { status: ConnectionStatus; lastUpdated: string }) {
  const live = status === 'live';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex size-3" aria-hidden>
        {live && <span className="absolute inline-flex size-full rounded-full bg-danger opacity-75 motion-safe:animate-ping" />}
        <span className={cn('relative inline-flex size-3 rounded-full', live ? 'bg-danger' : 'bg-muted-foreground')} />
      </span>
      <span role="status" className="font-bold">{STATUS_TEXT[status]}</span>
      <span className="tabular text-muted-foreground">Updated {formatClock(lastUpdated)}</span>
    </div>
  );
}
```

`components/report/entry-parts.tsx`:
```tsx
import { CircleX, type LucideIcon } from 'lucide-react';
import { valueTone } from '@/lib/labels';
import type { Level, Power, Road } from '@/lib/types';
import { StatusBadge } from './status-badge';

export function ConditionChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold">
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function StatusItem({ label, icon, value, text }: { label: string; icon?: LucideIcon; value: Road | Level | Power | null; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd><StatusBadge tone={valueTone(value)} label={text} icon={value ? icon : undefined} /></dd>
    </div>
  );
}

export function NoResponseLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-danger">
      <CircleX className="size-5 shrink-0" aria-hidden />
      No response
    </span>
  );
}
```

`components/report/report-header.tsx`:
```tsx
import { Radio } from 'lucide-react';
import type { Settings } from '@/lib/types';

export function ReportHeader({ settings }: { settings: Settings }) {
  return (
    <header className="bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
        <div className="flex shrink-0 items-center gap-2">
          {settings.logo_urls.length > 0 ? (
            settings.logo_urls.slice(0, 4).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- remote logos from the public storage bucket
              <img key={url} src={url} alt="" width={44} height={44} className="size-11 rounded-full bg-white object-contain" />
            ))
          ) : (
            <Radio className="size-10" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide">{settings.office_title}</p>
          {settings.office_lines.map((line) => (
            <p key={line} className="hidden text-sm opacity-90 sm:block">{line}</p>
          ))}
          <p className="text-xs opacity-80">
            {settings.network_name} · Call sign: {settings.call_sign} · {settings.radio_frequency}
          </p>
        </div>
      </div>
    </header>
  );
}
```

`components/report/report-bar.tsx`:
```tsx
import type { ConnectionStatus } from '@/hooks/use-live-report';
import { Badge } from '@/components/ui/badge';
import { LiveIndicator } from './live-indicator';

export function ReportBar({ title, heading, isLatest, status, lastUpdated }: {
  title: string;
  heading: string;
  isLatest: boolean;
  status: ConnectionStatus;
  lastUpdated: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Nagkahiusang Alerto sa Ozamiz Netcall Report</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-xl font-bold tabular">
          {heading}
          {isLatest ? <Badge>Latest</Badge> : <Badge variant="secondary">Older report</Badge>}
        </p>
      </div>
      <LiveIndicator status={status} lastUpdated={lastUpdated} />
    </section>
  );
}
```

- [ ] **Step 3: Summary tiles and filters**

`components/report/summary-tiles.tsx`:
```tsx
import { Anchor, CloudRain, Route, Waves, Wind, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { summaryTone } from '@/lib/labels';
import type { ReportSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

function Tile({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-card-foreground', className)}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-11 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
        className="stroke-ok transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
      />
    </svg>
  );
}

export function SummaryTiles({ summary }: { summary: ReportSummary }) {
  const pct = summary.total ? Math.round((summary.active / summary.total) * 100) : 0;
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Active stations">
        <div className="flex items-center gap-3">
          <ProgressRing value={pct} />
          <p className="text-3xl font-bold tabular">
            {summary.active}
            <span className="text-lg text-muted-foreground"> / {summary.total}</span>
          </p>
        </div>
      </Tile>
      <Tile label="No response">
        <p className={cn('text-3xl font-bold tabular', summary.noResponse > 0 && 'text-danger')}>{summary.noResponse}</p>
      </Tile>
      <Tile label="Average weather">
        <p className="flex items-center gap-2 text-lg font-bold"><CloudRain className="size-5 shrink-0" aria-hidden />{summary.weather}</p>
      </Tile>
      <Tile label="Average wind">
        <p className="flex items-center gap-2 text-lg font-bold"><Wind className="size-5 shrink-0" aria-hidden />{summary.wind}</p>
      </Tile>
      <Tile label="Rivers / canals"><StatusBadge tone={summaryTone(summary.rivers)} label={summary.rivers} icon={Waves} /></Tile>
      <Tile label="Roads / bridges"><StatusBadge tone={summaryTone(summary.roads)} label={summary.roads} icon={Route} /></Tile>
      <Tile label="Coastal"><StatusBadge tone={summaryTone(summary.coastal)} label={summary.coastal} icon={Anchor} /></Tile>
      <Tile label="Power"><StatusBadge tone={summaryTone(summary.power)} label={summary.power} icon={Zap} /></Tile>
    </section>
  );
}
```

`components/report/report-filters.tsx`:
```tsx
'use client';

import { cn } from '@/lib/utils';

export function ReportFilters({ zones, zone, onZoneChange, issuesOnly, onIssuesOnlyChange }: {
  zones: string[];
  zone: string;
  onZoneChange: (zone: string) => void;
  issuesOnly: boolean;
  onIssuesOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Filter by zone" className="flex flex-wrap gap-2">
        {['all', ...zones].map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={zone === z}
            onClick={() => onZoneChange(z)}
            className={cn(
              'min-h-11 cursor-pointer rounded-full border px-4 text-sm font-bold transition-colors duration-150',
              zone === z ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            {z === 'all' ? 'All' : z}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold sm:ml-auto">
        <input
          type="checkbox"
          checked={issuesOnly}
          onChange={(e) => onIssuesOnlyChange(e.target.checked)}
          className="size-5 accent-primary"
        />
        Issues only
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Barangay cards (phones) and table (desktop)**

`components/report/barangay-cards.tsx`:
```tsx
import { Anchor, CloudRain, Route, Waves, Wind, Zap, ZapOff } from 'lucide-react';
import { LEVEL_LABEL, POWER_LABEL, ROAD_LABEL } from '@/lib/labels';
import { NONE } from '@/lib/summary';
import type { ReportEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ConditionChip, NoResponseLabel, StatusItem } from './entry-parts';

type Groups = { zone: string; entries: ReportEntry[] }[];

function BarangayCard({ entry, optionLabel, flash }: { entry: ReportEntry; optionLabel: (id: string | null) => string; flash: boolean }) {
  const title = (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-lg font-bold">{entry.barangay_name}</h3>
      <span className="shrink-0 text-sm font-bold text-muted-foreground">{entry.callsign}</span>
    </div>
  );
  if (!entry.responded) {
    return (
      <article className={cn('rounded-xl border border-danger/30 bg-danger-soft p-4', flash && 'motion-safe:animate-flash')}>
        {title}
        <p className="mt-2"><NoResponseLabel /></p>
        {entry.remarks && <p className="mt-1 text-sm">{entry.remarks}</p>}
      </article>
    );
  }
  return (
    <article className={cn('rounded-xl border bg-card p-4', flash && 'motion-safe:animate-flash')}>
      {title}
      <div className="mt-3 flex flex-wrap gap-2">
        <ConditionChip icon={CloudRain} label={optionLabel(entry.weather_option_id)} />
        <ConditionChip icon={Wind} label={optionLabel(entry.wind_option_id)} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <StatusItem label="Road" icon={Route} value={entry.road} text={entry.road ? ROAD_LABEL[entry.road] : NONE} />
        <StatusItem label="River / canal" icon={Waves} value={entry.river} text={entry.river ? LEVEL_LABEL[entry.river] : NONE} />
        {entry.monitors_coastal && (
          <StatusItem label="Coastal" icon={Anchor} value={entry.coastal} text={entry.coastal ? LEVEL_LABEL[entry.coastal] : NONE} />
        )}
        <StatusItem
          label="Power"
          icon={entry.power === 'no_power' ? ZapOff : Zap}
          value={entry.power}
          text={entry.power ? POWER_LABEL[entry.power] : NONE}
        />
      </dl>
      {entry.remarks && <p className="mt-3 text-sm text-muted-foreground">{entry.remarks}</p>}
    </article>
  );
}

export function BarangayCards({ groups, optionLabel, flashIds }: {
  groups: Groups;
  optionLabel: (id: string | null) => string;
  flashIds: ReadonlySet<string>;
}) {
  return (
    <div className="space-y-6 md:hidden">
      {groups.map((group) => (
        <section key={group.zone} aria-label={`${group.zone} barangays`}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{group.zone}</h2>
          <ul className="space-y-3">
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <BarangayCard entry={entry} optionLabel={optionLabel} flash={flashIds.has(entry.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`components/report/barangay-table.tsx`:
```tsx
import { LEVEL_LABEL, POWER_LABEL, ROAD_LABEL, valueTone } from '@/lib/labels';
import { NONE } from '@/lib/summary';
import type { Level, Power, ReportEntry, Road } from '@/lib/types';
import { cn } from '@/lib/utils';
import { NoResponseLabel } from './entry-parts';
import { StatusBadge } from './status-badge';

type Groups = { zone: string; entries: ReportEntry[] }[];
const HEADERS = ['No.', 'Barangay', 'Callsign', 'Weather', 'Wind', 'Road', 'River / Canal', 'Coastal', 'Power', 'Remarks'];

function Status({ value, text }: { value: Road | Level | Power | null; text: string }) {
  return <StatusBadge tone={valueTone(value)} label={text} />;
}

export function BarangayTable({ groups, optionLabel, flashIds, numbers }: {
  groups: Groups;
  optionLabel: (id: string | null) => string;
  flashIds: ReadonlySet<string>;
  numbers: Map<string, number>;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Barangay weather situation</caption>
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {HEADERS.map((h) => (
              <th key={h} scope="col" className="px-3 py-3 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.zone} className="divide-y">
            <tr className="bg-brand/5">
              <th colSpan={HEADERS.length} scope="colgroup" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">
                {group.zone}
              </th>
            </tr>
            {group.entries.map((e) => (
              <tr key={e.id} className={cn(!e.responded && 'bg-danger-soft', flashIds.has(e.id) && 'motion-safe:animate-flash')}>
                <td className="px-3 py-2.5 tabular text-muted-foreground">{numbers.get(e.id)}</td>
                <th scope="row" className="px-3 py-2.5 font-bold">{e.barangay_name}</th>
                <td className="px-3 py-2.5">{e.callsign}</td>
                {e.responded ? (
                  <>
                    <td className="px-3 py-2.5">{optionLabel(e.weather_option_id)}</td>
                    <td className="px-3 py-2.5">{optionLabel(e.wind_option_id)}</td>
                    <td className="px-3 py-2.5"><Status value={e.road} text={e.road ? ROAD_LABEL[e.road] : NONE} /></td>
                    <td className="px-3 py-2.5"><Status value={e.river} text={e.river ? LEVEL_LABEL[e.river] : NONE} /></td>
                    <td className="px-3 py-2.5">
                      {e.monitors_coastal ? <Status value={e.coastal} text={e.coastal ? LEVEL_LABEL[e.coastal] : NONE} /> : <span className="text-muted-foreground">n/a</span>}
                    </td>
                    <td className="px-3 py-2.5"><Status value={e.power} text={e.power ? POWER_LABEL[e.power] : NONE} /></td>
                  </>
                ) : (
                  <td colSpan={6} className="px-3 py-2.5"><NoResponseLabel /></td>
                )}
                <td className="px-3 py-2.5">{e.remarks}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Share buttons, banner, footer, empty state**

`components/report/share-buttons.tsx`:
```tsx
'use client';

import { Link2, Share2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { FacebookIcon } from '@/components/facebook-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { facebookShareUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

const noopSubscribe = () => () => {};

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === 'function', () => false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Copy the link from the address bar instead.');
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The viewer closed the share sheet.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={facebookShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: 'lg' }), 'h-11 bg-[#0866FF] text-white hover:bg-[#0757D9]')}
      >
        <FacebookIcon className="size-5" />
        Share on Facebook
      </a>
      <Button type="button" variant="outline" size="lg" className="h-11 cursor-pointer" onClick={copy}>
        <Link2 aria-hidden /> Copy link
      </Button>
      {canShare && (
        <Button type="button" variant="outline" size="lg" className="h-11 cursor-pointer" onClick={share}>
          <Share2 aria-hidden /> Share…
        </Button>
      )}
    </div>
  );
}
```

`components/report/new-report-banner.tsx`:
```tsx
'use client';

import { Radio } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMilitaryTime } from '@/lib/format';

const BUTTON = 'ml-auto inline-flex min-h-11 cursor-pointer items-center rounded-md bg-primary-foreground px-4 font-bold text-primary';

export function NewReportBanner({ newer, onLatestPage }: { newer: { id: string; report_at: string } | null; onLatestPage: boolean }) {
  const router = useRouter();
  if (!newer) return null;
  return (
    <div role="status" className="sticky top-0 z-30 bg-primary text-primary-foreground shadow">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Radio className="size-5 shrink-0" aria-hidden />
        <p className="font-bold">A new netcall report ({formatMilitaryTime(newer.report_at)}) has started.</p>
        {onLatestPage ? (
          <button type="button" className={BUTTON} onClick={() => router.refresh()}>View</button>
        ) : (
          <Link href="/" className={BUTTON}>View</Link>
        )}
      </div>
    </div>
  );
}
```

`components/report/report-footer.tsx`:
```tsx
import type { Report } from '@/lib/types';

export function ReportFooter({ report }: { report: Report }) {
  return (
    <section aria-label="Remarks and preparer" className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Remarks</h2>
        <p className="mt-1 whitespace-pre-line">{report.remarks || '—'}</p>
      </div>
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prepared by</h2>
        <p className="mt-1 font-bold uppercase">{report.prepared_by_name || '—'}</p>
        <p className="text-sm text-muted-foreground">{report.prepared_by_position}</p>
      </div>
    </section>
  );
}
```

`components/report/no-reports.tsx`:
```tsx
import { Radio } from 'lucide-react';

export function NoReports() {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <Radio className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">No netcall reports yet</h1>
      <p className="mt-2 text-muted-foreground">The first Barangay Weather SitRep will appear here as soon as the radio controller starts it.</p>
    </div>
  );
}
```

- [ ] **Step 6: The live view**

`components/report/live-report-view.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useLiveReport } from '@/hooks/use-live-report';
import { useNewerReport } from '@/hooks/use-newer-report';
import { filterEntries, groupByZone, zoneNames } from '@/lib/filter';
import { formatReportHeading, formatShortHeading } from '@/lib/format';
import { makeOptionLabeler } from '@/lib/labels';
import { summarizeReport } from '@/lib/summary';
import type { ConditionOption, ReportBundle, Settings } from '@/lib/types';
import { BarangayCards } from './barangay-cards';
import { BarangayTable } from './barangay-table';
import { NewReportBanner } from './new-report-banner';
import { ReportBar } from './report-bar';
import { ReportFilters } from './report-filters';
import { ReportFooter } from './report-footer';
import { ReportHeader } from './report-header';
import { ShareButtons } from './share-buttons';
import { SummaryTiles } from './summary-tiles';

const LINK = 'font-bold text-primary underline-offset-4 hover:underline';

export function LiveReportView({ initial, options, settings, isLatest, shareUrl }: {
  initial: ReportBundle;
  options: ConditionOption[];
  settings: Settings;
  isLatest: boolean;
  shareUrl: string;
}) {
  const live = useLiveReport(initial);
  const newer = useNewerReport(live.report.id, live.report.report_at);
  const [zone, setZone] = useState('all');
  const [issuesOnly, setIssuesOnly] = useState(false);

  const summary = useMemo(() => summarizeReport(live.report, live.entries, options), [live.report, live.entries, options]);
  const optionLabel = useMemo(() => makeOptionLabeler(options), [options]);
  const zones = useMemo(() => zoneNames(live.entries), [live.entries]);
  const numbers = useMemo(() => new Map(live.entries.map((e, i) => [e.id, i + 1])), [live.entries]);
  const groups = useMemo(() => groupByZone(filterEntries(live.entries, zone, issuesOnly)), [live.entries, zone, issuesOnly]);

  if (live.deleted) {
    return (
      <>
        <ReportHeader settings={settings} />
        <main id="main" className="mx-auto max-w-xl px-4 py-12 text-center">
          <h1 className="text-xl font-bold">This report was removed</h1>
          <p className="mt-4"><Link href="/" className={LINK}>View the current report</Link></p>
        </main>
      </>
    );
  }

  return (
    <>
      <NewReportBanner newer={newer} onLatestPage={isLatest} />
      <ReportHeader settings={settings} />
      <main id="main" className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <ReportBar
          title={settings.report_title}
          heading={formatReportHeading(live.report.report_at)}
          isLatest={isLatest}
          status={live.status}
          lastUpdated={live.lastUpdated}
        />
        <SummaryTiles summary={summary} />
        <ReportFilters zones={zones} zone={zone} onZoneChange={setZone} issuesOnly={issuesOnly} onIssuesOnlyChange={setIssuesOnly} />
        {groups.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No barangays match this filter.</p>
        ) : (
          <>
            <BarangayCards groups={groups} optionLabel={optionLabel} flashIds={live.flashIds} />
            <BarangayTable groups={groups} optionLabel={optionLabel} flashIds={live.flashIds} numbers={numbers} />
          </>
        )}
        <ReportFooter report={live.report} />
        <section aria-labelledby="share-heading" className="space-y-3">
          <h2 id="share-heading" className="font-bold">Share this report</h2>
          <ShareButtons url={shareUrl} title={`${settings.report_title} – ${formatShortHeading(live.report.report_at)}`} />
        </section>
        <nav aria-label="Reports" className="flex flex-wrap gap-6 border-t pt-4">
          <Link href="/reports" className={LINK}>All reports</Link>
          {!isLatest && <Link href="/" className={LINK}>View latest report</Link>}
          <Link href="/login" className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline">Staff sign in</Link>
        </nav>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Metadata helper and pages**

`lib/report-metadata.ts`:
```ts
import type { Metadata } from 'next';
import { formatShortHeading } from '@/lib/format';
import { lastUpdatedAt } from '@/lib/live/report-state';
import { describeSummary, summarizeReport } from '@/lib/summary';
import type { ConditionOption, ReportBundle } from '@/lib/types';

export function reportMetadata(bundle: ReportBundle, options: ConditionOption[], { canonicalPath }: { canonicalPath: string }): Metadata {
  const summary = summarizeReport(bundle.report, bundle.entries, options);
  const title = `Barangay Weather SitRep – ${formatShortHeading(bundle.report.report_at)}`;
  const description = describeSummary(summary);
  const version = Date.parse(lastUpdatedAt(bundle));
  const image = `/reports/${bundle.report.id}/og?v=${version}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: `${title}. ${description}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
```

`app/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveReportView } from '@/components/report/live-report-view';
import { NoReports } from '@/components/report/no-reports';
import { ReportHeader } from '@/components/report/report-header';
import { getLatestReportMeta, getReferenceData, getReportBundle } from '@/lib/data/public';
import { reportMetadata } from '@/lib/report-metadata';
import { reportUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const latest = await getLatestReportMeta();
  if (!latest) return {};
  const [bundle, { options }] = await Promise.all([getReportBundle(latest.id), getReferenceData()]);
  return bundle ? reportMetadata(bundle, options, { canonicalPath: '/' }) : {};
}

export default async function HomePage() {
  const [latest, reference] = await Promise.all([getLatestReportMeta(), getReferenceData()]);
  if (!latest) {
    return (
      <>
        <ReportHeader settings={reference.settings} />
        <main id="main" className="px-4 py-12"><NoReports /></main>
      </>
    );
  }
  const bundle = await getReportBundle(latest.id);
  if (!bundle) notFound();
  return (
    <LiveReportView
      initial={bundle}
      options={reference.options}
      settings={reference.settings}
      isLatest
      shareUrl={reportUrl(bundle.report.id)}
    />
  );
}
```

`app/reports/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveReportView } from '@/components/report/live-report-view';
import { getLatestReportMeta, getReferenceData, getReportBundle } from '@/lib/data/public';
import { reportMetadata } from '@/lib/report-metadata';
import { reportUrl } from '@/lib/site';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [bundle, { options }] = await Promise.all([getReportBundle(id), getReferenceData()]);
  if (!bundle) return { title: 'Report not found' };
  return reportMetadata(bundle, options, { canonicalPath: `/reports/${id}` });
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const [bundle, reference, latest] = await Promise.all([getReportBundle(id), getReferenceData(), getLatestReportMeta()]);
  if (!bundle) notFound();
  return (
    <LiveReportView
      initial={bundle}
      options={reference.options}
      settings={reference.settings}
      isLatest={latest?.id === id}
      shareUrl={reportUrl(id)}
    />
  );
}
```

`app/not-found.tsx`:
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Report not found</h1>
      <p className="mt-2 text-muted-foreground">This report doesn&apos;t exist or was removed.</p>
      <div className="mt-6 flex justify-center gap-6 font-bold">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">Current report</Link>
        <Link href="/reports" className="text-primary underline-offset-4 hover:underline">All reports</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Build and lint**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: success. The routes `/` and `/reports/[id]` show as `ƒ` (dynamic).

- [ ] **Step 9: Check the rendered HTML**

Run `npm run start` in the background, then:
```bash
curl -s http://localhost:3000/ | grep -o 'Stimson Abordo' | head -1
curl -s http://localhost:3000/ | grep -o '<meta property="og:image"[^>]*>' | head -1
curl -s http://localhost:3000/ | grep -o '15/24 stations active · Light to Moderate rain · Not windy · Roads passable · Rivers normal' | head -1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/reports/00000000-0000-4000-8000-000000000000
```
Expected: `Stimson Abordo`, an `og:image` tag pointing to `/reports/<SAMPLE_REPORT_ID>/og?v=…`, the description line, and `404`.

- [ ] **Step 10: Visual check at phone and desktop widths**

Create `scripts/screenshots.mjs` (it lives in the project so Node can resolve `@playwright/test`; the screenshots go to `$SCRATCH`, this session's scratchpad directory):
```js
import { chromium } from '@playwright/test';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
for (const width of [375, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/home-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(width, overflow ? 'HORIZONTAL OVERFLOW' : 'ok');
  await page.close();
}
await browser.close();
```
Run: `npx playwright install chromium && node scripts/screenshots.mjs http://localhost:3000 $SCRATCH`
Expected: all four widths print `ok`. Open the PNGs (Read tool) and check:
- 375px: cards, with red "No response" cards.
- 768px and up: the table, with zone group rows.
- Summary tiles read "15 / 24", "Light to Moderate rain" and "Not windy".
- The live indicator says "LIVE".
Stop the server.

- [ ] **Step 11: Commit**

```bash
git add components/report lib/report-metadata.ts app/page.tsx app/reports app/not-found.tsx supabase/seed scripts/screenshots.mjs
git commit -m "feat(public): add live public report page with cards, table, filters and sharing"
```

---

### Task 12: Report archive (`/reports`)

**Files:**
- Create: `lib/archive.ts`, `app/reports/page.tsx`
- Test: `tests/unit/archive.test.ts`

**Interfaces:**
- Consumes: `getArchivePage`, `getReferenceData` (Task 10); `StatusBadge`, `ReportHeader` (Task 11); `manilaDayKey`, `formatDayHeading`, `formatMilitaryTime` (Task 5).
- Produces: `groupArchiveByDay<T extends { report: { report_at: string } }>(items: T[]): { day: string; items: T[] }[]`

- [ ] **Step 1: Write the failing test `tests/unit/archive.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { groupArchiveByDay } from '@/lib/archive';

const item = (report_at: string) => ({ report: { report_at } });

describe('groupArchiveByDay', () => {
  it('groups newest-first items by Manila day, including just after midnight', () => {
    const days = groupArchiveByDay([
      item('2026-10-07T06:50:00Z'), // 14:50 Oct 7
      item('2026-10-06T16:05:00Z'), // 00:05 Oct 7
      item('2026-10-06T15:55:00Z'), // 23:55 Oct 6
    ]);
    expect(days.map((d) => [d.day, d.items.length])).toEqual([
      ['2026-10-07', 2],
      ['2026-10-06', 1],
    ]);
  });
  it('returns nothing for no items', () => {
    expect(groupArchiveByDay([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/unit/archive.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/archive.ts`**

```ts
import { manilaDayKey } from './format';

export function groupArchiveByDay<T extends { report: { report_at: string } }>(items: T[]): { day: string; items: T[] }[] {
  const days: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = manilaDayKey(item.report.report_at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}
```
Run: `npx vitest run tests/unit/archive.test.ts`
Expected: PASS.

- [ ] **Step 4: `app/reports/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ReportHeader } from '@/components/report/report-header';
import { StatusBadge } from '@/components/report/status-badge';
import { groupArchiveByDay } from '@/lib/archive';
import { getArchivePage, getReferenceData } from '@/lib/data/public';
import { formatDayHeading, formatMilitaryTime } from '@/lib/format';

export const metadata: Metadata = {
  title: 'All reports',
  description: 'Archive of Barangay Weather SitReps from the Ozamiz City CDRRMO netcall.',
};

const LINK = 'font-bold text-primary underline-offset-4 hover:underline';

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const [{ items, hasMore }, { settings }] = await Promise.all([getArchivePage(page), getReferenceData()]);
  const days = groupArchiveByDay(items);

  return (
    <>
      <ReportHeader settings={settings} />
      <main id="main" className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">All reports</h1>
          <Link href="/" className={LINK}>Current report</Link>
        </div>
        {days.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No reports yet.</p>}
        {days.map((day) => (
          <section key={day.day} aria-labelledby={`day-${day.day}`}>
            <h2 id={`day-${day.day}`} className="mb-3 text-lg font-bold">{formatDayHeading(day.day)}</h2>
            <ul className="space-y-2">
              {day.items.map(({ report, summary }) => (
                <li key={report.id}>
                  <Link
                    href={`/reports/${report.id}`}
                    className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary"
                  >
                    <span className="text-xl font-bold tabular">{formatMilitaryTime(report.report_at)}</span>
                    <span className="tabular">{summary.active}/{summary.total} active</span>
                    {summary.noResponse > 0 && <StatusBadge tone="danger" label={`${summary.noResponse} no response`} />}
                    <span className="text-muted-foreground">{summary.weather}</span>
                    {summary.hasIssues && <StatusBadge tone="warn" label="Has issues" />}
                    <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <nav aria-label="Pagination" className="flex justify-between">
          {page > 1 ? <Link href={`/reports?page=${page - 1}`} className={LINK}>← Newer</Link> : <span />}
          {hasMore && <Link href={`/reports?page=${page + 1}`} className={LINK}>Older →</Link>}
        </nav>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Build and check**

Run: `npm run build`, then `npm run start` (background) and `curl -s http://localhost:3000/reports | grep -o 'Wednesday, October 7, 2026' | head -1`.
Expected: `Wednesday, October 7, 2026`. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add lib/archive.ts tests/unit/archive.test.ts app/reports/page.tsx
git commit -m "feat(public): add report archive grouped by Manila day"
```

---

### Task 13: Facebook preview image (`/reports/[id]/og`)

**Files:**
- Create: `app/reports/[id]/og/route.tsx`

**Interfaces:**
- Consumes: `getReportBundle`, `getReferenceData` (Task 10); `summarizeReport` (Task 6); `summaryTone` (Task 6); `formatReportHeading` (Task 5); fonts (Task 1).
- Produces: `GET /reports/{id}/og`, which returns a 1200×630 PNG, or 404.

- [ ] **Step 1: Confirm the route is missing**

Run `npm run start` (background) and `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/reports/<SAMPLE_REPORT_ID>/og`.
Expected: `404`. Stop the server.

- [ ] **Step 2: Write `app/reports/[id]/og/route.tsx`**

```tsx
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getReferenceData, getReportBundle } from '@/lib/data/public';
import { formatReportHeading } from '@/lib/format';
import { summaryTone, type Tone } from '@/lib/labels';
import { summarizeReport } from '@/lib/summary';

const TONE_COLORS: Record<Tone, [string, string]> = {
  ok: ['#dcfce7', '#15803d'],
  warn: ['#fef3c7', '#b45309'],
  danger: ['#fee2e2', '#b91c1c'],
  none: ['#e2e8f0', '#475569'],
};

function Pill({ label, value }: { label: string; value: string }) {
  const [bg, fg] = TONE_COLORS[summaryTone(value)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 22px', borderRadius: 18, background: bg, color: fg }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, { options, settings }] = await Promise.all([getReportBundle(id), getReferenceData()]);
  if (!bundle) return new Response('Not found', { status: 404 });

  const summary = summarizeReport(bundle.report, bundle.entries, options);
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/AtkinsonHyperlegible-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/AtkinsonHyperlegible-Bold.ttf')),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#020617', fontFamily: 'Atkinson' }}>
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#ffffff', padding: '28px 48px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>CDRRMO · CITY OF OZAMIZ</div>
          <div style={{ fontSize: 46, fontWeight: 700 }}>{settings.report_title}</div>
          <div style={{ fontSize: 30 }}>{formatReportHeading(bundle.report.report_at)}</div>
        </div>
        <div style={{ display: 'flex', flex: 1, padding: '32px 48px', gap: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 330 }}>
            <div style={{ fontSize: 116, fontWeight: 700, lineHeight: 1 }}>{`${summary.active}/${summary.total}`}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#475569' }}>STATIONS ACTIVE</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#b91c1c', marginTop: 8 }}>{`${summary.noResponse} no response`}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 44, fontWeight: 700 }}>{summary.weather}</div>
              <div style={{ fontSize: 32, color: '#475569' }}>{summary.wind}</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Pill label="Roads" value={summary.roads} />
              <Pill label="Rivers" value={summary.rivers} />
              <Pill label="Coastal" value={summary.coastal} />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Atkinson', data: regular, weight: 400, style: 'normal' },
        { name: 'Atkinson', data: bold, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    },
  );
}
```

- [ ] **Step 3: Verify the image**

Run `npm run build && npm run start` (background), then:
```bash
curl -s -o $SCRATCH/og.png -w "%{http_code} %{content_type}\n" http://localhost:3000/reports/<SAMPLE_REPORT_ID>/og
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/reports/00000000-0000-4000-8000-000000000000/og
```
Expected: `200 image/png`, then `404`. Open `$SCRATCH/og.png` with Read and check:
- The text is legible and nothing overflows.
- It shows "15/24", "Light to Moderate rain", "Not windy" and three green pills.
Stop the server.

- [ ] **Step 4: Commit**

```bash
git add "app/reports/[id]/og/route.tsx"
git commit -m "feat(public): generate per-report Facebook preview image"
```

---

### Task 14: Admin shell, report list and "New netcall report"

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/admin-nav.tsx`, `app/admin/auth-actions.ts`, `app/admin/page.tsx`, `app/admin/reports/page.tsx`, `app/admin/reports/new-report-dialog.tsx`, `app/admin/reports/actions.ts`

**Interfaces:**
- Consumes: `requireStaff`, `getCurrentStaff` (Task 9); `listRecentReports` (Task 10); `newReportSchema` (Task 8); `fromManilaInputValue`, `toManilaInputValue`, `formatShortHeading` (Task 5); `FormField` (Task 1).
- Produces:
  - `createReport(prev: ActionResult | null, formData: FormData): Promise<ActionResult>`, which redirects to `/admin/reports/{id}` on success
  - `signOut(): Promise<void>`
  - The admin layout, which every `/admin/**` page renders inside.

- [ ] **Step 1: `app/admin/auth-actions.ts` and `app/admin/page.tsx`**

```ts
// app/admin/auth-actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

```tsx
// app/admin/page.tsx
import { redirect } from 'next/navigation';

export default function AdminIndex() {
  redirect('/admin/reports');
}
```

- [ ] **Step 2: `app/admin/admin-nav.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin/reports', label: 'Reports', superOnly: false },
  { href: '/admin/barangays', label: 'Barangays', superOnly: true },
  { href: '/admin/options', label: 'Options', superOnly: true },
  { href: '/admin/settings', label: 'Settings', superOnly: true },
  { href: '/admin/users', label: 'Users', superOnly: true },
];

export function AdminNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {ITEMS.filter((item) => isSuperAdmin || !item.superOnly).map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn('inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold transition-colors', active ? 'bg-white/15' : 'hover:bg-white/10')}
          >
            {item.label}
          </Link>
        );
      })}
      <Link href="/" target="_blank" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold hover:bg-white/10">
        Public site ↗
      </Link>
    </nav>
  );
}
```

- [ ] **Step 3: `app/admin/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { LogOut, Radio } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { AdminNav } from './admin-nav';
import { signOut } from './auth-actions';

export const metadata: Metadata = { title: 'Staff', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/admin/reports" className="flex min-h-11 items-center gap-2 font-bold">
            <Radio className="size-5" aria-hidden /> CDRRMO SitRep
          </Link>
          <AdminNav isSuperAdmin={staff.role === 'super_admin'} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{staff.full_name || staff.email}</span>
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 font-bold hover:bg-white/10">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: `app/admin/reports/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { fail, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { fromManilaInputValue } from '@/lib/format';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { newReportSchema } from '@/lib/validation';

export async function createReport(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) return fail('Your session has expired. Sign in again.');
  const parsed = newReportSchema.safeParse({
    report_at_local: formData.get('report_at_local'),
    prepared_by_name: formData.get('prepared_by_name'),
    prepared_by_position: formData.get('prepared_by_position') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');

  const { data, error } = await cdrrmo(await createClient()).rpc('create_report', {
    p_report_at: fromManilaInputValue(parsed.data.report_at_local),
    p_prepared_by_name: parsed.data.prepared_by_name,
    p_prepared_by_position: parsed.data.prepared_by_position,
  });
  if (error) return fail(`Could not create the report: ${error.message}`, true);
  redirect(`/admin/reports/${data as string}`);
}
```

- [ ] **Step 5: `app/admin/reports/new-report-dialog.tsx`**

```tsx
'use client';

import { Plus } from 'lucide-react';
import { useActionState, useState } from 'react';
import { FormField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import { toManilaInputValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createReport } from './actions';

function NewReportForm({ defaultName, defaultPosition }: { defaultName: string; defaultPosition: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createReport, null);
  const [defaultTime] = useState(() => toManilaInputValue(new Date().toISOString()));
  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Netcall date and time (Philippine time)" htmlFor="report_at_local">
        <Input id="report_at_local" name="report_at_local" type="datetime-local" defaultValue={defaultTime} required className="h-11" />
      </FormField>
      <FormField label="Prepared by" htmlFor="prepared_by_name">
        <Input id="prepared_by_name" name="prepared_by_name" defaultValue={defaultName} required className="h-11" />
      </FormField>
      <FormField label="Position" htmlFor="prepared_by_position">
        <Input id="prepared_by_position" name="prepared_by_position" defaultValue={defaultPosition} className="h-11" />
      </FormField>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Starting…' : 'Start report'}</Button>
      </DialogFooter>
    </form>
  );
}

export function NewReportDialog({ defaultName, defaultPosition }: { defaultName: string; defaultPosition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
        <Plus aria-hidden /> New netcall report
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New netcall report</DialogTitle>
          <DialogDescription>
            It goes live on the public site immediately, with every barangay set to &ldquo;No response&rdquo;.
          </DialogDescription>
        </DialogHeader>
        {open && <NewReportForm defaultName={defaultName} defaultPosition={defaultPosition} />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: `app/admin/reports/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { listRecentReports } from '@/lib/data/admin';
import { formatShortHeading } from '@/lib/format';
import { NewReportDialog } from './new-report-dialog';

export const metadata: Metadata = { title: 'Reports' };

export default async function AdminReportsPage() {
  const staff = await requireStaff();
  const reports = await listRecentReports();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Netcall reports</h1>
        <NewReportDialog defaultName={staff.full_name} defaultPosition={staff.position} />
      </div>
      {reports.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No reports yet. Start the first netcall report.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {reports.map(({ report, active, total }) => (
            <li key={report.id}>
              <Link href={`/admin/reports/${report.id}`} className="flex min-h-14 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
                <span className="font-bold tabular">{formatShortHeading(report.report_at)}</span>
                <span className="tabular text-muted-foreground">{active}/{total} responded</span>
                <span className="hidden text-muted-foreground sm:inline">{report.prepared_by_name}</span>
                <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Build, then check sign-in with the owner**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: success.
Run `npm run dev` (background). Ask the owner: "Open http://localhost:3000/login, sign in with berlcamp@gmail.com, and tell me what you see." Expected: they land on `/admin/reports`, which lists the 2026-10-07 1050H report (15/24 responded) and shows all five admin nav items.
Then confirm the link via MCP:
```sql
select email, auth_user_id is not null as linked, last_sign_in_at from cdrrmo.users;
```
Expected: berlcamp@gmail.com has `linked = true`. Keep the dev server running for Task 15.

- [ ] **Step 8: Commit**

```bash
git add app/admin
git commit -m "feat(admin): add staff shell, report list and new netcall report"
```

---
### Task 15: Live encoding screen (`/admin/reports/[id]`)

**Files:**
- Create:
  - `lib/actions/report-actions.ts`
  - `hooks/use-entry-saver.ts`, `hooks/use-report-saver.ts`
  - Under `components/encoder/`: `encoder-view.tsx`, `summary-strip.tsx`, `roll-call-list.tsx`, `entry-editor.tsx`, `choice-group.tsx`, `blur-input.tsx`, `save-text.tsx`, `report-details.tsx`, `report-remarks.tsx`, `missing-barangays-button.tsx`, `share-panel.tsx`, `delete-report-dialog.tsx`
  - `app/admin/reports/[id]/page.tsx`

**Interfaces:**
- Consumes: `useLiveReport` (Task 10); the patch helpers, `backoffDelay` and schemas (Task 8); `summarizeReport` (Task 6); report components (Task 11); `fetchReportBundle`, `getReferenceData` (Task 10); `requireStaff`, `getCurrentStaff` (Task 9).
- Produces:
  - Server actions:
    - `updateEntry(entryId, patch): Promise<ActionResult<ReportEntry>>`
    - `updateReport(reportId, patch): Promise<ActionResult<Report>>`
    - `addMissingBarangays(reportId): Promise<ActionResult<number>>`
    - `deleteReport(reportId, confirmation): Promise<ActionResult>`
  - Hooks:
    - `useEntrySaver(save, onSaved)` returns `{ pending, states, update, retry, discard, hasUnsaved }`
    - `useReportSaver(reportId, onSaved)` returns `{ save, status }`

- [ ] **Step 1: `lib/actions/report-actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { formatMilitaryTime } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { Report, ReportEntry } from '@/lib/types';
import { entryPatchSchema, reportPatchSchema, type EntryPatch, type ReportPatch } from '@/lib/validation';

const SESSION_EXPIRED = 'Your session has expired. Sign in again in a new tab, then press Retry.';

export async function updateEntry(entryId: string, patch: EntryPatch): Promise<ActionResult<ReportEntry>> {
  const staff = await getCurrentStaff();
  if (!staff) return fail(SESSION_EXPIRED);
  if (!isUuid(entryId)) return fail('Unknown barangay row.');
  const parsed = entryPatchSchema.safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid value.');

  const { data, error } = await cdrrmo(await createClient())
    .from('report_entries')
    .update({ ...parsed.data, updated_by: staff.id })
    .eq('id', entryId)
    .select('*')
    .maybeSingle();
  if (error) return fail(`Could not save: ${error.message}`, true);
  if (!data) return fail('This barangay row no longer exists.');
  return ok(data as ReportEntry);
}

export async function updateReport(reportId: string, patch: ReportPatch): Promise<ActionResult<Report>> {
  const staff = await getCurrentStaff();
  if (!staff) return fail(SESSION_EXPIRED);
  if (!isUuid(reportId)) return fail('Unknown report.');
  const parsed = reportPatchSchema.safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid value.');

  const { data, error } = await cdrrmo(await createClient())
    .from('reports')
    .update({ ...parsed.data, updated_by: staff.id })
    .eq('id', reportId)
    .select('*')
    .maybeSingle();
  if (error) return fail(`Could not save: ${error.message}`, true);
  if (!data) return fail('This report no longer exists.');
  return ok(data as Report);
}

export async function addMissingBarangays(reportId: string): Promise<ActionResult<number>> {
  if (!(await getCurrentStaff())) return fail(SESSION_EXPIRED);
  if (!isUuid(reportId)) return fail('Unknown report.');
  const { data, error } = await cdrrmo(await createClient()).rpc('add_missing_barangays', { p_report_id: reportId });
  if (error) return fail(`Could not add barangays: ${error.message}`, true);
  return ok(data as number);
}

export async function deleteReport(reportId: string, confirmation: string): Promise<ActionResult> {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== 'super_admin') return fail('Only the super admin can delete reports.');
  if (!isUuid(reportId)) return fail('Unknown report.');
  const db = cdrrmo(await createClient());
  const { data: report } = await db.from('reports').select('report_at').eq('id', reportId).maybeSingle();
  if (!report) return fail('Report not found.');
  const expected = formatMilitaryTime((report as { report_at: string }).report_at);
  if (confirmation.trim().toUpperCase() !== expected) return fail(`Type ${expected} to confirm.`);
  const { error } = await db.from('reports').delete().eq('id', reportId);
  if (error) return fail(`Could not delete: ${error.message}`, true);
  redirect('/admin/reports');
}
```

- [ ] **Step 2: `hooks/use-entry-saver.ts`** (optimistic per-row queue: saves one request at a time per row, merges rapid edits, retries with backoff)

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionResult } from '@/lib/action-result';
import { backoffDelay } from '@/lib/backoff';
import { mergePatch, omitKey } from '@/lib/encoder-patches';
import type { ReportEntry } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';

export interface SaveState {
  state: 'saving' | 'saved' | 'failed';
  message?: string;
}

type SaveFn = (id: string, patch: EntryPatch) => Promise<ActionResult<ReportEntry>>;

export function useEntrySaver(save: SaveFn, onSaved: (entry: ReportEntry) => void) {
  const [pending, setPending] = useState<Record<string, EntryPatch>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const queued = useRef(new Map<string, EntryPatch>());
  const inFlight = useRef(new Set<string>());
  const attempts = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flush = useCallback(
    async function run(id: string): Promise<void> {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      if (inFlight.current.has(id)) return;
      const patch = queued.current.get(id);
      if (!patch) return;
      queued.current.delete(id);
      inFlight.current.add(id);
      setStates((s) => ({ ...s, [id]: { state: 'saving' } }));

      let result: ActionResult<ReportEntry>;
      try {
        result = await save(id, patch);
      } catch {
        result = { ok: false, message: 'No connection. Retrying…', retryable: true };
      }
      inFlight.current.delete(id);

      if (result.ok) {
        attempts.current.delete(id);
        onSaved(result.data);
        if (queued.current.has(id)) {
          void run(id);
          return;
        }
        setPending((p) => omitKey(p, id));
        setStates((s) => ({ ...s, [id]: { state: 'saved' } }));
        return;
      }

      const message = result.message;
      queued.current.set(id, mergePatch(patch, queued.current.get(id) ?? {}));
      setStates((s) => ({ ...s, [id]: { state: 'failed', message } }));
      if (result.retryable) {
        const attempt = attempts.current.get(id) ?? 0;
        attempts.current.set(id, attempt + 1);
        timers.current.set(id, setTimeout(() => void run(id), backoffDelay(attempt)));
      }
    },
    [save, onSaved],
  );

  const update = useCallback(
    (id: string, patch: EntryPatch) => {
      queued.current.set(id, mergePatch(queued.current.get(id), patch));
      setPending((p) => ({ ...p, [id]: mergePatch(p[id], patch) }));
      attempts.current.delete(id);
      void flush(id);
    },
    [flush],
  );

  const retry = useCallback(
    (id: string) => {
      attempts.current.delete(id);
      void flush(id);
    },
    [flush],
  );

  const discard = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    queued.current.delete(id);
    setPending((p) => omitKey(p, id));
    setStates((s) => omitKey(s, id));
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  return { pending, states, update, retry, discard, hasUnsaved: Object.keys(pending).length > 0 };
}
```

- [ ] **Step 3: `hooks/use-report-saver.ts`, `components/encoder/save-text.tsx`, `components/encoder/blur-input.tsx`**

```ts
// hooks/use-report-saver.ts
'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { updateReport } from '@/lib/actions/report-actions';
import { fail, type ActionResult } from '@/lib/action-result';
import type { Report } from '@/lib/types';
import type { ReportPatch } from '@/lib/validation';

export type ReportSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useReportSaver(reportId: string, onSaved: (report: Report) => void) {
  const [status, setStatus] = useState<ReportSaveStatus>('idle');
  const save = useCallback(
    async (patch: ReportPatch) => {
      setStatus('saving');
      let result: ActionResult<Report>;
      try {
        result = await updateReport(reportId, patch);
      } catch {
        result = fail('No connection. Your change was not saved — try again.', true);
      }
      if (result.ok) {
        onSaved(result.data);
        setStatus('saved');
      } else {
        setStatus('error');
        toast.error(result.message);
      }
    },
    [reportId, onSaved],
  );
  return { save, status };
}
```

```tsx
// components/encoder/save-text.tsx
import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReportSaveStatus } from '@/hooks/use-report-saver';

export function SaveText({ status }: { status: ReportSaveStatus }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden />Saving…</span>;
  if (status === 'saved') return <span className="flex items-center gap-1 text-sm text-ok"><Check className="size-4" aria-hidden />Saved</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-sm font-bold text-danger"><CircleAlert className="size-4" aria-hidden />Not saved</span>;
  return null;
}
```

```tsx
// components/encoder/blur-input.tsx
'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Common = { value: string | null; onCommit: (value: string) => void };

/** Local draft while typing; commits on blur; adopts new server values (e.g. another encoder's edit). */
function useDraft(value: string | null) {
  const [draft, setDraft] = useState(value ?? '');
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value ?? '');
  }
  return [draft, setDraft] as const;
}

export function BlurInput({ value, onCommit, className, ...props }: Common & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useDraft(value);
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? '')) onCommit(draft);
      }}
      className={cn('h-11', className)}
    />
  );
}

export function BlurTextarea({ value, onCommit, ...props }: Common & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useDraft(value);
  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? '')) onCommit(draft);
      }}
    />
  );
}
```

- [ ] **Step 4: `components/encoder/choice-group.tsx` and `components/encoder/entry-editor.tsx`**

```tsx
// components/encoder/choice-group.tsx
'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

type ChoiceTone = 'neutral' | 'ok' | 'warn' | 'danger';

const SELECTED: Record<ChoiceTone, string> = {
  neutral: 'border-primary bg-primary text-primary-foreground',
  ok: 'border-ok bg-ok text-on-status',
  warn: 'border-warn bg-warn text-on-status',
  danger: 'border-danger bg-danger text-on-status',
};

export function ChoiceGroup<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T | null;
  options: { value: T; label: string; tone?: ChoiceTone }[];
  onChange: (value: T | null) => void;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="mb-2 text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : option.value)}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border px-4 text-sm font-bold transition-colors duration-150',
                selected ? SELECTED[option.tone ?? 'neutral'] : 'bg-card hover:bg-accent',
              )}
            >
              {selected && <Check className="size-4" aria-hidden />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

```tsx
// components/encoder/entry-editor.tsx
'use client';

import { ArrowRight, CircleCheck, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaveState } from '@/hooks/use-entry-saver';
import { allNormalPatch, conditionPatch, noResponsePatch, remarksPatch } from '@/lib/encoder-patches';
import type { ConditionOption, Level, Power, ReportEntry, Road } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';
import { BlurInput } from './blur-input';
import { ChoiceGroup } from './choice-group';

const ROAD = [
  { value: 'passable' as Road, label: 'Passable', tone: 'ok' as const },
  { value: 'unpassable' as Road, label: 'Unpassable', tone: 'danger' as const },
];
const LEVEL = [
  { value: 'normal' as Level, label: 'Normal', tone: 'ok' as const },
  { value: 'above_normal' as Level, label: 'Above normal', tone: 'warn' as const },
];
const POWER = [
  { value: 'with_power' as Power, label: 'With power', tone: 'ok' as const },
  { value: 'no_power' as Power, label: 'No power', tone: 'danger' as const },
];

export function EntryEditor({ entry, weatherOptions, windOptions, saveState, onPatch, onRetry, onDiscard, onNext }: {
  entry: ReportEntry;
  weatherOptions: ConditionOption[];
  windOptions: ConditionOption[];
  saveState?: SaveState;
  onPatch: (id: string, patch: EntryPatch) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onNext: (id: string) => void;
}) {
  const patch = (p: EntryPatch) => onPatch(entry.id, p);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => patch(allNormalPatch(entry))} className="h-11 cursor-pointer bg-ok text-on-status hover:bg-ok/90">
          <CircleCheck aria-hidden /> Responded – all normal
        </Button>
        <Button type="button" variant="outline" onClick={() => patch(noResponsePatch())} className="h-11 cursor-pointer border-danger text-danger hover:bg-danger-soft">
          <CircleX aria-hidden /> No response
        </Button>
      </div>
      <ChoiceGroup
        label="Weather"
        value={entry.weather_option_id}
        options={weatherOptions.map((o) => ({ value: o.id, label: o.label }))}
        onChange={(v) => patch(conditionPatch('weather_option_id', v))}
      />
      <ChoiceGroup
        label="Wind"
        value={entry.wind_option_id}
        options={windOptions.map((o) => ({ value: o.id, label: o.label }))}
        onChange={(v) => patch(conditionPatch('wind_option_id', v))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <ChoiceGroup label="Road" value={entry.road} options={ROAD} onChange={(v) => patch(conditionPatch('road', v))} />
        <ChoiceGroup label="River / canal" value={entry.river} options={LEVEL} onChange={(v) => patch(conditionPatch('river', v))} />
        {entry.monitors_coastal && (
          <ChoiceGroup label="Coastal" value={entry.coastal} options={LEVEL} onChange={(v) => patch(conditionPatch('coastal', v))} />
        )}
        <ChoiceGroup label="Power" value={entry.power} options={POWER} onChange={(v) => patch(conditionPatch('power', v))} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`remarks-${entry.id}`} className="text-sm font-bold">Remarks</label>
        <BlurInput id={`remarks-${entry.id}`} value={entry.remarks} onCommit={(text) => patch(remarksPatch(text))} placeholder="Optional" />
      </div>
      {saveState?.state === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger">
          <span className="font-bold">Not saved:</span> {saveState.message}
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => onRetry(entry.id)}>Retry now</Button>
          <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={() => onDiscard(entry.id)}>Discard change</Button>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={() => onNext(entry.id)} className="h-11 cursor-pointer">
          Next barangay <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `components/encoder/roll-call-list.tsx` and `components/encoder/summary-strip.tsx`**

```tsx
// components/encoder/roll-call-list.tsx
'use client';

import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { StatusBadge } from '@/components/report/status-badge';
import type { SaveState } from '@/hooks/use-entry-saver';
import { groupByZone } from '@/lib/filter';
import type { ConditionOption, ReportEntry } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { EntryEditor } from './entry-editor';

function RowSaveStatus({ state }: { state?: SaveState }) {
  if (!state) return null;
  if (state.state === 'saving') return <span className="flex items-center gap-1 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden />Saving</span>;
  if (state.state === 'saved') return <span className="flex items-center gap-1 text-xs text-ok"><Check className="size-4" aria-hidden />Saved</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-danger"><CircleAlert className="size-4" aria-hidden />Not saved</span>;
}

function EntrySummaryLine({ entry, optionLabel }: { entry: ReportEntry; optionLabel: (id: string | null) => string }) {
  if (!entry.responded) return <span className="text-sm font-bold text-danger">No response</span>;
  const issues = [
    entry.road === 'unpassable' && 'Unpassable',
    entry.river === 'above_normal' && 'River above normal',
    entry.monitors_coastal && entry.coastal === 'above_normal' && 'Coast above normal',
    entry.power === 'no_power' && 'No power',
  ].filter((issue): issue is string => Boolean(issue));
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span>{optionLabel(entry.weather_option_id)} · {optionLabel(entry.wind_option_id)}</span>
      {issues.map((issue) => <StatusBadge key={issue} tone="danger" label={issue} />)}
    </span>
  );
}

export function RollCallList({ entries, openId, onToggle, states, optionLabel, flashIds, weatherOptions, windOptions, onPatch, onRetry, onDiscard, onNext }: {
  entries: ReportEntry[];
  openId: string | null;
  onToggle: (id: string) => void;
  states: Record<string, SaveState>;
  optionLabel: (id: string | null) => string;
  flashIds: ReadonlySet<string>;
  weatherOptions: ConditionOption[];
  windOptions: ConditionOption[];
  onPatch: (id: string, patch: EntryPatch) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onNext: (id: string) => void;
}) {
  useEffect(() => {
    if (!openId) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`row-${openId}`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [openId]);

  return (
    <div className="space-y-6">
      {groupByZone(entries).map((group) => (
        <section key={group.zone} aria-label={`${group.zone} barangays`}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{group.zone}</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {group.entries.map((entry) => {
              const open = entry.id === openId;
              return (
                <li key={entry.id} id={`row-${entry.id}`} className={cn('scroll-mt-20', flashIds.has(entry.id) && 'motion-safe:animate-flash')}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`editor-${entry.id}`}
                    onClick={() => onToggle(entry.id)}
                    className={cn('flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent', !entry.responded && 'bg-danger-soft/50')}
                  >
                    <span className="w-24 shrink-0 text-lg font-bold sm:w-32">{entry.callsign}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{entry.barangay_name}</span>
                      <EntrySummaryLine entry={entry} optionLabel={optionLabel} />
                    </span>
                    <RowSaveStatus state={states[entry.id]} />
                    <ChevronDown className={cn('size-5 shrink-0 transition-transform duration-150', open && 'rotate-180')} aria-hidden />
                  </button>
                  {open && (
                    <div id={`editor-${entry.id}`} className="border-t bg-background px-4 py-4">
                      <EntryEditor
                        entry={entry}
                        weatherOptions={weatherOptions}
                        windOptions={windOptions}
                        saveState={states[entry.id]}
                        onPatch={onPatch}
                        onRetry={onRetry}
                        onDiscard={onDiscard}
                        onNext={onNext}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

```tsx
// components/encoder/summary-strip.tsx
import { StatusBadge } from '@/components/report/status-badge';
import { summaryTone } from '@/lib/labels';
import type { ReportSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SummaryStrip({ summary }: { summary: ReportSummary }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <ul aria-label="Live summary" className="flex flex-wrap gap-2 text-sm font-bold">
        <li className="rounded-full bg-ok-soft px-3 py-1 tabular text-ok">{summary.active}/{summary.total} active</li>
        <li className={cn('rounded-full px-3 py-1 tabular', summary.noResponse > 0 ? 'bg-danger-soft text-danger' : 'bg-muted')}>
          {summary.noResponse} no response
        </li>
        <li className="rounded-full bg-muted px-3 py-1">{summary.weather}</li>
        <li className="rounded-full bg-muted px-3 py-1">{summary.wind}</li>
        <li><StatusBadge tone={summaryTone(summary.roads)} label={`Roads: ${summary.roads}`} /></li>
        <li><StatusBadge tone={summaryTone(summary.rivers)} label={`Rivers: ${summary.rivers}`} /></li>
        <li><StatusBadge tone={summaryTone(summary.coastal)} label={`Coastal: ${summary.coastal}`} /></li>
        <li><StatusBadge tone={summaryTone(summary.power)} label={`Power: ${summary.power}`} /></li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Report details, remarks, share, missing barangays and delete**

```tsx
// components/encoder/report-details.tsx
'use client';

import { FormField } from '@/components/form-field';
import { useReportSaver } from '@/hooks/use-report-saver';
import { formatReportHeading, fromManilaInputValue, toManilaInputValue } from '@/lib/format';
import type { Report } from '@/lib/types';
import { BlurInput } from './blur-input';
import { SaveText } from './save-text';

export function ReportDetails({ report, onSaved }: { report: Report; onSaved: (report: Report) => void }) {
  const { save, status } = useReportSaver(report.id, onSaved);
  return (
    <section aria-labelledby="details-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="details-heading" className="text-xl font-bold tabular">{formatReportHeading(report.report_at)}</h1>
        <SaveText status={status} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Netcall date and time" htmlFor="report_at">
          <BlurInput
            id="report_at"
            type="datetime-local"
            value={toManilaInputValue(report.report_at)}
            onCommit={(value) => {
              if (value) void save({ report_at: fromManilaInputValue(value) });
            }}
          />
        </FormField>
        <FormField label="Prepared by" htmlFor="prepared_by_name">
          <BlurInput id="prepared_by_name" value={report.prepared_by_name} onCommit={(v) => void save({ prepared_by_name: v })} />
        </FormField>
        <FormField label="Position" htmlFor="prepared_by_position">
          <BlurInput id="prepared_by_position" value={report.prepared_by_position} onCommit={(v) => void save({ prepared_by_position: v })} />
        </FormField>
      </div>
    </section>
  );
}
```

```tsx
// components/encoder/report-remarks.tsx
'use client';

import { FormField } from '@/components/form-field';
import { useReportSaver } from '@/hooks/use-report-saver';
import type { Report, ReportSummary } from '@/lib/types';
import type { ReportPatch } from '@/lib/validation';
import { BlurInput, BlurTextarea } from './blur-input';
import { SaveText } from './save-text';

type OverrideField = 'weather_summary_override' | 'wind_summary_override' | 'rivers_summary_override' | 'roads_summary_override' | 'coastal_summary_override';

export function ReportRemarks({ report, computed, onSaved }: { report: Report; computed: ReportSummary; onSaved: (report: Report) => void }) {
  const { save, status } = useReportSaver(report.id, onSaved);
  const overrides: [OverrideField, string, string][] = [
    ['weather_summary_override', 'Average weather', computed.weather],
    ['wind_summary_override', 'Average wind', computed.wind],
    ['rivers_summary_override', 'Rivers / canals', computed.rivers],
    ['roads_summary_override', 'Roads / bridges', computed.roads],
    ['coastal_summary_override', 'Coastal', computed.coastal],
  ];
  return (
    <section aria-labelledby="remarks-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="remarks-heading" className="text-lg font-bold">Remarks and summary</h2>
        <SaveText status={status} />
      </div>
      <FormField label="General remarks" htmlFor="remarks" hint="Shown under the barangay list on the public page.">
        <BlurTextarea id="remarks" rows={3} value={report.remarks} onCommit={(v) => void save({ remarks: v })} />
      </FormField>
      <details className="rounded-lg border p-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">Override summary values (optional)</summary>
        <p className="mb-3 text-sm text-muted-foreground">Leave a field blank to use the computed value shown in grey.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {overrides.map(([field, label, placeholder]) => (
            <FormField key={field} label={label} htmlFor={field}>
              <BlurInput
                id={field}
                value={report[field]}
                placeholder={placeholder}
                onCommit={(v) => void save({ [field]: v.trim() === '' ? null : v } as ReportPatch)}
              />
            </FormField>
          ))}
        </div>
      </details>
    </section>
  );
}
```

```tsx
// components/encoder/share-panel.tsx
'use client';

import { ShareButtons } from '@/components/report/share-buttons';
import { Input } from '@/components/ui/input';
import { facebookDebuggerUrl } from '@/lib/site';

export function SharePanel({ url, title }: { url: string; title: string }) {
  return (
    <section aria-labelledby="share-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id="share-heading" className="text-lg font-bold">Share</h2>
      <Input readOnly value={url} aria-label="Public link" className="h-11" onFocus={(e) => e.currentTarget.select()} />
      <ShareButtons url={url} title={title} />
      <p className="text-sm text-muted-foreground">
        Facebook showing an old preview?{' '}
        <a href={facebookDebuggerUrl(url)} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline-offset-4 hover:underline">
          Open the Sharing Debugger
        </a>{' '}
        and press &ldquo;Scrape Again&rdquo;.
      </p>
    </section>
  );
}
```

```tsx
// components/encoder/missing-barangays-button.tsx
'use client';

import { ListPlus } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { addMissingBarangays } from '@/lib/actions/report-actions';

export function MissingBarangaysButton({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className="h-11 cursor-pointer"
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await addMissingBarangays(reportId);
            if (!result.ok) toast.error(result.message);
            else toast.success(result.data === 0 ? 'All active barangays are already in this report.' : `${result.data} barangay(s) added.`);
          } catch {
            toast.error('No connection. Try again.');
          }
        })
      }
    >
      <ListPlus aria-hidden /> Add missing barangays
    </Button>
  );
}
```

```tsx
// components/encoder/delete-report-dialog.tsx
'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { FormField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { deleteReport } from '@/lib/actions/report-actions';
import { formatMilitaryTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function DeleteReportDialog({ reportId, reportAt }: { reportId: string; reportAt: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const expected = formatMilitaryTime(reportAt);

  return (
    <section aria-labelledby="danger-heading" className="rounded-xl border border-danger/40 p-4">
      <h2 id="danger-heading" className="font-bold text-danger">Danger zone</h2>
      <p className="mb-3 text-sm text-muted-foreground">Deleting removes this report from the public site permanently.</p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setText('');
          setError(null);
        }}
      >
        <DialogTrigger className={cn(buttonVariants({ variant: 'destructive' }), 'h-11 cursor-pointer')}>
          <Trash2 aria-hidden /> Delete report
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
            <DialogDescription>Type <strong>{expected}</strong> to confirm. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <FormField label="Report time" htmlFor="confirm-delete" error={error ?? undefined}>
            <Input id="confirm-delete" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" className="h-11" />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              className="h-11 cursor-pointer"
              disabled={pending || text.trim().toUpperCase() !== expected}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteReport(reportId, text);
                  if (result && !result.ok) setError(result.message);
                })
              }
            >
              {pending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 7: `components/encoder/encoder-view.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LiveIndicator } from '@/components/report/live-indicator';
import { useEntrySaver } from '@/hooks/use-entry-saver';
import { useLiveReport } from '@/hooks/use-live-report';
import { updateEntry } from '@/lib/actions/report-actions';
import { applyPatch } from '@/lib/encoder-patches';
import { formatShortHeading } from '@/lib/format';
import { makeOptionLabeler } from '@/lib/labels';
import { summarizeReport, type SummaryOverrides } from '@/lib/summary';
import type { ConditionOption, ReportBundle } from '@/lib/types';
import { DeleteReportDialog } from './delete-report-dialog';
import { MissingBarangaysButton } from './missing-barangays-button';
import { ReportDetails } from './report-details';
import { ReportRemarks } from './report-remarks';
import { RollCallList } from './roll-call-list';
import { SharePanel } from './share-panel';
import { SummaryStrip } from './summary-strip';

const NO_OVERRIDES: SummaryOverrides = {
  weather_summary_override: null,
  wind_summary_override: null,
  rivers_summary_override: null,
  roads_summary_override: null,
  coastal_summary_override: null,
};

export function EncoderView({ initial, options, isSuperAdmin, shareUrl }: {
  initial: ReportBundle;
  options: ConditionOption[];
  isSuperAdmin: boolean;
  shareUrl: string;
}) {
  const live = useLiveReport(initial);
  const saver = useEntrySaver(updateEntry, live.applyEntry);
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(() => live.entries.map((e) => applyPatch(e, saver.pending[e.id])), [live.entries, saver.pending]);
  const summary = useMemo(() => summarizeReport(live.report, entries, options), [live.report, entries, options]);
  const computed = useMemo(() => summarizeReport(NO_OVERRIDES, entries, options), [entries, options]);
  const optionLabel = useMemo(() => makeOptionLabeler(options), [options]);
  const weatherOptions = useMemo(() => options.filter((o) => o.kind === 'weather' && o.is_active), [options]);
  const windOptions = useMemo(() => options.filter((o) => o.kind === 'wind' && o.is_active), [options]);

  useEffect(() => {
    if (!saver.hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saver.hasUnsaved]);

  if (live.deleted) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="font-bold">This report was deleted.</p>
        <Link href="/admin/reports" className="mt-2 inline-block font-bold text-primary underline-offset-4 hover:underline">Back to reports</Link>
      </div>
    );
  }

  function openNext(id: string) {
    const index = entries.findIndex((e) => e.id === id);
    setOpenId(entries[index + 1]?.id ?? null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/reports" className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline">← All reports</Link>
        <LiveIndicator status={live.status} lastUpdated={live.lastUpdated} />
      </div>
      <ReportDetails report={live.report} onSaved={live.applyReport} />
      <SummaryStrip summary={summary} />
      <RollCallList
        entries={entries}
        openId={openId}
        onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
        states={saver.states}
        optionLabel={optionLabel}
        flashIds={live.flashIds}
        weatherOptions={weatherOptions}
        windOptions={windOptions}
        onPatch={saver.update}
        onRetry={saver.retry}
        onDiscard={saver.discard}
        onNext={openNext}
      />
      <MissingBarangaysButton reportId={live.report.id} />
      <ReportRemarks report={live.report} computed={computed} onSaved={live.applyReport} />
      <SharePanel url={shareUrl} title={`Barangay Weather SitRep – ${formatShortHeading(live.report.report_at)}`} />
      {isSuperAdmin && <DeleteReportDialog reportId={live.report.id} reportAt={live.report.report_at} />}
    </div>
  );
}
```

- [ ] **Step 8: `app/admin/reports/[id]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EncoderView } from '@/components/encoder/encoder-view';
import { requireStaff } from '@/lib/auth';
import { getReferenceData } from '@/lib/data/public';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { isUuid } from '@/lib/ids';
import { reportUrl } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Encode report' };

export default async function EncodeReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  if (!isUuid(id)) notFound();
  const [bundle, { options }] = await Promise.all([fetchReportBundle(await createClient(), id), getReferenceData()]);
  if (!bundle) notFound();
  return <EncoderView initial={bundle} options={options} isSuperAdmin={staff.role === 'super_admin'} shareUrl={reportUrl(id)} />;
}
```

- [ ] **Step 9: Typecheck, lint, test and build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 10: Check the encoder flow with the owner** (needs Google sign-in)

Run `npm run dev` (background). Ask the owner to do the following with **two windows**: the encoder at `/admin/reports`, and the public page at `http://localhost:3000/` in a second window or on a phone on the same network.
1. Click **New netcall report**, keep the defaults and click **Start report**. The public window shows the "A new netcall report … has started" banner. Clicking **View** shows 0/24 active.
2. On the encoder, open **Gala**, tap **Responded – all normal**, then **Moderate rain** and **Light wind**. The public window updates that row within about 1 second and the row flashes. The summary tiles update.
3. Tap **Next barangay**. The next row opens and scrolls into view.
4. Turn the network off (DevTools → Network → Offline) and change Guimad's road. The row shows "Not saved". Turn the network back on; within 30 seconds it shows "Saved" and the public window updates.
5. Type general remarks and click outside the field. The public page shows them.
6. Delete this test report (Danger zone, then type the time). The public window shows "This report was removed".

Record what the owner reports. If a step fails, use superpowers:systematic-debugging before changing code.

- [ ] **Step 11: Commit**

```bash
git add lib/actions hooks components/encoder "app/admin/reports/[id]"
git commit -m "feat(encoder): add live encoding screen with optimistic autosave and retry"
```

---

### Task 16: Staff user management (`/admin/users`)

**Files:**
- Create: `app/admin/users/page.tsx`, `app/admin/users/users-manager.tsx`, `app/admin/users/actions.ts`
- Modify: `lib/auth.ts` (add `getSuperAdminForAction`)

**Interfaces:**
- Consumes: `staffSchema` (Task 8), `listStaff` (Task 10), `requireSuperAdmin` (Task 9).
- Produces:
  - `getSuperAdminForAction(): Promise<StaffUser | null>`
  - `addStaff(prev, formData): Promise<ActionResult>`
  - `setStaffActive(id, isActive): Promise<ActionResult>`
  - `removeStaff(id): Promise<ActionResult>`

- [ ] **Step 1: Add the action guard to `lib/auth.ts`** (append)

```ts
/** For Server Actions: returns the caller only if they are the active super admin. */
export async function getSuperAdminForAction(): Promise<StaffUser | null> {
  const staff = await getCurrentStaff();
  return staff?.role === 'super_admin' ? staff : null;
}
```

- [ ] **Step 2: `app/admin/users/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { staffSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can manage users.';

export async function addStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const parsed = staffSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    position: formData.get('position') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const { error } = await cdrrmo(await createClient())
    .from('users')
    .insert({ ...parsed.data, position: parsed.data.position || 'Radio Controller on Duty', role: 'encoder' });
  if (error) return fail(error.code === '23505' ? 'That email is already on the staff list.' : `Could not add: ${error.message}`);
  revalidatePath('/admin/users');
  return ok(null);
}

export async function setStaffActive(id: string, isActive: boolean): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  if (!isUuid(id)) return fail('Unknown user.');
  const { error } = await cdrrmo(await createClient()).from('users').update({ is_active: isActive }).eq('id', id);
  if (error) return fail(error.message);
  revalidatePath('/admin/users');
  return ok(null);
}

export async function removeStaff(id: string): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  if (!isUuid(id)) return fail('Unknown user.');
  const { error } = await cdrrmo(await createClient()).from('users').delete().eq('id', id);
  if (error) return fail(error.message);
  revalidatePath('/admin/users');
  return ok(null);
}
```

- [ ] **Step 3: `app/admin/users/users-manager.tsx`**

```tsx
'use client';

import { Trash2, UserPlus } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import { formatShortHeading } from '@/lib/format';
import type { StaffUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { addStaff, removeStaff, setStaffActive } from './actions';

function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await addStaff(prev, formData);
    if (result.ok) {
      setOpen(false);
      toast.success('Staff added. They can now sign in with Google.');
    }
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
        <UserPlus aria-hidden /> Add staff
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
          <DialogDescription>Enter their Google (Gmail) address. Access starts the first time they sign in.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <FormField label="Gmail address" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="off" required className="h-11" />
          </FormField>
          <FormField label="Full name" htmlFor="full_name">
            <Input id="full_name" name="full_name" required className="h-11" />
          </FormField>
          <FormField label="Position" htmlFor="position" hint="Defaults to Radio Controller on Duty.">
            <Input id="position" name="position" className="h-11" />
          </FormField>
          {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Adding…' : 'Add staff'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffRow({ user }: { user: StaffUser }) {
  const [pending, startTransition] = useTransition();
  const locked = user.role === 'super_admin';
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
    });

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="break-all font-bold">{user.email}</p>
        <p className="text-sm text-muted-foreground">{user.full_name || '—'} · {user.position}</p>
        <p className="text-xs text-muted-foreground">
          {user.last_sign_in_at ? `Last sign-in ${formatShortHeading(user.last_sign_in_at)}` : 'Has not signed in yet'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={locked ? 'default' : 'secondary'}>{locked ? 'Super admin' : 'Encoder'}</Badge>
        {!user.is_active && <Badge variant="destructive">Inactive</Badge>}
        {!locked && (
          <>
            <Button type="button" variant="outline" className="h-11 cursor-pointer" disabled={pending} onClick={() => run(() => setStaffActive(user.id, !user.is_active))}>
              {user.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 cursor-pointer text-danger"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Remove ${user.email} from the staff list?`)) run(() => removeStaff(user.id));
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function UsersManager({ users }: { users: StaffUser[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Staff users</h1>
        <AddStaffDialog />
      </div>
      <p className="text-muted-foreground">People on this list can sign in with Google and encode reports. Deactivated users are signed out of editing immediately.</p>
      <ul className="divide-y rounded-xl border bg-card">
        {users.map((user) => <StaffRow key={user.id} user={user} />)}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: `app/admin/users/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { listStaff } from '@/lib/data/admin';
import { UsersManager } from './users-manager';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  await requireSuperAdmin();
  return <UsersManager users={await listStaff()} />;
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: success.
Ask the owner, with `npm run dev` running:
- Add a second Gmail account they control as staff, and sign in with it in a private window. It should land on `/admin/reports` with only the "Reports" nav item.
- Deactivate it, then reload that window. It should be sent to `/login`.
- Signing in with a Google account that is **not** listed should show `/unauthorized`.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts app/admin/users
git commit -m "feat(admin): manage staff allowlist"
```

---

### Task 17: Barangays and condition options management

**Files:**
- Create: `app/admin/barangays/{page.tsx, barangays-manager.tsx, actions.ts}`, `app/admin/options/{page.tsx, options-manager.tsx, actions.ts}`

**Interfaces:**
- Consumes: `barangaySchema`, `optionSchema` (Task 8); `moveWithinGroup` (Task 8); `listZones`, `listBarangays`, `listOptions` (Task 10); `getSuperAdminForAction` (Task 16).
- Produces:
  - `saveBarangay(prev, formData)`, `moveBarangay(id, direction)`
  - `saveOption(prev, formData)`, `moveOption(id, direction)`
  - All return `Promise<ActionResult>`.

- [ ] **Step 1: `app/admin/barangays/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { moveWithinGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { barangaySchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can manage barangays.';

function dbMessage(error: { code?: string; message: string }): string {
  return error.code === '23505' ? 'A barangay with that name already exists.' : `Could not save: ${error.message}`;
}

export async function saveBarangay(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const parsed = barangaySchema.safeParse({
    name: formData.get('name'),
    callsign: formData.get('callsign'),
    zone_id: formData.get('zone_id'),
    monitors_coastal: formData.get('monitors_coastal') === 'on',
    is_active: formData.get('is_active') === 'on',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const db = cdrrmo(await createClient());
  const id = formData.get('id');
  if (typeof id === 'string' && id !== '') {
    if (!isUuid(id)) return fail('Unknown barangay.');
    const { error } = await db.from('barangays').update(parsed.data).eq('id', id);
    if (error) return fail(dbMessage(error));
  } else {
    const { data: last } = await db.from('barangays').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from('barangays').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1 });
    if (error) return fail(dbMessage(error));
  }
  revalidatePath('/admin/barangays');
  return ok(null);
}

export async function moveBarangay(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('barangays').select('id, zone_id, sort_order');
  if (error) return fail(error.message, true);
  const rows = (data ?? []) as { id: string; zone_id: string; sort_order: number }[];
  const current = rows.find((row) => row.id === id);
  if (!current) return fail('Unknown barangay.');
  for (const change of moveWithinGroup(rows.filter((row) => row.zone_id === current.zone_id), id, direction)) {
    const { error: updateError } = await db.from('barangays').update({ sort_order: change.sort_order }).eq('id', change.id);
    if (updateError) return fail(updateError.message, true);
  }
  revalidatePath('/admin/barangays');
  return ok(null);
}
```

- [ ] **Step 2: `app/admin/barangays/barangays-manager.tsx`**

```tsx
'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { Barangay, Zone } from '@/lib/types';
import { moveBarangay, saveBarangay } from './actions';

const SELECT = 'h-11 w-full rounded-md border border-input bg-card px-3 text-base';
const CHECK = 'flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold';

function BarangayForm({ zones, barangay }: { zones: Zone[]; barangay?: Barangay }) {
  const key = barangay?.id ?? 'new';
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveBarangay(prev, formData);
    if (result.ok) toast.success(barangay ? `${formData.get('name')} saved` : 'Barangay added');
    return result;
  }, null);
  return (
    <form action={formAction} className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1.3fr_auto_auto_auto] lg:items-end">
      {barangay && <input type="hidden" name="id" value={barangay.id} />}
      <FormField label="Name" htmlFor={`name-${key}`}>
        <Input id={`name-${key}`} name="name" defaultValue={barangay?.name} required className="h-11" />
      </FormField>
      <FormField label="Callsign" htmlFor={`callsign-${key}`}>
        <Input id={`callsign-${key}`} name="callsign" defaultValue={barangay?.callsign} required className="h-11" />
      </FormField>
      <FormField label="Zone" htmlFor={`zone-${key}`}>
        <select id={`zone-${key}`} name="zone_id" defaultValue={barangay?.zone_id ?? zones[0]?.id} className={SELECT}>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
      </FormField>
      <label className={CHECK}>
        <input type="checkbox" name="monitors_coastal" defaultChecked={barangay?.monitors_coastal ?? false} className="size-5 accent-primary" /> Coastal
      </label>
      <label className={CHECK}>
        <input type="checkbox" name="is_active" defaultChecked={barangay?.is_active ?? true} className="size-5 accent-primary" /> Active
      </label>
      <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : barangay ? 'Save' : 'Add'}</Button>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-2 lg:col-span-6">{state.message}</p>}
    </form>
  );
}

function BarangayRow({ barangay, zones, isFirst, isLast }: { barangay: Barangay; zones: Zone[]; isFirst: boolean; isLast: boolean }) {
  const [pending, startTransition] = useTransition();
  const move = (direction: 'up' | 'down') =>
    startTransition(async () => {
      const result = await moveBarangay(barangay.id, direction);
      if (!result.ok) toast.error(result.message);
    });
  return (
    <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end">
      <BarangayForm zones={zones} barangay={barangay} />
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${barangay.name} up`} disabled={isFirst || pending} onClick={() => move('up')}>
          <ArrowUp aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${barangay.name} down`} disabled={isLast || pending} onClick={() => move('down')}>
          <ArrowDown aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function BarangaysManager({ zones, barangays }: { zones: Zone[]; barangays: Barangay[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Barangays</h1>
        <p className="text-muted-foreground">Changes apply to new reports. Existing reports keep the names and callsigns they were created with. Use the arrows to set the roll-call order.</p>
      </div>
      {zones.map((zone) => {
        const rows = barangays.filter((b) => b.zone_id === zone.id).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <section key={zone.id} aria-label={`${zone.name} barangays`}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{zone.name}</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map((barangay, i) => (
                <li key={barangay.id}>
                  <BarangayRow barangay={barangay} zones={zones} isFirst={i === 0} isLast={i === rows.length - 1} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section aria-labelledby="add-barangay" className="rounded-xl border bg-card p-4">
        <h2 id="add-barangay" className="mb-3 font-bold">Add a barangay</h2>
        <BarangayForm zones={zones} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: `app/admin/barangays/page.tsx`**

```tsx
import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { listBarangays, listZones } from '@/lib/data/admin';
import { BarangaysManager } from './barangays-manager';

export const metadata: Metadata = { title: 'Barangays' };

export default async function BarangaysPage() {
  await requireSuperAdmin();
  const [zones, barangays] = await Promise.all([listZones(), listBarangays()]);
  return <BarangaysManager zones={zones} barangays={barangays} />;
}
```

- [ ] **Step 4: `app/admin/options/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { moveWithinGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { optionSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can manage options.';

export async function saveOption(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const parsed = optionSchema.safeParse({
    kind: formData.get('kind'),
    label: formData.get('label'),
    severity: formData.get('severity'),
    is_active: formData.get('is_active') === 'on',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const db = cdrrmo(await createClient());
  const id = formData.get('id');
  let error: { code?: string; message: string } | null;
  if (typeof id === 'string' && id !== '') {
    if (!isUuid(id)) return fail('Unknown option.');
    ({ error } = await db.from('condition_options').update(parsed.data).eq('id', id));
  } else {
    const { data: last } = await db.from('condition_options').select('sort_order').eq('kind', parsed.data.kind).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    ({ error } = await db.from('condition_options').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1 }));
  }
  if (error) return fail(error.code === '23505' ? 'That label already exists.' : `Could not save: ${error.message}`);
  revalidatePath('/admin/options');
  return ok(null);
}

export async function moveOption(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('condition_options').select('id, kind, sort_order');
  if (error) return fail(error.message, true);
  const rows = (data ?? []) as { id: string; kind: string; sort_order: number }[];
  const current = rows.find((row) => row.id === id);
  if (!current) return fail('Unknown option.');
  for (const change of moveWithinGroup(rows.filter((row) => row.kind === current.kind), id, direction)) {
    const { error: updateError } = await db.from('condition_options').update({ sort_order: change.sort_order }).eq('id', change.id);
    if (updateError) return fail(updateError.message, true);
  }
  revalidatePath('/admin/options');
  return ok(null);
}
```

- [ ] **Step 5: `app/admin/options/options-manager.tsx` and `page.tsx`**

```tsx
// app/admin/options/options-manager.tsx
'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { ConditionKind, ConditionOption } from '@/lib/types';
import { moveOption, saveOption } from './actions';

function OptionForm({ kind, option }: { kind: ConditionKind; option?: ConditionOption }) {
  const key = option?.id ?? `new-${kind}`;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveOption(prev, formData);
    if (result.ok) toast.success(option ? 'Saved' : 'Option added');
    return result;
  }, null);
  return (
    <form action={formAction} className="grid flex-1 gap-3 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
      <input type="hidden" name="kind" value={kind} />
      {option && <input type="hidden" name="id" value={option.id} />}
      <FormField label="Label" htmlFor={`label-${key}`}>
        <Input id={`label-${key}`} name="label" defaultValue={option?.label} required className="h-11" />
      </FormField>
      <FormField label="Severity" htmlFor={`severity-${key}`} hint={option ? undefined : '0 = calmest'}>
        <Input id={`severity-${key}`} name="severity" type="number" min={0} max={20} defaultValue={option?.severity ?? 0} required className="h-11" />
      </FormField>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="is_active" defaultChecked={option?.is_active ?? true} className="size-5 accent-primary" /> Active
      </label>
      <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : option ? 'Save' : 'Add'}</Button>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-4">{state.message}</p>}
    </form>
  );
}

function OptionRow({ option, isFirst, isLast }: { option: ConditionOption; isFirst: boolean; isLast: boolean }) {
  const [pending, startTransition] = useTransition();
  const move = (direction: 'up' | 'down') =>
    startTransition(async () => {
      const result = await moveOption(option.id, direction);
      if (!result.ok) toast.error(result.message);
    });
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
      <OptionForm kind={option.kind} option={option} />
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${option.label} up`} disabled={isFirst || pending} onClick={() => move('up')}><ArrowUp aria-hidden /></Button>
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${option.label} down`} disabled={isLast || pending} onClick={() => move('down')}><ArrowDown aria-hidden /></Button>
      </div>
    </div>
  );
}

const TITLES: Record<ConditionKind, string> = { weather: 'Weather situation', wind: 'Wind situation' };

export function OptionsManager({ options }: { options: ConditionOption[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Condition options</h1>
        <p className="text-muted-foreground">
          These are the choices encoders tap. Severity sets the order used for the &ldquo;average&rdquo; summary (higher is worse). Deactivate an option instead of deleting it, so older reports keep their labels.
        </p>
      </div>
      {(['weather', 'wind'] as const).map((kind) => {
        const rows = options.filter((o) => o.kind === kind).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <section key={kind} aria-labelledby={`kind-${kind}`} className="space-y-3">
            <h2 id={`kind-${kind}`} className="text-lg font-bold">{TITLES[kind]}</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map((option, i) => (
                <li key={option.id}><OptionRow option={option} isFirst={i === 0} isLast={i === rows.length - 1} /></li>
              ))}
            </ul>
            <div className="rounded-xl border border-dashed p-3">
              <p className="mb-2 text-sm font-bold">Add {kind} option</p>
              <OptionForm kind={kind} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

```tsx
// app/admin/options/page.tsx
import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { listOptions } from '@/lib/data/admin';
import { OptionsManager } from './options-manager';

export const metadata: Metadata = { title: 'Options' };

export default async function OptionsPage() {
  await requireSuperAdmin();
  return <OptionsManager options={await listOptions()} />;
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: success.
With the owner signed in (dev server running), on `/admin/barangays`:
- Move "Gala" down. It swaps with Guimad.
- Change a callsign and save. A toast appears.
Confirm in SQL that the sample report's entry keeps the old callsign:
```sql
select b.callsign as current_callsign, e.callsign as report_callsign
from cdrrmo.barangays b join cdrrmo.report_entries e on e.barangay_id = b.id
where b.name = 'Gala' and e.report_id = '<SAMPLE_REPORT_ID>';
```
Expected: the two values differ if the owner changed Gala's callsign. **Ask the owner to change it back afterwards.** On `/admin/options`, add "Thunderstorm" (severity 5) and then deactivate it.

- [ ] **Step 7: Commit**

```bash
git add app/admin/barangays app/admin/options
git commit -m "feat(admin): manage barangays, callsigns and condition options"
```

---

### Task 18: Report header settings and logos (`0004_storage.sql`, `/admin/settings`)

**Files:**
- Create: `supabase/migrations/0004_storage.sql`, `app/admin/settings/{page.tsx, settings-form.tsx, actions.ts}`

**Interfaces:**
- Consumes: `settingsSchema` (Task 8); `getSettings` (Task 10); `getSuperAdminForAction` (Task 16).
- Produces:
  - Public bucket `cdrrmo-assets` (PNG/JPEG/WebP, ≤ 500 KB)
  - `saveSettings(prev, formData)`, `uploadLogo(prev, formData)`, `removeLogo(url)`, all returning `Promise<ActionResult>`

- [ ] **Step 1: Write and apply `supabase/migrations/0004_storage.sql`**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cdrrmo-assets', 'cdrrmo-assets', true, 512000, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "cdrrmo assets: super admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_super_admin()));
create policy "cdrrmo assets: super admin uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_super_admin()));
create policy "cdrrmo assets: super admin deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_super_admin()));
```
Run MCP `apply_migration` with `name: "cdrrmo_0004_storage"`. Verify:
```sql
select id, public, file_size_limit from storage.buckets where id = 'cdrrmo-assets';
```
Expected: one row with `public = true` and `file_size_limit = 512000`.

- [ ] **Step 2: `app/admin/settings/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { getSettings } from '@/lib/data/admin';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { settingsSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can change settings.';
const BUCKET = 'cdrrmo-assets';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_LOGOS = 4;
const MAX_BYTES = 500 * 1024;

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const parsed = settingsSchema.safeParse({
    office_title: formData.get('office_title'),
    office_lines: String(formData.get('office_lines') ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
    network_name: formData.get('network_name'),
    call_sign: formData.get('call_sign'),
    radio_frequency: formData.get('radio_frequency'),
    report_title: formData.get('report_title'),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const { error } = await cdrrmo(await createClient()).from('settings').update(parsed.data).eq('id', 1);
  if (error) return fail(`Could not save: ${error.message}`, true);
  revalidatePath('/', 'layout');
  return ok(null);
}

export async function uploadLogo(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return fail('Choose an image file.');
  const ext = EXTENSIONS[file.type];
  if (!ext) return fail('Use a PNG, JPG or WebP image.');
  if (file.size > MAX_BYTES) return fail('The logo must be 500 KB or smaller.');
  const settings = await getSettings();
  if (settings.logo_urls.length >= MAX_LOGOS) return fail(`Remove a logo first (maximum ${MAX_LOGOS}).`);

  const supabase = await createClient();
  const path = `logos/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (uploadError) return fail(`Upload failed: ${uploadError.message}`, true);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await cdrrmo(supabase).from('settings').update({ logo_urls: [...settings.logo_urls, data.publicUrl] }).eq('id', 1);
  if (error) return fail(`Could not save the logo: ${error.message}`, true);
  revalidatePath('/', 'layout');
  return ok(null);
}

export async function removeLogo(url: string): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const settings = await getSettings();
  if (!settings.logo_urls.includes(url)) return fail('Logo not found.');
  const supabase = await createClient();
  const path = url.split(PUBLIC_MARKER)[1];
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await cdrrmo(supabase).from('settings').update({ logo_urls: settings.logo_urls.filter((u) => u !== url) }).eq('id', 1);
  if (error) return fail(`Could not remove: ${error.message}`, true);
  revalidatePath('/', 'layout');
  return ok(null);
}
```

- [ ] **Step 3: `app/admin/settings/settings-form.tsx` and `page.tsx`**

```tsx
// app/admin/settings/settings-form.tsx
'use client';

import { Trash2, Upload } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ActionResult } from '@/lib/action-result';
import type { Settings } from '@/lib/types';
import { removeLogo, saveSettings, uploadLogo } from './actions';

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveSettings(prev, formData);
    if (result.ok) toast.success('Settings saved');
    return result;
  }, null);
  const [logoState, logoAction, uploading] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await uploadLogo(prev, formData);
    if (result.ok) toast.success('Logo added');
    return result;
  }, null);
  const [removing, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Report header</h1>
      <form action={formAction} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <FormField label="Office title" htmlFor="office_title">
          <Input id="office_title" name="office_title" defaultValue={settings.office_title} required className="h-11" />
        </FormField>
        <FormField label="Report title" htmlFor="report_title">
          <Input id="report_title" name="report_title" defaultValue={settings.report_title} required className="h-11" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Office lines" htmlFor="office_lines" hint="One line per row.">
            <Textarea id="office_lines" name="office_lines" rows={3} defaultValue={settings.office_lines.join('\n')} />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Network name" htmlFor="network_name">
            <Input id="network_name" name="network_name" defaultValue={settings.network_name} required className="h-11" />
          </FormField>
        </div>
        <FormField label="Call sign" htmlFor="call_sign">
          <Input id="call_sign" name="call_sign" defaultValue={settings.call_sign} required className="h-11" />
        </FormField>
        <FormField label="Radio frequency" htmlFor="radio_frequency">
          <Input id="radio_frequency" name="radio_frequency" defaultValue={settings.radio_frequency} required className="h-11" />
        </FormField>
        {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-2">{state.message}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : 'Save header'}</Button>
        </div>
      </form>

      <section aria-labelledby="logos-heading" className="space-y-4 rounded-xl border bg-card p-4">
        <h2 id="logos-heading" className="text-lg font-bold">Logos</h2>
        <p className="text-sm text-muted-foreground">Shown in the public header, left to right. PNG, JPG or WebP, up to 500 KB, maximum 4.</p>
        <ul className="flex flex-wrap gap-4">
          {settings.logo_urls.map((url) => (
            <li key={url} className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote logo from the public storage bucket */}
              <img src={url} alt="Logo" width={64} height={64} className="size-16 rounded-full border bg-white object-contain" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer text-danger"
                disabled={removing}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeLogo(url);
                    if (!result.ok) toast.error(result.message);
                  })
                }
              >
                <Trash2 aria-hidden /> Remove
              </Button>
            </li>
          ))}
        </ul>
        <form action={logoAction} className="flex flex-wrap items-end gap-3">
          <FormField label="Add a logo" htmlFor="logo">
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="h-11" />
          </FormField>
          <Button type="submit" disabled={uploading} className="h-11 cursor-pointer"><Upload aria-hidden /> {uploading ? 'Uploading…' : 'Upload'}</Button>
          {logoState && !logoState.ok && <p role="alert" className="w-full text-sm font-bold text-danger">{logoState.message}</p>}
        </form>
      </section>
    </div>
  );
}
```

```tsx
// app/admin/settings/page.tsx
import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/data/admin';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requireSuperAdmin();
  return <SettingsForm settings={await getSettings()} />;
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: success.
Ask the owner (dev server running) to upload the CDRRMO and City of Ozamiz logos as PNG files of 500 KB or less. Expected: the logos appear on `/admin/settings` and in the public header at `/`. Run `node scripts/screenshots.mjs http://localhost:3000 $SCRATCH` again and look at the 375px screenshot. The header must not overflow.

- [ ] **Step 5: Re-run the RLS test** (the storage policies must not affect it)

Expected: `RLS_TESTS_PASSED`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_storage.sql app/admin/settings
git commit -m "feat(admin): edit report header and upload logos"
```

---

### Task 19: End-to-end tests, final verification and README

**Files:**
- Create: `playwright.config.ts`, `e2e/public.spec.ts`, `scripts/watch-live.mjs`, `README.md` (replace the scaffold's)

**Interfaces:**
- Consumes: everything above. `SAMPLE_REPORT_ID` from Task 11 is passed to the tests as `E2E_REPORT_ID`.

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: external ?? 'http://localhost:3000' },
  webServer: external
    ? undefined
    : { command: 'npm run build && npm run start', url: 'http://localhost:3000', timeout: 240_000, reuseExistingServer: true },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 2: Write `e2e/public.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

const REPORT_ID = process.env.E2E_REPORT_ID;
if (!REPORT_ID) throw new Error('Set E2E_REPORT_ID to the 2026-10-07 1050H sample report id.');
const REPORT = `/reports/${REPORT_ID}`;

test('report page shows the 1050H summary and barangays', async ({ page }) => {
  await page.goto(REPORT);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Barangay Weather SitRep');
  await expect(page.getByText('October 7, 2026 – 1050H')).toBeVisible();
  await expect(page.getByText('Light to Moderate rain').first()).toBeVisible();
  await expect(page.getByText('Stimson Abordo').locator('visible=true').first()).toBeVisible();
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 20_000 });
});

test('zone filter and issues-only filter narrow the list', async ({ page }) => {
  await page.goto(REPORT);
  await page.getByRole('button', { name: 'Coastal', exact: true }).click();
  await expect(page.getByText('Malaubang').locator('visible=true').first()).toBeVisible();
  await expect(page.getByText('Stimson Abordo').locator('visible=true')).toHaveCount(0);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Issues only').check();
  await expect(page.getByText('Gala', { exact: true }).locator('visible=true').first()).toBeVisible();
  await expect(page.getByText('Trigos').locator('visible=true')).toHaveCount(0);
});

test('report page exposes Facebook Open Graph tags', async ({ request }) => {
  const html = await (await request.get(REPORT)).text();
  expect(html).toContain('property="og:title" content="Barangay Weather SitRep – Oct 7, 2026 1050H"');
  expect(html).toContain('15/24 stations active · Light to Moderate rain · Not windy · Roads passable · Rivers normal');
  expect(html).toMatch(new RegExp(`property="og:image" content="[^"]*/reports/${REPORT_ID}/og\\?v=\\d+"`));
});

test('preview image renders as PNG', async ({ request }) => {
  const response = await request.get(`${REPORT}/og`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
});

test('archive lists the sample report', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Wednesday, October 7, 2026' })).toBeVisible();
  await expect(page.getByText('1050H')).toBeVisible();
});

test('unknown report returns 404', async ({ request }) => {
  const response = await request.get('/reports/00000000-0000-4000-8000-000000000000');
  expect(response.status()).toBe(404);
});

test('admin requires sign-in', async ({ page }) => {
  await page.goto('/admin/reports');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Freports/);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});
```

- [ ] **Step 3: Run the E2E suite**

Run: `E2E_REPORT_ID=<SAMPLE_REPORT_ID> npx playwright test`
Expected: 14 passed (7 tests × 2 projects). If a test fails, debug with superpowers:systematic-debugging. Do not loosen the assertions.

- [ ] **Step 4: Live-update check with `scripts/watch-live.mjs`**

```js
// Usage: node scripts/watch-live.mjs <url> <text>
// Opens the public page and waits (without reloading) for <text> to appear via Realtime.
import { chromium } from '@playwright/test';

const [url, text] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url);
await page.getByText('LIVE', { exact: true }).waitFor({ timeout: 30_000 });
console.log('READY: page is live, waiting for', JSON.stringify(text));
try {
  await page.getByText(text).first().waitFor({ state: 'attached', timeout: 90_000 });
  console.log('PASS: live update appeared without reload');
  process.exitCode = 0;
} catch {
  console.error('FAIL: text did not appear');
  process.exitCode = 1;
}
await browser.close();
```
With `npm run start` running, start `node scripts/watch-live.mjs http://localhost:3000/reports/<SAMPLE_REPORT_ID> live-check-7Q2` in the background and wait for `READY`. Then run via MCP:
```sql
update cdrrmo.report_entries set remarks = 'live-check-7Q2'
where report_id = '<SAMPLE_REPORT_ID>' and barangay_name = 'Malaubang';
```
Expected: the script prints `PASS`. Then revert:
```sql
update cdrrmo.report_entries set remarks = null
where report_id = '<SAMPLE_REPORT_ID>' and barangay_name = 'Malaubang';
```

- [ ] **Step 5: Database advisors**

Call MCP `get_advisors` (type `security`, then `performance`) for project `jwpaamhdlufycuopiguy`. Filter the results to objects in schema `cdrrmo` and the `cdrrmo-assets` policies.
Expected: no ERROR or WARN items for `cdrrmo`. Fix any finding with a new migration `0005_advisor_fixes.sql`, re-run the RLS test, and note any INFO-level items in the final report.

- [ ] **Step 6: Accessibility audit**

With `npm run start` running:
```bash
CHROME_PATH="$(node -e "console.log(require('@playwright/test').chromium.executablePath())")" \
  npx -y lighthouse http://localhost:3000/ --only-categories=accessibility --quiet \
  --chrome-flags="--headless=new" --output=json --output-path=$SCRATCH/lh.json
node -e "console.log(require('$SCRATCH/lh.json').categories.accessibility.score)"
```
Expected: a score of 0.95 or higher. If lower, list `audits` with `score < 1` from the JSON, fix them, and re-run.

- [ ] **Step 7: Replace `README.md`**

````markdown
# CDRRMO Barangay Weather SitRep

Live barangay weather situation reports for the Ozamiz City CDRRMO netcall. Radio controllers encode each barangay during the netcall, and every change appears on the public site immediately.

- Public: `/` (current report), `/reports` (archive), `/reports/<id>` (shareable, with a Facebook preview)
- Staff: `/admin` (Google sign-in; allowlisted accounts only)

## Stack
Next.js 16 · Supabase (schema `cdrrmo` on the shared "Asenso" project) · Tailwind v4 · shadcn/ui · Supabase Realtime Broadcast

## Local setup
1. `cp .env.example .env.local` and fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. `npm install`
3. `npm run dev` and open http://localhost:3000

## One-time Supabase setup (Asenso project)
- Project Settings → Data API → **Exposed schemas**: add `cdrrmo`.
- Authentication → URL Configuration → **Redirect URLs**: add `http://localhost:3000/auth/callback` and `https://<production-domain>/auth/callback`.
- Realtime → Settings: public channel access must be allowed.
- Migrations are in `supabase/migrations` (already applied). Apply new ones in order.

## Deploying to Vercel
Import the repo and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` (the production URL, which is used in share links and Facebook previews). Add the production callback URL in Supabase (see above).

## Roles
- **Super admin** (berlcamp@gmail.com, fixed): manages users, barangays, options, header settings; can delete reports.
- **Encoder**: creates and edits reports. Every edit is public immediately.

## Tests
- `npm test`: unit tests (summary rules, formatting, live reducer, validation)
- `E2E_REPORT_ID=<id> npx playwright test`: public site end-to-end
- `supabase/tests/rls_test.sql`: run with the Supabase SQL editor or MCP; it passes when it fails with `RLS_TESTS_PASSED`.

## Manual acceptance checklist (needs Google sign-in)
1. Sign in as super admin and land on `/admin/reports`.
2. An unlisted Google account is sent to `/unauthorized`.
3. Start a new report. An open public tab shows the "new netcall report" banner.
4. Change a barangay's wind on a phone. The public page on another device updates within about 1 second.
5. Go offline, change a field, and see "Not saved". Back online, it saves automatically.
6. The super admin deletes a test report by typing its time.
````

- [ ] **Step 8: Full verification run**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green. Record the counts of unit tests and E2E tests that passed.

- [ ] **Step 9: Commit**

```bash
git add playwright.config.ts e2e scripts/watch-live.mjs README.md
git commit -m "test: add public E2E suite, live-update check and project README"
```

---

## Self-review notes (done while writing)

- **Spec coverage:**
  - §3 architecture: Tasks 1, 9 and 10.
  - §4 routes: Tasks 9 and 11–18.
  - §5 data model: Tasks 2 and 3.
  - §5.4 summary: Task 6.
  - §6 auth/RLS: Tasks 3 and 9.
  - §7 realtime: Tasks 4 and 10.
  - §8 UI: Tasks 1, 11, 12 and 14–18.
  - §9 Facebook: Tasks 11 and 13.
  - §10 errors: Tasks 8, 10 and 15.
  - §11 testing: Tasks 3–8, 12 and 19.
- **Manual owner steps** (they can't be automated without credentials) are called out in Task 2 Step 4, Task 9 Step 9, Task 14 Step 7, Tasks 15–18 verification and Task 4 Step 4.
