// lib/catCard.ts — การ์ดเหมียวสไตล์ trading card (1080×1350 = IG 4:5)
// ดีไซน์ตามธีมเว็บ: พื้นดำ + ส้ม + สีสถานะ, ฟอนต์ใช้ตามหน้าเว็บ (Mitr)
// วาดหน้าแมว/หัวใจ/รอยเท้าด้วยโค้ดเอง ไม่พึ่งอีโมจิ เพื่อให้หน้าตาเหมือนกันทุกเครื่อง

export type CardBellyStatus = 'safe' | 'caution' | 'danger';

export interface CardCat {
  id?: number;
  name: string;
  location: string;
  belly_status: CardBellyStatus;
  collar_status?: 'stray' | 'collared';
  details?: string;
  photo_urls?: string[] | null;
  discovered_by?: string;
  likes_count?: number;
}

/* ───────────── constants ───────────── */

const W = 1080;
const H = 1350;

// น้ำหนักฟอนต์ (ต้องโหลดใน layout.tsx ให้ครบ: 400, 500, 600)
const W_REG = 400;
const W_BOLD = 500;
const W_HEAVY = 600;

const C = {
  bg: '#0B0B0D',
  surface: '#151518',
  line: '#27272A',
  text: '#F5F5F2',
  muted: '#8E8E96',
  orange: '#FF9F43',
  orangeLight: '#FFB86B',
};

// ใบหน้าแมวสไตล์สติกเกอร์
const FACE = { fur: '#FFF3E6', line: '#2A2228', blush: '#FF8FB1' };

const LEVEL: Record<CardBellyStatus, { color: string; label: string; text: string; lv: number }> = {
  safe: { color: '#34D399', label: 'เฟรนลี่', text: 'จกพุงได้สบาย ชอบให้เกา', lv: 1 },
  caution: { color: '#FBBF24', label: 'คาดเดาไม่ได้', text: 'จกได้นิดหน่อย ระวังโดนสวบ', lv: 2 },
  danger: { color: '#FB7185', label: 'โขด', text: 'ห้ามจกพุงเด็ดขาด!', lv: 3 },
};

// เลย์เอาต์
const CARD = { x: 40, y: 40, w: 1000, h: 1270, r: 52 };
const RIGHT = CARD.x + CARD.w; // 1040
const BOTTOM = CARD.y + CARD.h; // 1310
const BAR_H = 88; // แถบบาร์โค้ดด้านบน
const COL_W = 88; // คอลัมน์ซ้าย
const ART = { x: CARD.x + COL_W, y: CARD.y + BAR_H, w: RIGHT - (CARD.x + COL_W), h: 812 }; // 128,128 912×812
const PLATE_Y = ART.y + ART.h; // 940
const PLATE_H = 142;
const BAND_Y = PLATE_Y + PLATE_H + 8; // 1090
const BAND_H = 60;
const TX = ART.x + 28; // จุดเริ่มข้อความ
const TEXT_R = RIGHT - 30; // ขอบขวาของข้อความ
const EMBLEM = { x: 908, y: BAND_Y - 4, r: 92 };

/* ───────────── helpers ───────────── */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// letterSpacing ใช้ได้ในเบราว์เซอร์ใหม่ ถ้าไม่รองรับจะถูกข้ามไปเฉยๆ
function setLS(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function segmentText(text: string): string[] {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      return Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), (s) => s.segment);
    }
  } catch {}
  return Array.from(text);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const tokens = segmentText(clean).flatMap((t) => (ctx.measureText(t).width > maxWidth ? Array.from(t) : [t]));
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    const test = line + token;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      if (line) lines.push(line.trimEnd());
      line = token.trimStart();
    }
  }
  if (line) lines.push(line.trimEnd());
  if (lines.length > maxLines) {
    const out = lines.slice(0, maxLines);
    let last = out[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    out[maxLines - 1] = last + '…';
    return out;
  }
  return lines;
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

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, min: number, family: string, weight: number) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.4) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) * focusY, sw, sh, x, y, w, h);
}

