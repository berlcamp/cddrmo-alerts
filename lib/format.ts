export const MANILA_TZ = 'Asia/Manila';

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, month: 'long', day: 'numeric', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric', year: 'numeric' });
const dayHeadingFmt = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: MANILA_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

function parts(fmt: Intl.DateTimeFormat, iso: string): Record<string, string> {
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

export function formatReportDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatMilitaryTime(iso: string): string {
  const p = parts(timeFmt, iso);
  return `${p.hour}${p.minute}H`;
}

export function formatReportHeading(iso: string): string {
  return `${formatReportDate(iso)} – ${formatMilitaryTime(iso)}`;
}

export function formatShortHeading(iso: string): string {
  return `${shortDateFmt.format(new Date(iso))} ${formatMilitaryTime(iso)}`;
}

export function formatClock(iso: string): string {
  const p = parts(timeFmt, iso);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function manilaDayKey(iso: string): string {
  const p = parts(dayKeyFmt, iso);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatDayHeading(dayKey: string): string {
  return dayHeadingFmt.format(new Date(`${dayKey}T12:00:00+08:00`));
}

export function toManilaInputValue(iso: string): string {
  const d = parts(dayKeyFmt, iso);
  const t = parts(timeFmt, iso);
  return `${d.year}-${d.month}-${d.day}T${t.hour}:${t.minute}`;
}

export function fromManilaInputValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Invalid date/time');
  return new Date(`${value}:00+08:00`).toISOString();
}
