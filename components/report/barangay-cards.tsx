import { Anchor, Route, Waves, Zap, ZapOff } from 'lucide-react';
import { LEVEL_LABEL, POWER_LABEL, ROAD_LABEL } from '@/lib/labels';
import type { ConditionLook } from '@/lib/map/conditions';
import { NONE } from '@/lib/summary';
import type { ReportEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ConditionLabel } from './condition-icon';
import { NoResponseLabel, StatusItem } from './entry-parts';

type Groups = { zone: string; entries: ReportEntry[] }[];

type Look = (id: string | null) => ConditionLook | null;

function BarangayCard({ entry, optionLabel, look, flash }: { entry: ReportEntry; optionLabel: (id: string | null) => string; look: Look; flash: boolean }) {
  const title = (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-lg font-bold">{entry.barangay_name}</h3>
      <span className="shrink-0 text-sm font-bold text-muted-foreground">{entry.callsign}</span>
    </div>
  );
  if (!entry.responded) {
    return (
      <article className={cn('rounded-xl border border-danger/30 bg-danger-soft p-4', flash && 'motion-safe:animate-flash')}>
        {title}
        <p className="mt-2"><NoResponseLabel /></p>
        {entry.remarks && <p className="mt-1 text-sm">{entry.remarks}</p>}
      </article>
    );
  }
  return (
    <article className={cn('rounded-xl border bg-card p-4', flash && 'motion-safe:animate-flash')}>
      {title}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-bold">
        <ConditionLabel look={look(entry.weather_option_id)} fallback={optionLabel(entry.weather_option_id)} />
        <ConditionLabel look={look(entry.wind_option_id)} fallback={optionLabel(entry.wind_option_id)} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <StatusItem label="Road" icon={Route} value={entry.road} text={entry.road ? ROAD_LABEL[entry.road] : NONE} />
        <StatusItem label="River / canal" icon={Waves} value={entry.river} text={entry.river ? LEVEL_LABEL[entry.river] : NONE} />
        {entry.monitors_coastal && (
          <StatusItem label="Coastal" icon={Anchor} value={entry.coastal} text={entry.coastal ? LEVEL_LABEL[entry.coastal] : NONE} />
        )}
        <StatusItem
          label="Power"
          icon={entry.power === 'no_power' ? ZapOff : Zap}
          value={entry.power}
          text={entry.power ? POWER_LABEL[entry.power] : NONE}
        />
      </dl>
      {entry.remarks && <p className="mt-3 text-sm text-muted-foreground">{entry.remarks}</p>}
    </article>
  );
}

export function BarangayCards({ groups, optionLabel, look, flashIds }: {
  groups: Groups;
  optionLabel: (id: string | null) => string;
  look: Look;
  flashIds: ReadonlySet<string>;
}) {
  return (
    <div className="space-y-6 lg:hidden">
      {groups.map((group) => (
        <section key={group.zone} aria-label={`${group.zone} barangays`}>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{group.zone}</h2>
          <ul className="space-y-3">
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <BarangayCard entry={entry} optionLabel={optionLabel} look={look} flash={flashIds.has(entry.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
