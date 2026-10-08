import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudRainWind, Minus, Sun, Wind } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ConditionLook, Swatch } from '@/lib/map/conditions';
import { cn } from '@/lib/utils';

/** The icon for a weather or wind look: weather icons step up with severity, wind always uses the wind icon. */
export function ConditionGlyph({ look, className }: { look: ConditionLook | null; className?: string }) {
  const props = { className, strokeWidth: 2.25, 'aria-hidden': true } as const;
  if (!look) return <Minus {...props} />;
  if (look.kind === 'wind') return <Wind {...props} />;
  switch (look.level) {
    case 0:
      return <Sun {...props} />;
    case 1:
      return <Cloud {...props} />;
    case 2:
      return <CloudDrizzle {...props} />;
    case 3:
      return <CloudRain {...props} />;
    case 4:
      return <CloudRainWind {...props} />;
    default:
      return <CloudLightning {...props} />;
  }
}

/** Round colour swatch with the condition's icon; decorative, so pair it with a text label. */
export function ConditionDot({ look, swatch, icon, className }: { look?: ConditionLook | null; swatch?: Swatch; icon?: ReactNode; className?: string }) {
  const colors = swatch ?? look ?? { bg: 'var(--muted)', fg: 'var(--muted-foreground)', border: 'var(--border)' };
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full border [&>svg]:size-[60%]', className)}
      style={{ backgroundColor: colors.bg, color: colors.fg, borderColor: colors.border }}
    >
      {icon ?? <ConditionGlyph look={look ?? null} />}
    </span>
  );
}

export function ConditionLabel({ look, fallback }: { look: ConditionLook | null; fallback: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ConditionDot look={look} />
      <span className="whitespace-nowrap">{look?.label ?? fallback}</span>
    </span>
  );
}