// รูปที่ผ่านตัวครอปแล้ว (จัตุรัส) → cover พอดี
// รูปเก่าที่สัดส่วนต่างมาก → แสดงเต็มรูปบนพื้นหลังเบลอ ไม่ยืดและไม่ตัดหน้าแมว
function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const imgRatio = iw / ih, boxRatio = w / h;
  const cropLoss = imgRatio > boxRatio ? 1 - boxRatio / imgRatio : 1 - imgRatio / boxRatio;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (cropLoss <= 0.12) { drawCover(ctx, img, x, y, w, h, 0.4); return; }

  const tw = 36, th = Math.max(1, Math.round((tw * h) / w));
  const tiny = document.createElement('canvas');
  tiny.width = tw; tiny.height = th;
  const tctx = tiny.getContext('2d');
  if (tctx) {
    tctx.imageSmoothingQuality = 'high';
    drawCover(tctx, img, 0, 0, tw, th, 0.5);
    ctx.drawImage(tiny, x, y, w, h);
    ctx.fillStyle = 'rgba(11,11,13,0.35)';
    ctx.fillRect(x, y, w, h);
  }
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(img, 0, 0, iw, ih, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/* ───────────── vector decorations ───────────── */

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  const t = s * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + t * 0.9);
  ctx.bezierCurveTo(cx - t * 1.6, cy - t * 0.1, cx - t * 0.9, cy - t * 1.2, cx, cy - t * 0.45);
  ctx.bezierCurveTo(cx + t * 0.9, cy - t * 1.2, cx + t * 1.6, cy - t * 0.1, cx, cy + t * 0.9);
  ctx.closePath();
  ctx.fill();
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.28;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function catFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, mood: CardBellyStatus) {
  ctx.save();
  ctx.lineWidth = s * 0.04;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = FACE.line;
  ctx.fillStyle = FACE.fur;
  // หู
  [-1, 1].forEach((d) => {
    ctx.beginPath();
    ctx.moveTo(cx + d * 0.46 * s, cy - 0.02 * s);
    ctx.lineTo(cx + d * 0.4 * s, cy - 0.5 * s);
    ctx.lineTo(cx + d * 0.1 * s, cy - 0.34 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  // หน้า
  ctx.beginPath();
  ctx.ellipse(cx, cy, 0.5 * s, 0.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // แก้ม
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = FACE.blush;
  [-1, 1].forEach((d) => {
    ctx.beginPath();
    ctx.arc(cx + d * 0.3 * s, cy + 0.1 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  // ตา
  [-1, 1].forEach((d) => {
    const ex = cx + d * 0.2 * s, ey = cy - 0.04 * s;
    if (mood === 'safe') {
      ctx.beginPath();
      ctx.arc(ex, ey + 0.03 * s, 0.06 * s, Math.PI, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = FACE.line;
      ctx.beginPath();
      ctx.arc(ex, ey, 0.045 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mood === 'danger') {
      ctx.beginPath();
      ctx.moveTo(ex + d * 0.09 * s, ey - 0.14 * s);
      ctx.lineTo(ex - d * 0.08 * s, ey - 0.06 * s);
      ctx.stroke();
    }
  });
  // จมูก
  ctx.fillStyle = FACE.blush;
  ctx.beginPath();
  ctx.moveTo(cx - 0.04 * s, cy + 0.06 * s);
  ctx.lineTo(cx + 0.04 * s, cy + 0.06 * s);
  ctx.lineTo(cx, cy + 0.11 * s);
  ctx.closePath();
  ctx.fill();
  // ปาก
  if (mood === 'safe') {
    ctx.beginPath(); ctx.arc(cx - 0.045 * s, cy + 0.11 * s, 0.045 * s, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 0.045 * s, cy + 0.11 * s, 0.045 * s, 0, Math.PI); ctx.stroke();
  } else if (mood === 'caution') {
    ctx.beginPath(); ctx.moveTo(cx - 0.06 * s, cy + 0.19 * s); ctx.lineTo(cx + 0.06 * s, cy + 0.19 * s); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy + 0.22 * s, 0.06 * s, Math.PI, 0); ctx.stroke();
  }
  // หนวด
  ctx.lineWidth = s * 0.025;
  [-1, 1].forEach((d) => {
    ctx.beginPath(); ctx.moveTo(cx + d * 0.36 * s, cy + 0.04 * s); ctx.lineTo(cx + d * 0.58 * s, cy + 0.0 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + d * 0.36 * s, cy + 0.1 * s); ctx.lineTo(cx + d * 0.56 * s, cy + 0.15 * s); ctx.stroke();
  });
  ctx.restore();
}

/* ───────────── card parts ───────────── */

// บาร์โค้ดสีส้มด้านบน — สุ่มจากข้อมูลแมว จึงไม่ซ้ำกันทุกตัว
function drawBarcode(ctx: CanvasRenderingContext2D, rand: () => number) {
  const g = ctx.createLinearGradient(CARD.x, 0, RIGHT, 0);
  g.addColorStop(0, C.orange);
  g.addColorStop(1, C.orangeLight);
  ctx.fillStyle = g;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, BAR_H);

  ctx.fillStyle = 'rgba(11,11,13,0.9)';
  let x = CARD.x + 28;
  while (x < RIGHT - 28) {
    const w = 3 + Math.floor(rand() * 12);
    if (x + w > RIGHT - 28) break;
    const h = BAR_H - 28 - (rand() > 0.85 ? 16 : 0);
    ctx.fillRect(x, CARD.y + 14, w, h);
    x += w + 3 + Math.floor(rand() * 9);
  }
  ctx.fillStyle = C.bg;
  ctx.fillRect(CARD.x, CARD.y + BAR_H - 4, CARD.w, 4);
}

// เกจ BELLY LV ด้านซ้าย (6 ช่อง)
function drawSideColumn(ctx: CanvasRenderingContext2D, lv: { color: string; lv: number }, rand: () => number, family: string) {
  ctx.fillStyle = '#0F0F12';
  ctx.fillRect(CARD.x, ART.y, COL_W, BOTTOM - ART.y);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ART.x, ART.y);
  ctx.lineTo(ART.x, BOTTOM);
  ctx.stroke();

  const lit = lv.lv * 2;
  const TAB_H = 88, GAP = 14, TOP = ART.y + 22;
  const x0 = CARD.x - 10, x1 = ART.x - 10;
  for (let i = 0; i < 6; i++) {
    const y = TOP + i * (TAB_H + GAP);
    const on = i >= 6 - lit;
    ctx.save();
    poly(ctx, [[x0, y], [x1 - 14, y], [x1, y + 14], [x1, y + TAB_H], [x0, y + TAB_H]]);
    if (on) {
      ctx.shadowColor = hexA(lv.color, 0.7);
      ctx.shadowBlur = 20;
      ctx.fillStyle = lv.color;
    } else {
      ctx.fillStyle = '#2B2B31';
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = on ? 'rgba(255,255,255,0.45)' : '#3A3A42';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  const labelY = TOP + 6 * (TAB_H + GAP) - GAP + 36;
  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.font = `${W_BOLD} 18px ${family}`;
  setLS(ctx, 2);
  ctx.fillText('BELLY', CARD.x + COL_W / 2, labelY);
  setLS(ctx, 0);
  ctx.fillStyle = lv.color;
  ctx.font = `${W_HEAVY} 46px ${family}`;
  ctx.fillText(`LV.${lv.lv}`, CARD.x + COL_W / 2, labelY + 52);
  ctx.textAlign = 'left';

  // ลายแถบด้านล่างซ้าย
  for (let i = 0, y = 985; y < BOTTOM; i++, y += 26) {
    const w = 28 + Math.floor(rand() * 48);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(245,245,242,0.88)' : '#34343A';
    ctx.fillRect(CARD.x, y, w, 12);
  }
}

// กรอบรูปเต็ม (full art) + แสงเรือง + holo foil
function drawArt(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, mood: CardBellyStatus, color: string, rand: () => number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ART.x, ART.y, ART.w, ART.h);
  ctx.clip();
  const cx = ART.x + ART.w / 2, cy = ART.y + ART.h / 2;

  if (img) {
    drawPhoto(ctx, img, ART.x, ART.y, ART.w, ART.h);
  } else {
    const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, ART.w * 0.7);
    g.addColorStop(0, hexA(color, 0.55));
    g.addColorStop(1, C.bg);
    ctx.fillStyle = g;
    ctx.fillRect(ART.x, ART.y, ART.w, ART.h);
    catFace(ctx, cx, cy + 30, 420, mood);
  }

  // รัศมีแสง
  ctx.globalCompositeOperation = 'screen';
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const a0 = ((Math.PI * 2) / rays) * i;
    const a1 = a0 + (Math.PI / rays) * 0.8;
    ctx.fillStyle = hexA(color, 0.06);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 1200, cy + Math.sin(a0) * 1200);
    ctx.lineTo(cx + Math.cos(a1) * 1200, cy + Math.sin(a1) * 1200);
    ctx.closePath();
    ctx.fill();
  }

  // แสงเรืองขอบกรอบตามสีสถานะ
  ctx.globalCompositeOperation = 'source-over';
  const glow = ctx.createRadialGradient(cx, cy, ART.h * 0.32, cx, cy, ART.h * 0.9);
  glow.addColorStop(0, hexA(color, 0));
  glow.addColorStop(1, hexA(color, 0.5));
  ctx.fillStyle = glow;
  ctx.fillRect(ART.x, ART.y, ART.w, ART.h);

  // holo foil
  ctx.globalCompositeOperation = 'overlay';
  const holo = ctx.createLinearGradient(ART.x, ART.y, ART.x + ART.w, ART.y + ART.h);
  holo.addColorStop(0.0, 'rgba(255,159,67,0.40)');
  holo.addColorStop(0.25, 'rgba(255,110,200,0.32)');
  holo.addColorStop(0.5, 'rgba(110,200,255,0.38)');
  holo.addColorStop(0.75, 'rgba(120,255,200,0.32)');
  holo.addColorStop(1.0, 'rgba(255,220,120,0.40)');
  ctx.fillStyle = holo;
  ctx.fillRect(ART.x, ART.y, ART.w, ART.h);

  // แถบสะท้อนแสงเฉียง
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const x = ART.x + ART.w * (0.12 + 0.3 * i);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    poly(ctx, [[x + 220, ART.y], [x + 300, ART.y], [x + 80, ART.y + ART.h], [x, ART.y + ART.h]]);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // ไล่สีลงพื้นป้ายชื่อ
  const fade = ctx.createLinearGradient(0, PLATE_Y - 190, 0, PLATE_Y);
  fade.addColorStop(0, 'rgba(11,11,13,0)');
  fade.addColorStop(1, 'rgba(11,11,13,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(ART.x, PLATE_Y - 190, ART.w, 190);

  // ประกาย
  for (let i = 0; i < 7; i++) {
    const sx = ART.x + 60 + rand() * (ART.w - 120);
    const sy = ART.y + 110 + rand() * (ART.h * 0.55);
    sparkle(ctx, sx, sy, 10 + rand() * 16, 'rgba(255,255,255,0.75)');
  }
  ctx.restore();
}

/* ───────────── main ───────────── */

export async function renderCatCard(cat: CardCat): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');

  // ใช้ฟอนต์เดียวกับหน้าเว็บ (ตั้งที่ <body> ใน layout.tsx → Mitr)
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (size: number, weight: number = W_REG) => `${weight} ${size}px ${family}`;

  const lv = LEVEL[cat.belly_status];
  const collared = cat.collar_status === 'collared';

  // โหลดฟอนต์ให้ครอบคลุมตัวอักษรที่ใช้จริงบนการ์ด
  const sample =
    `${cat.name}${cat.location}${cat.details ?? ''}${cat.discovered_by ?? ''}` +
    `${lv.label}${lv.text}เฟรนลี่คาดเดาไม่ได้โขดสถานที่เจอพบเจอโดยทาสแมวนิรนามเหมียวมีบ้านเหมียวจร` +
    `CAT FOUND BELLY ZONE LV. BELLY DON'T BULLY No. 0123456789 Aa`;
  try {
    await Promise.all([W_REG, W_BOLD, W_HEAVY].map((w) => document.fonts.load(`${w} 16px ${family}`, sample)));
    await document.fonts.ready;
  } catch {}

  const photoUrl = cat.photo_urls?.[0];
  const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;

  const seed = hashStr(`${cat.id ?? ''}|${cat.name}|${cat.location}|${cat.likes_count ?? 0}`);
  const rand = makeRng(seed);
  const baseline = (centerY: number, size: number) => centerY + size * 0.34; // ปรับตรงนี้ถ้าข้อความดูสูง/ต่ำ

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  /* พื้นหลังนอกการ์ด */
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const bgGlow = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 900);
  bgGlow.addColorStop(0, hexA(lv.color, 0.22));
  bgGlow.addColorStop(1, 'rgba(11,11,13,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);
  const topGlow = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 0, 700);
  topGlow.addColorStop(0, 'rgba(255,159,67,0.18)');
  topGlow.addColorStop(1, 'rgba(255,159,67,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, H);

  /* ตัวการ์ด + เงา */
  ctx.save();
  ctx.shadowColor = hexA(lv.color, 0.5);
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.surface;
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.fill();
  ctx.restore();

  /* เนื้อใน (clip ตามขอบการ์ด) */
  ctx.save();
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.clip();

  const base = ctx.createLinearGradient(0, CARD.y, 0, BOTTOM);
  base.addColorStop(0, '#1A1A1F');
  base.addColorStop(1, C.bg);
  ctx.fillStyle = base;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);

  drawBarcode(ctx, rand);
  drawSideColumn(ctx, lv, rand, family);
  drawArt(ctx, img, cat.belly_status, lv.color, rand);

  /* ป้ายเหมียวจร/มีบ้าน (มุมซ้ายบนของรูป) */
  {
    const t = collared ? 'เหมียวมีบ้าน' : 'เหมียวจร';
    ctx.font = font(26, W_BOLD);
    const w = ctx.measureText(t).width + 44, h = 54;
    const x = ART.x + 24, y = ART.y + 24;
    const col = collared ? C.orange : '#C9C9CF';
    ctx.fillStyle = 'rgba(11,11,13,0.78)';
    rr(ctx, x, y, w, h, 27);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillText(t, x + 22, baseline(y + h / 2, 26));
  }

  /* ยอดไลก์ แบบ HP (มุมขวาบนของรูป) */
  {
    const likes = String(cat.likes_count || 0);
    ctx.font = font(36, W_HEAVY);
    const w = ctx.measureText(likes).width + 92, h = 54;
    const x = RIGHT - 24 - w, y = ART.y + 24;
    ctx.fillStyle = 'rgba(11,11,13,0.78)';
    rr(ctx, x, y, w, h, 27);
    ctx.fill();
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 3;
    ctx.stroke();
    heart(ctx, x + 36, y + h / 2 - 1, 28, '#FB7185');
    ctx.fillStyle = C.text;
    ctx.fillText(likes, x + 60, baseline(y + h / 2, 36));
  }

  /* ป้ายชื่อ */
  poly(ctx, [[ART.x, PLATE_Y + 22], [ART.x + 22, PLATE_Y], [RIGHT, PLATE_Y], [RIGHT, PLATE_Y + PLATE_H], [ART.x, PLATE_Y + PLATE_H]]);
  ctx.fillStyle = C.bg;
  ctx.fill();
  const lineG = ctx.createLinearGradient(ART.x, 0, RIGHT, 0);
  lineG.addColorStop(0, C.orange);
  lineG.addColorStop(1, 'rgba(255,159,67,0.15)');
  ctx.strokeStyle = lineG;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ART.x, PLATE_Y + 22);
  ctx.lineTo(ART.x + 22, PLATE_Y + 2);
  ctx.lineTo(RIGHT, PLATE_Y + 2);
  ctx.stroke();

  setLS(ctx, 6);
  ctx.font = font(24, W_BOLD);
  ctx.fillStyle = C.orange;
  ctx.fillText('CAT FOUND', TX, PLATE_Y + 38);
  setLS(ctx, 0);

  const NAME_W = 640;
  fitFont(ctx, cat.name, NAME_W, 78, 40, family, W_HEAVY);
  const nameText = wrapText(ctx, cat.name, NAME_W, 1)[0] ?? '';
  ctx.save();
  ctx.fillStyle = C.text;
  ctx.shadowColor = hexA(lv.color, 0.7);
  ctx.shadowBlur = 26;
  ctx.fillText(nameText, TX, PLATE_Y + PLATE_H - 26);
  ctx.restore();

  /* แถบ BELLY ZONE */
  poly(ctx, [[ART.x, BAND_Y], [RIGHT, BAND_Y], [RIGHT, BAND_Y + BAND_H], [ART.x + 22, BAND_Y + BAND_H], [ART.x, BAND_Y + BAND_H - 22]]);
  const bandG = ctx.createLinearGradient(ART.x, 0, RIGHT, 0);
  bandG.addColorStop(0, lv.color);
  bandG.addColorStop(1, hexA(lv.color, 0.55));
  ctx.fillStyle = bandG;
  ctx.fill();
  setLS(ctx, 3);
  ctx.font = font(28, W_BOLD);
  ctx.fillStyle = C.bg;
  ctx.fillText(`BELLY ZONE  ·  ${lv.label}`, TX, baseline(BAND_Y + BAND_H / 2, 28));
  setLS(ctx, 0);

  /* สถานที่เจอ */
  {
    const y = BAND_Y + BAND_H + 16; // 1166
    const h = 40;
    ctx.font = font(22, W_BOLD);
    const pillW = ctx.measureText('สถานที่เจอ').width + 36;
    ctx.fillStyle = 'rgba(255,159,67,0.12)';
    rr(ctx, TX, y, pillW, h, 20);
    ctx.fill();
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.orange;
    ctx.fillText('สถานที่เจอ', TX + 18, baseline(y + h / 2, 22));

    const locX = TX + pillW + 16;
    const locW = 800 - locX; // เว้นที่ให้ตราด้านขวา
    fitFont(ctx, cat.location, locW, 30, 20, family, W_REG);
    ctx.fillStyle = C.text;
    ctx.fillText(wrapText(ctx, cat.location, locW, 1)[0] ?? '', locX, baseline(y + h / 2, 30));
  }

  /* คำอธิบาย */
  {
    ctx.font = font(26, W_REG);
    const hasDetails = !!cat.details?.trim();
    ctx.fillStyle = hasDetails ? '#C9C9CF' : lv.color;
    const text = hasDetails ? cat.details! : lv.text;
    wrapText(ctx, text, TEXT_R - TX, 2).forEach((line, i) => ctx.fillText(line, TX, 1242 + i * 28));
  }

  /* ท้ายการ์ด */
  {
    const fy = BOTTOM - 14; // 1296
    ctx.font = font(22, W_REG);
    ctx.fillStyle = C.muted;
    ctx.fillText(wrapText(ctx, `พบเจอโดย : ${cat.discovered_by || 'ทาสแมวนิรนาม'}`, 480, 1)[0] ?? '', TX, fy);

    const no = cat.id != null ? `  ·  No.${String(cat.id).padStart(3, '0')}` : '';
    ctx.textAlign = 'right';
    setLS(ctx, 1.5);
    ctx.font = font(20, W_BOLD);
    ctx.fillStyle = C.orange;
    ctx.fillText(`BELLY DON'T BULLY${no}`, TEXT_R, fy);
    setLS(ctx, 0);
    ctx.textAlign = 'left';
  }

  /* ตรา (emblem) หน้าแมวตามอารมณ์ */
  {
    const { x: ex, y: ey, r } = EMBLEM;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    const ring = ctx.createLinearGradient(ex - r, ey - r, ex + r, ey + r);
    ring.addColorStop(0, '#F1F1F4');
    ring.addColorStop(0.5, '#6B6B73');
    ring.addColorStop(1, '#E5E5EA');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(ex, ey, r - 12, 0, Math.PI * 2);
    ctx.fill();

    const inner = ctx.createRadialGradient(ex - 20, ey - 24, 6, ex, ey, r - 20);
    inner.addColorStop(0, '#FFFFFF');
    inner.addColorStop(0.25, lv.color);
    inner.addColorStop(1, hexA(lv.color, 0.85));
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(ex, ey, r - 20, 0, Math.PI * 2);
    ctx.fill();

    catFace(ctx, ex, ey - 4, 108, cat.belly_status);

    // ไฟ 3 ดวงที่ขอบตรา (ดวงที่ตรงกับสถานะจะสว่าง)
    (['safe', 'caution', 'danger'] as CardBellyStatus[]).forEach((k, i) => {
      const a = (Math.PI / 180) * (118 + i * 24);
      const dx = ex + Math.cos(a) * (r - 6), dy = ey + Math.sin(a) * (r - 6);
      ctx.fillStyle = hexA(LEVEL[k].color, k === cat.belly_status ? 1 : 0.25);
      ctx.beginPath();
      ctx.arc(dx, dy, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* โฮโลเกรเดียนต์คลุมทั้งใบ */
  ctx.globalCompositeOperation = 'overlay';
  const sheen = ctx.createLinearGradient(CARD.x, CARD.y, RIGHT, BOTTOM);
  sheen.addColorStop(0.0, 'rgba(255,159,67,0.16)');
  sheen.addColorStop(0.3, 'rgba(255,110,200,0.10)');
  sheen.addColorStop(0.55, 'rgba(110,200,255,0.14)');
  sheen.addColorStop(0.8, 'rgba(120,255,200,0.10)');
  sheen.addColorStop(1.0, 'rgba(255,220,120,0.16)');
  ctx.fillStyle = sheen;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore(); // จบ clip การ์ด

  /* ขอบการ์ดไล่สี */
  const border = ctx.createLinearGradient(CARD.x, CARD.y, RIGHT, BOTTOM);
  border.addColorStop(0, C.orangeLight);
  border.addColorStop(0.35, C.orange);
  border.addColorStop(0.65, lv.color);
  border.addColorStop(1, C.orange);
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  rr(ctx, CARD.x + 3, CARD.y + 3, CARD.w - 6, CARD.h - 6, CARD.r - 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  rr(ctx, CARD.x + 12, CARD.y + 12, CARD.w - 24, CARD.h - 24, CARD.r - 12);
  ctx.stroke();

  /* ประกายที่ทับขอบการ์ด */
  sparkle(ctx, 1050, 420, 22, C.orange);
  sparkle(ctx, 30, 1230, 18, lv.color);
  sparkle(ctx, 1046, 1240, 14, '#FFFFFF');

  return canvas.toDataURL('image/png');
}
