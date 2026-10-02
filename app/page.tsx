'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import dynamic from 'next/dynamic';
import type { DivIcon, Map as LeafletMap } from 'leaflet';
import { supabase, isSupabaseConfigured, uploadCatPhotos } from '@/lib/supabase';

/* ────────────────────────────── Leaflet (client only) ────────────────────────────── */

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then((mod) => mod.ZoomControl), { ssr: false });

const MapEventsBridge = dynamic(
  () => import('react-leaflet').then((mod) => {
    function Bridge({ onMove }: { onMove: (map: LeafletMap) => void }) {
      const map = mod.useMapEvents({
        move: () => onMove(map),
        zoomend: () => onMove(map),
      });
      useEffect(() => { onMove(map); }, [map, onMove]);
      return null;
    }
    return Bridge;
  }),
  { ssr: false }
);

// แตะที่ว่างบนแผนที่เพื่อปิด bottom sheet
const MapClickBridge = dynamic(
  () => import('react-leaflet').then((mod) => {
    function Bridge({ onClick }: { onClick: () => void }) {
      mod.useMapEvents({ click: () => onClick() });
      return null;
    }
    return Bridge;
  }),
  { ssr: false }
);

const MapRefBridge = dynamic(
  () => import('react-leaflet').then((mod) => {
    function Bridge({ onReady }: { onReady: (map: LeafletMap) => void }) {
      const map = mod.useMap();
      useEffect(() => { onReady(map); }, [map, onReady]);
      return null;
    }
    return Bridge;
  }),
  { ssr: false }
);

/* ────────────────────────────── Types & constants ────────────────────────────── */

type BellyStatus = 'safe' | 'caution' | 'danger';
type CollarStatus = 'stray' | 'collared';
type FilterType = 'all' | BellyStatus | CollarStatus;

interface CatData {
  id: number;
  name: string;
  location: string;
  lat: number;
  lng: number;
  belly_status: BellyStatus;
  collar_status?: CollarStatus;
  belly_text: string;
  details: string;
  photo_urls?: string[] | null;
  discovered_by?: string;
  likes_count?: number;
  edit_count?: number;
}

interface GeoResult {
  lat: string;
  lon: string;
  display_name: string;
}

const STATUS_CONFIG: Record<BellyStatus, { label: string; text: string; emoji: string; ring: string; bg: string }> = {
  safe: { label: 'SAFE ZONE', text: 'จกพุงได้สบาย ชอบให้เกา', emoji: '🟢', ring: '#34D399', bg: 'rgba(52, 211, 153, 0.15)' },
  caution: { label: 'CAUTION ZONE', text: 'จกได้นิดหน่อย ระวังโดนสวบ', emoji: '🟡', ring: '#FBBF24', bg: 'rgba(251, 191, 36, 0.15)' },
  danger: { label: 'DANGER ZONE', text: 'ห้ามจกพุงเด็ดขาด!', emoji: '🔴', ring: '#FB7185', bg: 'rgba(251, 113, 133, 0.15)' },
};

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด 🐾' },
  { id: 'safe', label: '🟢 เฟรนลี่' },
  { id: 'caution', label: '🟡 คาดเดาไม่ได้' },
  { id: 'danger', label: '🔴 โขด' },
  { id: 'stray', label: '🚷 เหมียวจร' },
  { id: 'collared', label: '🏷️ มีบ้าน' },
];

const MAX_PHOTOS = 3;
const DEFAULT_CENTER: [number, number] = [18.7883, 98.9853];
const LIKES_STORAGE_KEY = 'bellydontbully_liked_cats';
const OWNER_STORAGE_KEY = 'bellydontbully_my_cats';
const CAT_COLUMNS = 'id,name,location,lat,lng,belly_status,collar_status,belly_text,details,photo_urls,discovered_by,likes_count,edit_count';

/* ────────────────────────────── Helpers ────────────────────────────── */

// สมการ Haversine คำนวณระยะทางระหว่างพิกัด 2 จุด (กิโลเมตร)
function getDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// crypto.randomUUID ใช้ไม่ได้บน http (ไม่ใช่ https) จึงมี fallback
function makeToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ────────────────────────────── Canvas Helpers ────────────────────────────── */
const CARD_W = 825, CARD_H = 1125;
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
};
function segmentText(text: string): string[] {
  try { if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') { return Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), (s) => s.segment); } } catch {}
  return Array.from(text);
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim(); if (!clean) return [];
  const tokens = segmentText(clean).flatMap((t) => ctx.measureText(t).width > maxWidth ? Array.from(t) : [t]);
  const lines: string[] = []; let line = '';
  for (const token of tokens) {
    const test = line + token;
    if (ctx.measureText(test).width <= maxWidth) { line = test; } else {
      if (line) lines.push(line.trimEnd()); line = token.trimStart();
    }
  }
  if (line) lines.push(line.trimEnd());
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines); let last = out[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) { last = last.slice(0, -1); }
    out[maxLines - 1] = last + '…'; return out;
  }
  return lines;
}
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#151518'; ctx.fillRect(x, y, w, h);
  const imgRatio = img.naturalWidth / img.naturalHeight; const boxRatio = w / h;
  let sw = w, sh = h, sx = x, sy = y;
  if (imgRatio > boxRatio) { sh = w / imgRatio; sy = y + (h - sh) / 2; } else { sw = h * imgRatio; sx = x + (w - sw) / 2; }
  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, sx, sy, sw, sh);
}
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('image load failed')); img.src = url; });
}

