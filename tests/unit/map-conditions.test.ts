import { describe, expect, it } from 'vitest';
import { makeConditionLooker, scaleLevel, WEATHER_SCALE, WIND_SCALE } from '@/lib/map/conditions';
import type { ConditionOption } from '@/lib/types';

const option = (id: string, kind: ConditionOption['kind'], severity: number): ConditionOption => ({
  id, kind, label: id, severity, sort_order: severity, is_active: true,
});

describe('scaleLevel', () => {
  it('spreads severities across the scale', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => scaleLevel(s, 5, 6))).toEqual([0, 1, 2, 3, 4, 5]);
    expect([0, 1, 2, 3].map((s) => scaleLevel(s, 3, 4))).toEqual([0, 1, 2, 3]);
  });

  it('stays in range for odd inputs', () => {
    expect(scaleLevel(0, 0, 6)).toBe(0);
    expect(scaleLevel(-3, 5, 6)).toBe(0);
    expect(scaleLevel(99, 5, 6)).toBe(5);
    expect(scaleLevel(10, 20, 6)).toBe(3);
  });
});

describe('makeConditionLooker', () => {
  const look = makeConditionLooker([
    option('sunny', 'weather', 0), option('torrential', 'weather', 5),
    option('calm', 'wind', 0), option('strong', 'wind', 3),
  ]);

  it('colours each kind on its own scale', () => {
    expect(look('sunny')).toMatchObject({ kind: 'weather', level: 0, bg: WEATHER_SCALE[0].bg });
    expect(look('torrential')).toMatchObject({ level: 5, bg: WEATHER_SCALE[5].bg });
    expect(look('strong')).toMatchObject({ kind: 'wind', level: 3, bg: WIND_SCALE[3].bg });
  });

  it('returns null for missing or unknown ids', () => {
    expect(look(null)).toBeNull();
    expect(look('nope')).toBeNull();
  });
});
