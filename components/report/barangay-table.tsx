import { LEVEL_LABEL, POWER_LABEL, ROAD_LABEL, valueTone } from '@/lib/labels';
import { NONE } from '@/lib/summary';
import type { Level, Power, ReportEntry, Road } from '@/lib/types';
import { cn } from '@/lib/utils';
import { NoResponseLabel } from './entry-parts';
import { StatusBadge } from './status-badge';

type Groups = { zone: string; entries: ReportEntry[] }[];
const HEADERS = ['No.', 'Barangay', 'Callsign', 'Weather', 'Wind', 'Road', 'River / Canal', 'Coastal', 'Power', 'Remarks'];

function Status({ value, text }: { value: Road | Level | Power | null; text: string }) {
  return <StatusBadge tone={valueTone(value)} label={text} />;
}

export function BarangayTable({ groups, optionLabel, flashIds, numbers }: {
  groups: Groups;
  optionLabel: (id: string | null) => string;
  flashIds: ReadonlySet<string>;
  numbers: Map<string, number>;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border bg-card lg:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Barangay weather situation</caption>
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {HEADERS.map((h) => (
              <th key={h} scope="col" className="px-3 py-3 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.zone} className="divide-y">
            <tr className="bg-brand/5">
              <th colSpan={HEADERS.length} scope="colgroup" className="px-3 py-2 text-xs font-bold uppercase tracking-wider">
                {group.zone}
              </th>
            </tr>
            {group.entries.map((e) => (
              <tr key={e.id} className={cn(!e.responded && 'bg-danger-soft', flashIds.has(e.id) && 'motion-safe:animate-flash')}>
                <td className="px-3 py-2.5 tabular text-muted-foreground">{numbers.get(e.id)}</td>
                <th scope="row" className="px-3 py-2.5 font-bold">{e.barangay_name}</th>
                <td className="px-3 py-2.5">{e.callsign}</td>
                {e.responded ? (
                  <>
                    <td className="px-3 py-2.5">{optionLabel(e.weather_option_id)}</td>
                    <td className="px-3 py-2.5">{optionLabel(e.wind_option_id)}</td>
                    <td className="px-3 py-2.5"><Status value={e.road} text={e.road ? ROAD_LABEL[e.road] : NONE} /></td>
                    <td className="px-3 py-2.5"><Status value={e.river} text={e.river ? LEVEL_LABEL[e.river] : NONE} /></td>
                    <td className="px-3 py-2.5">
                      {e.monitors_coastal ? <Status value={e.coastal} text={e.coastal ? LEVEL_LABEL[e.coastal] : NONE} /> : <span className="text-muted-foreground">n/a</span>}
                    </td>
                    <td className="px-3 py-2.5"><Status value={e.power} text={e.power ? POWER_LABEL[e.power] : NONE} /></td>
                  </>
                ) : (
                  <td colSpan={6} className="px-3 py-2.5"><NoResponseLabel /></td>
                )}
                <td className="px-3 py-2.5">{e.remarks}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
