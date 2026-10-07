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
  /** fetchStartedAt: epoch ms when the snapshot was requested; live rows stamped later lose to the snapshot. */
  | { type: 'merge'; bundle: ReportBundle; fetchStartedAt: number }
  | { type: 'entry'; payload: ReportEntry | Deleted }
  | { type: 'report'; payload: Report | Deleted };

export function sortEntries(entries: ReportEntry[]): ReportEntry[] {
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  return [...entries].sort(
    (a, b) =>
      num(a.zone_sort) - num(b.zone_sort) ||
      num(a.sort_order) - num(b.sort_order) ||
      str(a.barangay_name).localeCompare(str(b.barangay_name)),
  );
}

export function initLiveState(bundle: ReportBundle): LiveState {
  return { report: bundle.report, entries: sortEntries(bundle.entries), deleted: false };
}

function isDeleted(payload: object): payload is Deleted {
  return (payload as Deleted).deleted === true;
}

function isObject(payload: unknown): payload is object {
  return typeof payload === 'object' && payload !== null;
}

function isOlder(incoming: string, current: string): boolean {
  return Date.parse(incoming) < Date.parse(current);
}

/** Keep the live copy only if it is newer than the snapshot and was stamped before the fetch began. */
function keepLive(live: { updated_at: string }, fetched: { updated_at: string }, fetchStartedAt: number): boolean {
  return isOlder(fetched.updated_at, live.updated_at) && Date.parse(live.updated_at) <= fetchStartedAt;
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'reset':
      return initLiveState(action.bundle);
    case 'merge': {
      const { bundle, fetchStartedAt } = action;
      if (bundle.report.id !== state.report.id) return initLiveState(bundle);
      const current = new Map(state.entries.map((e) => [e.id, e]));
      const entries = bundle.entries.map((fetched) => {
        const live = current.get(fetched.id);
        return live && keepLive(live, fetched, fetchStartedAt) ? live : fetched;
      });
      const report = keepLive(state.report, bundle.report, fetchStartedAt) ? state.report : bundle.report;
      return { report, entries: sortEntries(entries), deleted: false };
    }
    case 'entry': {
      const payload = action.payload;
      if (!isObject(payload)) return state;
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
      if (!isObject(payload) || payload.id !== state.report.id) return state;
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
