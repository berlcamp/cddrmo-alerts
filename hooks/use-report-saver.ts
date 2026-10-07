'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { updateReport } from '@/lib/actions/report-actions';
import { fail, type ActionResult } from '@/lib/action-result';
import type { Report } from '@/lib/types';
import type { ReportPatch } from '@/lib/validation';

export type ReportSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useReportSaver(reportId: string, onSaved: (report: Report) => void) {
  const [status, setStatus] = useState<ReportSaveStatus>('idle');
  const save = useCallback(
    async (patch: ReportPatch) => {
      setStatus('saving');
      let result: ActionResult<Report>;
      try {
        result = await updateReport(reportId, patch);
      } catch {
        result = fail('No connection. Your change was not saved — try again.', true);
      }
      if (result.ok) {
        onSaved(result.data);
        setStatus('saved');
      } else {
        setStatus('error');
        toast.error(result.message);
      }
    },
    [reportId, onSaved],
  );
  return { save, status };
}
