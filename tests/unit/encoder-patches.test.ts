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
