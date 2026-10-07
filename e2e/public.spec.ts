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
