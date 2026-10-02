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
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
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
}

const STATUS_CONFIG: Record<BellyStatus, { label: string; text: string; emoji: string; ring: string; bg: string }> = {
  safe: { label: 'SAFE ZONE', text: 'จกพุงได้สบาย ชอบให้เกา', emoji: '🟢', ring: '#34D399', bg: 'rgba(52, 211, 153, 0.15)' },
  caution: { label: 'CAUTION ZONE', text: 'จกได้นิดหน่อย ระวังโดนสวบ', emoji: '🟡', ring: '#FBBF24', bg: 'rgba(251, 191, 36, 0.15)' },
  danger: { label: 'DANGER ZONE', text: 'ห้ามจกพุงเด็ดขาด!', emoji: '🔴', ring: '#FB7185', bg: 'rgba(251, 113, 133, 0.15)' },
};

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'เหมียวทั้งหมด 🐾' },
  { id: 'safe', label: '🟢 เฟรนลี่' },
  { id: 'caution', label: '🟡 คาดเดาไม่ได้' },
  { id: 'danger', label: '🔴 โขด' },
  { id: 'stray', label: '🚷 เหมียวจร' },
  { id: 'collared', label: '🏷️ เหมียวมีบ้าน' },
];

const MAX_PHOTOS = 3;
const DEFAULT_CENTER: [number, number] = [18.7883, 98.9853];
const LIKES_STORAGE_KEY = 'bellydontbully_liked_cats';

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

/* ────────────────────────────── Canvas Helpers (ละไว้เพื่อความกระชับ - ใช้ของเดิม) ────────────────────────────── */
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

function PhotoCarousel({ photos, alt, size }: { photos: string[]; alt: string; size: 'md' | 'sm' }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const safeIndex = index < total ? index : 0;

  if (total === 0) return <div className="w-full h-full bg-[#0B0B0D] flex items-center justify-center text-3xl">🐱</div>;

  const go = (e: ReactMouseEvent, delta: number) => { e.stopPropagation(); setIndex((safeIndex + delta + total) % total); };
  const btn = size === 'md' ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]';

  return (
    <div className="relative w-full h-full bg-[#0B0B0D]">
      <img src={photos[safeIndex]} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      {total > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, -1)} className={`absolute left-1.5 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white rounded-full flex items-center justify-center font-bold cursor-pointer ${btn}`}>‹</button>
          <button type="button" onClick={(e) => go(e, 1)} className={`absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white rounded-full flex items-center justify-center font-bold cursor-pointer ${btn}`}>›</button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[#0B0B0D]/70 px-2 py-0.5 rounded-full text-[9px] font-bold text-white tracking-widest">{safeIndex + 1}/{total}</div>
        </>
      )}
    </div>
  );
}

