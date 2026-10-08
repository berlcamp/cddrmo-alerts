import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { getCurrentStaff } from '@/lib/auth';
import { getReferenceData } from '@/lib/data/public';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { formatMilitaryTime, formatReportDate, manilaDayKey } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { makeOptionLabeler } from '@/lib/labels';
import { NONE, summarizeReport } from '@/lib/summary';
import { createClient } from '@/lib/supabase/server';
import type { ReportEntry } from '@/lib/types';

// Printable netcall sheet, laid out like the CDRRMO's hand-made SitRep image.

const WIDTH = 1900;
const PAD = 40;
const ROW = 40;
const LINE = '1px solid #1f2937';

const C = { zone: 80, no: 60, name: 170, callsign: 110, weather: 170, wind: 160, a: 92, b: 106, c: 92, d: 126, e: 92, f: 116, g: 90, h: 92 };
const REMARKS = WIDTH - PAD * 2 - Object.values(C).reduce((sum, w) => sum + w, 0);
const LEAD = C.zone + C.no + C.name + C.callsign;

const HEADER_BG = '#f9bf0f';
const ZONE_BG = '#a4c2f4';
const MISSING_BG = '#f4cccc';
const MISSING_REMARKS_BG = '#e99a9a';
const MISSING_BORDER = '#dc2626';

// Shown when no logos have been uploaded in Admin → Settings (same set as the site header).
// `crop` trims transparent padding: [x, y, width, height] of the visible area, in source pixels.
const DEFAULT_LOGOS: { file: string; type: string; width: number; height: number; crop?: [number, number, number, number]; shown?: number }[] = [
  { file: 'bagong_pilinas.png', type: 'image/png', width: 500, height: 447 },
  { file: 'ozamiz_seal.jpg', type: 'image/jpeg', width: 1426, height: 1440 },
  { file: 'cdrrmo.jpg', type: 'image/jpeg', width: 1184, height: 824 },
  { file: 'asenso_misoc.jpg', type: 'image/jpeg', width: 1600, height: 1520 },
  { file: 'asenso_ozamiz.png', type: 'image/png', width: 1800, height: 1200, crop: [238, 392, 1324, 414], shown: 64 },
];
const LOGO_HEIGHT = 96;

const assets = Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/AtkinsonHyperlegible-Regular.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/AtkinsonHyperlegible-Bold.ttf')),
  Promise.all(
    DEFAULT_LOGOS.map(async (logo): Promise<Logo> => {
      const src = `data:${logo.type};base64,${(await readFile(join(process.cwd(), 'public', logo.file))).toString('base64')}`;
      if (!logo.crop) return { src, width: Math.round((logo.width / logo.height) * LOGO_HEIGHT), height: LOGO_HEIGHT };
      const [x, y, w, h] = logo.crop;
      const scale = (logo.shown ?? LOGO_HEIGHT) / h;
      return { src, width: Math.round(w * scale), height: Math.round(h * scale), crop: { x: x * scale, y: y * scale, width: logo.width * scale, height: logo.height * scale } };
    }),
  ),
]);

type Logo = { src: string; width: number; height: number; crop?: { x: number; y: number; width: number; height: number } };

function Cell({ width, children, bg, bold, size = 15, flex }: { width?: number; children?: ReactNode; bg?: string; bold?: boolean; size?: number; flex?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        ...(width ? { width } : { flex }),
        height: '100%',
        padding: '0 6px',
        borderRight: LINE,
        ...(bg && { background: bg }),
        fontSize: size,
        fontWeight: bold ? 700 : 400,
        lineHeight: 1.1,
      }}
    >
      {children}
    </div>
  );
}

function Box({ checked, missing }: { checked: boolean; missing: boolean }) {
  const color = missing ? MISSING_BORDER : '#6b7280';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 3,
        border: `2px solid ${color}`,
        background: checked ? '#6b7280' : '#ffffff',
      }}
    >
      {checked && (
        <svg width="14" height="14" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 20, borderRadius: 10, background: '#e5e7eb', fontSize: 14 }}>
      {label}
    </div>
  );
}

