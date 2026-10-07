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
