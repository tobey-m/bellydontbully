// lib/catCard.ts — "Cat ID" badge card สำหรับ IG Story (1080×1920 = 9:16)
// ดีไซน์: พื้นหลังพาสเทลม่วงฟ้า + บัตรขาวขอบเข้ม ห้อยสายคล้อง + รูปแมววงกลม
// รองรับ th / en / zh / ja / ko, ฟอนต์หลักอ่านจาก <body> (Mitr) + ฟอนต์สำรอง CJK ของระบบ
// วาดหน้าแมว/หัวใจ/รอยเท้าด้วยโค้ดเอง ไม่พึ่งอีโมจิ เพื่อให้หน้าตาเหมือนกันทุกเครื่อง

export type CardBellyStatus = 'safe' | 'caution' | 'danger';
export type CardLang = 'th' | 'en' | 'zh' | 'ja' | 'ko';

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
  locale?: CardLang; // เผื่อส่งภาษามาในตัวข้อมูลแมว
}

export interface CardOptions {
  lang?: CardLang; // ไม่ส่ง = ตรวจจากภาษาเบราว์เซอร์ (zh/ja/ko) ที่เหลือเป็นไทย
}

/* ───────────── texts ───────────── */

interface Strings {
  where: string;
  belly: string;
  by: string;
  anon: string;
  stray: string;
  collared: string;
  level: Record<CardBellyStatus, { label: string; text: string }>;
}

const T: Record<CardLang, Strings> = {
  th: {
    where: 'สถานที่เจอ',
    belly: 'ระดับความพุง',
    by: 'พบเจอโดย',
    anon: 'ทาสแมวนิรนาม',
    stray: 'เหมียวจร',
    collared: 'เหมียวมีบ้าน',
    level: {
      safe: { label: 'เฟรนลี่', text: 'จกพุงได้สบาย ชอบให้เกา' },
      caution: { label: 'คาดเดาไม่ได้', text: 'จกได้นิดหน่อย ระวังโดนสวบ' },
      danger: { label: 'โขด', text: 'ห้ามจกพุงเด็ดขาด!' },
    },
  },
  en: {
    where: 'Spotted at',
    belly: 'Belly level',
    by: 'Found by',
    anon: 'Anonymous cat lover',
    stray: 'Stray',
    collared: 'Has a home',
    level: {
      safe: { label: 'Friendly', text: 'Belly rubs welcome!' },
      caution: { label: 'Unpredictable', text: 'A few pats are OK, watch the claws' },
      danger: { label: 'Spicy', text: 'No belly rubs. Ever!' },
    },
  },
  zh: {
    where: '发现地点',
    belly: '肚肚等级',
    by: '发现者',
    anon: '匿名铲屎官',
    stray: '流浪猫',
    collared: '有主人',
    level: {
      safe: { label: '亲人', text: '可以放心摸肚肚，超爱被挠' },
      caution: { label: '看心情', text: '摸一下就好，小心被挠' },
      danger: { label: '超凶', text: '绝对不能摸肚肚！' },
    },
  },
  ja: {
    where: '発見場所',
    belly: 'お腹レベル',
    by: '発見者',
    anon: '名無しの猫好き',
    stray: '野良猫',
    collared: '飼い猫',
    level: {
      safe: { label: 'フレンドリー', text: 'お腹なでなでOK！' },
      caution: { label: '気まぐれ', text: '少しならOK、猫パンチ注意' },
      danger: { label: 'ツンツン', text: 'お腹は絶対さわらないで！' },
    },
  },
  ko: {
    where: '발견 장소',
    belly: '배 레벨',
    by: '발견자',
    anon: '익명의 집사',
    stray: '길고양이',
    collared: '집고양이',
    level: {
      safe: { label: '친화적', text: '배 쓰다듬어도 좋아요' },
      caution: { label: '변덕쟁이', text: '살짝만, 냥펀치 주의' },
      danger: { label: '까칠함', text: '배는 절대 만지지 마세요!' },
    },
  },
};

function detectLang(): CardLang {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'th').toLowerCase();
  if (n.startsWith('zh')) return 'zh';
  if (n.startsWith('ja')) return 'ja';
  if (n.startsWith('ko')) return 'ko';
  return 'th';
}

/* ───────────── constants ───────────── */

const W = 1080;
const H = 1920;

// น้ำหนักฟอนต์ (layout.tsx ต้องโหลด Mitr: 400, 500, 600)
const W_REG = 400;
const W_BOLD = 500;
const W_HEAVY = 600;

const C = {
  ink: '#2F2B3F',
  inkSoft: '#3C3950',
  muted: '#8C89A3',
  body: '#6B6880',
  white: '#FFFFFF',
  hl: '#DCD9FF', // ไฮไลต์ลาเวนเดอร์
  lavDeep: '#7C83F0',
  mint: '#D5F3E6',
  peach: '#FFE9D6',
  pinkSoft: '#FFE6EE',
  pinkDeep: '#FF7FA6',
  orange: '#FF9F43',
  cream: '#FFF8EE',
};

