'use client';

import { ListPlus } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { addMissingBarangays } from '@/lib/actions/report-actions';

export function MissingBarangaysButton({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      className="h-11 cursor-pointer"
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await addMissingBarangays(reportId);
            if (!result.ok) toast.error(result.message);
            else toast.success(result.data === 0 ? 'All active barangays are already in this report.' : `${result.data} barangay(s) added.`);
          } catch {
            toast.error('No connection. Try again.');
          }
        })
      }
    >
      <ListPlus aria-hidden /> Add missing barangays
    </Button>
  );
}
