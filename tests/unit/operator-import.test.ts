import { describe, expect, it } from 'vitest';
import { barangayKey, normalizeContact, parseCsv, planImport } from '@/lib/operator-import';
import type { Barangay, RadioOperator } from '@/lib/types';

const B1 = '3f2b6a0e-9c1d-4e5f-8a7b-1c2d3e4f5a61';
const B2 = '3f2b6a0e-9c1d-4e5f-8a7b-1c2d3e4f5a62';
const barangays = [{ id: B1, name: 'San Roque' }, { id: B2, name: 'Gala' }] as Barangay[];

describe('parseCsv', () => {
  it('handles quotes, embedded commas and newlines, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"line\nbreak",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['line\nbreak', 'z'],
    ]);
  });
});

describe('helpers', () => {
  it('matches barangay names loosely', () => {
    expect(barangayKey('Brgy. San  Roque')).toBe('san roque');
    expect(barangayKey('BARANGAY san-roque')).toBe('san roque');
  });
  it('restores the leading zero of mobile numbers', () => {
    expect(normalizeContact('9171234567')).toBe('09171234567');
    expect(normalizeContact('+63 917 123 4567')).toBe('+63 917 123 4567');
  });
});

describe('planImport', () => {
  const header = 'Barangay,Name of Operator,Status,Callsign,Contact Number,Position';
  it('maps the columns, flags bad rows and finds existing operators', () => {
    const existing = [{ id: 'old', barangay_id: B2, name: 'Maria Santos' }] as RadioOperator[];
    const csv = [
      header,
      'Brgy. San Roque,Juan  Dela Cruz,Active,Alpha 1,9171234567,BDRRM Officer',
      'gala,maria santos,,Bravo 2,,',
      'Nowhere,Pedro,Active,,,',
      'Gala,Ana,Retired,,,',
      ',,,,,',
      'San Roque,juan dela cruz,Inactive,,,',
    ].join('\n');
    const { rows, missingColumns } = planImport(csv, barangays, existing);
    expect(missingColumns).toEqual([]);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      line: 2,
      existingId: null,
      error: null,
      data: { barangay_id: B1, name: 'Juan Dela Cruz', status: 'active', callsign: 'Alpha 1', contact_number: '09171234567', position: 'BDRRM Officer' },
    });
    expect(rows[1]).toMatchObject({ existingId: 'old', data: { status: 'active' } });
    expect(rows[2].error).toMatch(/No barangay named/);
    expect(rows[3].error).toMatch(/Active or Inactive/);
    expect(rows[4]).toMatchObject({ line: 7, error: expect.stringMatching(/earlier in the file/) });
  });
  it('reports missing required columns', () => {
    expect(planImport('Status,Callsign\nActive,A1', barangays, []).missingColumns).toEqual(['barangay', 'name']);
  });
  it('accepts columns in any order and optional ones missing', () => {
    const { rows } = planImport('name of operator,barangay\nJuan,Gala', barangays, []);
    expect(rows[0].data).toMatchObject({ barangay_id: B2, name: 'Juan', status: 'active', callsign: '', contact_number: '' });
  });
});