const FACE = { fur: '#FFFDF8', line: '#2F2B3F', blush: '#FF9DB8' };

const LEVEL: Record<CardBellyStatus, { color: string; light: string; lv: number }> = {
  safe: { color: '#8FE3BC', light: '#DDF7EB', lv: 1 },
  caution: { color: '#FFD470', light: '#FFF2CC', lv: 2 },
  danger: { color: '#FF9DAE', light: '#FFE0E6', lv: 3 },
};

// เลย์เอาต์ — เนื้อหาสำคัญอยู่ช่วง y 330–1590 หลบแถบ UI ของไอจี (บน/ล่าง ~250px)
const CARD = { x: 120, y: 330, w: 840, h: 1260, r: 60 };
const CX = 540;
const LEFT = 190;
const RIGHT = 890;
const INW = RIGHT - LEFT; // 700
const PH = { cx: 540, cy: 700, r: 250 };
const EMBLEM = { x: 722, y: 872, r: 62 };
const BAND = { y: 1490, h: 100 };

/* ───────────── fonts ───────────── */

const GENERIC = new Set(['system-ui', 'sans-serif', 'ui-sans-serif', 'serif', 'monospace', '-apple-system', 'blinkmacsystemfont']);

const CJK_STACK: Record<CardLang, string[]> = {
  th: ['"PingFang SC"', '"Hiragino Sans"', '"Yu Gothic"', '"Microsoft YaHei"', '"Malgun Gothic"', '"Apple SD Gothic Neo"', '"Noto Sans SC"', '"Noto Sans JP"', '"Noto Sans KR"'],
  en: ['"PingFang SC"', '"Hiragino Sans"', '"Yu Gothic"', '"Microsoft YaHei"', '"Malgun Gothic"', '"Apple SD Gothic Neo"', '"Noto Sans SC"', '"Noto Sans JP"', '"Noto Sans KR"'],
  zh: ['"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', '"Noto Sans SC"', '"Noto Sans CJK SC"'],
  ja: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', '"Meiryo"', '"Noto Sans JP"', '"Noto Sans CJK JP"'],
  ko: ['"Apple SD Gothic Neo"', '"Malgun Gothic"', '"Noto Sans KR"', '"Noto Sans CJK KR"'],
};

