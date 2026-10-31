'use client';

// components/MapView.tsx — แผนที่ทั้งก้อน แยกออกจาก page.tsx
// - โหลดครั้งเดียวด้วย dynamic() (แทน 4 ก้อนเดิม) และ memo ไม่ให้เรนเดอร์ใหม่เมื่อฟอร์ม/โมดอลเปลี่ยน
// - วาดเฉพาะหมุดที่อยู่ในหน้าจอ (เมื่อมีหมุดเกิน CULL_THRESHOLD)
// - หมุดที่ไม่มีใครยืนยันเกิน 60 วันจะจางลง

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { divIcon } from 'leaflet';
import type { DivIcon, LatLngBounds, Map as LeafletMap, LeafletEvent } from 'leaflet';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';

export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  belly_status: 'safe' | 'caution' | 'danger';
  collar_status?: 'stray' | 'collared';
  last_seen_at?: string | null;
}

// เปลี่ยนไทล์แผนที่ที่นี่จุดเดียว (ทุกตัวด้านล่างใช้ได้โดยไม่ต้องมี API key)
// หมายเหตุ: CARTO basemaps เคยฟรีแต่ตอนนี้ต้องมี API key จึงเอาออกแล้ว
const TILE_PRESETS = {
  osmfr: {
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 20,
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
} as const;
const ACTIVE_TILE: keyof typeof TILE_PRESETS = 'osmfr';

const CULL_THRESHOLD = 150; // มีหมุดไม่เกินนี้ → วาดทั้งหมด ไม่ต้องคำนวณขอบเขต
const STALE_MS = 60 * 24 * 3600 * 1000;

const iconCache = new Map<string, DivIcon>();

function pinIcon(p: MapPin, now: number): DivIcon {
  const key = `${p.collar_status || 'stray'}-${p.belly_status}`;
  const stale = p.last_seen_at ? now - Date.parse(p.last_seen_at) > STALE_MS : false;
  const cacheKey = stale ? `${key}-stale` : key;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const index = p.belly_status === 'safe' ? 1 : p.belly_status === 'danger' ? 2 : 0;
  const color = {safe:'#34D399',caution:'#FBBF24',danger:'#FB7185'}[p.belly_status];
  const icon = divIcon({
    className: 'custom-cat-marker',
    html: `<div class="belly-pin" style="--pin-color:${color};${stale?'opacity:.5;':''}"><span class="belly-pin-art" style="background-position:${index*50}% 0%"></span><span class="belly-pin-type">${p.collar_status==='collared'?'H':'?'}</span></div>`,
    iconSize:[58,64],iconAnchor:[29,58],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function MapEvents({
  onReady, onBounds, onMapClick, onUserMove,
}: {
  onReady: (map: LeafletMap) => void;
  onBounds: (b: LatLngBounds) => void;
  onMapClick: () => void;
  onUserMove: () => void;
}) {
  const map = useMapEvents({
    moveend: () => onBounds(map.getBounds()),
    zoomend: () => onBounds(map.getBounds()),
    dragstart: () => onUserMove(),
    click: () => onMapClick(),
  });
  useEffect(() => {
    onReady(map);
    onBounds(map.getBounds());
  }, [map, onReady, onBounds]);
  return null;
}

const PinMarker = memo(function PinMarker({ pin, icon, onClick }: { pin: MapPin; icon: DivIcon; onClick: (pin: MapPin) => void }) {
  const handlers = useMemo(() => ({ click: () => onClick(pin), add: (event: LeafletEvent) => { const marker=event.target as import('leaflet').Marker; marker.getElement()?.setAttribute('aria-label', `cat #${pin.id} / ${pin.belly_status}`); } }), [onClick, pin]);
  return <Marker title={`cat #${pin.id} / ${pin.belly_status}`} alt={`cat #${pin.id} / ${pin.belly_status}`} position={[pin.lat, pin.lng]} icon={icon} eventHandlers={handlers} />;
});

interface Props {
  center: [number, number];
  pins: MapPin[];
  onReady: (map: LeafletMap) => void;
  onMarkerClick: (pin: MapPin) => void;
  onMapClick: () => void;
  onUserMove: () => void;
}

function MapView({ center, pins, onReady, onMarkerClick, onMapClick, onUserMove }: Props) {
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const handleBounds = useCallback((b: LatLngBounds) => setBounds(b), []);

  const visible = useMemo(() => {
    if (!bounds || pins.length <= CULL_THRESHOLD) return pins;
    const area = bounds.pad(0.4);
    return pins.filter((p) => area.contains([p.lat, p.lng]));
  }, [pins, bounds]);

  const now = useMemo(() => Date.now(), [pins]); // eslint-disable-line react-hooks/exhaustive-deps
  const tile = TILE_PRESETS[ACTIVE_TILE];

  return (
    <MapContainer center={center} zoom={15} zoomControl={false} className="w-full h-full">
      <MapEvents onReady={onReady} onBounds={handleBounds} onMapClick={onMapClick} onUserMove={onUserMove} />
      <TileLayer
        url={tile.url}
        attribution={tile.attribution}
        subdomains={tile.subdomains}
        maxZoom={tile.maxZoom}
        keepBuffer={4}
        updateWhenIdle={false}
        updateWhenZooming={false}
      />
      <ZoomControl position="bottomright" />
      {visible.map((p) => (
        <PinMarker key={p.id} pin={p} icon={pinIcon(p, now)} onClick={onMarkerClick} />
      ))}
    </MapContainer>
  );
}

export default memo(MapView);
