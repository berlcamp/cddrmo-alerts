import { describe, expect, it } from 'vitest';
import { describeSummary, entryHasIssue, entryRemarks, joinRange, NONE, summarizeCondition, summarizeReport } from '@/lib/summary';
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

describe('entryRemarks', () => {
  it('adds the no-radio note before any remarks', () => {
    expect(entryRemarks({ no_radio: true, remarks: null })).toBe('No radio capability');
    expect(entryRemarks({ no_radio: true, remarks: ' Relayed by phone ' })).toBe('No radio capability · Relayed by phone');
  });
  it('keeps the note alongside any remark, whatever it says', () => {
    expect(entryRemarks({ no_radio: true, remarks: 'no radio capability, used SMS' })).toBe('No radio capability · no radio capability, used SMS');
  });
  it('leaves remarks alone without the flag', () => {
    expect(entryRemarks({ no_radio: false, remarks: 'Flooded' })).toBe('Flooded');
    expect(entryRemarks({ no_radio: false, remarks: null })).toBe('');
  });
});
