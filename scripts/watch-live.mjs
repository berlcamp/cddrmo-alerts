// Usage: node scripts/watch-live.mjs <url> <text>
// Opens the public page and waits (without reloading) for <text> to appear via Realtime.
// Uses system Chrome by default; override with PW_CHANNEL.
import { chromium } from '@playwright/test';

const [url, text] = process.argv.slice(2);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
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
