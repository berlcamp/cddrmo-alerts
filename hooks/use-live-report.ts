'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { initLiveState, lastUpdatedAt, liveReducer, type Deleted } from '@/lib/live/report-state';
import { getBrowserClient } from '@/lib/supabase/browser';
import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

const FLASH_MS = 1500;

export function useLiveReport(initial: ReportBundle) {
  const [state, dispatch] = useReducer(liveReducer, initial, initLiveState);
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    // New server snapshot (router.refresh or navigation): adopt it.
    setSeenInitial(initial);
    dispatch({ type: 'reset', bundle: initial });
  }

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
      const bundle = await fetchReportBundle(getBrowserClient(), reportId);
      if (bundle) dispatch({ type: 'reset', bundle });
      else dispatch({ type: 'report', payload: { id: reportId, deleted: true } });
    } catch {
      // Keep showing current data; the status indicator tells the viewer we're reconnecting.
    }
  }, [reportId]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`cdrrmo:report:${reportId}`)
      .on('broadcast', { event: 'entry' }, ({ payload }) => {
        const entry = payload as ReportEntry | Deleted;
        dispatch({ type: 'entry', payload: entry });
        if (!('deleted' in entry)) flash(entry.id);
      })
      .on('broadcast', { event: 'report' }, ({ payload }) => {
        dispatch({ type: 'report', payload: payload as Report | Deleted });
      })
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('live');
          void resync(); // catch anything that changed between server render and subscribe
        } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT' || channelStatus === 'CLOSED') {
          setStatus('reconnecting');
        }
      });

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
      void supabase.removeChannel(channel);
    };
  }, [reportId, resync, flash]);

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
