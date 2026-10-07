'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Common = { value: string | null; onCommit: (value: string) => void };

/** Local draft while typing; commits on blur; adopts new server values (e.g. another encoder's edit). */
function useDraft(value: string | null) {
  const [draft, setDraft] = useState(value ?? '');
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value ?? '');
  }
  return [draft, setDraft] as const;
}

export function BlurInput({ value, onCommit, className, ...props }: Common & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useDraft(value);
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? '')) onCommit(draft);
      }}
      className={cn('h-11', className)}
    />
  );
}

export function BlurTextarea({ value, onCommit, ...props }: Common & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useDraft(value);
  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? '')) onCommit(draft);
      }}
    />
  );
}
