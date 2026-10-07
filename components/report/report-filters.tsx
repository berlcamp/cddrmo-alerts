'use client';

import { cn } from '@/lib/utils';

export function ReportFilters({ zones, zone, onZoneChange, issuesOnly, onIssuesOnlyChange }: {
  zones: string[];
  zone: string;
  onZoneChange: (zone: string) => void;
  issuesOnly: boolean;
  onIssuesOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Filter by zone" className="flex flex-wrap gap-2">
        {['all', ...zones].map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={zone === z}
            onClick={() => onZoneChange(z)}
            className={cn(
              'min-h-11 cursor-pointer rounded-full border px-4 text-sm font-bold transition-colors duration-150',
              zone === z ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            {z === 'all' ? 'All' : z}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold sm:ml-auto">
        <input
          type="checkbox"
          checked={issuesOnly}
          onChange={(e) => onIssuesOnlyChange(e.target.checked)}
          className="size-5 accent-primary"
        />
        Issues only
      </label>
    </div>
  );
}
