import type { Metadata } from 'next';
import { currentMonthKey, isMonthKey, monthDays } from '@/lib/attendance';
import { requireStaff } from '@/lib/auth';
import { listAttendance, listBarangays, listRadioOperators } from '@/lib/data/admin';
import { manilaDayKey } from '@/lib/format';
import { AttendanceGrid } from './attendance-grid';

export const metadata: Metadata = { title: 'Operator attendance' };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireStaff();
  const requested = (await searchParams).month ?? '';
  const month = isMonthKey(requested) ? requested : currentMonthKey();
  const days = monthDays(month);
  const [barangays, operators, attendance] = await Promise.all([
    listBarangays(),
    listRadioOperators(),
    listAttendance(month, days[days.length - 1].key),
  ]);
  const marked = new Set(attendance.map((a) => a.operator_id));
  // Inactive operators only appear for months they have attendance in.
  const shown = operators.filter((o) => o.status === 'active' || marked.has(o.id));
  const barangayNames = Object.fromEntries(barangays.map((b) => [b.id, b.name]));
  return (
    <AttendanceGrid
      key={month}
      month={month}
      today={manilaDayKey(new Date().toISOString())}
      operators={shown}
      barangayNames={barangayNames}
      present={attendance.map((a) => `${a.operator_id}|${a.day}`)}
    />
  );
}