// ฟอนต์ของเว็บ (Mitr จาก next/font) ก่อน แล้วตามด้วยฟอนต์ CJK ของระบบตามภาษา
function buildFamily(lang: CardLang): string {
  const base = getComputedStyle(document.body).fontFamily || '';
  const own = base
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !GENERIC.has(s.replace(/['"]/g, '').toLowerCase()));
  return [...own, ...CJK_STACK[lang], 'system-ui', 'sans-serif'].join(', ');
}

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

function segmentText(text: string, lang: CardLang): string[] {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      return Array.from(new Intl.Segmenter(lang, { granularity: 'word' }).segment(text), (s) => s.segment);
    }
  } catch {}
  return Array.from(text);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, lang: CardLang): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const tokens = segmentText(clean, lang).flatMap((t) => (ctx.measureText(t).width > maxWidth ? Array.from(t) : [t]));
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
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
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

function paw(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.18, s * 0.32, s * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ([[-0.38, -0.12], [-0.14, -0.34], [0.14, -0.34], [0.38, -0.12]] as const).forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.ellipse(dx * s, dy * s, s * 0.12, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function pin(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.15, s * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.26, cy - s * 0.02);
  ctx.lineTo(cx + s * 0.26, cy - s * 0.02);
  ctx.lineTo(cx, cy + s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.15, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

// หน้าแมวสไตล์สติกเกอร์ ตามอารมณ์ของระดับความพุง
function catFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, mood: CardBellyStatus) {
  ctx.save();
  ctx.lineWidth = s * 0.045;
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
    ctx.save();
    ctx.fillStyle = hexA(FACE.blush, 0.55);
    ctx.beginPath();
    ctx.moveTo(cx + d * 0.4 * s, cy - 0.1 * s);
    ctx.lineTo(cx + d * 0.36 * s, cy - 0.38 * s);
    ctx.lineTo(cx + d * 0.18 * s, cy - 0.3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  // หน้า
  ctx.beginPath();
  ctx.ellipse(cx, cy, 0.5 * s, 0.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // แก้ม
  ctx.save();
  ctx.globalAlpha = 0.5;
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
  ctx.lineWidth = s * 0.028;
  [-1, 1].forEach((d) => {
    ctx.beginPath(); ctx.moveTo(cx + d * 0.36 * s, cy + 0.04 * s); ctx.lineTo(cx + d * 0.58 * s, cy + 0.0 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + d * 0.36 * s, cy + 0.1 * s); ctx.lineTo(cx + d * 0.56 * s, cy + 0.15 * s); ctx.stroke();
  });
  ctx.restore();
}

/* ───────────── main ───────────── */

export async function renderCatCard(cat: CardCat, opts: CardOptions = {}): Promise<string> {
  const lang = opts.lang ?? cat.locale ?? detectLang();
  const t = T[lang];

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');

  const family = buildFamily(lang);
  const font = (size: number, weight: number = W_REG) => `${weight} ${size}px ${family}`;
  const lv = LEVEL[cat.belly_status];
  const txt = t.level[cat.belly_status];
  const collared = cat.collar_status === 'collared';
  const byName = !cat.discovered_by || cat.discovered_by === 'ทาสแมวนิรนาม' ? t.anon : cat.discovered_by;

  const sample =
    `${cat.name}${cat.location}${cat.details ?? ''}${byName}${txt.label}${txt.text}` +
    `${t.where}${t.belly}${t.by}${t.stray}${t.collared}BELLY DON'T BULLY No. 0123456789 Aa`;
  try {
    await Promise.all([W_REG, W_BOLD, W_HEAVY].map((w) => document.fonts.load(`${w} 16px ${family}`, sample)));
    await document.fonts.ready;
  } catch {}

  const photoUrl = cat.photo_urls?.[0];
  const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;

  // Full-bleed 9:16 photo. ไม่มีการ์ด/พื้นหลังแยกอีกต่อไป
  if (img) {
    drawCover(ctx, img, 0, 0, W, H, 0.5);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#25252A');
    g.addColorStop(1, '#0B0B0D');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    catFace(ctx, CX, 760, 360, cat.belly_status);
  }

  // อ่านง่ายบนรูป: gradient ด้านบนและด้านล่าง ไม่สร้างพื้นหลังการ์ด
  const top = ctx.createLinearGradient(0, 0, 0, 620);
  top.addColorStop(0, 'rgba(0,0,0,0.72)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 620);

  const bottom = ctx.createLinearGradient(0, 1120, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 1120, W, H - 1120);

  // subtle status tint
  ctx.fillStyle = hexA(lv.color, 0.08);
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Brand
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(34, W_HEAVY);
  setLS(ctx, 4);
  ctx.fillText("BELLY DON'T BULLY", 72, 105);
  setLS(ctx, 0);

  ctx.font = font(22, W_BOLD);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(cat.id != null ? `CAT ID • ${String(cat.id).padStart(3, '0')}` : 'CAT ID', 74, 145);

  // Name
  const nameSize = fitFont(ctx, cat.name, 920, 110, 52, family, W_HEAVY);
  ctx.font = font(nameSize, W_HEAVY);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.fillText(cat.name, 72, 1245);
  ctx.shadowBlur = 0;

  // Status badge
  const statusText = txt.label;
  ctx.font = font(28, W_HEAVY);
  const badgeW = ctx.measureText(statusText).width + 52;
  ctx.fillStyle = lv.color;
  rr(ctx, 72, 1280, badgeW, 58, 29);
  ctx.fill();
  ctx.fillStyle = '#111113';
  ctx.fillText(statusText, 98, 1320);

  // Collar + likes
  const collarText = collared ? t.collared : t.stray;
  ctx.font = font(25, W_BOLD);
  const collarW = ctx.measureText(collarText).width + 42;
  const collarX = 72 + badgeW + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  rr(ctx, collarX, 1280, collarW, 58, 29);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(collarText, collarX + 21, 1320);

  ctx.font = font(25, W_BOLD);
  ctx.fillText(`♥ ${cat.likes_count || 0}`, collarX + collarW + 18, 1320);

  // Location
  ctx.font = font(27, W_BOLD);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(`📍 ${t.where}`, 72, 1400);
  ctx.font = font(fitFont(ctx, cat.location, 900, 42, 24, family, W_HEAVY), W_HEAVY);
  ctx.fillStyle = '#FFFFFF';
  const locationLines = wrapText(ctx, cat.location, 900, 2, lang);
  locationLines.forEach((line, i) => ctx.fillText(line, 72, 1450 + i * 48));

  // Belly message
  ctx.font = font(28, W_BOLD);
  ctx.fillStyle = lv.color;
  const bellyY = 1560;
  wrapText(ctx, txt.text, 900, 2, lang).forEach((line, i) => ctx.fillText(line, 72, bellyY + i * 42));

  // Details / discoverer
  const detailsY = 1660;
  ctx.font = font(23, W_REG);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  if (cat.details?.trim()) {
    wrapText(ctx, `“${cat.details.trim()}”`, 900, 2, lang).forEach((line, i) => ctx.fillText(line, 72, detailsY + i * 34));
  }
  ctx.font = font(21, W_REG);
  ctx.fillStyle = 'rgba(255,255,255,0.66)';
  ctx.fillText(`${t.by}: ${byName}`, 72, 1780);

  ctx.font = font(19, W_REG);
  ctx.fillStyle = 'rgba(255,255,255,0.48)';
  ctx.fillText(txt.label.toUpperCase(), 72, 1840);

  return canvas.toDataURL('image/png');
}
