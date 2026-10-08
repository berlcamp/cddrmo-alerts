'use client';

import { Anchor, Bridge, CloudRain, MapPin, Route, Waves, WavesArrowUp, Wind, X, Zap, ZapOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, type ReactNode } from 'react';
import { LEVEL_LABEL, POWER_LABEL, ROAD_LABEL, summaryTone } from '@/lib/labels';
import { COASTAL_HIGH_SWATCH, NO_RESPONSE_SWATCH, UNPASSABLE_SWATCH, type ConditionLook } from '@/lib/map/conditions';
import { NONE } from '@/lib/summary';
import type { BarangayLocations, ConditionOption, ReportEntry, ReportSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ConditionDot, ConditionLabel } from '../condition-icon';
import { NoResponseLabel, StatusItem } from '../entry-parts';
import { StatusBadge } from '../status-badge';

// On desktop the map stretches to the height of the summary column beside it.
const MAP_HEIGHT = 'h-[460px] sm:h-[500px] lg:h-auto lg:min-h-[600px]';

function MapSkeleton() {
  return (
    <div className="flex size-full items-center justify-center bg-muted motion-safe:animate-pulse">
      <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground"><MapPin className="size-5" aria-hidden />Loading map…</p>
    </div>
  );
}

const BarangayMap = dynamic(() => import('./barangay-map'), { ssr: false, loading: MapSkeleton });

function DetailsPanel({ entry, look, onClose }: { entry: ReportEntry; look: (id: string | null) => ConditionLook | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="map-details-heading"
      className="absolute inset-x-2 bottom-2 z-[1000] max-h-[75%] overflow-y-auto rounded-xl border bg-card p-4 shadow-xl sm:inset-x-auto sm:left-3 sm:bottom-3 sm:w-80"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="map-details-heading" className="text-lg font-bold">{entry.barangay_name}</h3>
          <p className="text-sm text-muted-foreground">{entry.callsign} · {entry.zone_name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-mt-2 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {entry.responded ? (
        <>
          <div className="mt-3 grid gap-2 font-bold">
            <ConditionLabel look={look(entry.weather_option_id)} fallback="No weather reported" />
            <ConditionLabel look={look(entry.wind_option_id)} fallback="No wind reported" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <StatusItem label="Road" icon={entry.road === 'unpassable' ? Bridge : Route} value={entry.road} text={entry.road ? ROAD_LABEL[entry.road] : NONE} />
            <StatusItem label="River / canal" icon={Waves} value={entry.river} text={entry.river ? LEVEL_LABEL[entry.river] : NONE} />
            {entry.monitors_coastal && <StatusItem label="Coastal" icon={entry.coastal === 'above_normal' ? WavesArrowUp : Anchor} value={entry.coastal} text={entry.coastal ? LEVEL_LABEL[entry.coastal] : NONE} />}
            <StatusItem label="Power" icon={entry.power === 'no_power' ? ZapOff : Zap} value={entry.power} text={entry.power ? POWER_LABEL[entry.power] : NONE} />
          </dl>
        </>
      ) : (
        <p className="mt-3"><NoResponseLabel /></p>
      )}
      {entry.remarks && <p className="mt-3 text-sm text-muted-foreground">{entry.remarks}</p>}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-bold">{children}</dd>
    </div>
  );
}

function Legend({ options, look }: { options: ConditionOption[]; look: (id: string | null) => ConditionLook | null }) {
  const weather = options.filter((o) => o.kind === 'weather' && o.is_active);
  const wind = options.filter((o) => o.kind === 'wind' && o.is_active);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Weather (marker)</h3>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {weather.map((o) => (
            <li key={o.id} className="flex items-center gap-2"><ConditionDot look={look(o.id)} />{o.label}</li>
          ))}
          <li className="flex items-center gap-2"><ConditionDot swatch={NO_RESPONSE_SWATCH} icon={<X />} className="border-dashed" />No response</li>
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Wind (small badge)</h3>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {wind.map((o) => (
            <li key={o.id} className="flex items-center gap-2"><ConditionDot look={look(o.id)} />{o.label}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alerts (top-left badge)</h3>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <li className="flex items-center gap-2"><ConditionDot swatch={UNPASSABLE_SWATCH} icon={<Bridge />} />Unpassable road / bridge</li>
          <li className="flex items-center gap-2"><ConditionDot swatch={COASTAL_HIGH_SWATCH} icon={<WavesArrowUp />} />Coastal above normal</li>
        </ul>
      </div>
    </div>
  );
}

export function MapSection({ entries, locations, options, look, summary, selectedId, onSelect, flashIds }: {
  entries: ReportEntry[];
  locations: BarangayLocations;
  options: ConditionOption[];
  look: (id: string | null) => ConditionLook | null;
  summary: ReportSummary;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  flashIds: ReadonlySet<string>;
}) {
  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);
  const unmapped = entries.filter((e) => !locations[e.barangay_id]).length;
  const pct = summary.total ? Math.round((summary.active / summary.total) * 100) : 0;

  return (
    <section aria-labelledby="map-heading" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 id="map-heading" className="text-xl font-bold">Barangay conditions map</h2>
          <p className="text-sm text-muted-foreground">Tap a barangay to see its full report. Zoom in to show names.</p>
        </div>
        {unmapped > 0 && <p className="text-sm text-muted-foreground">{unmapped} barangay(s) have no map position yet.</p>}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cn('relative isolate', MAP_HEIGHT)}>
          <BarangayMap entries={entries} locations={locations} look={look} selectedId={selectedId} flashIds={flashIds} onSelect={onSelect} />
          {selected && <DetailsPanel entry={selected} look={look} onClose={() => onSelect(null)} />}
        </div>
        <aside aria-label="Summary and legend" className="space-y-5 border-t p-4 lg:border-t-0 lg:border-l">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Active stations</h3>
              <p className="text-2xl font-bold tabular">{summary.active}<span className="text-base text-muted-foreground"> / {summary.total}</span></p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Stations that responded" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-ok transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
            </div>
            {summary.noResponse > 0 && <p className="mt-1.5 text-sm font-bold text-danger">{summary.noResponse} with no response</p>}
          </div>
          <dl className="divide-y border-y">
            <SummaryRow label="Average weather"><CloudRain className="mr-1.5 inline size-4 align-[-2px]" aria-hidden />{summary.weather}</SummaryRow>
            <SummaryRow label="Average wind"><Wind className="mr-1.5 inline size-4 align-[-2px]" aria-hidden />{summary.wind}</SummaryRow>
            <SummaryRow label="Rivers / canals"><StatusBadge tone={summaryTone(summary.rivers)} label={summary.rivers} icon={Waves} /></SummaryRow>
            <SummaryRow label="Roads / bridges"><StatusBadge tone={summaryTone(summary.roads)} label={summary.roads} icon={Route} /></SummaryRow>
            <SummaryRow label="Coastal"><StatusBadge tone={summaryTone(summary.coastal)} label={summary.coastal} icon={Anchor} /></SummaryRow>
            <SummaryRow label="Power"><StatusBadge tone={summaryTone(summary.power)} label={summary.power} icon={Zap} /></SummaryRow>
          </dl>
          <Legend options={options} look={look} />
        </aside>
      </div>
    </section>
  );
}
