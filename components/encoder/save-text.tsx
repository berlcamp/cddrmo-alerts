import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReportSaveStatus } from '@/hooks/use-report-saver';

export function SaveText({ status }: { status: ReportSaveStatus }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden />Saving…</span>;
  if (status === 'saved') return <span className="flex items-center gap-1 text-sm text-ok"><Check className="size-4" aria-hidden />Saved</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-sm font-bold text-danger"><CircleAlert className="size-4" aria-hidden />Not saved</span>;
  return null;
}