function Group({ label, width, subs }: { label: string; width: number; subs: [string, number][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height: '100%', borderRight: LINE }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 30, borderBottom: LINE, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'flex', flex: 1 }}>
        {subs.map(([sub, w], i) => (
          <div
            key={sub}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              ...(i === subs.length - 1 ? { width: w - 1 } : { width: w, borderRight: LINE }),
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {sub}
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry, no, label }: { entry: ReportEntry; no: number; label: (id: string | null) => string }) {
  const missing = !entry.responded;
  const bg = missing ? MISSING_BG : '#ffffff';
  const box = (checked: boolean) => <Box checked={!missing && checked} missing={missing} />;
  const weather = missing ? '' : label(entry.weather_option_id);
  const wind = missing ? '' : label(entry.wind_option_id);
  const remarks = missing ? 'No response' : entry.remarks?.trim() ?? '';
  return (
    <div style={{ display: 'flex', height: ROW, borderBottom: LINE, background: bg }}>
      <Cell width={C.no} size={14}>{no}</Cell>
      <Cell width={C.name} bold>{entry.barangay_name}</Cell>
      <Cell width={C.callsign} bold>{entry.callsign}</Cell>
      <Cell width={C.weather}><Pill label={weather === NONE ? '' : weather} /></Cell>
      <Cell width={C.wind}><Pill label={wind === NONE ? '' : wind} /></Cell>
      <Cell width={C.a}>{box(entry.road === 'passable')}</Cell>
      <Cell width={C.b}>{box(entry.road === 'unpassable')}</Cell>
      <Cell width={C.c}>{box(entry.river === 'normal')}</Cell>
      <Cell width={C.d}>{box(entry.river === 'above_normal')}</Cell>
      <Cell width={C.e}>{box(entry.monitors_coastal && entry.coastal === 'normal')}</Cell>
      <Cell width={C.f}>{box(entry.monitors_coastal && entry.coastal === 'above_normal')}</Cell>
      <Cell width={C.g}>{box(entry.power === 'with_power')}</Cell>
      <Cell width={C.h}>{box(entry.power === 'no_power')}</Cell>
      <Cell width={REMARKS - 1} size={14} bg={missing ? MISSING_REMARKS_BG : undefined}>{remarks}</Cell>
    </div>
  );
}

function groupByZone(entries: ReportEntry[]): { zone: string; entries: ReportEntry[] }[] {
  const groups: { zone: string; entries: ReportEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.zone === entry.zone_name) last.entries.push(entry);
    else groups.push({ zone: entry.zone_name, entries: [entry] });
  }
  return groups;
}

