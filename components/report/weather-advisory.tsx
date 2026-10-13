import { TriangleAlert } from 'lucide-react';
import { formatShortHeading } from '@/lib/format';
import type { Settings } from '@/lib/types';

/** The weather advisory staff post from Options › Weather; renders nothing while none is set. */
export function WeatherAdvisory({ settings }: { settings: Settings }) {
  const text = settings.weather_advisory?.trim();
  if (!text) return null;
  const updatedAt = settings.weather_advisory_updated_at;
  return (
    <aside aria-labelledby="weather-advisory-title" className="border-b border-warn/30 bg-warn-soft text-foreground">
      <div className="mx-auto flex max-w-6xl gap-3 px-4 py-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <div className="min-w-0">
          <p id="weather-advisory-title" className="text-sm font-bold uppercase tracking-wide text-warn">
            Weather advisory
            {updatedAt && <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">Posted {formatShortHeading(updatedAt)}</span>}
          </p>
          <p className="whitespace-pre-line break-words">{text}</p>
        </div>
      </div>
    </aside>
  );
}
