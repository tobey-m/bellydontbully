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
  { id: 'all', label: 'ทั้งหมด 🐾' },
  { id: 'safe', label: '🟢 เฟรนลี่' },
  { id: 'caution', label: '🟡 คาดเดาไม่ได้' },
  { id: 'danger', label: '🔴 โขด' },
  { id: 'stray', label: '🚷 แมวจร' },
  { id: 'collared', label: '🏷️ มีปลอกคอ' },
];

const MAX_PHOTOS = 3;
const DEFAULT_CENTER: [number, number] = [18.7883, 98.9853];
const LIKES_STORAGE_KEY = 'bellydontbully_liked_cats';

/* ────────────────────────────── Canvas helpers (TCG card) ────────────────────────────── */

const CARD_W = 825;
const CARD_H = 1125;

// สีการ์ดตามระดับความปลอดภัยของพุง (เหมือน "ธาตุ" ของโปเกมอน)
const CARD_THEME: Record<BellyStatus, { top: string; bottom: string; accent: string; dark: string; glyph: string }> = {
  safe: { top: '#EEFBF3', bottom: '#BFE9D2', accent: '#2FB37A', dark: '#14573B', glyph: '♥' },
  caution: { top: '#FFF9E0', bottom: '#F8E3A0', accent: '#E0A100', dark: '#6E4F00', glyph: '!' },
  danger: { top: '#FFECEF', bottom: '#F6C3CB', accent: '#E0455A', dark: '#7A1626', glyph: '✕' },
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

/** ตัดคำ — ใช้ Intl.Segmenter (รองรับภาษาไทย) ถ้าไม่มีจะตัดทีละตัวอักษร */
function segmentText(text: string): string[] {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      const seg = new Intl.Segmenter('th', { granularity: 'word' });
      return Array.from(seg.segment(text), (s) => s.segment);
    }
  } catch {
    /* fall through */
  }
  return Array.from(text);
}

/** ตัดข้อความให้พอดีความกว้างและจำกัดจำนวนบรรทัด (เกินแล้วต่อท้ายด้วย …) */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const tokens = segmentText(clean).flatMap((t) =>
    ctx.measureText(t).width > maxWidth ? Array.from(t) : [t]
  );

  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    const test = line + token;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line.trimEnd());
      line = token.trimStart();
    }
  }
  if (line) lines.push(line.trimEnd());

  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines);
    let last = out[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1);
    }
    out[maxLines - 1] = last + '…';
    return out;
  }
  return lines;
}

/** วาดรูปแบบ object-fit: cover (ครอปกึ่งกลาง เอียงขึ้นบนเล็กน้อยเพราะหน้าแมวมักอยู่ครึ่งบน) */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) * 0.4;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/** ลูกแก้วพลังงานสไตล์การ์ด TCG */
function drawOrb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  dark: string,
  glyph: string,
  glyphFont: string,
) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.35, color);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = glyphFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

