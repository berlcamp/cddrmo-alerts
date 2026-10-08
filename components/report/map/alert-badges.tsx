import { Bridge, RouteOff, WavesArrowUp, ZapOff } from 'lucide-react';
import { COASTAL_HIGH_SWATCH, NO_POWER_SWATCH, UNPASSABLE_SWATCH, type Swatch } from '@/lib/map/conditions';
import { cn } from '@/lib/utils';

const BADGE = 'inline-flex shrink-0 items-center justify-center gap-px rounded-full border [&>svg]:size-[11px]';

function Badge({ swatch, className, children }: { swatch: Swatch; className?: string; children: React.ReactNode }) {
  return (
    <span aria-hidden className={cn(BADGE, className)} style={{ backgroundColor: swatch.bg, color: swatch.fg, borderColor: swatch.border }}>
      {children}
    </span>
  );
}

/** Unpassable roads and bridges share one field, so one red pill shows both icons. */
export function UnpassableBadge({ className }: { className?: string }) {
  return <Badge swatch={UNPASSABLE_SWATCH} className={cn('h-4 px-0.5', className)}><RouteOff strokeWidth={2.5} /><Bridge strokeWidth={2.5} /></Badge>;
}

export function CoastalHighBadge({ className }: { className?: string }) {
  return <Badge swatch={COASTAL_HIGH_SWATCH} className={cn('size-4', className)}><WavesArrowUp strokeWidth={2.5} /></Badge>;
}

export function NoPowerBadge({ className }: { className?: string }) {
  return <Badge swatch={NO_POWER_SWATCH} className={cn('size-4', className)}><ZapOff strokeWidth={2.5} /></Badge>;
}
