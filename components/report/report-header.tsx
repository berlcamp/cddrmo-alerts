import Image from 'next/image';
import type { Settings } from '@/lib/types';

export function ReportHeader({ settings }: { settings: Settings }) {
  return (
    <header className="bg-brand text-brand-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:gap-4">
        <Image
          src="/ozamiz_seal.jpg"
          alt="Official seal of the City of Ozamiz"
          width={1426}
          height={1440}
          sizes="64px"
          preload
          className="size-12 shrink-0 rounded-full bg-white object-contain sm:size-14"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide">{settings.office_title}</p>
          {settings.office_lines.map((line) => (
            <p key={line} className="hidden text-sm opacity-90 sm:block">{line}</p>
          ))}
          <p className="text-sm opacity-90">
            {settings.network_name} · Call sign: {settings.call_sign} · {settings.radio_frequency}
          </p>
        </div>
      </div>
    </header>
  );
}