async function renderCatCard(cat: CatData): Promise<string> {
  const canvas = document.createElement('canvas'); canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas not supported');
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (size: number, bold = false) => `${bold ? '700' : '400'} ${size}px ${family}`;
  try { await document.fonts.ready; } catch {}
  const cfg = STATUS_CONFIG[cat.belly_status];
  const collarLabel = cat.collar_status === 'collared' ? 'เหมียวมีบ้าน' : 'เหมียวจร';
  const photoUrl = cat.photo_urls?.[0]; const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;
  ctx.textBaseline = 'alphabetic';
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#1E1E24'); bg.addColorStop(1, '#0B0B0D');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = '#27272A'; ctx.lineWidth = 3; drawRoundedRect(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 24); ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#FF9F43'; ctx.font = font(16, true); ctx.fillText("BELLY DON'T BULLY • PROFILE CARD", 64, 75);
  ctx.fillStyle = '#F5F5F2'; ctx.font = font(44, true); ctx.fillText(wrapText(ctx, cat.name, 500, 1)[0] ?? '', 64, 135);
  ctx.textAlign = 'right'; ctx.fillStyle = '#27272A'; drawRoundedRect(ctx, 600, 92, 160, 40, 20); ctx.fill();
  ctx.fillStyle = '#FF9F43'; ctx.font = font(16, true); ctx.fillText(collarLabel, 680, 118);
  const FX = 64, FY = 160, FW = 697, FH = 500;
  ctx.fillStyle = '#151518'; drawRoundedRect(ctx, FX, FY, FW, FH, 16); ctx.fill();
  if (img) { ctx.save(); drawRoundedRect(ctx, FX, FY, FW, FH, 16); ctx.clip(); drawContain(ctx, img, FX, FY, FW, FH); ctx.restore(); }
  else { ctx.textAlign = 'center'; ctx.font = font(120); ctx.fillStyle = '#27272A'; ctx.fillText('🐱', FX + FW / 2, FY + FH / 2 + 40); }
  ctx.strokeStyle = '#27272A'; ctx.lineWidth = 2; drawRoundedRect(ctx, FX, FY, FW, FH, 16); ctx.stroke();
  const infoY = 690; ctx.fillStyle = '#151518'; drawRoundedRect(ctx, FX, infoY, FW, 54, 12); ctx.fill(); ctx.strokeStyle = '#27272A'; ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#8E8E96'; ctx.font = font(16, true); ctx.fillText(`📍 ${cat.location}`, FX + 20, infoY + 33);
  const zoneY = 760; ctx.fillStyle = cfg.bg; drawRoundedRect(ctx, FX, zoneY, FW, 85, 16); ctx.fill(); ctx.strokeStyle = cfg.ring; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = cfg.ring; ctx.font = font(20, true); ctx.fillText(`${cfg.emoji} ${cfg.label}`, FX + 24, zoneY + 34);
  ctx.fillStyle = '#F5F5F2'; ctx.font = font(16); ctx.fillText(wrapText(ctx, cfg.text, FW - 48, 1)[0] ?? '', FX + 24, zoneY + 62);
  if (cat.details) {
    const detailY = 860; ctx.fillStyle = '#151518'; drawRoundedRect(ctx, FX, detailY, FW, 75, 16); ctx.fill(); ctx.strokeStyle = '#27272A'; ctx.stroke();
    ctx.fillStyle = '#8E8E96'; ctx.font = font(15);
    const detailLines = wrapText(ctx, `"${cat.details}"`, FW - 48, 2);
    detailLines.forEach((line, idx) => { ctx.fillText(line, FX + 24, detailY + 28 + idx * 22); });
  }
  const footerY = 1010; ctx.textAlign = 'left'; ctx.fillStyle = '#8E8E96'; ctx.font = font(14, true); ctx.fillText(`พบเจอโดย: ${cat.discovered_by || 'ทาสแมวนิรนาม'}`, FX, footerY);
  ctx.textAlign = 'right'; ctx.fillStyle = '#FB7185'; ctx.font = font(16, true); ctx.fillText(`❤️ ${cat.likes_count || 0} เลิฟ`, CARD_W - 64, footerY);
  return canvas.toDataURL('image/png');
}

/* ────────────────────────────── Small shared components ────────────────────────────── */

