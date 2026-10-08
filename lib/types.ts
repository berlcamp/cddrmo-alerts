export type Role = 'super_admin' | 'encoder';
export type ConditionKind = 'weather' | 'wind';
export type Road = 'passable' | 'unpassable';
export type Level = 'normal' | 'above_normal';
export type Power = 'with_power' | 'no_power';
export type ReportStatus = 'draft' | 'published';

export interface Zone {
  id: string;
  name: string;
  sort_order: number;
}

export interface Barangay {
  id: string;
  name: string;
  callsign: string;
  zone_id: string;
  sort_order: number;
  monitors_coastal: boolean;
  is_active: boolean;
}

export interface ConditionOption {
  id: string;
  kind: ConditionKind;
  label: string;
  severity: number;
  sort_order: number;
  is_active: boolean;
}

export interface Settings {
  office_title: string;
  office_lines: string[];
  network_name: string;
  call_sign: string;
  radio_frequency: string;
  report_title: string;
  logo_urls: string[];
}

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  position: string;
  role: Role;
  is_active: boolean;
  auth_user_id: string | null;
  last_sign_in_at: string | null;
}

export interface Report {
  id: string;
  report_at: string;
  prepared_by_name: string;
  prepared_by_position: string;
  remarks: string;
  weather_summary_override: string | null;
  wind_summary_override: string | null;
  rivers_summary_override: string | null;
  roads_summary_override: string | null;
  coastal_summary_override: string | null;
  status: ReportStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportEntry {
  id: string;
  report_id: string;
  barangay_id: string;
  barangay_name: string;
  callsign: string;
  zone_name: string;
  zone_sort: number;
  sort_order: number;
  monitors_coastal: boolean;
  responded: boolean;
  weather_option_id: string | null;
  wind_option_id: string | null;
  road: Road | null;
  river: Level | null;
  coastal: Level | null;
  power: Power | null;
  remarks: string | null;
  updated_at: string;
}

export interface ReportBundle {
  report: Report;
  entries: ReportEntry[];
}

export interface ReportSummary {
  total: number;
  active: number;
  noResponse: number;
  weather: string;
  wind: string;
  rivers: string;
  roads: string;
  coastal: string;
  power: string;
  hasIssues: boolean;
}
