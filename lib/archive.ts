import { manilaDayKey } from './format';

export function groupArchiveByDay<T extends { report: { report_at: string } }>(items: T[]): { day: string; items: T[] }[] {
  const days: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = manilaDayKey(item.report.report_at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}