function PhotoCarousel({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const safeIndex = index < total ? index : 0;

  if (total === 0) return <div className="w-full h-full bg-[#0B0B0D] flex items-center justify-center text-4xl">🐱</div>;

  const go = (e: ReactMouseEvent, delta: number) => { e.stopPropagation(); setIndex((safeIndex + delta + total) % total); };

  return (
    <div className="relative w-full h-full bg-[#0B0B0D]">
      <img src={photos[safeIndex]} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      {total > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, -1)} aria-label="รูปก่อนหน้า" className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#0B0B0D]/60 text-white rounded-full text-xs flex items-center justify-center font-bold cursor-pointer">‹</button>
          <button type="button" onClick={(e) => go(e, 1)} aria-label="รูปถัดไป" className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#0B0B0D]/60 text-white rounded-full text-xs flex items-center justify-center font-bold cursor-pointer">›</button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {photos.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CollarBadge({ collar, overlay = false }: { collar?: CollarStatus; overlay?: boolean }) {
  const collared = collar === 'collared';
  const tone = overlay
    ? collared
      ? 'bg-[#0B0B0D]/75 backdrop-blur-sm text-[#FF9F43] border-[#FF9F43]/40 px-2 py-1 rounded-full text-[10px]'
      : 'bg-[#0B0B0D]/75 backdrop-blur-sm text-[#D4D4DA] border-white/15 px-2 py-1 rounded-full text-[10px]'
    : collared
      ? 'bg-[#FF9F43]/15 text-[#FF9F43] border-[#FF9F43]/30 px-2 py-0.5 rounded-md text-[10px]'
      : 'bg-[#8E8E96]/15 text-[#8E8E96] border-[#8E8E96]/30 px-2 py-0.5 rounded-md text-[10px]';
  return <span className={`${tone} border font-bold shrink-0 whitespace-nowrap`}>{collared ? 'เหมียวมีบ้าน' : 'เหมียวจร'}</span>;
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const pendingFlyRef = useRef<[number, number] | null>(null);
  const iconCacheRef = useRef(new Map<string, DivIcon>());
  const photoPreviewsRef = useRef<string[]>([]);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

  const [cats, setCats] = useState<CatData[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [likedCats, setLikedCats] = useState<Record<number, boolean>>({});

  // เหมียวที่เครื่องนี้เป็นคนเพิ่ม: { catId: ownerToken }
  const [myCats, setMyCats] = useState<Record<number, string>>({});
  const [editingCat, setEditingCat] = useState<CatData | null>(null);

  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);

  // Bottom sheet แทน Popup
  const [activeId, setActiveId] = useState<number | null>(null);
  const activeCat = useMemo(() => cats.find((c) => c.id === activeId) ?? null, [cats, activeId]);

  const [shareCat, setShareCat] = useState<CatData | null>(null);
  const [shareCardImage, setShareCardImage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // States for Radar Scan
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResultCount, setScannedResultCount] = useState<number | null>(null);

  // States for Location Search (Pick Location)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [isSearchingLoc, setIsSearchingLoc] = useState(false);

  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [bellyStatus, setBellyStatus] = useState<BellyStatus>('safe');
  const [collarStatus, setCollarStatus] = useState<CollarStatus>('stray');
  const [details, setDetails] = useState('');
  const [discoveredBy, setDiscoveredBy] = useState('');

  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [hasLocation, setHasLocation] = useState(false);

  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    if (pendingFlyRef.current) {
      map.setView(pendingFlyRef.current, 15, { animate: true });
      pendingFlyRef.current = null;
    }
  }, []);

  const handlePickMove = useCallback((map: LeafletMap) => {
    const c = map.getCenter();
    setPickedCenter({ lat: c.lat, lng: c.lng });
  }, []);

  const closeSheet = useCallback(() => setActiveId(null), []);

  useEffect(() => {
    setIsClient(true);
    import('leaflet').then((L) => setLeafletLib(L));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(coords);
          if (mapRef.current) {
            mapRef.current.setView(coords, 15, { animate: true });
          } else {
            pendingFlyRef.current = coords;
          }
        },
        () => console.log('User location denied, using default center.'),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    try {
      const savedLikes = localStorage.getItem(LIKES_STORAGE_KEY);
      if (savedLikes) setLikedCats(JSON.parse(savedLikes));
    } catch (e) {
      console.error(e);
    }

    try {
      const savedOwner = localStorage.getItem(OWNER_STORAGE_KEY);
      if (savedOwner) setMyCats(JSON.parse(savedOwner));
    } catch (e) {
      console.error(e);
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoadingCats(false);
      return;
    }

    let cancelled = false;
    supabase
      .from('cats')
      .select(CAT_COLUMNS)
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setCats(data as unknown as CatData[]);
        setLoadingCats(false);
      });

    return () => { cancelled = true; };
  }, []);

  // เก็บ blob URL ล่าสุดไว้ revoke ตอนปิดหน้า (ห้าม revoke ทุกครั้งที่ photoPreviews เปลี่ยน ไม่งั้นรูปที่ยังแสดงอยู่จะพัง)
  useEffect(() => { photoPreviewsRef.current = photoPreviews; }, [photoPreviews]);
  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ฟังก์ชันค้นหาสถานที่ผ่าน OpenStreetMap
  const handleSearchLocation = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchingLoc(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=th&limit=5`);
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      const data = (await res.json()) as GeoResult[];
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    }
    setIsSearchingLoc(false);
  };

  const jumpToLocation = (newLat: string, newLng: string, displayName: string) => {
    const latNum = parseFloat(newLat);
    const lonNum = parseFloat(newLng);
    if (mapRef.current) {
      mapRef.current.flyTo([latNum, lonNum], 17, { animate: true, duration: 1.5 });
      setPickedCenter({ lat: latNum, lng: lonNum });
    }
    setSearchQuery(displayName);
    setSearchResults([]);
  };

  // ฟังก์ชันสแกนหาแมว
  const handleRadarScan = () => {
    const map = mapRef.current;
    if (!map || isScanning) return;
    setIsScanning(true);
    setScannedResultCount(null);

    // จำลองเวลาสแกน 2.5 วินาที
    scanTimerRef.current = setTimeout(() => {
      const center = map.getCenter();
      // คำนวณหาแมวในรัศมี 3 กม.
      const nearbyCats = cats.filter((c) => getDistanceKM(center.lat, center.lng, c.lat, c.lng) <= 3);

      setIsScanning(false);
      setScannedResultCount(nearbyCats.length);

      // ซ่อนแจ้งเตือนอัตโนมัติ
      toastTimerRef.current = setTimeout(() => setScannedResultCount(null), 5000);
    }, 2500);
  };

  const filteredCats = useMemo(() => {
    if (selectedFilter === 'all') return cats;
    return cats.filter((cat) => {
      if (selectedFilter === 'safe' || selectedFilter === 'caution' || selectedFilter === 'danger') {
        return cat.belly_status === selectedFilter;
      }
      if (selectedFilter === 'stray') return !cat.collar_status || cat.collar_status === 'stray';
      return cat.collar_status === 'collared';
    });
  }, [cats, selectedFilter]);

  const getCatIcon = useCallback((cat: CatData): DivIcon | undefined => {
    if (!leafletLib) return undefined;
    const collar = cat.collar_status || 'stray';
    const cacheKey = `${collar}-${cat.belly_status}`;
    const cached = iconCacheRef.current.get(cacheKey);
    if (cached) return cached;

    // 🐱 สำรองจะโชว์เฉพาะตอนรูปหมุดโหลดไม่ได้ (ไม่งั้นจะซ้อนอยู่หลังหมุด)
    const icon = leafletLib.divIcon({
      className: 'custom-cat-marker bg-transparent border-0',
      html: `
        <div style="width:56px;height:56px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6));">
          <img src="/pins/${cacheKey}.png" alt="cat pin" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
          <span style="display:none;font-size:40px;line-height:1;">🐱</span>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });
    iconCacheRef.current.set(cacheKey, icon);
    return icon;
  }, [leafletLib]);

  // แตะหมุด: เปิด sheet แล้วเลื่อนแผนที่ให้หมุดอยู่เหนือ sheet
  const handleMarkerClick = (cat: CatData) => {
    setActiveId(cat.id);
    const map = mapRef.current;
    if (!map) return;
    const zoom = Math.max(map.getZoom(), 16);
    const target = map.project([cat.lat, cat.lng], zoom).add([0, 110]);
    map.setView(map.unproject(target, zoom), zoom, { animate: true });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setHasLocation(true);
        setLocating(false);
      },
      () => { setLocating(false); alert('ดึงตำแหน่งไม่ได้ ลองใช้โหมดเลือกบนแผนที่แทนนะครับ'); },
      { enableHighAccuracy: true }
    );
  };

  const confirmPickedLocation = () => {
    if (pickedCenter) {
      setLat(pickedCenter.lat.toFixed(6));
      setLng(pickedCenter.lng.toFixed(6));
      setHasLocation(true);
    }
    setPickingLocation(false);
    setShowForm(true);
  };

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    const remaining = MAX_PHOTOS - photoFiles.length;
    if (remaining <= 0) return;
    const accepted = selected.slice(0, remaining);
    setPhotoFiles((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (index: number) => {
    setPhotoPreviews((prev) => { if (prev[index]) URL.revokeObjectURL(prev[index]); return prev.filter((_, i) => i !== index); });
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    photoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoPreviewsRef.current = [];
    setName(''); setLocationName(''); setDetails(''); setDiscoveredBy('');
    setBellyStatus('safe'); setCollarStatus('stray');
    setPhotoFiles([]); setPhotoPreviews([]); setLat(''); setLng(''); setHasLocation(false);
  };

  /* ───────── แก้ไขข้อมูล (ได้ 1 ครั้ง) ───────── */

  const canEdit = (cat: CatData) => !!myCats[cat.id] && (cat.edit_count ?? 0) < 1;

  const closeForm = () => {
    setShowForm(false);
    if (editingCat) { setEditingCat(null); resetForm(); }
  };

  const openEdit = (cat: CatData) => {
    setEditingCat(cat);
    setName(cat.name);
    setLocationName(cat.location);
    setBellyStatus(cat.belly_status);
    setCollarStatus(cat.collar_status || 'stray');
    setDetails(cat.details || '');
    setDiscoveredBy(cat.discovered_by === 'ทาสแมวนิรนาม' ? '' : cat.discovered_by || '');
    setActiveId(null);
    setShowList(false);
    setShowForm(true);
  };

  const submitEdit = async () => {
    if (!editingCat || !supabase) return;
    const token = myCats[editingCat.id];
    if (!token || !name.trim() || !locationName.trim()) return alert('กรุณากรอกชื่อและสถานที่');
    if (!window.confirm('แก้ไขได้แค่ครั้งเดียวนะ แน่ใจว่าข้อมูลถูกต้องแล้ว?')) return;

    setSaving(true);
    const cfg = STATUS_CONFIG[bellyStatus];
    const patch = {
      name: name.trim(),
      location: locationName.trim(),
      belly_status: bellyStatus,
      collar_status: collarStatus,
      belly_text: `${cfg.emoji} ${cfg.label} — ${cfg.text}`,
      details: details.trim(),
      discovered_by: discoveredBy.trim() || 'ทาสแมวนิรนาม',
    };
    const { error } = await supabase.rpc('edit_cat', {
      p_id: editingCat.id,
      p_token: token,
      p_name: patch.name,
      p_location: patch.location,
      p_belly_status: patch.belly_status,
      p_collar_status: patch.collar_status,
      p_belly_text: patch.belly_text,
      p_details: patch.details,
      p_discovered_by: patch.discovered_by,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      return alert('แก้ไขไม่สำเร็จ (อาจแก้ไปครบ 1 ครั้งแล้ว)');
    }
    setCats((prev) => prev.map((c) => (c.id === editingCat.id ? { ...c, ...patch, edit_count: 1 } : c)));
    setShowForm(false);
    setEditingCat(null);
    resetForm();
  };

  const handleAddCat = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (editingCat) return submitEdit();
    if (!name.trim() || !locationName.trim() || !hasLocation) return alert('กรุณากรอกชื่อ สถานที่ และระบุพิกัดให้เรียบร้อย');
    if (!isSupabaseConfigured || !supabase) return;

    setSaving(true);
    let photoUrls: string[] = [];
    if (photoFiles.length > 0) {
      try { photoUrls = await uploadCatPhotos(photoFiles); }
      catch (err) { console.error(err); alert('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'); setSaving(false); return; }
    }

    const cfg = STATUS_CONFIG[bellyStatus];
    const ownerToken = makeToken();
    const { data, error } = await supabase.from('cats').insert([{
      name: name.trim(), location: locationName.trim(), lat: parseFloat(lat), lng: parseFloat(lng),
      belly_status: bellyStatus, collar_status: collarStatus, belly_text: `${cfg.emoji} ${cfg.label} — ${cfg.text}`,
      details: details.trim(), photo_urls: photoUrls, discovered_by: discoveredBy.trim() || 'ทาสแมวนิรนาม', likes_count: 0,
      owner_token: ownerToken,
    }]).select(CAT_COLUMNS);

    if (!error && data) {
      const newCat = data[0] as unknown as CatData;
      setCats((prev) => [newCat, ...prev]);
      const next = { ...myCats, [newCat.id]: ownerToken };
      setMyCats(next);
      try { localStorage.setItem(OWNER_STORAGE_KEY, JSON.stringify(next)); } catch {}
      setShowForm(false); resetForm();
    } else { alert('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ'); }
    setSaving(false);
  };

  const flyToCat = (catLat: number, catLng: number) => {
    setShowList(false);
    mapRef.current?.flyTo([catLat, catLng], 18, { animate: true, duration: 1.5 });
  };

  const handleLike = async (e: ReactMouseEvent, catId: number, currentLikes: number) => {
    e.stopPropagation();
    if (!supabase) return;
    const wasLiked = !!likedCats[catId];
    const newLikes = wasLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;
    const updated = { ...likedCats, [catId]: !wasLiked };
    setLikedCats(updated);
    try { localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(updated)); } catch {}
    setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, likes_count: newLikes } : c)));

    const { error } = await supabase.from('cats').update({ likes_count: newLikes }).eq('id', catId);
    if (error) {
      const rolledBack = { ...updated, [catId]: wasLiked };
      setLikedCats(rolledBack);
      try { localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(rolledBack)); } catch {}
      setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, likes_count: currentLikes } : c)));
    }
  };

  const openGoogleMaps = (catLat: number, catLng: number) => { window.open(`https://www.google.com/maps/search/?api=1&query=${catLat},${catLng}`, '_blank', 'noopener,noreferrer'); };

  const generatePokemonCard = async (cat: CatData) => {
    setShareCat(cat); setShareCardImage(null);
    try { setShareCardImage(await renderCatCard(cat)); } catch (err) { console.error(err); alert('สร้างการ์ดไม่สำเร็จ ลองใหม่อีกครั้งนะ'); setShareCat(null); }
  };

  const closeShare = () => {
    setShareCat(null);
    setShareCardImage(null);
  };

  const downloadCard = async () => {
    if (!shareCardImage || !shareCat) return;
    const fileName = `${shareCat.name}-profile-card.png`;
    try {
      if (window.matchMedia('(pointer: coarse)').matches && typeof navigator.canShare === 'function') {
        const blob = await (await fetch(shareCardImage)).blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: shareCat.name }); return; }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
    const link = document.createElement('a'); link.href = shareCardImage; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const inputCls = 'w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] outline-none focus:border-[#FF9F43]';

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0B0B0D] text-[#F5F5F2] font-sans">

      {/* ────────────────────────────── Global tweaks ────────────────────────────── */}
      <style>{`
        html, body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
        /* กัน iOS ซูมหน้าจอเองตอนโฟกัสช่องกรอก (ต้อง 16px ขึ้นไป) */
        input, select, textarea { font-size: 16px !important; -webkit-user-select: text; user-select: text; }
        @media (pointer: coarse) { .leaflet-control-zoom { display: none !important; } }
        .leaflet-container { -webkit-touch-callout: none; }
        .leaflet-marker-icon { -webkit-user-select: none; user-select: none; }
      `}</style>

      {/* ────────────────────────────── Header UI ────────────────────────────── */}
      {!pickingLocation && (
        <div
          className="absolute inset-x-3 z-[3000] pointer-events-none flex flex-col gap-1.5"
          style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div className="pointer-events-auto flex items-center justify-between gap-3 bg-[#151518]/90 backdrop-blur-md border border-[#27272A] rounded-full pl-3.5 pr-1.5 py-1.5 shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg leading-none">🐾</span>
              <h1 className="font-black text-[12px] tracking-wide truncate">BELLY DON&apos;T BULLY</h1>
            </div>
            <button
              onClick={() => { setActiveId(null); setShowList(true); }}
              className="shrink-0 bg-[#FF9F43]/15 text-[#FF9F43] border border-[#FF9F43]/30 px-3 py-1.5 rounded-full text-[11px] font-black cursor-pointer active:scale-95"
            >
              {loadingCats ? '…' : cats.length} 🐱 ดูทั้งหมด
            </button>
          </div>

          {/* ตัวกรอง: เลื่อนแนวนอนได้ ไม่มีแถบ scroll */}
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_92%,transparent)]">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 whitespace-nowrap border transition-colors cursor-pointer ${selectedFilter === tab.id ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#151518]/90 backdrop-blur-md text-[#8E8E96] border-[#27272A]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(isScanning || scannedResultCount !== null) && (
            <div className="self-center animate-fade-in bg-[#151518]/95 backdrop-blur-md border border-[#34D399]/40 text-[#34D399] rounded-full px-3.5 py-1.5 text-xs font-bold shadow-lg">
              {isScanning ? '📡 กำลังสแกนรอบๆ...' : `🚨 พบแมว ${scannedResultCount} ตัว ในรัศมี 3 กม.`}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────── Map UI ────────────────────────────── */}
      <div className="w-full h-full z-0 relative">
        {isClient ? (
          <>
            {isScanning && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2000] pointer-events-none">
                <div className="w-[260px] h-[260px] border-2 border-[#34D399] rounded-full animate-ping opacity-50 bg-[#34D399]/15" />
              </div>
            )}

            <MapContainer center={mapCenter} zoom={15} zoomControl={false} className="w-full h-full">
              <MapRefBridge onReady={handleMapReady} />
              <MapClickBridge onClick={closeSheet} />
              <TileLayer url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <ZoomControl position="bottomright" />
              {pickingLocation && <MapEventsBridge onMove={handlePickMove} />}

              {leafletLib && filteredCats.map((cat) => (
                <Marker
                  key={cat.id}
                  position={[cat.lat, cat.lng]}
                  icon={getCatIcon(cat)}
                  eventHandlers={{ click: () => handleMarkerClick(cat) }}
                />
              ))}
            </MapContainer>
          </>
        ) : (
          <div className="w-full h-full bg-[#0B0B0D] flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#8E8E96] text-xs font-bold tracking-widest uppercase">Loading Map...</p>
          </div>
        )}
      </div>

      {/* ────────────────────────────── Cat Bottom Sheet ────────────────────────────── */}
      {activeCat && !pickingLocation && !showForm && !showList && (() => {
        const cfg = STATUS_CONFIG[activeCat.belly_status];
        const isLiked = !!likedCats[activeCat.id];
        return (
          <div className="fixed inset-x-0 bottom-0 z-[9000] animate-sheet-in px-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="bg-[#151518]/95 backdrop-blur-md border border-[#27272A] rounded-3xl p-3 shadow-2xl">
              <div className="flex gap-3">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-[#27272A]">
                  <PhotoCarousel photos={activeCat.photo_urls ?? []} alt={activeCat.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-[15px] truncate">{activeCat.name}</h3>
                    <button onClick={closeSheet} aria-label="ปิด" className="w-8 h-8 -mt-1 -mr-1 rounded-full bg-[#27272A] text-[#8E8E96] text-xs cursor-pointer shrink-0">✕</button>
                  </div>
                  <p className="text-[#8E8E96] text-[11px] truncate">📍 {activeCat.location}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <CollarBadge collar={activeCat.collar_status} />
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap" style={{ color: cfg.ring, background: cfg.bg, borderColor: cfg.ring }}>
                      {cfg.emoji} {cfg.label.split(' ')[0]}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-2 text-[12px] font-semibold" style={{ color: cfg.ring }}>{cfg.text}</p>
              {activeCat.details && <p className="mt-1 text-[11px] text-[#8E8E96] italic line-clamp-2 break-words">&quot;{activeCat.details}&quot;</p>}
              <p className="mt-1 text-[10px] text-[#8E8E96] truncate">
                พบเจอโดย <span className="text-[#F5F5F2] font-semibold">{activeCat.discovered_by || 'ทาสแมวนิรนาม'}</span>
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={(e) => handleLike(e, activeCat.id, activeCat.likes_count || 0)}
                  className={`h-11 px-3 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}
                >
                  {isLiked ? '❤️' : '🤍'} {activeCat.likes_count || 0}
                </button>
                <button onClick={() => openGoogleMaps(activeCat.lat, activeCat.lng)} className="flex-1 h-11 bg-[#27272A] text-[#34D399] rounded-xl text-xs font-black cursor-pointer whitespace-nowrap">🗺 นำทาง</button>
                <button onClick={() => generatePokemonCard(activeCat)} className="flex-1 h-11 bg-[#FF9F43] text-[#0B0B0D] rounded-xl text-xs font-black cursor-pointer whitespace-nowrap">📱 การ์ด</button>
                {canEdit(activeCat) && (
                  <button onClick={() => openEdit(activeCat)} aria-label="แก้ไข" className="h-11 w-11 bg-[#27272A] text-[#F5F5F2] rounded-xl text-sm cursor-pointer shrink-0">✏️</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ────────────────────────────── Bottom Action Bar ────────────────────────────── */}
      {!pickingLocation && !showForm && !showList && !activeCat && (
        <div
          className="fixed inset-x-0 z-[8000] pointer-events-none flex items-center justify-center px-4"
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleRadarScan}
            disabled={isScanning}
            aria-label="สแกนหาเหมียวใกล้ตัว"
            title="สแกนหาเหมียวใกล้ตัว"
            className="pointer-events-auto absolute left-4 w-[48px] h-[48px] rounded-full bg-[#151518]/95 backdrop-blur-md border border-[#27272A] shadow-xl flex items-center justify-center text-xl cursor-pointer active:scale-95 disabled:opacity-60 transition-colors"
          >
            {isScanning ? '📡' : '🎯'}
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="pointer-events-auto bg-[#FF9F43] active:scale-95 text-[#0B0B0D] font-black px-6 py-3 rounded-full shadow-[0_8px_24px_rgba(255,159,67,0.4)] transition-all flex items-center gap-2 text-sm tracking-wide border-[3px] border-[#151518] cursor-pointer"
          >
            <span className="text-xl leading-none">+</span>
            <span>FIND A CAT</span>
          </button>
        </div>
      )}

      {/* ────────────────────────────── List Overlay ────────────────────────────── */}
      {showList && (
        <div className="fixed inset-0 bg-[#0B0B0D]/95 backdrop-blur-md z-[99999] flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-5 pb-3 border-b border-[#27272A] bg-[#151518]" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div>
              <h2 className="text-[#F5F5F2] font-black text-lg flex items-center gap-2">🐾 CATS LIST</h2>
              <p className="text-[#8E8E96] text-[10px] font-bold mt-0.5">เหมียวที่เจอทั้งหมด</p>
            </div>
            <button onClick={() => setShowList(false)} aria-label="ปิด" className="w-10 h-10 rounded-full bg-[#27272A] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
            {filteredCats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#8E8E96]">
                <span className="text-4xl mb-3">{loadingCats ? '⏳' : '😿'}</span>
                <p className="font-semibold text-sm">{loadingCats ? 'กำลังโหลด...' : 'ไม่พบเหมียวในหมวดหมู่นี้'}</p>
              </div>
            ) : (
              filteredCats.map((cat) => {
                const cfg = STATUS_CONFIG[cat.belly_status];
                const isLiked = !!likedCats[cat.id];
                const photos = cat.photo_urls ?? [];
                return (
                  <div key={cat.id} className="bg-[#151518] border border-[#27272A] rounded-2xl p-3 flex gap-3 items-center">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#27272A] bg-[#0B0B0D]">
                      {photos[0] ? (
                        <img src={photos[0]} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🐱</div>
                      )}
                      {photos.length > 1 && (
                        <span className="absolute bottom-1 right-1 bg-[#0B0B0D]/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">+{photos.length - 1}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div onClick={() => flyToCat(cat.lat, cat.lng)} className="cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-[15px] truncate min-w-0">{cat.name}</h3>
                          <CollarBadge collar={cat.collar_status} />
                        </div>
                        <p className="text-[#8E8E96] text-[11px] truncate mt-0.5">📍 {cat.location}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2.5">
                        <span
                          className="text-[10px] font-black px-2 py-1 rounded-lg border whitespace-nowrap"
                          style={{ color: cfg.ring, backgroundColor: cfg.bg, borderColor: cfg.ring }}
                        >
                          {cfg.emoji} {cfg.label.split(' ')[0]}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openGoogleMaps(cat.lat, cat.lng)} aria-label="นำทาง" className="w-9 h-9 rounded-lg bg-[#27272A] text-sm flex items-center justify-center cursor-pointer">🗺️</button>
                          <button onClick={() => generatePokemonCard(cat)} aria-label="สร้างการ์ด" className="w-9 h-9 rounded-lg bg-[#FF9F43]/15 text-sm flex items-center justify-center cursor-pointer">📱</button>
                          {canEdit(cat) && (
                            <button onClick={() => openEdit(cat)} aria-label="แก้ไข" className="w-9 h-9 rounded-lg bg-[#27272A] text-sm flex items-center justify-center cursor-pointer">✏️</button>
                          )}
                          <button
                            onClick={(e) => handleLike(e, cat.id, cat.likes_count || 0)}
                            className={`h-9 px-2.5 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}
                          >
                            {isLiked ? '❤️' : '🤍'} {cat.likes_count || 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────── Share Card Overlay ────────────────────────────── */}
      {shareCat && (
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[999999] overflow-y-auto overscroll-contain animate-fade-in">
          <div className="min-h-full flex items-center justify-center p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="bg-[#151518] border border-[#27272A] p-4 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl">
              <h3 className="font-black text-base mb-1 text-[#FF9F43]">{shareCardImage ? 'การ์ดเหมียวพร้อมแล้ว !' : 'กำลังสร้างการ์ดเหมียว...'}</h3>
              <p className="text-xs text-[#8E8E96] mb-3 text-center">กดปุ่มด้านล่างเพื่อบันทึกหรือแชร์รูปการ์ด</p>
              <div className="w-full min-h-[16rem] rounded-2xl border border-[#27272A] mb-4 bg-[#0B0B0D] flex items-center justify-center p-2">
                {shareCardImage ? <img src={shareCardImage} alt="Profile Card" className="max-h-[55dvh] w-auto max-w-full object-contain rounded-xl" /> : <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />}
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={downloadCard} disabled={!shareCardImage} className="flex-1 bg-[#FF9F43] disabled:opacity-40 text-[#0B0B0D] font-black py-3.5 rounded-xl text-sm text-center cursor-pointer shadow-lg">เซฟ & แชร์</button>
                <button onClick={closeShare} className="px-5 bg-[#27272A] text-[#F5F5F2] font-bold py-3.5 rounded-xl text-sm cursor-pointer">ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────── Pick Location Map Overlay & Search ────────────────────────────── */}
      {pickingLocation && (
        <div className="fixed inset-0 z-[8000] pointer-events-none flex flex-col">
          <div className="relative bg-[#0B0B0D]/90 backdrop-blur-md px-4 pb-3 flex flex-col gap-2.5 pointer-events-auto border-b border-[#27272A] shadow-xl" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div className="flex justify-between items-center w-full">
              <button onClick={() => { setPickingLocation(false); setShowForm(true); }} className="text-[#F5F5F2] font-bold text-sm cursor-pointer py-1">✕ ยกเลิก</button>
              <span className="text-[#FF9F43] font-bold text-sm">เลื่อนหรือค้นหาสถานที่</span>
              <div className="w-12"></div>
            </div>

            <form onSubmit={handleSearchLocation} className="relative w-full">
              <input
                type="text"
                placeholder="พิมพ์ชื่อสถานที่, จังหวัด, ถนน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 pl-10 pr-20 bg-[#151518] border border-[#27272A] rounded-xl text-[#F5F5F2] outline-none focus:border-[#FF9F43]"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#27272A] text-xs font-bold px-3 py-2 rounded-lg text-[#F5F5F2] cursor-pointer">
                {isSearchingLoc ? '⏳' : 'ค้นหา'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="absolute top-[100%] left-4 right-4 bg-[#151518] border border-[#27272A] rounded-xl mt-2 overflow-hidden shadow-2xl max-h-60 overflow-y-auto z-[9000]">
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    onClick={() => jumpToLocation(res.lat, res.lon, res.display_name)}
                    className="p-3 border-b border-[#27272A] last:border-0 active:bg-[#27272A] cursor-pointer text-sm"
                  >
                    <p className="font-bold text-[#F5F5F2] truncate">{res.display_name.split(',')[0]}</p>
                    <p className="text-xs text-[#8E8E96] truncate mt-0.5">{res.display_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#FF9F43] bg-[#FF9F43]/30 shadow-[0_0_25px_rgba(255,159,67,0.8)] animate-pulse" />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto" style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <button onClick={confirmPickedLocation} className="bg-[#34D399] text-[#0B0B0D] font-black px-8 py-4 rounded-full shadow-[0_8px_24px_rgba(52,211,153,0.45)] border-[3px] border-[#151518] flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <span className="text-lg">✓</span> ยืนยันพิกัดนี้
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────── Add / Edit Form ────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-[#0B0B0D]/80 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#151518] border-t sm:border border-[#27272A] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] px-5 pt-5 shadow-2xl relative max-h-[92dvh] overflow-y-auto overscroll-contain animate-sheet-in" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
              <h2 className="text-[#F5F5F2] font-black text-lg flex items-center gap-2">
                {editingCat ? '✏️ แก้ไขข้อมูล (ได้ครั้งเดียว)' : '🐱 เพิ่มแมวที่พบ'}
              </h2>
              <button onClick={closeForm} aria-label="ปิด" className="w-9 h-9 rounded-full bg-[#27272A] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddCat} className="space-y-4">
              {!editingCat && (
                <div>
                  <label className="block text-xs font-bold text-[#8E8E96] mb-2">📷 รูปถ่ายน้องแมว (สูงสุด {MAX_PHOTOS} รูป)</label>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {photoPreviews.map((src, i) => (
                      <div key={src} className="relative min-w-[80px] h-[80px] rounded-2xl overflow-hidden border border-[#27272A]">
                        <img src={src} className="w-full h-full object-cover" alt="" />
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePhoto(i); }} className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-6 h-6 rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                      </div>
                    ))}
                    {photoFiles.length < MAX_PHOTOS && (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }} className="min-w-[80px] h-[80px] rounded-2xl border-2 border-dashed border-[#27272A] flex flex-col items-center justify-center text-[#FF9F43] cursor-pointer"><span className="text-xl">+</span></button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ชื่อเรียก</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เจ้าส้ม" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">สถานที่เจอ</label>
                  <input type="text" required value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="เช่น หน้าคาเฟ่" className={inputCls} />
                </div>
              </div>

              {!editingCat && (
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระบุพิกัด {hasLocation && <span className="text-[#34D399] ml-1">✓ ระบุตำแหน่งแล้ว</span>}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleUseMyLocation} disabled={locating} className="bg-[#27272A] text-[#F5F5F2] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer">{locating ? '⏳ กำลังหา...' : 'ตำแหน่งปัจจุบัน'}</button>
                    <button type="button" onClick={() => { setShowForm(false); setPickingLocation(true); }} className="bg-[#27272A] text-[#FF9F43] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer">🔍 ค้นหา / ปักหมุดเอง</button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">สถานะน้องเหมียว</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setCollarStatus('stray')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'stray' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A]'}`}>เหมียวจร</button>
                  <button type="button" onClick={() => setCollarStatus('collared')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'collared' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A]'}`}>เหมียวมีบ้าน</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระดับความพุง</label>
                <select value={bellyStatus} onChange={(e) => setBellyStatus(e.target.value as BellyStatus)} className={`${inputCls} font-semibold`}>
                  <option value="safe">เฟรนลี่ — จกพุงได้สบาย ชอบให้เกา</option>
                  <option value="caution">คาดเดาไม่ได้ — ระวังโดนสวบ</option>
                  <option value="danger">โขด — ห้ามจับพุงเด็ดขาด!</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">พบเจอโดย <span className="font-normal opacity-50">- ไม่บังคับ</span></label>
                <input type="text" value={discoveredBy} onChange={(e) => setDiscoveredBy(e.target.value)} placeholder="ชื่อ/ไอจี" className={inputCls} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">คำอธิบายเพิ่มเติม</label>
                <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className={inputCls} />
              </div>

              <button type="submit" disabled={saving} className="w-full bg-[#FF9F43] disabled:opacity-60 disabled:cursor-not-allowed text-[#0B0B0D] font-black py-4 rounded-xl text-sm tracking-wide mt-2 cursor-pointer shadow-lg">
                {saving ? 'กำลังบันทึก...' : editingCat ? 'บันทึกการแก้ไข' : 'SAVE CAT SPOT'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
