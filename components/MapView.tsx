'use client';

// components/MapView.tsx — แผนที่ทั้งก้อน แยกออกจาก page.tsx
// - โหลดครั้งเดียวด้วย dynamic() (แทน 4 ก้อนเดิม) และ memo ไม่ให้เรนเดอร์ใหม่เมื่อฟอร์ม/โมดอลเปลี่ยน
// - วาดเฉพาะหมุดที่อยู่ในหน้าจอ (เมื่อมีหมุดเกิน CULL_THRESHOLD)
// - หมุดที่ไม่มีใครยืนยันเกิน 60 วันจะจางลง

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { divIcon } from 'leaflet';
import type { DivIcon, LatLngBounds, Map as LeafletMap } from 'leaflet';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';

export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  belly_status: 'safe' | 'caution' | 'danger';
  collar_status?: 'stray' | 'collared';
  last_seen_at?: string | null;
}

// เปลี่ยนไทล์แผนที่ที่นี่จุดเดียว
const TILE_PRESETS = {
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  },
  osmfr: {
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 20,
  },
} as const;
const ACTIVE_TILE: keyof typeof TILE_PRESETS = 'carto';

const CULL_THRESHOLD = 150; // มีหมุดไม่เกินนี้ → วาดทั้งหมด ไม่ต้องคำนวณขอบเขต
const STALE_MS = 60 * 24 * 3600 * 1000;

const iconCache = new Map<string, DivIcon>();

function pinIcon(p: MapPin, now: number): DivIcon {
  const key = `${p.collar_status || 'stray'}-${p.belly_status}`;
  const stale = p.last_seen_at ? now - Date.parse(p.last_seen_at) > STALE_MS : false;
  const cacheKey = stale ? `${key}-stale` : key;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  // 🐱 สำรองจะโชว์เฉพาะตอนรูปหมุดโหลดไม่ได้
  const icon = divIcon({
    className: 'custom-cat-marker bg-transparent border-0',
    html: `
      <div style="width:56px;height:56px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6));${stale ? 'opacity:.5;' : ''}">
        <img src="/pins/${key}.png" alt="cat pin" decoding="async" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
        <span style="display:none;font-size:40px;line-height:1;">🐱</span>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
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
  const handlers = useMemo(() => ({ click: () => onClick(pin) }), [onClick, pin]);
  return <Marker position={[pin.lat, pin.lng]} icon={icon} eventHandlers={handlers} />;
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
