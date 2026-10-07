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