function CollarBadge({ collar }: { collar?: CollarStatus }) {
  return collar === 'collared' ? (
    <span className="bg-[#FF9F43]/20 text-[#FF9F43] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#FF9F43]/30 shrink-0 whitespace-nowrap">เหมียวมีบ้าน</span>
  ) : (
    <span className="bg-[#8E8E96]/20 text-[#8E8E96] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#8E8E96]/30 shrink-0 whitespace-nowrap">เหมียวจร</span>
  );
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);

  const mapRef = useRef<LeafletMap | null>(null);
  const pendingFlyRef = useRef<[number, number] | null>(null);
  const iconCacheRef = useRef(new Map<string, DivIcon>());
  const photoPreviewsRef = useRef<string[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

  const [cats, setCats] = useState<CatData[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [likedCats, setLikedCats] = useState<Record<number, boolean>>({});

  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);

  const [shareCat, setShareCat] = useState<CatData | null>(null);
  const [shareCardImage, setShareCardImage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // States for Radar Scan
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResultCount, setScannedResultCount] = useState<number | null>(null);

  // States for Location Search (Pick Location)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
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

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

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

    if (!isSupabaseConfigured || !supabase) {
      setLoadingCats(false);
      return;
    }

    let cancelled = false;
    supabase
      .from('cats')
      .select('*')
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setCats(data as CatData[]);
        setLoadingCats(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => { photoPreviewsRef.current = photoPreviews; }, [photoPreviews]);

  // ฟังก์ชันค้นหาสถานที่ผ่าน OpenStreetMap
  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchingLoc(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=th&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
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
    if (!mapRef.current || cats.length === 0) return;
    setIsScanning(true);
    setScannedResultCount(null);

    // จำลองเวลาสแกน 2.5 วินาที
    setTimeout(() => {
      const center = mapRef.current!.getCenter();
      // คำนวณหาแมวในรัศมี 3 กม.
      const nearbyCats = cats.filter(c => getDistanceKM(center.lat, center.lng, c.lat, c.lng) <= 3);
      
      setIsScanning(false);
      setScannedResultCount(nearbyCats.length);

      // ซ่อนแจ้งเตือนอัตโนมัติ
      setTimeout(() => setScannedResultCount(null), 5000);
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

    const icon = leafletLib.divIcon({
      className: 'custom-cat-marker bg-transparent border-0',
      html: `
        <div style="width:56px;height:56px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6));">
          <div style="position:absolute;font-size:40px;line-height:1;z-index:0;">🐱</div>
          <img src="/pins/${cacheKey}.png" alt="cat pin" style="width:100%;height:100%;object-fit:contain;position:relative;z-index:1;" onerror="this.style.display='none'" />
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      popupAnchor: [0, -28],
    });
    iconCacheRef.current.set(cacheKey, icon);
    return icon;
  }, [leafletLib]);

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

  const handleAddCat = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim() || !locationName.trim() || !hasLocation) return alert('กรุณากรอกชื่อ สถานที่ และระบุพิกัดให้เรียบร้อย');
    if (!isSupabaseConfigured || !supabase) return;

    setSaving(true);
    let photoUrls: string[] = [];
    if (photoFiles.length > 0) {
      try { photoUrls = await uploadCatPhotos(photoFiles); } 
      catch (err) { console.error(err); alert('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'); setSaving(false); return; }
    }

    const cfg = STATUS_CONFIG[bellyStatus];
    const { data, error } = await supabase.from('cats').insert([{
      name: name.trim(), location: locationName.trim(), lat: parseFloat(lat), lng: parseFloat(lng),
      belly_status: bellyStatus, collar_status: collarStatus, belly_text: `${cfg.emoji} ${cfg.label} — ${cfg.text}`,
      details: details.trim(), photo_urls: photoUrls, discovered_by: discoveredBy.trim() || 'ทาสแมวนิรนาม', likes_count: 0,
    }]).select();

    if (!error && data) {
      setCats((prev) => [data[0] as CatData, ...prev]);
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
    try { setShareCardImage(await renderCatCard(cat)); } catch (err) { alert('สร้างการ์ดไม่สำเร็จ ลองใหม่อีกครั้งนะ'); setShareCat(null); }
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
    } catch {}
    const link = document.createElement('a'); link.href = shareCardImage; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const popupMaxHeight = typeof window === 'undefined' ? 420 : Math.max(260, Math.min(460, window.innerHeight - 260));

  return (
    <main className="relative w-screen h-[100svh] overflow-hidden bg-[#0B0B0D] text-[#F5F5F2] select-none font-sans">
      
      {/* ────────────────────────────── Header UI ────────────────────────────── */}
      {!pickingLocation && (
        <div className="absolute left-4 right-4 z-[3000] pointer-events-none flex flex-col gap-2.5" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="flex justify-between items-start">
            <div className="pointer-events-auto bg-[#151518]/95 backdrop-blur-md border border-[#27272A] p-3 rounded-2xl shadow-2xl flex items-center gap-3">
              <span className="text-2xl">🐾</span>
              <div>
                <h1 className="font-black text-[#F5F5F2] text-sm tracking-wide leading-tight">BELLY DON&apos;T BULLY</h1>
                <p className="text-[#8E8E96] text-[10px] uppercase font-semibold tracking-wider">cat map found</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => setShowList(true)}
                className="pointer-events-auto bg-[#151518]/95 hover:bg-[#27272A] transition-colors backdrop-blur-md border border-[#27272A] px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="text-[#8E8E96] text-xs font-bold">FOUND</span>
                <span className="bg-[#FF9F43]/20 text-[#FF9F43] border border-[#FF9F43]/30 px-2 py-0.5 rounded-lg text-xs font-black">
                  {loadingCats ? '…' : cats.length} 🐱
                </span>
              </button>

              {/* ปุ่ม Radar Scan */}
              <button
                onClick={handleRadarScan}
                disabled={isScanning}
                className="pointer-events-auto bg-[#151518]/95 hover:bg-[#27272A] disabled:opacity-50 transition-colors backdrop-blur-md border border-[#27272A] px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="text-xl">{isScanning ? '📡' : '🎯'}</span>
                <span className="text-[#34D399] text-xs font-bold whitespace-nowrap">
                  {isScanning ? 'กำลังสแกน...' : 'สแกนหาเหมียว'}
                </span>
              </button>
            </div>
          </div>

          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 whitespace-nowrap border transition-all cursor-pointer shadow-md ${selectedFilter === tab.id ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#151518]/95 text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* แจ้งเตือนผลสแกนเรดาร์ */}
          {scannedResultCount !== null && (
            <div className="pointer-events-auto bg-[#34D399] text-[#0B0B0D] px-4 py-3 rounded-2xl font-black text-sm shadow-[0_4px_20px_rgba(52,211,153,0.4)] animate-bounce self-center mt-2 flex items-center gap-2">
              🚨 พบแมว {scannedResultCount} ตัว ในรัศมี 3 กม.!
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
                <div className="w-[300px] h-[300px] border-2 border-[#34D399] rounded-full animate-ping opacity-60 bg-[#34D399]/20 shadow-[0_0_50px_rgba(52,211,153,0.8)]" />
              </div>
            )}
            
            <MapContainer center={mapCenter} zoom={15} zoomControl={false} className="w-full h-full">
              <MapRefBridge onReady={handleMapReady} />
              <TileLayer url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <ZoomControl position="bottomright" />
              {pickingLocation && <MapEventsBridge onMove={handlePickMove} />}

              {leafletLib && filteredCats.map((cat) => {
                const isLiked = !!likedCats[cat.id];
                const cfg = STATUS_CONFIG[cat.belly_status];
                return (
                  <Marker key={cat.id} position={[cat.lat, cat.lng]} icon={getCatIcon(cat)}>
                    <Popup minWidth={240} maxWidth={240} maxHeight={popupMaxHeight} autoPanPaddingTopLeft={[16, 150]} autoPanPaddingBottomRight={[16, 110]}>
                      <div className="w-[240px] bg-[#151518] text-[#F5F5F2] rounded-2xl overflow-hidden shadow-2xl relative">
                        <div className="absolute top-2 right-2 bg-[#0B0B0D]/80 backdrop-blur-md px-2 py-1 rounded-full border border-[#27272A] flex items-center gap-1.5 text-[10px] font-black text-[#FB7185] z-10 shadow-lg">
                          ❤️ {cat.likes_count || 0}
                        </div>
                        <div className="w-full h-36 border-b border-[#27272A]"><PhotoCarousel photos={cat.photo_urls ?? []} alt={cat.name} size="md" /></div>
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="font-black text-base flex items-center gap-1.5 min-w-0"><span>🐱</span><span className="truncate">{cat.name}</span></h3>
                            <CollarBadge collar={cat.collar_status} />
                          </div>
                          <p className="text-[#8E8E96] text-xs font-medium mb-3 break-words">📍 {cat.location}</p>
                          <div className="text-[11px] font-bold p-2.5 rounded-xl mb-2.5 border leading-relaxed" style={{ color: cfg.ring, backgroundColor: cfg.bg, borderColor: cfg.ring }}>
                            {cfg.emoji} {cfg.label} — {cfg.text}
                          </div>
                          {cat.details && <p className="text-xs text-[#8E8E96] bg-[#0B0B0D] p-2.5 rounded-xl border border-[#27272A] italic mb-2 break-words">&quot;{cat.details}&quot;</p>}
                          <p className="text-[10px] text-[#8E8E96] mt-1 mb-2 truncate">พบเจอโดย: <span className="text-[#F5F5F2] font-semibold">{cat.discovered_by || 'ทาสแมวนิรนาม'}</span></p>
                          <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-[#27272A] pt-2">
                            <button onClick={() => openGoogleMaps(cat.lat, cat.lng)} className="bg-[#27272A] hover:bg-[#3f3f46] text-[#34D399] px-2 py-1.5 rounded-xl text-[11px] font-black cursor-pointer whitespace-nowrap" title="นำทางด้วย Google Maps">🗺 จกพุงรึ..</button>
                            <button onClick={(e) => handleLike(e, cat.id, cat.likes_count || 0)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}>{isLiked ? '❤' : '🤍'}</button>
                          </div>
                          <button onClick={() => generatePokemonCard(cat)} className="w-full mt-2 bg-[#FF9F43] hover:bg-[#ff8f24] text-[#0B0B0D] py-2 rounded-xl text-xs font-black cursor-pointer shadow-md">📱 สร้างการ์ดโปรไฟล์</button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </>
        ) : (
          <div className="w-full h-full bg-[#0B0B0D] flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#8E8E96] text-xs font-bold tracking-widest uppercase">Loading Map...</p>
          </div>
        )}
      </div>

      {/* ────────────────────────────── Bottom Add Button ────────────────────────────── */}
      {!pickingLocation && !showForm && !showList && (
        <div className="fixed left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto" style={{ bottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <button onClick={() => setShowForm(true)} className="bg-[#FF9F43] hover:bg-[#ff8f24] active:scale-95 text-[#0B0B0D] font-black px-8 py-4 rounded-full shadow-[0_12px_35px_rgba(255,159,67,0.5)] transition-all flex items-center gap-2 text-sm tracking-wide border-[3px] border-[#151518] cursor-pointer">
            <span className="text-xl leading-none">+</span>
            <span>FIND A CAT</span>
          </button>
        </div>
      )}

      {/* ────────────────────────────── List Overlay ────────────────────────────── */}
      {showList && (
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[99999] flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-6 pb-5 border-b border-[#27272A] bg-[#151518]" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
            <div><h2 className="text-[#F5F5F2] font-black text-xl flex items-center gap-2">🐾 CATS LIST</h2><p className="text-[#8E8E96] text-xs font-bold uppercase mt-1 tracking-widest">any cats we found</p></div>
            <button onClick={() => setShowList(false)} className="w-10 h-10 rounded-full bg-[#27272A] hover:bg-[#3f3f46] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer transition-colors">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
            {filteredCats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#8E8E96]"><span className="text-4xl mb-3">{loadingCats ? '⏳' : '😿'}</span><p className="font-semibold text-sm">{loadingCats ? 'กำลังโหลด...' : 'ไม่พบเหมียวในหมวดหมู่นี้'}</p></div>
            ) : (
              filteredCats.map((cat) => {
                const cfg = STATUS_CONFIG[cat.belly_status]; const isLiked = !!likedCats[cat.id];
                return (
                  <div key={cat.id} className="bg-[#151518] border border-[#27272A] rounded-2xl p-3 flex gap-4 items-center">
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#27272A]"><PhotoCarousel photos={cat.photo_urls ?? []} alt={cat.name} size="sm" /></div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div onClick={() => flyToCat(cat.lat, cat.lng)} className="cursor-pointer">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h3 className="font-black text-[#F5F5F2] truncate text-base min-w-0">{cat.name}</h3>
                          <CollarBadge collar={cat.collar_status} />
                        </div>
                        <p className="text-[#8E8E96] text-[10px] font-medium truncate mb-2">📍 {cat.location}</p>
                        <div className="inline-block text-[9px] font-bold px-2 py-1 rounded-lg border" style={{ color: cfg.ring, backgroundColor: cfg.bg, borderColor: cfg.ring }}>{cfg.emoji} {cfg.label}</div>
                      </div>
                      <div className="flex justify-between items-center gap-2 mt-3 border-t border-[#27272A] pt-2">
                        <div className="flex gap-2 min-w-0">
                          <button onClick={() => openGoogleMaps(cat.lat, cat.lng)} className="bg-[#27272A] text-[#34D399] px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap">🗺️ จกพุงรึ..</button>
                          <button onClick={() => generatePokemonCard(cat)} className="bg-[#FF9F43]/20 text-[#FF9F43] px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap">📱 การ์ด</button>
                        </div>
                        <button onClick={(e) => handleLike(e, cat.id, cat.likes_count || 0)} className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black cursor-pointer shrink-0 ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}>{isLiked ? '❤️' : '🤍'} {cat.likes_count || 0}</button>
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
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[999999] overflow-y-auto animate-fade-in">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-[#151518] border border-[#27272A] p-4 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl">
              <h3 className="font-black text-base mb-1 text-[#FF9F43]">{shareCardImage ? 'การ์ดเหมียวพร้อมแล้ว !' : 'กำลังสร้างการ์ดเหมียว...'}</h3>
              <p className="text-xs text-[#8E8E96] mb-3 text-center">กดปุ่มด้านล่างเพื่อบันทึกหรือแชร์รูปการ์ด</p>
              <div className="w-full min-h-[16rem] rounded-2xl border border-[#27272A] mb-4 bg-[#0B0B0D] flex items-center justify-center p-2">
                {shareCardImage ? <img src={shareCardImage} alt="Profile Card" className="max-h-[58svh] w-auto max-w-full object-contain rounded-xl" /> : <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />}
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={downloadCard} disabled={!shareCardImage} className="flex-1 bg-[#FF9F43] hover:bg-[#ff8f24] disabled:opacity-40 text-[#0B0B0D] font-black py-3 rounded-xl text-xs text-center cursor-pointer shadow-lg">เซฟ & แชร์</button>
                <button onClick={closeShare} className="px-4 bg-[#27272A] hover:bg-[#3f3f46] text-[#F5F5F2] font-bold py-3 rounded-xl text-xs cursor-pointer">ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────── Pick Location Map Overlay & Search ────────────────────────────── */}
      {pickingLocation && (
        <div className="fixed inset-0 z-[8000] pointer-events-none flex flex-col">
          {/* Top Bar with Search */}
          <div className="bg-[#0B0B0D]/90 backdrop-blur-md px-4 pb-4 pt-6 flex flex-col gap-3 pointer-events-auto border-b border-[#27272A] shadow-xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div className="flex justify-between items-center w-full">
              <button onClick={() => { setPickingLocation(false); setShowForm(true); }} className="text-[#F5F5F2] font-bold text-sm cursor-pointer">✕ ยกเลิก</button>
              <span className="text-[#FF9F43] font-bold text-sm">เลื่อนหรือค้นหาสถานที่</span>
              <div className="w-12"></div>
            </div>
            
            {/* Search Box */}
            <form onSubmit={handleSearchLocation} className="relative w-full">
              <input
                type="text"
                placeholder="พิมพ์ชื่อสถานที่, จังหวัด, ถนน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 pl-10 bg-[#151518] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#27272A] text-xs font-bold px-3 py-1.5 rounded-lg text-[#F5F5F2]">
                {isSearchingLoc ? '⏳' : 'ค้นหา'}
              </button>
            </form>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-[100%] left-4 right-4 bg-[#151518] border border-[#27272A] rounded-xl mt-2 overflow-hidden shadow-2xl max-h-60 overflow-y-auto z-[9000]">
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    onClick={() => jumpToLocation(res.lat, res.lon, res.display_name)}
                    className="p-3 border-b border-[#27272A] last:border-0 hover:bg-[#27272A] cursor-pointer text-sm"
                  >
                    <p className="font-bold text-[#F5F5F2] truncate">{res.display_name.split(',')[0]}</p>
                    <p className="text-xs text-[#8E8E96] truncate mt-0.5">{res.display_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#FF9F43] bg-[#FF9F43]/30 shadow-[0_0_25px_rgba(255,159,67,0.8)] animate-pulse" />
          </div>

          {/* Confirm Button */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto" style={{ bottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
            <button onClick={confirmPickedLocation} className="bg-[#34D399] hover:bg-[#2bc288] text-[#0B0B0D] font-black px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(52,211,153,0.5)] border-[3px] border-[#151518] flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <span className="text-lg">✓</span> ยืนยันพิกัดนี้
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────── Add Form ────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-[#0B0B0D]/80 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#151518] border-t sm:border border-[#27272A] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] px-6 pt-6 shadow-2xl relative max-h-[92svh] overflow-y-auto animate-sheet-in" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-5 border-b border-[#27272A] pb-4">
              <h2 className="text-[#F5F5F2] font-black text-lg flex items-center gap-2"><span>🐱</span> เพิ่มแมวที่พบ</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-[#27272A] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddCat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8E8E96] mb-2 uppercase">📷 รูปถ่ายน้องแมว (สูงสุด {MAX_PHOTOS} รูป)</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {photoPreviews.map((src, i) => (
                    <div key={src} className="relative min-w-[80px] h-[80px] rounded-2xl overflow-hidden border border-[#27272A]">
                      <img src={src} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePhoto(i); }} className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                    </div>
                  ))}
                  {photoFiles.length < MAX_PHOTOS && (
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }} className="min-w-[80px] h-[80px] rounded-2xl border-2 border-dashed border-[#27272A] flex flex-col items-center justify-center text-[#FF9F43] hover:bg-[#27272A]/30 cursor-pointer"><span className="text-xl">+</span></button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ชื่อเรียก</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เจ้าส้ม" className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">สถานที่เจอ</label>
                  <input type="text" required value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="เช่น หน้าคาเฟ่" className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระบุพิกัด {hasLocation && <span className="text-[#34D399] ml-1">✓ ระบุตำแหน่งแล้ว</span>}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={handleUseMyLocation} disabled={locating} className="bg-[#27272A] hover:bg-[#3f3f46] text-[#F5F5F2] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer">{locating ? '⏳ กำลังหา...' : 'ตำแหน่งปัจจุบัน'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setPickingLocation(true); }} className="bg-[#27272A] hover:bg-[#3f3f46] text-[#FF9F43] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer shadow-md">🔍 ค้นหา / ปักหมุดเอง</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">สถานะน้องเหมียว</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setCollarStatus('stray')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'stray' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}>เหมียวจร</button>
                  <button type="button" onClick={() => setCollarStatus('collared')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'collared' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}>เหมียวมีบ้าน</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระดับความพุง</label>
                <select value={bellyStatus} onChange={(e) => setBellyStatus(e.target.value as BellyStatus)} className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43] font-semibold">
                  <option value="safe">เฟรนลี่ — จกพุงได้สบาย ชอบให้เกา</option>
                  <option value="caution">คาดเดาไม่ได้ — ระวังโดนสวบ</option>
                  <option value="danger">โขด — ห้ามจับพุงเด็ดขาด!</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">พบเจอโดย <span className="font-normal opacity-50">- ไม่บังคับ</span></label>
                <input type="text" value={discoveredBy} onChange={(e) => setDiscoveredBy(e.target.value)} placeholder="ชื่อ/ไอจี" className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">คำอธิบายเพิ่มเติม</label>
                <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
              </div>

              <button type="submit" disabled={saving} className="w-full bg-[#FF9F43] hover:bg-[#ff8f24] disabled:opacity-60 disabled:cursor-not-allowed text-[#0B0B0D] font-black py-4 rounded-xl text-sm tracking-wide mt-2 cursor-pointer shadow-lg">
                {saving ? 'กำลังปักหมุดจำ...' : 'SAVE CAT SPOT'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
