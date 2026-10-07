import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getReferenceData, getReportBundle } from '@/lib/data/public';
import { formatReportHeading } from '@/lib/format';
import { summaryTone, type Tone } from '@/lib/labels';
import { summarizeReport } from '@/lib/summary';

const TONE_COLORS: Record<Tone, [string, string]> = {
  ok: ['#dcfce7', '#15803d'],
  warn: ['#fef3c7', '#b45309'],
  danger: ['#fee2e2', '#b91c1c'],
  none: ['#e2e8f0', '#475569'],
};

function Pill({ label, value }: { label: string; value: string }) {
  const [bg, fg] = TONE_COLORS[summaryTone(value)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px 22px', borderRadius: 18, background: bg, color: fg }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, { options, settings }] = await Promise.all([getReportBundle(id), getReferenceData()]);
  if (!bundle) return new Response('Not found', { status: 404 });

  const summary = summarizeReport(bundle.report, bundle.entries, options);
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/AtkinsonHyperlegible-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/AtkinsonHyperlegible-Bold.ttf')),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#020617', fontFamily: 'Atkinson' }}>
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#ffffff', padding: '28px 48px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>CDRRMO · CITY OF OZAMIZ</div>
          <div style={{ fontSize: 46, fontWeight: 700 }}>{settings.report_title}</div>
          <div style={{ fontSize: 30 }}>{formatReportHeading(bundle.report.report_at)}</div>
        </div>
        <div style={{ display: 'flex', flex: 1, padding: '32px 48px', gap: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 330 }}>
            <div style={{ fontSize: 116, fontWeight: 700, lineHeight: 1 }}>{`${summary.active}/${summary.total}`}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#475569' }}>STATIONS ACTIVE</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#b91c1c', marginTop: 8 }}>{`${summary.noResponse} no response`}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 44, fontWeight: 700 }}>{summary.weather}</div>
              <div style={{ fontSize: 32, color: '#475569' }}>{summary.wind}</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Pill label="Roads" value={summary.roads} />
              <Pill label="Rivers" value={summary.rivers} />
              <Pill label="Coastal" value={summary.coastal} />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Atkinson', data: regular, weight: 400, style: 'normal' },
        { name: 'Atkinson', data: bold, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    },
  );
}
