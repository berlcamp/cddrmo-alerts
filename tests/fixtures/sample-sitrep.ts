import type { ConditionOption, Report, ReportEntry } from '@/lib/types';

function opt(id: string, kind: 'weather' | 'wind', label: string, severity: number): ConditionOption {
  return { id, kind, label, severity, sort_order: severity, is_active: true };
}

export const OPTIONS: ConditionOption[] = [
  opt('w-sunny', 'weather', 'Sunny', 0),
  opt('w-cloudy', 'weather', 'Cloudy', 1),
  opt('w-light', 'weather', 'Light rain', 2),
  opt('w-moderate', 'weather', 'Moderate rain', 3),
  opt('w-heavy', 'weather', 'Heavy rain', 4),
  opt('w-torrential', 'weather', 'Torrential rain', 5),
  opt('n-none', 'wind', 'Not windy', 0),
  opt('n-light', 'wind', 'Light wind', 1),
  opt('n-moderate', 'wind', 'Moderate wind', 2),
  opt('n-strong', 'wind', 'Strong wind', 3),
];

const ZONE_SORT: Record<string, number> = { Upland: 1, Midland: 2, Lowland: 3, Coastal: 4 };

const ok = (weather: string, extra: Partial<ReportEntry> = {}): Partial<ReportEntry> => ({
  responded: true,
  weather_option_id: weather,
  wind_option_id: 'n-none',
  road: 'passable',
  power: 'with_power',
  ...extra,
});

const ROWS: [number, string, string, string, Partial<ReportEntry>?][] = [
  [1, 'Stimson Abordo', 'Sierra 5', 'Upland', ok('w-moderate')],
  [2, 'Gala', 'Golf 2', 'Upland'],
  [3, 'Guimad', 'Golf 5', 'Upland'],
  [4, 'Trigos', 'Tango 3', 'Upland', ok('w-moderate', { river: 'normal' })],
  [5, 'Dalapang', 'Delta 1', 'Upland', ok('w-moderate')],
  [6, 'Cogon', 'Charlie 8', 'Upland', ok('w-light')],
  [7, 'Embargo', 'Eagle', 'Midland', ok('w-moderate', { river: 'normal' })],
  [8, 'Pantaon', 'Papa 1', 'Midland'],
  [9, 'Pulot', 'Papa 2', 'Midland', ok('w-moderate', { river: 'normal' })],
  [10, 'Calabayan', 'Charlie 1', 'Midland', ok('w-light', { river: 'normal' })],
  [11, 'Kinuman Sur', 'Kilo 2', 'Midland', ok('w-light', { river: 'normal' })],
  [12, 'Sangay Diot', 'Sierra 1', 'Midland', ok('w-light', { river: 'normal', power: null })],
  [13, 'Cavinte', 'Charlie 7', 'Midland'],
  [14, 'Balintawak', 'Bravo 3', 'Lowland', ok('w-moderate')],
  [15, 'Bañadero', 'Bravo 4', 'Lowland', ok('w-light', { river: 'normal' })],
  [16, 'Aguada', 'Alpha', 'Lowland', ok('w-moderate', { river: 'normal' })],
  [17, 'Dimaluna', 'Delta 3', 'Lowland', ok('w-moderate', { river: 'normal' })],
  [18, 'Lam-an', 'Lima 3', 'Lowland'],
  [19, 'Tabid', 'Tango 1', 'Lowland'],
  [20, 'Bongbong', 'Bravo 8', 'Lowland'],
  [21, 'Baybay Triunfo', 'Bravo 7', 'Coastal', ok('w-light', { river: 'normal', coastal: 'normal' })],
  [22, 'Malaubang', 'Mike 1', 'Coastal', ok('w-light', { river: 'normal', coastal: 'normal', wind_option_id: 'n-light' })],
  [23, 'Catadman-Manabay', 'Charlie 6', 'Coastal'],
  [24, 'San Antonio', 'Sierra 3', 'Coastal'],
];

export function makeEntry(no: number, name: string, callsign: string, zone: string, data: Partial<ReportEntry> = {}): ReportEntry {
  return {
    id: `e${no}`,
    report_id: 'r1',
    barangay_id: `b${no}`,
    barangay_name: name,
    callsign,
    zone_name: zone,
    zone_sort: ZONE_SORT[zone],
    sort_order: no,
    monitors_coastal: zone === 'Coastal',
    responded: false,
    weather_option_id: null,
    wind_option_id: null,
    road: null,
    river: null,
    coastal: null,
    power: null,
    remarks: null,
    updated_at: '2026-10-07T02:50:00.000Z',
    ...data,
  };
}

export const SAMPLE_ENTRIES: ReportEntry[] = ROWS.map(([no, name, callsign, zone, data]) => makeEntry(no, name, callsign, zone, data));

export const SAMPLE_REPORT: Report = {
  id: 'r1',
  report_at: '2026-10-07T02:50:00.000Z',
  prepared_by_name: 'Romeo P. De Los Angeles Jr',
  prepared_by_position: 'Radio Controller on Duty',
  remarks: 'All stations reported that their respective AOR are in normal situation.',
  weather_summary_override: null,
  wind_summary_override: null,
  rivers_summary_override: null,
  roads_summary_override: null,
  coastal_summary_override: null,
  status: 'published',
  published_at: '2026-10-07T02:50:00.000Z',
  created_at: '2026-10-07T02:50:00.000Z',
  updated_at: '2026-10-07T02:50:00.000Z',
};