async function renderCatCard(cat: CatData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');

  // ใช้ฟอนต์เดียวกับหน้าเว็บ (next/font ตั้งชื่อ family เอง จึงดึงจาก computed style)
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (size: number, bold = false) => `${bold ? '700' : '400'} ${size}px ${family}`;
  try { await document.fonts.ready; } catch { /* ignore */ }

  const cfg = STATUS_CONFIG[cat.belly_status];
  const theme = CARD_THEME[cat.belly_status];
  const likes = cat.likes_count || 0;
  const collarLabel = cat.collar_status === 'collared' ? 'มีปลอกคอ' : 'แมวจร';
  const photoUrl = cat.photo_urls?.[0];
  const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;

  ctx.textBaseline = 'alphabetic';

  /* 1. ขอบทอง (foil) */
  const gold = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  gold.addColorStop(0, '#E6C687');
  gold.addColorStop(0.5, '#FBE9BF');
  gold.addColorStop(1, '#C8A25D');
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  for (let x = -CARD_H; x < CARD_W; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CARD_H, CARD_H);
    ctx.stroke();
  }

  ctx.strokeStyle = '#8A6A35';
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 3, 3, CARD_W - 6, CARD_H - 6, 28);
  ctx.stroke();

  /* 2. พื้นการ์ดไล่สีตามธาตุ */
  const bg = ctx.createLinearGradient(0, 35, 0, 1090);
  bg.addColorStop(0, theme.top);
  bg.addColorStop(1, theme.bottom);
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = bg;
  drawRoundedRect(ctx, 35, 35, 755, 1055, 24);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(138,106,53,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  /* 3. ส่วนหัว: แท็กขั้น + ชื่อ + HP */
  ctx.textAlign = 'left';
  ctx.font = font(15, true);
  const tag = 'พื้นฐาน · แมวเหมียว';
  const tagW = ctx.measureText(tag).width + 24;
  ctx.fillStyle = theme.accent;
  drawRoundedRect(ctx, 62, 52, tagW, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(tag, 74, 72);

  ctx.fillStyle = theme.dark;
  ctx.font = font(42, true);
  ctx.fillText(wrapText(ctx, cat.name, 470, 1)[0] ?? '', 64, 126);

  drawOrb(ctx, 742, 100, 24, theme.accent, theme.dark, theme.glyph, font(22, true));
  ctx.textAlign = 'right';
  ctx.fillStyle = '#C0392B';
  ctx.font = font(52, true);
  ctx.fillText('160', 700, 118);
  const hpW = ctx.measureText('160').width;
  ctx.font = font(22, true);
  ctx.fillText('HP', 700 - hpW - 8, 116);

  /* 4. กรอบรูป (ครอปให้พอดี) */
  const FX = 55, FY = 150, FW = 715, FH = 470;
  const frame = ctx.createLinearGradient(FX, FY, FX + FW, FY + FH);
  frame.addColorStop(0, '#E9CE92');
  frame.addColorStop(0.5, '#FFF1CF');
  frame.addColorStop(1, '#C49A52');
  ctx.fillStyle = frame;
  drawRoundedRect(ctx, FX, FY, FW, FH, 20);
  ctx.fill();

  const PX = FX + 13, PY = FY + 13, PW = FW - 26, PH = FH - 26;
  ctx.fillStyle = '#E0D6C3';
  drawRoundedRect(ctx, PX, PY, PW, PH, 12);
  ctx.fill();

  if (img) {
    ctx.save();
    drawRoundedRect(ctx, PX, PY, PW, PH, 12);
    ctx.clip();
    drawCover(ctx, img, PX, PY, PW, PH);

    // เงาไล่ด้านล่าง + แสงสะท้อนแบบ holo
    const vignette = ctx.createLinearGradient(0, PY + PH * 0.7, 0, PY + PH);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(PX, PY, PW, PH);

    const shine = ctx.createLinearGradient(PX, PY, PX + PW, PY + PH);
    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.42, 'rgba(255,255,255,0)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    shine.addColorStop(0.58, 'rgba(255,255,255,0)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(PX, PY, PW, PH);
    ctx.restore();
  } else {
    ctx.textAlign = 'center';
    ctx.font = font(170);
    ctx.fillStyle = '#9A7B4C';
    ctx.fillText('🐱', PX + PW / 2, PY + PH / 2 + 60);
  }

  ctx.strokeStyle = 'rgba(74,53,37,0.7)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, PX, PY, PW, PH, 12);
  ctx.stroke();

  /* 5. ริบบิ้นข้อมูลใต้รูป (บรรทัดเดียว ถ้ายาวตัดด้วย …) */
  ctx.font = font(17, true);
  const ribbon = `No.${String(cat.id).padStart(3, '0')}  ·  ${collarLabel}  ·  ${cat.location}`;
  const ribbonText = wrapText(ctx, ribbon, 620, 1)[0] ?? '';
  const ribbonW = Math.min(ctx.measureText(ribbonText).width + 44, 690);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  drawRoundedRect(ctx, (CARD_W - ribbonW) / 2, 634, ribbonW, 34, 17);
  ctx.fill();
  ctx.strokeStyle = '#C8A25D';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = theme.dark;
  ctx.textAlign = 'center';
  ctx.fillText(ribbonText, CARD_W / 2, 657);

  /* 6. สกิลที่ 1: ระดับความปลอดภัยของพุง */
  drawOrb(ctx, 100, 722, 20, theme.accent, theme.dark, theme.glyph, font(18, true));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2C221E';
  ctx.font = font(28, true);
  ctx.fillText(cfg.label, 134, 732);

  ctx.font = font(17);
  ctx.fillStyle = '#4A3F36';
  ctx.fillText(wrapText(ctx, cfg.text, 640, 1)[0] ?? '', 90, 768);

  if (cat.details) {
    ctx.fillStyle = '#6B5B4B';
    wrapText(ctx, `“${cat.details}”`, 640, 2).forEach((l, i) => ctx.fillText(l, 90, 796 + i * 24));
  }

  ctx.strokeStyle = 'rgba(138,106,53,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(65, 836);
  ctx.lineTo(760, 836);
  ctx.stroke();

  /* 7. สกิลที่ 2: ดาเมจตามยอดไลก์ */
  drawOrb(ctx, 100, 880, 20, '#F59E0B', '#B45309', '★', font(18, true));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2C221E';
  ctx.font = font(28, true);
  ctx.fillText('ฮีลใจขยี้พุง', 134, 890);

  ctx.textAlign = 'right';
  ctx.font = font(40, true);
  ctx.fillText(`${likes * 10 + 50}`, 740, 892);

  ctx.textAlign = 'left';
  ctx.font = font(17);
  ctx.fillStyle = '#4A3F36';
  wrapText(ctx, 'สร้างดาเมจความน่ารักใส่ทาสแมว ทำให้อยากวิ่งเข้าไปหวีดทันที', 640, 2)
    .forEach((l, i) => ctx.fillText(l, 90, 926 + i * 24));

  /* 8. แถวจุดอ่อน / ต้านทาน / ถอย */
  const SX = 65, SY = 968, SW = 695, SH = 50;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  drawRoundedRect(ctx, SX, SY, SW, SH, 12);
  ctx.fill();
  ctx.strokeStyle = '#C8A25D';
  ctx.lineWidth = 2;
  ctx.stroke();

  const cols = [
    { label: 'จุดอ่อน', value: '🐟 ×2' },
    { label: 'ต้านทาน', value: '✋ −30' },
    { label: 'ถอย', value: '🐾🐾' },
  ];
  const colW = SW / cols.length;
  cols.forEach((c, i) => {
    const cx = SX + colW * i + colW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7A6A58';
    ctx.font = font(12, true);
    ctx.fillText(c.label, cx, SY + 19);
    ctx.fillStyle = '#2C221E';
    ctx.font = font(17, true);
    ctx.fillText(c.value, cx, SY + 40);
    if (i > 0) {
      ctx.strokeStyle = 'rgba(200,162,93,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(SX + colW * i, SY + 8);
      ctx.lineTo(SX + colW * i, SY + SH - 8);
      ctx.stroke();
    }
  });

  /* 9. ท้ายการ์ด */
  const [raritySymbol, rarityLabel] = likes >= 15 ? ['★', 'Rare'] : likes >= 5 ? ['◆', 'Uncommon'] : ['●', 'Common'];

  ctx.textAlign = 'left';
  ctx.fillStyle = '#4A3F36';
  ctx.font = font(13, true);
  ctx.fillText(wrapText(ctx, `เปิดวาร์ปโดย: ${cat.discovered_by || 'ทาสแมวนิรนาม'}`, 480, 1)[0] ?? '', 70, 1050);
  ctx.font = font(12);
  ctx.fillStyle = '#7A6A58';
  ctx.fillText("© 2026 Belly Don't Bully • TCG Edition", 70, 1072);

  ctx.textAlign = 'right';
  ctx.font = font(13, true);
  ctx.fillStyle = '#4A3F36';
  ctx.fillText(`${raritySymbol} ${rarityLabel}`, 755, 1050);
  ctx.font = font(12);
  ctx.fillStyle = '#7A6A58';
  ctx.fillText('Illus. Cat Lover Club', 755, 1072);

  return canvas.toDataURL('image/png');
}

/* ────────────────────────────── Small shared components ────────────────────────────── */

function PhotoCarousel({ photos, alt, size }: { photos: string[]; alt: string; size: 'md' | 'sm' }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const safeIndex = index < total ? index : 0;

  if (total === 0) {
    return (
      <div className="w-full h-full bg-[#0B0B0D] flex items-center justify-center text-3xl">
        🐱
      </div>
    );
  }

  const go = (e: ReactMouseEvent, delta: number) => {
    e.stopPropagation();
    setIndex((safeIndex + delta + total) % total);
  };

  const btn = size === 'md' ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]';

  return (
    <div className="relative w-full h-full bg-[#0B0B0D]">
      <img src={photos[safeIndex]} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => go(e, -1)}
            className={`absolute left-1.5 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white rounded-full flex items-center justify-center font-bold cursor-pointer ${btn}`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => go(e, 1)}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white rounded-full flex items-center justify-center font-bold cursor-pointer ${btn}`}
          >
            ›
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[#0B0B0D]/70 px-2 py-0.5 rounded-full text-[9px] font-bold text-white tracking-widest">
            {safeIndex + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
}

function CollarBadge({ collar }: { collar?: CollarStatus }) {
  return collar === 'collared' ? (
    <span className="bg-[#FF9F43]/20 text-[#FF9F43] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#FF9F43]/30 shrink-0">มีปลอกคอ</span>
  ) : (
    <span className="bg-[#8E8E96]/20 text-[#8E8E96] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#8E8E96]/30 shrink-0">แมวจรจร</span>
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

  // Form fields
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

  // แผนที่พร้อมแล้ว: ถ้า GPS มาก่อนแผนที่โหลดเสร็จให้บินไปตำแหน่งนั้น (ไม่ผูกกับ mapCenter จะได้ไม่ยิงซ้ำ)
  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    if (pendingFlyRef.current) {
      map.flyTo(pendingFlyRef.current, 15, { animate: true, duration: 1.5 });
      pendingFlyRef.current = null;
    }
  }, []);

  // ต้องเป็นฟังก์ชันคงที่ ไม่งั้น MapEventsBridge จะ loop render ไม่จบ
  const handlePickMove = useCallback((map: LeafletMap) => {
    const c = map.getCenter();
    setPickedCenter({ lat: c.lat, lng: c.lng });
  }, []);

  useEffect(() => {
    setIsClient(true);
    import('leaflet').then((L) => setLeafletLib(L));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(coords);
          if (mapRef.current) {
            mapRef.current.flyTo(coords, 15, { animate: true, duration: 1.5 });
          } else {
            pendingFlyRef.current = coords;
          }
        },
        () => {
          console.log('User location denied, using default center.');
        },
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
        if (error) {
          console.error('Failed to load cats:', error);
        } else if (data) {
          setCats(data as CatData[]);
        }
        setLoadingCats(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // เก็บ blob URL ล่าสุดไว้ revoke ตอนปิดหน้า
  useEffect(() => {
    photoPreviewsRef.current = photoPreviews;
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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

  // แคชไอคอนหมุด (มีแค่ 6 แบบ) ไม่ต้องสร้างใหม่ทุกครั้งที่ render
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
          <img
            src="/pins/${cacheKey}.png"
            alt="cat pin"
            style="width:100%;height:100%;object-fit:contain;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block';"
          />
          <span style="display:none;font-size:40px;line-height:1;">🐱</span>
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
      () => {
        setLocating(false);
        alert('ดึงตำแหน่งไม่ได้ ลองใช้โหมดเลือกบนแผนที่แทนนะครับ');
      },
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
    e.target.value = ''; // เลือกไฟล์เดิมซ้ำได้
    if (selected.length === 0) return;

    const remaining = MAX_PHOTOS - photoFiles.length;
    if (remaining <= 0) return;

    const accepted = selected.slice(0, remaining);
    setPhotoFiles((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (index: number) => {
    setPhotoPreviews((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    photoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoPreviewsRef.current = [];
    setName('');
    setLocationName('');
    setDetails('');
    setDiscoveredBy('');
    setBellyStatus('safe');
    setCollarStatus('stray');
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setLat('');
    setLng('');
    setHasLocation(false);
  };

  const handleAddCat = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !locationName.trim() || !hasLocation) {
      return alert('กรุณากรอกชื่อ สถานที่ และระบุพิกัดให้เรียบร้อย');
    }
    if (!isSupabaseConfigured || !supabase) return;

    setSaving(true);
    let photoUrls: string[] = [];

    if (photoFiles.length > 0) {
      try { photoUrls = await uploadCatPhotos(photoFiles); } catch (err) { console.error(err); }
    }

    const cfg = STATUS_CONFIG[bellyStatus];
    const { data, error } = await supabase.from('cats').insert([{
      name: name.trim(),
      location: locationName.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      belly_status: bellyStatus,
      collar_status: collarStatus,
      belly_text: `${cfg.emoji} ${cfg.label} — ${cfg.text}`,
      details: details.trim(),
      photo_urls: photoUrls,
      discovered_by: discoveredBy.trim() || 'ทาสแมวนิรนาม',
      likes_count: 0,
    }]).select();

    if (!error && data) {
      setCats((prev) => [data[0] as CatData, ...prev]);
      setShowForm(false);
      resetForm();
    } else {
      alert('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    }
    setSaving(false);
  };

  const flyToCat = (catLat: number, catLng: number) => {
    setShowList(false);
    mapRef.current?.flyTo([catLat, catLng], 18, { animate: true, duration: 1.5 });
  };

  const persistLikes = (value: Record<number, boolean>) => {
    try { localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
  };

  const handleLike = async (e: ReactMouseEvent, catId: number, currentLikes: number) => {
    e.stopPropagation();
    if (!supabase) return;

    const wasLiked = !!likedCats[catId];
    const newLikes = wasLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    const updated = { ...likedCats, [catId]: !wasLiked };
    setLikedCats(updated);
    persistLikes(updated);
    setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, likes_count: newLikes } : c)));

    const { error } = await supabase.from('cats').update({ likes_count: newLikes }).eq('id', catId);
    if (error) {
      // บันทึกไม่สำเร็จ → ย้อนค่ากลับ
      const rolledBack = { ...updated, [catId]: wasLiked };
      setLikedCats(rolledBack);
      persistLikes(rolledBack);
      setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, likes_count: currentLikes } : c)));
    }
  };

  const openGoogleMaps = (catLat: number, catLng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${catLat},${catLng}`, '_blank');
  };

  const generatePokemonCard = async (cat: CatData) => {
    setShareCat(cat);
    setShareCardImage(null);
    try {
      setShareCardImage(await renderCatCard(cat));
    } catch (err) {
      console.error(err);
      alert('สร้างการ์ดไม่สำเร็จ ลองใหม่อีกครั้งนะ');
      setShareCat(null);
    }
  };

  const closeShare = () => {
    setShareCat(null);
    setShareCardImage(null);
  };

  // มือถือ: เปิดหน้าต่างแชร์ (บันทึกลงอัลบั้มได้) / คอมพิวเตอร์: ดาวน์โหลดไฟล์
  const downloadCard = async () => {
    if (!shareCardImage || !shareCat) return;
    const fileName = `${shareCat.name}-pokemon-card.png`;

    try {
      if (window.matchMedia('(pointer: coarse)').matches && typeof navigator.canShare === 'function') {
        const blob = await (await fetch(shareCardImage)).blob();
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: shareCat.name });
          return;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }

    const link = document.createElement('a');
    link.href = shareCardImage;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="relative w-screen h-[100svh] overflow-hidden bg-[#0B0B0D] text-[#F5F5F2] select-none font-sans">

      {!pickingLocation && (
        <div className="absolute top-4 left-4 right-4 z-[3000] pointer-events-none flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <div className="pointer-events-auto bg-[#151518]/95 backdrop-blur-md border border-[#27272A] p-3 rounded-2xl shadow-2xl flex items-center gap-3">
              <span className="text-2xl">🐾</span>
              <div>
                <h1 className="font-black text-[#F5F5F2] text-sm tracking-wide leading-tight">BELLY DON&apos;T BULLY</h1>
                <p className="text-[#8E8E96] text-[10px] uppercase font-semibold tracking-wider">Thailand Cat Map</p>
              </div>
            </div>
            <button
              onClick={() => setShowList(true)}
              className="pointer-events-auto bg-[#151518]/95 hover:bg-[#27272A] transition-colors backdrop-blur-md border border-[#27272A] px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="text-[#8E8E96] text-xs font-bold">FOUND</span>
              <span className="bg-[#FF9F43]/20 text-[#FF9F43] border border-[#FF9F43]/30 px-2 py-0.5 rounded-lg text-xs font-black">
                {loadingCats ? '…' : cats.length} 🐱
              </span>
            </button>
          </div>

          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all cursor-pointer shadow-md ${selectedFilter === tab.id ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#151518]/95 text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full h-full z-0">
        {isClient ? (
          <MapContainer center={mapCenter} zoom={15} zoomControl={false} className="w-full h-full">
            <MapRefBridge onReady={handleMapReady} />
            <TileLayer url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png" />
            <ZoomControl position="bottomright" />

            {pickingLocation && <MapEventsBridge onMove={handlePickMove} />}

            {leafletLib && filteredCats.map((cat) => {
              const isLiked = !!likedCats[cat.id];
              const cfg = STATUS_CONFIG[cat.belly_status];

              return (
                <Marker key={cat.id} position={[cat.lat, cat.lng]} icon={getCatIcon(cat)}>
                  <Popup>
                    <div className="w-[240px] bg-[#151518] text-[#F5F5F2] rounded-2xl overflow-hidden shadow-2xl relative">
                      <div className="absolute top-2 right-2 bg-[#0B0B0D]/80 backdrop-blur-md px-2 py-1 rounded-full border border-[#27272A] flex items-center gap-1.5 text-[10px] font-black text-[#FB7185] z-10 shadow-lg">
                        ❤️ {cat.likes_count || 0}
                      </div>

                      <div className="w-full h-36 border-b border-[#27272A]">
                        <PhotoCarousel photos={cat.photo_urls ?? []} alt={cat.name} size="md" />
                      </div>

                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-black text-base flex items-center gap-1.5">🐱 {cat.name}</h3>
                          <CollarBadge collar={cat.collar_status} />
                        </div>
                        <p className="text-[#8E8E96] text-xs font-medium mb-3">📍 {cat.location}</p>

                        <div
                          className="text-[11px] font-bold p-2.5 rounded-xl mb-2.5 border"
                          style={{ color: cfg.ring, backgroundColor: cfg.bg, borderColor: cfg.ring }}
                        >
                          {cat.belly_text}
                        </div>

                        {cat.details && (
                          <p className="text-xs text-[#8E8E96] bg-[#0B0B0D] p-2.5 rounded-xl border border-[#27272A] italic mb-2">&quot;{cat.details}&quot;</p>
                        )}

                        <div className="flex justify-between items-center border-t border-[#27272A] pt-2 mt-1">
                          <p className="text-[10px] text-[#8E8E96]">
                            โดย: <span className="text-[#F5F5F2] font-semibold">{cat.discovered_by || 'ทาสแมวนิรนาม'}</span>
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openGoogleMaps(cat.lat, cat.lng)}
                              className="bg-[#27272A] hover:bg-[#3f3f46] text-[#34D399] px-2 py-1 rounded-xl text-[10px] font-black cursor-pointer"
                              title="นำทางด้วย Google Maps"
                            >
                              🗺️ นำทาง
                            </button>
                            <button
                              onClick={(e) => handleLike(e, cat.id, cat.likes_count || 0)}
                              className={`px-2 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}
                            >
                              {isLiked ? '❤' : '🤍'}
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => generatePokemonCard(cat)}
                          className="w-full mt-2 bg-[#FF9F43] hover:bg-[#ff8f24] text-[#0B0B0D] py-1.5 rounded-xl text-xs font-black cursor-pointer shadow-md"
                        >
                          🃏 สร้างการ์ดโปเกมอน (TCG)
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="w-full h-full bg-[#0B0B0D] flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#8E8E96] text-xs font-bold tracking-widest uppercase">Loading Map...</p>
          </div>
        )}
      </div>

      {!pickingLocation && !showForm && !showList && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#FF9F43] hover:bg-[#ff8f24] active:scale-95 text-[#0B0B0D] font-black px-8 py-4 rounded-full shadow-[0_12px_35px_rgba(255,159,67,0.5)] transition-all flex items-center gap-2 text-sm tracking-wide border-[3px] border-[#151518] cursor-pointer"
          >
            <span className="text-xl leading-none">+</span>
            <span>FIND A CAT</span>
          </button>
        </div>
      )}

      {showList && (
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[99999] flex flex-col animate-fade-in">
          <div className="flex items-center justify-between p-6 border-b border-[#27272A] bg-[#151518]">
            <div>
              <h2 className="text-[#F5F5F2] font-black text-xl flex items-center gap-2">🐾 CAT DIRECTORY</h2>
              <p className="text-[#8E8E96] text-xs font-bold uppercase mt-1 tracking-widest">สมุดสะสมแมวทั่วไทย</p>
            </div>
            <button onClick={() => setShowList(false)} className="w-10 h-10 rounded-full bg-[#27272A] hover:bg-[#3f3f46] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer transition-colors">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
            {filteredCats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#8E8E96]">
                <span className="text-4xl mb-3">{loadingCats ? '⏳' : '😿'}</span>
                <p className="font-semibold text-sm">{loadingCats ? 'กำลังโหลด...' : 'ไม่พบแมวในหมวดหมู่นี้'}</p>
              </div>
            ) : (
              filteredCats.map((cat) => {
                const cfg = STATUS_CONFIG[cat.belly_status];
                const isLiked = !!likedCats[cat.id];

                return (
                  <div
                    key={cat.id}
                    className="bg-[#151518] border border-[#27272A] rounded-2xl p-3 flex gap-4 items-center"
                  >
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#27272A]">
                      <PhotoCarousel photos={cat.photo_urls ?? []} alt={cat.name} size="sm" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div onClick={() => flyToCat(cat.lat, cat.lng)} className="cursor-pointer">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h3 className="font-black text-[#F5F5F2] truncate text-base">{cat.name}</h3>
                          <CollarBadge collar={cat.collar_status} />
                        </div>
                        <p className="text-[#8E8E96] text-[10px] font-medium truncate mb-2">📍 {cat.location}</p>
                        <div className="inline-block text-[9px] font-bold px-2 py-1 rounded-lg border" style={{ color: cfg.ring, backgroundColor: cfg.bg, borderColor: cfg.ring }}>
                          {cfg.emoji} {cfg.label}
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 border-t border-[#27272A] pt-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openGoogleMaps(cat.lat, cat.lng)}
                            className="bg-[#27272A] text-[#34D399] px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            🗺️ นำทาง
                          </button>
                          <button
                            onClick={() => generatePokemonCard(cat)}
                            className="bg-[#FF9F43]/20 text-[#FF9F43] px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            🃏 การ์ด
                          </button>
                        </div>
                        <button
                          onClick={(e) => handleLike(e, cat.id, cat.likes_count || 0)}
                          className={`flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black cursor-pointer ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}
                        >
                          {isLiked ? '❤️' : '🤍'} {cat.likes_count || 0}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal พรีวิวการ์ด & ปุ่มบันทึก/แชร์ */}
      {shareCat && (
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[999999] flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#151518] border border-[#27272A] p-4 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl">
            <h3 className="font-black text-base mb-1 text-[#FF9F43]">
              {shareCardImage ? '🃏 การ์ดโปเกมอน (TCG) พร้อมแล้ว!' : '🃏 กำลังสร้างการ์ด...'}
            </h3>
            <p className="text-xs text-[#8E8E96] mb-3 text-center">กดปุ่มด้านล่างเพื่อบันทึกหรือแชร์รูปการ์ด</p>

            <div className="w-full h-[26rem] rounded-2xl overflow-hidden border border-[#27272A] mb-4 bg-[#0B0B0D] flex items-center justify-center">
              {shareCardImage ? (
                <img src={shareCardImage} alt="Pokemon Card" className="h-full object-contain" />
              ) : (
                <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={downloadCard}
                disabled={!shareCardImage}
                className="flex-1 bg-[#FF9F43] hover:bg-[#ff8f24] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0B0D] font-black py-3 rounded-xl text-xs text-center cursor-pointer shadow-lg"
              >
                📥 บันทึก / แชร์การ์ด
              </button>
              <button
                onClick={closeShare}
                className="px-4 bg-[#27272A] hover:bg-[#3f3f46] text-[#F5F5F2] font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {pickingLocation && (
        <div className="fixed inset-0 z-[8000] pointer-events-none">
          <div className="absolute top-0 left-0 right-0 bg-[#0B0B0D]/90 backdrop-blur-md px-5 py-4 flex justify-between items-center pointer-events-auto border-b border-[#27272A]">
            <button onClick={() => { setPickingLocation(false); setShowForm(true); }} className="text-[#F5F5F2] font-bold text-sm cursor-pointer">✕ ยกเลิก</button>
            <span className="text-[#FF9F43] font-bold text-sm">เลื่อนแผนที่เพื่อปักหมุดแมว</span>
            <div className="w-12"></div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-8 h-8 rounded-full border-[3px] border-[#FF9F43] bg-[#FF9F43]/30 shadow-[0_0_25px_rgba(255,159,67,0.8)] animate-pulse" />
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto">
            <button onClick={confirmPickedLocation} className="bg-[#34D399] hover:bg-[#2bc288] text-[#0B0B0D] font-black px-8 py-4 rounded-full shadow-[0_10px_30px_rgba(52,211,153,0.5)] border-[3px] border-[#151518] flex items-center gap-2 cursor-pointer">
              <span className="text-lg">✓</span> ยืนยันพิกัดนี้
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#0B0B0D]/80 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#151518] border-t sm:border border-[#27272A] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto animate-sheet-in">

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
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePhoto(i); }}
                        className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer"
                      >✕</button>
                    </div>
                  ))}
                  {photoFiles.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
                      className="min-w-[80px] h-[80px] rounded-2xl border-2 border-dashed border-[#27272A] flex flex-col items-center justify-center text-[#FF9F43] hover:bg-[#27272A]/30 cursor-pointer"
                    >
                      <span className="text-xl">+</span>
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ชื่อแมว</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เจ้าส้ม" className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">สถานที่เจอ</label>
                  <input type="text" required value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="เช่น หน้าคาเฟ่" className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">พิกัดบนแผนที่ {hasLocation && <span className="text-[#34D399] ml-1">✓ ระบุตำแหน่งแล้ว</span>}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={handleUseMyLocation} disabled={locating} className="bg-[#27272A] hover:bg-[#3f3f46] text-[#F5F5F2] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer">
                    {locating ? '⏳ กำลังหา...' : '◎ ใช้ตำแหน่งปัจจุบัน'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setPickingLocation(true); }} className="bg-[#27272A] hover:bg-[#3f3f46] text-[#F5F5F2] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer">
                    🗺️ เลือกบนแผนที่
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">สถานะน้องเหมียว</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setCollarStatus('stray')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'stray' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}>
                    🚷 แมวจรแท้ๆ
                  </button>
                  <button type="button" onClick={() => setCollarStatus('collared')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'collared' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}>
                    🏷️ มีปลอกคอ
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระดับความปลอดภัยพุง</label>
                <select value={bellyStatus} onChange={(e) => setBellyStatus(e.target.value as BellyStatus)} className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43] font-semibold">
                  <option value="safe">🟢 เฟรนลี่ — จกได้สบาย ชอบให้เกา</option>
                  <option value="caution">🟡 คาดเดาไม่ได้ — ระวังโดนสวบ</option>
                  <option value="danger">🔴 โขด — ห้ามจับพุงเด็ดขาด!</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">เปิดวาร์ปโดย (ชื่อ / IG) <span className="font-normal opacity-50">- ไม่บังคับ</span></label>
                <input type="text" value={discoveredBy} onChange={(e) => setDiscoveredBy(e.target.value)} placeholder="เช่น @catlover.cnx" className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">คำอธิบายเพิ่มเติม</label>
                <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43]" />
              </div>

              <button type="submit" disabled={saving} className="w-full bg-[#FF9F43] hover:bg-[#ff8f24] disabled:opacity-60 text-[#0B0B0D] font-black py-4 rounded-xl text-sm tracking-wide mt-2 cursor-pointer shadow-lg">
                {saving ? 'กำลังบันทึก...' : 'SAVE CAT SPOT 🐾'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
