import type { Barangay, OperatorStatus, RadioOperator } from '@/lib/types';
import { operatorSchema } from '@/lib/validation';

export const IMPORT_LIMIT = 500;

export type ImportField = 'barangay' | 'name' | 'status' | 'callsign' | 'contact_number' | 'position';

/** Header spellings accepted for each column, compared after lowercasing and dropping non-letters. */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  barangay: ['barangay', 'brgy', 'barangayname'],
  name: ['nameofoperator', 'operatorname', 'operator', 'name', 'radiooperator', 'fullname'],
  status: ['status'],
  callsign: ['callsign', 'callsigns'],
  contact_number: ['contactnumber', 'contactno', 'contact', 'mobilenumber', 'mobileno', 'mobile', 'phonenumber', 'phone', 'cellphonenumber'],
  position: ['position', 'designation', 'role'],
};

export interface ImportRow {
  /** 1-based line in the file, counting the header as line 1. */
  line: number;
  barangayLabel: string;
  data: {
    barangay_id: string;
    name: string;
    callsign: string;
    position: string;
    contact_number: string;
    status: OperatorStatus;
  } | null;
  /** Existing operator this row will update, matched by barangay and name. */
  existingId: string | null;
  error: string | null;
}

export interface ImportPlan {
  rows: ImportRow[];
  missingColumns: ImportField[];
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF, and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/** "Brgy. San Roque" and "barangay san roque" both become "san roque". */
export function barangayKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^\s*(brgy|bgy|barangay)\b\.?/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Spreadsheets drop the leading zero from mobile numbers: 9171234567 → 09171234567. */
export function normalizeContact(value: string): string {
  const v = value.trim();
  return /^9\d{9}$/.test(v) ? `0${v}` : v;
}

function parseStatus(value: string): OperatorStatus | null {
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'active') return 'active';
  if (v === 'inactive') return 'inactive';
  return null;
}

export function planImport(text: string, barangays: Barangay[], existing: RadioOperator[]): ImportPlan {
  const [header = [], ...body] = parseCsv(text);
  const keys = header.map(headerKey);
  const index = {} as Record<ImportField, number>;
  const missingColumns: ImportField[] = [];
  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    // Prefer the most specific alias, so "name of operator" wins over a bare "name" column.
    const i = HEADER_ALIASES[field].map((alias) => keys.indexOf(alias)).find((pos) => pos >= 0) ?? -1;
    index[field] = i;
    if (i < 0 && (field === 'barangay' || field === 'name')) missingColumns.push(field);
  }
  if (missingColumns.length > 0) return { rows: [], missingColumns };

  const byKey = new Map(barangays.map((b) => [barangayKey(b.name), b]));
  const existingByKey = new Map(existing.map((o) => [`${o.barangay_id}|${o.name.trim().toLowerCase()}`, o.id]));
  const seen = new Set<string>();
  const cell = (cells: string[], field: ImportField) => (index[field] >= 0 ? (cells[index[field]] ?? '').trim() : '');

  const rows: ImportRow[] = [];
  body.forEach((cells, i) => {
    if (cells.every((c) => c.trim() === '')) return;
    const line = i + 2;
    const barangayLabel = cell(cells, 'barangay');
    const fail = (error: string): ImportRow => ({ line, barangayLabel, data: null, existingId: null, error });
    const barangay = byKey.get(barangayKey(barangayLabel));
    if (!barangayLabel) return void rows.push(fail('Barangay is blank.'));
    if (!barangay) return void rows.push(fail(`No barangay named “${barangayLabel}”.`));
    const status = parseStatus(cell(cells, 'status'));
    if (!status) return void rows.push(fail(`Status “${cell(cells, 'status')}” should be Active or Inactive.`));
    const parsed = operatorSchema.safeParse({
      barangay_id: barangay.id,
      name: cell(cells, 'name').replace(/\s+/g, ' '),
      callsign: cell(cells, 'callsign'),
      position: cell(cells, 'position'),
      contact_number: normalizeContact(cell(cells, 'contact_number')),
      status,
    });
    if (!parsed.success) return void rows.push(fail(parsed.error.issues[0]?.message ?? 'Check this row.'));
    const key = `${barangay.id}|${parsed.data.name.toLowerCase()}`;
    if (seen.has(key)) return void rows.push(fail('Same operator and barangay appear earlier in the file.'));
    seen.add(key);
    rows.push({ line, barangayLabel: barangay.name, data: parsed.data, existingId: existingByKey.get(key) ?? null, error: null });
  });
  return { rows, missingColumns };
}