function estimateLines(text: string, charsPerLine: number): number {
  return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function LogoRow({ logos }: { logos: Logo[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      {logos.map(({ src, width, height, crop }) =>
        crop ? (
          <div key={src} style={{ display: 'flex', width, height, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered to PNG by Satori */}
            <img src={src} width={crop.width} height={crop.height} style={{ marginLeft: -crop.x, marginTop: -crop.y }} />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered to PNG by Satori
          <img key={src} src={src} width={width} height={height} style={{ objectFit: 'contain' }} />
        ),
      )}
    </div>
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCurrentStaff())) return new Response('Unauthorized', { status: 401 });
  if (!isUuid(id)) return new Response('Not found', { status: 404 });

  const [bundle, { options, settings }, [regular, bold, defaultLogos]] = await Promise.all([
    fetchReportBundle(await createClient(), id),
    getReferenceData(),
    assets,
  ]);
  if (!bundle) return new Response('Not found', { status: 404 });

  const { report, entries } = bundle;
  const summary = summarizeReport(report, entries, options);
  const label = makeOptionLabeler(options);
  const groups = groupByZone(entries);

  const logos: Logo[] = settings.logo_urls.length > 0 ? settings.logo_urls.map((src) => ({ src, width: LOGO_HEIGHT, height: LOGO_HEIGHT })) : defaultLogos;
  const leftLogos = logos.slice(0, 2);
  const rightLogos = logos.slice(2);

  const netcallTitle = `${settings.network_name.replace(/\s*radio communication network\s*$/i, '')} Netcall Report`;
  const remarks = report.remarks.trim();
  const remarksLines = remarks ? estimateLines(remarks, 34) : 1;
  const remarksHeight = Math.max(64, remarksLines * 22 + 20);

  const height = PAD + LOGO_HEIGHT + 24 + 96 + 64 + entries.length * ROW + 56 + 112 + 20 + 44 + remarksHeight + 80 + 90 + PAD;

  const statCell = (title: string, value: string, big = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, borderRight: LINE }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 40, borderBottom: LINE, fontSize: 24, fontWeight: 700 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: big ? 44 : 26, fontWeight: 700, textAlign: 'center', padding: '0 8px' }}>{value}</div>
    </div>
  );

  const conditionCell = (title: string, value: ReactNode, isText = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, borderRight: LINE }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderBottom: LINE, fontSize: isText ? 22 : 18, fontWeight: 700 }}>{title}</div>
      <div
        style={{
          display: 'flex',
          alignItems: isText ? 'flex-start' : 'center',
          justifyContent: isText ? 'flex-start' : 'center',
          height: remarksHeight,
          padding: isText ? '8px 10px' : '0 8px',
          fontSize: isText ? 17 : 26,
          fontWeight: isText ? 400 : 700,
          textAlign: isText ? 'left' : 'center',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.25,
        }}
      >
        {value}
      </div>
    </div>
  );

  let no = 0;
  const filename = `netcall-report-${manilaDayKey(report.report_at)}-${formatMilitaryTime(report.report_at)}.png`;

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: PAD, background: '#ffffff', color: '#000000', fontFamily: 'Atkinson' }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48, height: LOGO_HEIGHT, marginBottom: 24 }}>
          <LogoRow logos={leftLogos} />
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 14, lineHeight: 1.25 }}>
            <div style={{ fontSize: 20, fontWeight: 700, textTransform: 'uppercase' }}>{settings.office_title}</div>
            {settings.office_lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
            <div>{settings.network_name}</div>
            <div>{`Call Sign: ${settings.call_sign} - Radio Frequency ${settings.radio_frequency}`}</div>
          </div>
          <LogoRow logos={rightLogos} />
        </div>

        {/* Title block */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: C.zone }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: 96, border: LINE, borderBottom: 'none', fontSize: 18, fontWeight: 700, lineHeight: 1.45 }}>
            <div>{netcallTitle}</div>
            <div>{`${formatReportDate(report.report_at)} - ${formatMilitaryTime(report.report_at)}`}</div>
            <div>{settings.report_title}</div>
          </div>
        </div>

        {/* Column headings */}
        <div style={{ display: 'flex', height: 64 }}>
          <div style={{ width: C.zone }} />
          <div style={{ display: 'flex', flex: 1, background: HEADER_BG, border: LINE, borderRight: 'none' }}>
            <Cell width={C.no} bold>No.</Cell>
            <Cell width={C.name} bold>BARANGAY</Cell>
            <Cell width={C.callsign} bold>CALLSIGN</Cell>
            <Cell width={C.weather} bold>Weather Situation</Cell>
            <Cell width={C.wind} bold>Wind Situation</Cell>
            <Group label="ROAD SITUATION" width={C.a + C.b} subs={[['PASSABLE', C.a], ['UNPASSABLE', C.b]]} />
            <Group label="RIVERS / CANALS SITUATION" width={C.c + C.d} subs={[['NORMAL', C.c], ['ABOVE NORMAL', C.d]]} />
            <Group label="COASTAL SITUATION" width={C.e + C.f} subs={[['NORMAL', C.e], ['ABOVE NORMAL', C.f]]} />
            <Group label="POWER STATUS" width={C.g + C.h} subs={[['WITH POWER', C.g], ['NO POWER', C.h]]} />
            <Cell width={REMARKS - 1} bold>REMARKS</Cell>
          </div>
        </div>

        {/* Barangay rows, grouped by zone */}
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: LINE }}>
          {groups.map((group) => (
            <div key={group.zone} style={{ display: 'flex' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: C.zone,
                  height: group.entries.length * ROW,
                  background: ZONE_BG,
                  borderLeft: LINE,
                  borderRight: LINE,
                  borderBottom: LINE,
                  fontSize: group.entries.length * ROW < group.zone.length * 26 ? 16 : 22,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {group.zone.toUpperCase().split('').map((ch, i) => (
                  <div key={i}>{ch === ' ' ? ' ' : ch}</div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {group.entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} no={++no} label={label} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', height: 112, marginTop: 56, border: LINE, borderRight: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: LEAD, borderRight: LINE, fontSize: 26, fontWeight: 700 }}>TOTAL RESPONSE</div>
          {statCell('Active Stations', String(summary.active), true)}
          {statCell('No Response', String(summary.noResponse), true)}
          {statCell('Average Weather Condition', summary.weather)}
          {statCell('Average Wind Situation', summary.wind)}
        </div>

        <div style={{ display: 'flex', marginTop: 20 }}>
          <div style={{ width: LEAD }} />
          <div style={{ display: 'flex', flex: 1, border: LINE, borderRight: 'none' }}>
            {conditionCell('RIVERS / CANALS SITUATION', summary.rivers)}
            {conditionCell('ROADS / BRIDGES', summary.roads)}
            {conditionCell('COASTAL SITUATION', summary.coastal)}
            {conditionCell('REMARKS', remarks || NONE, true)}
          </div>
        </div>

        {/* Signatory */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 64, marginTop: 80, paddingLeft: 16 }}>
          <div style={{ fontSize: 20, paddingBottom: 26 }}>Prepared by:</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, textTransform: 'uppercase' }}>{report.prepared_by_name || NONE}</div>
            <div style={{ fontSize: 16, textTransform: 'uppercase' }}>{report.prepared_by_position}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [
        { name: 'Atkinson', data: regular, weight: 400, style: 'normal' },
        { name: 'Atkinson', data: bold, weight: 700, style: 'normal' },
      ],
      headers: { 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' },
    },
  );
}
