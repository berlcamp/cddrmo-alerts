'use client';

import { useEffect, useState } from 'react';
import { parseReportsChanged } from '@/lib/live/payloads';
import { getBrowserClient } from '@/lib/supabase/browser';

interface NewerReport {
  forId: string;
  id: string;
  report_at: string;
}

export function useNewerReport(currentId: string, currentReportAt: string): { id: string; report_at: string } | null {
  const [newer, setNewer] = useState<NewerReport | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel('cdrrmo:reports', { config: { private: true } })
      .on('broadcast', { event: 'reports_changed' }, ({ payload }) => {
        const p = parseReportsChanged(payload);
        if (!p) return;
        if (p.op !== 'DELETE' && p.id !== currentId && Date.parse(p.report_at) > Date.parse(currentReportAt)) {
          setNewer({ forId: currentId, id: p.id, report_at: p.report_at });
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentId, currentReportAt]);

  return newer && newer.forId === currentId ? { id: newer.id, report_at: newer.report_at } : null;
}
