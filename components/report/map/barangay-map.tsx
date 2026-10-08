'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bridge, CircleX, WavesArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COASTAL_HIGH_SWATCH, NO_RESPONSE_SWATCH, UNPASSABLE_SWATCH, type ConditionLook } from '@/lib/map/conditions';
import { OZAMIZ_BOUNDARY } from '@/lib/map/ozamiz-boundary';
import type { BarangayLocations, ReportEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ConditionDot, ConditionGlyph } from '../condition-icon';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MARKER_SIZE = 32;
const MARKER_SIZE_NARROW = 24; // phones: the whole city fits at a low zoom, so markers shrink to stay apart
const LABEL_ZOOM = 14;

export interface BarangayMapProps {
  entries: ReportEntry[];
  locations: BarangayLocations;
  look: (id: string | null) => ConditionLook | null;
  selectedId: string | null;
  flashIds: ReadonlySet<string>;
  onSelect: (id: string | null) => void;
}

function MarkerBadge({ entry, look, selected, flash }: { entry: ReportEntry; look: BarangayMapProps['look']; selected: boolean; flash: boolean }) {
  const weather = entry.responded ? look(entry.weather_option_id) : null;
  const wind = entry.responded ? look(entry.wind_option_id) : null;
  const fill = entry.responded ? weather ?? { bg: '#e2e8f0', fg: '#475569', border: '#94a3b8' } : NO_RESPONSE_SWATCH;
  const unpassable = entry.responded && entry.road === 'unpassable';
  const coastalHigh = entry.responded && entry.monitors_coastal && entry.coastal === 'above_normal';
  const hazards = [unpassable && 'road or bridge unpassable', coastalHigh && 'coastal above normal'].filter(Boolean).join(', ');
  const description = entry.responded
    ? `${entry.barangay_name}: ${weather?.label ?? 'no weather reported'}, ${wind?.label ?? 'no wind reported'}${hazards ? `, ${hazards}` : ''}`
    : `${entry.barangay_name}: no response`;
  return (
    <span className="relative block size-full">
      <span className="sr-only">{description}</span>
      {flash && <span aria-hidden className="absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-ping" />}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-full border-2 shadow-md transition-transform duration-150',
          !entry.responded && 'border-dashed',
          selected && 'scale-115 ring-4 ring-primary/60',
        )}
        style={{ backgroundColor: fill.bg, color: fill.fg, borderColor: fill.border }}
      >
        {entry.responded ? <ConditionGlyph look={weather} className="size-[55%]" /> : <CircleX className="size-[55%]" strokeWidth={2.25} aria-hidden />}
      </span>
      {wind && <ConditionDot look={wind} className="absolute -right-[18%] -bottom-[18%] size-[50%] shadow-sm ring-2 ring-white" />}
      {(unpassable || coastalHigh) && (
        <span className="absolute -top-[22%] -left-[22%] flex gap-px">
          {unpassable && <ConditionDot swatch={UNPASSABLE_SWATCH} icon={<Bridge />} className="size-[16px] shadow-sm ring-2 ring-white" />}
          {coastalHigh && <ConditionDot swatch={COASTAL_HIGH_SWATCH} icon={<WavesArrowUp />} className="size-[16px] shadow-sm ring-2 ring-white" />}
        </span>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute top-full left-1/2 mt-1.5 hidden -translate-x-1/2 rounded bg-white/90 px-1.5 text-xs font-bold whitespace-nowrap text-slate-900 shadow-sm [.show-labels_&]:block"
      >
        {entry.barangay_name}
      </span>
    </span>
  );
}

export default function BarangayMap({ entries, locations, look, selectedId, flashIds, onSelect }: BarangayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [slots, setSlots] = useState<ReadonlyMap<string, HTMLElement>>(() => new Map());

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      scrollWheelZoom: false, // never trap page scrolling
      dragging: !L.Browser.mobile, // one-finger swipes scroll the page on phones; pinch still zooms
      zoomSnap: 0.25,
      minZoom: 11,
      maxBounds: L.latLngBounds(OZAMIZ_BOUNDARY).pad(0.6),
    });
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map);
    L.polygon(OZAMIZ_BOUNDARY, { color: '#0369a1', weight: 2, dashArray: '6 6', fillColor: '#0369a1', fillOpacity: 0.04, interactive: false }).addTo(map);
    map.fitBounds(L.latLngBounds(OZAMIZ_BOUNDARY), { padding: [12, 12] });
    const syncLabels = () => container.classList.toggle('show-labels', map.getZoom() >= LABEL_ZOOM);
    map.on('zoomend', syncLabels);
    map.on('click', () => onSelectRef.current(null));
    syncLabels();
    // The container can change size without a window resize (e.g. the summary column grows).
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container);
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      resize.disconnect();
      map.remove();
      markers.clear();
      mapRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Keep one Leaflet marker per located barangay; React renders each marker's contents through a portal.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const size = map.getContainer().clientWidth < 640 ? MARKER_SIZE_NARROW : MARKER_SIZE;
    const wanted = new Set<string>();
    for (const entry of entries) {
      const at = locations[entry.barangay_id];
      if (!at) continue;
      wanted.add(entry.id);
      const existing = markers.get(entry.id);
      if (existing) {
        existing.setLatLng(at);
        continue;
      }
      const marker = L.marker(at, {
        icon: L.divIcon({ className: 'barangay-marker', html: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current(entry.id);
      });
      marker.addTo(map);
      marker.getElement()?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelectRef.current(entry.id);
      });
      markers.set(entry.id, marker);
    }
    for (const [id, marker] of markers) {
      if (!wanted.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    if (!fittedRef.current && markers.size > 0) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds([...markers.values()].map((m) => m.getLatLng())), { padding: [size, size], maxZoom: 14 });
    }
    setSlots((prev) => {
      const next = new Map<string, HTMLElement>();
      for (const [id, marker] of markers) {
        const element = marker.getElement();
        if (element) next.set(id, element);
      }
      const same = prev.size === next.size && [...next].every(([id, el]) => prev.get(id) === el);
      return same ? prev : next;
    });
  }, [entries, locations]);

  useEffect(() => {
    for (const [id, marker] of markersRef.current) marker.setZIndexOffset(id === selectedId ? 1000 : 0);
  }, [selectedId, slots]);

  return (
    <>
      <div
        ref={containerRef}
        role="region"
        aria-label="Map of Ozamiz City barangays. The same information is in the table below."
        className="size-full bg-[#f2f1ed]"
      />
      {entries.map((entry) => {
        const slot = slots.get(entry.id);
        return slot
          ? createPortal(
              <MarkerBadge entry={entry} look={look} selected={entry.id === selectedId} flash={flashIds.has(entry.id)} />,
              slot,
              entry.id,
            )
          : null;
      })}
    </>
  );
}
