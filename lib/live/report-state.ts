import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export interface LiveState {
  report: Report;
  entries: ReportEntry[];
  deleted: boolean;
}

export interface Deleted {
  id: string;
  deleted: true;
}

export type LiveAction =
  | { type: 'reset'; bundle: ReportBundle }
  | { type: 'entry'; payload: ReportEntry | Deleted }
  | { type: 'report'; payload: Report | Deleted };

export function sortEntries(entries: ReportEntry[]): ReportEntry[] {
  return [...entries].sort(
    (a, b) => a.zone_sort - b.zone_sort || a.sort_order - b.sort_order || a.barangay_name.localeCompare(b.barangay_name),
  );
}

export function initLiveState(bundle: ReportBundle): LiveState {
  return { report: bundle.report, entries: sortEntries(bundle.entries), deleted: false };
}

function isDeleted(payload: object): payload is Deleted {
  return (payload as Deleted).deleted === true;
}

function isOlder(incoming: string, current: string): boolean {
  return Date.parse(incoming) < Date.parse(current);
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'reset':
      return initLiveState(action.bundle);
    case 'entry': {
      const payload = action.payload;
      if (isDeleted(payload)) {
        return { ...state, entries: state.entries.filter((e) => e.id !== payload.id) };
      }
      if (payload.report_id !== state.report.id) return state;
      const current = state.entries.find((e) => e.id === payload.id);
      if (current && isOlder(payload.updated_at, current.updated_at)) return state;
      return { ...state, entries: sortEntries([...state.entries.filter((e) => e.id !== payload.id), payload]) };
    }
    case 'report': {
      const payload = action.payload;
      if (payload.id !== state.report.id) return state;
      if (isDeleted(payload)) return { ...state, deleted: true };
      if (isOlder(payload.updated_at, state.report.updated_at)) return state;
      return { ...state, report: payload };
    }
  }
}

export function lastUpdatedAt(bundle: { report: Report; entries: ReportEntry[] }): string {
  return [bundle.report.updated_at, ...bundle.entries.map((e) => e.updated_at)].reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
}
