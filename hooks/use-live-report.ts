'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { parseEntryPayload, parseReportPayload } from '@/lib/live/payloads';
import { initLiveState, lastUpdatedAt, liveReducer } from '@/lib/live/report-state';
import { getBrowserClient } from '@/lib/supabase/browser';
import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

const FLASH_MS = 1500;

/** staff: listen on the staff-only topic, which also carries draft changes. */
export function useLiveReport(initial: ReportBundle, { staff = false }: { staff?: boolean } = {}) {
  const [state, dispatch] = useReducer(liveReducer, initial, initLiveState);
  const seenInitial = useRef(initial);
  useEffect(() => {
    if (seenInitial.current === initial) return;
    // New server snapshot (router.refresh or navigation): adopt it. Live rows stamped after now lose to it.
    seenInitial.current = initial;
    dispatch({ type: 'merge', bundle: initial, fetchStartedAt: Date.now() });
  }, [initial]);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reportId = state.report.id;

  const flash = useCallback((id: string) => {
    setFlashIds((prev) => new Set(prev).add(id));
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        setFlashIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, FLASH_MS),
    );
  }, []);

  const resync = useCallback(async () => {
    try {
      const fetchStartedAt = Date.now();
      const bundle = await fetchReportBundle(getBrowserClient(), reportId);
      if (bundle) dispatch({ type: 'merge', bundle, fetchStartedAt });
      else dispatch({ type: 'report', payload: { id: reportId, deleted: true } });
    } catch {
      // Keep showing current data; the status indicator tells the viewer we're reconnecting.
    }
  }, [reportId]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`${staff ? 'cdrrmo-staff' : 'cdrrmo'}:report:${reportId}`, { config: { private: true } })
      .on('broadcast', { event: 'entry' }, ({ payload }) => {
        const entry = parseEntryPayload(payload);
        if (!entry) return; // malformed or future-dated: ignore
        dispatch({ type: 'entry', payload: entry });
        if (!('deleted' in entry)) flash(entry.id);
      })
      .on('broadcast', { event: 'report' }, ({ payload }) => {
        const report = parseReportPayload(payload);
        if (report) dispatch({ type: 'report', payload: report });
      });
    let removed = false;
    const subscribe = () => {
      if (removed) return;
      channel.subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('live');
          void resync(); // catch anything that changed between server render and subscribe
        } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
          setStatus('reconnecting');
        }
      });
    };
    // The staff topic needs the signed-in user's JWT on the socket, or the join is checked as anon and refused.
    if (staff) void supabase.realtime.setAuth().then(subscribe, subscribe);
    else subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void resync();
    };
    const onOnline = () => void resync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const pending = timers.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      pending.forEach(clearTimeout);
      removed = true;
      void supabase.removeChannel(channel);
    };
  }, [reportId, staff, resync, flash]);

  const applyEntry = useCallback((entry: ReportEntry) => dispatch({ type: 'entry', payload: entry }), []);
  const applyReport = useCallback((report: Report) => dispatch({ type: 'report', payload: report }), []);
  const lastUpdated = useMemo(() => lastUpdatedAt(state), [state]);

  return {
    report: state.report,
    entries: state.entries,
    deleted: state.deleted,
    status,
    lastUpdated,
    flashIds,
    applyEntry,
    applyReport,
  };
}
