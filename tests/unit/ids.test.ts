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
