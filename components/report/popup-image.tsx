'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const DELAY_MS = 3000;

/** Opens the pop-up image from Settings a few seconds after each page load. */
export function PopupImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Preload while waiting so the modal never opens on a half-drawn image.
  useEffect(() => {
    const image = new Image();
    image.onload = () => setLoaded(true);
    image.src = src;
    const timer = window.setTimeout(() => setElapsed(true), DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      image.onload = null;
    };
  }, [src]);

  return (
    <Dialog open={loaded && elapsed && !dismissed} onOpenChange={(open) => !open && setDismissed(true)}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] gap-0 sm:w-auto overflow-hidden bg-card p-0 sm:max-w-3xl [&_[data-slot=dialog-close]]:bg-black/50 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-black/70">
        <DialogTitle className="sr-only">{alt || 'Announcement'}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote image from the public storage bucket */}
        <img src={src} alt={alt} className="mx-auto block h-auto max-h-[85vh] w-full max-w-full object-contain sm:w-auto" />
      </DialogContent>
    </Dialog>
  );
}
