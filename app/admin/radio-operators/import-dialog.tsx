'use client';

import { CircleAlert, Download, FileUp, Upload } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { RowTag } from '@/components/admin/parts';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { IMPORT_LIMIT, planImport, type ImportPlan } from '@/lib/operator-import';
import type { Barangay, RadioOperator } from '@/lib/types';
import { cn } from '@/lib/utils';
import { importOperators } from './actions';

const TEMPLATE = 'Barangay,Name of Operator,Status,Callsign,Contact Number,Position\nGala,Juan Dela Cruz,Active,Golf 2,0917 123 4567,BDRRM Officer\n';
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
const FIELD_LABEL = { barangay: 'Barangay', name: 'Name of Operator' } as const;

export function ImportDialog({ barangays, operators }: { barangays: Barangay[]; operators: RadioOperator[] }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setFileName(null);
    setPlan(null);
    setReadError(null);
  };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    try {
      setPlan(planImport(await file.text(), barangays, operators));
    } catch {
      setReadError("Couldn't read that file. Save it from Excel or Google Sheets as CSV and try again.");
    }
  };

  const ready = plan?.rows.filter((r) => r.data) ?? [];
  const problems = plan?.rows.filter((r) => r.error) ?? [];
  const updates = ready.filter((r) => r.existingId).length;
  const tooMany = ready.length > IMPORT_LIMIT;

  const runImport = () =>
    startTransition(async () => {
      try {
        const result = await importOperators(ready.map((r) => r.data));
        if (!result.ok) return void toast.error(result.message);
        const { added, updated } = result.data;
        toast.success(`Imported ${added} new ${added === 1 ? 'operator' : 'operators'}${updated ? `, updated ${updated}` : ''}`);
        setOpen(false);
        reset();
      } catch {
        toast.error("Couldn't import. Check your connection and try again.");
      }
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 cursor-pointer')}>
        <Upload aria-hidden /> Import CSV
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Import radio operators</DialogTitle>
          <DialogDescription>
            Columns: Barangay, Name of Operator, Status, Callsign, Contact Number, Position, in any order. Only Barangay and Name are required; a blank
            status means Active. A row with the same barangay and name as an existing operator updates that operator.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <label className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer focus-within:ring-3 focus-within:ring-ring/50')}>
            <FileUp aria-hidden /> {fileName ? 'Choose another file' : 'Choose CSV file'}
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => onFile(event.target.files?.[0])} />
          </label>
          <a href={TEMPLATE_HREF} download="radio-operators-template.csv" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
            <Download className="size-4" aria-hidden /> Download a template
          </a>
        </div>
        {fileName && <p className="text-sm text-muted-foreground">File: <span className="font-bold text-foreground">{fileName}</span></p>}

        {readError && <p role="alert" className="text-sm font-bold text-danger">{readError}</p>}

        {plan && plan.missingColumns.length > 0 && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
            The file needs a {plan.missingColumns.map((f) => `“${FIELD_LABEL[f as keyof typeof FIELD_LABEL]}”`).join(' and ')} column in the first row.
          </p>
        )}

        {plan && plan.missingColumns.length === 0 && plan.rows.length === 0 && (
          <p role="alert" className="text-sm font-bold text-danger">The file has a header row but no operators.</p>
        )}

        {plan && plan.rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5" aria-live="polite">
              {ready.length - updates > 0 && <RowTag label={`${ready.length - updates} to add`} className="bg-ok-soft text-ok" />}
              {updates > 0 && <RowTag label={`${updates} to update`} className="bg-primary/10 text-primary" />}
              {problems.length > 0 && <RowTag icon={CircleAlert} label={`${problems.length} skipped`} className="bg-danger-soft text-danger" />}
            </div>

            {problems.length > 0 && (
              <div className="rounded-lg border border-danger/40 p-3">
                <p className="mb-1 font-bold text-danger">These rows will be skipped</p>
                <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                  {problems.map((r) => (
                    <li key={r.line}><span className="font-bold tabular">Line {r.line}:</span> {r.error}</li>
                  ))}
                </ul>
              </div>
            )}

            {ready.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Operators that will be imported</caption>
                  <thead className="sticky top-0 bg-muted text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2">Barangay</th>
                      <th scope="col" className="px-3 py-2">Name</th>
                      <th scope="col" className="hidden px-3 py-2 sm:table-cell">Callsign</th>
                      <th scope="col" className="hidden px-3 py-2 sm:table-cell">Contact</th>
                      <th scope="col" className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ready.map((r) => (
                      <tr key={r.line}>
                        <td className="px-3 py-1.5">{r.barangayLabel}</td>
                        <td className="px-3 py-1.5 font-bold">
                          {r.data!.name}
                          {r.existingId && <span className="ml-1.5 text-xs font-normal text-primary">update</span>}
                        </td>
                        <td className="hidden px-3 py-1.5 sm:table-cell">{r.data!.callsign || '—'}</td>
                        <td className="hidden px-3 py-1.5 tabular sm:table-cell">{r.data!.contact_number || '—'}</td>
                        <td className="px-3 py-1.5 capitalize">{r.data!.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tooMany && <p role="alert" className="text-sm font-bold text-danger">Import at most {IMPORT_LIMIT} operators at a time. Split the file and try again.</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" className="h-11 cursor-pointer" disabled={pending || ready.length === 0 || tooMany} onClick={runImport}>
            {pending ? 'Importing…' : ready.length > 0 ? `Import ${ready.length} ${ready.length === 1 ? 'operator' : 'operators'}` : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
