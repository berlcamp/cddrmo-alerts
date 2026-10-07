import { Radio } from 'lucide-react';

export function NoReports() {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <Radio className="mx-auto mb-3 size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">No netcall reports yet</h1>
      <p className="mt-2 text-muted-foreground">The first Barangay Weather SitRep will appear here as soon as the radio controller starts it.</p>
    </div>
  );
}
