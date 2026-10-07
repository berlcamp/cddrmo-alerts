'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { updateReport } from '@/lib/actions/report-actions';
import { fail, type ActionResult } from '@/lib/action-result';
import { backoffDelay } from '@/lib/backoff';
import type { Report } from '@/lib/types';
import type { ReportPatch } from '@/lib/validation';

export type ReportSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Report-level saver: merges rapid edits, one request at a time, retries with backoff. */
export function useReportSaver(reportId: string, onSaved: (report: Report) => void) {
  const [status, setStatus] = useState<ReportSaveStatus>('idle');
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const queued = useRef<ReportPatch | null>(null);
  const inFlight = useRef(false);
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unmounted = useRef(false);

  const flush = useCallback(
    async function run(): Promise<void> {
      clearTimeout(timer.current);
      timer.current = undefined;
      if (inFlight.current || unmounted.current) return;
      const patch = queued.current;
      if (!patch) return;
      queued.current = null;
      inFlight.current = true;
      setStatus('saving');

      let result: ActionResult<Report>;
      try {
        result = await updateReport(reportId, patch);
      } catch {
        result = fail('No connection. Your change was not saved — try again.', true);
      }
      inFlight.current = false;
      if (unmounted.current) return;

      if (result.ok) {
        attempts.current = 0;
        onSaved(result.data);
        if (queued.current) {
          void run();
          return;
        }
        setHasUnsaved(false);
        setStatus('saved');
        return;
      }

      queued.current = { ...patch, ...(queued.current ?? {}) };
      setStatus('error');
      if (result.retryable) {
        const attempt = attempts.current;
        attempts.current = attempt + 1;
        timer.current = setTimeout(() => void run(), backoffDelay(attempt));
      } else {
        toast.error(result.message);
      }
    },
    [reportId, onSaved],
  );

  const save = useCallback(
    async (patch: ReportPatch) => {
      queued.current = { ...(queued.current ?? {}), ...patch };
      attempts.current = 0;
      setHasUnsaved(true);
      await flush();
    },
    [flush],
  );

  const retry = useCallback(() => {
    attempts.current = 0;
    void flush();
  }, [flush]);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      clearTimeout(timer.current);
    };
  }, []);

  return { save, status, hasUnsaved, retry };
}
