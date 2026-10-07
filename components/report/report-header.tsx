import { Radio } from 'lucide-react';
import type { Settings } from '@/lib/types';

export function ReportHeader({ settings }: { settings: Settings }) {
  return (
    <header className="bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
        <div className="flex shrink-0 items-center gap-2">
          {settings.logo_urls.length > 0 ? (
            settings.logo_urls.slice(0, 4).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- remote logos from the public storage bucket
              <img key={url} src={url} alt="" width={44} height={44} className="size-11 rounded-full bg-white object-contain" />
            ))
          ) : (
            <Radio className="size-10" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide">{settings.office_title}</p>
          {settings.office_lines.map((line) => (
            <p key={line} className="hidden text-sm opacity-90 sm:block">{line}</p>
          ))}
          <p className="text-xs opacity-80">
            {settings.network_name} · Call sign: {settings.call_sign} · {settings.radio_frequency}
          </p>
        </div>
      </div>
    </header>
  );
}
