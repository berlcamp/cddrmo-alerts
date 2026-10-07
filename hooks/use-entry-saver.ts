'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionResult } from '@/lib/action-result';
import { backoffDelay } from '@/lib/backoff';
import { mergePatch, omitKey } from '@/lib/encoder-patches';
import type { ReportEntry } from '@/lib/types';
import type { EntryPatch } from '@/lib/validation';

export interface SaveState {
  state: 'saving' | 'saved' | 'failed';
  message?: string;
}

type SaveFn = (id: string, patch: EntryPatch) => Promise<ActionResult<ReportEntry>>;

export function useEntrySaver(save: SaveFn, onSaved: (entry: ReportEntry) => void) {
  const [pending, setPending] = useState<Record<string, EntryPatch>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const queued = useRef(new Map<string, EntryPatch>());
  const inFlight = useRef(new Set<string>());
  const attempts = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const unmounted = useRef(false);

  const flush = useCallback(
    async function run(id: string): Promise<void> {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      if (inFlight.current.has(id)) return;
      const patch = queued.current.get(id);
      if (!patch) return;
      queued.current.delete(id);
      inFlight.current.add(id);
      setStates((s) => ({ ...s, [id]: { state: 'saving' } }));

      let result: ActionResult<ReportEntry>;
      try {
        result = await save(id, patch);
      } catch {
        result = { ok: false, message: 'No connection. Retrying…', retryable: true };
      }
      inFlight.current.delete(id);
      if (unmounted.current) return;

      if (result.ok) {
        attempts.current.delete(id);
        onSaved(result.data);
        if (queued.current.has(id)) {
          void run(id);
          return;
        }
        setPending((p) => omitKey(p, id));
        setStates((s) => ({ ...s, [id]: { state: 'saved' } }));
        return;
      }

      const message = result.message;
      queued.current.set(id, mergePatch(patch, queued.current.get(id) ?? {}));
      setStates((s) => ({ ...s, [id]: { state: 'failed', message } }));
      if (result.retryable) {
        const attempt = attempts.current.get(id) ?? 0;
        attempts.current.set(id, attempt + 1);
        timers.current.set(id, setTimeout(() => void run(id), backoffDelay(attempt)));
      }
    },
    [save, onSaved],
  );

  const update = useCallback(
    (id: string, patch: EntryPatch) => {
      queued.current.set(id, mergePatch(queued.current.get(id), patch));
      setPending((p) => ({ ...p, [id]: mergePatch(p[id], patch) }));
      attempts.current.delete(id);
      void flush(id);
    },
    [flush],
  );

  const retry = useCallback(
    (id: string) => {
      attempts.current.delete(id);
      void flush(id);
    },
    [flush],
  );

  const discard = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    queued.current.delete(id);
    setPending((p) => omitKey(p, id));
    setStates((s) => omitKey(s, id));
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      pendingTimers.forEach(clearTimeout);
    };
  }, []);

  return { pending, states, update, retry, discard, hasUnsaved: Object.keys(pending).length > 0 };
}
