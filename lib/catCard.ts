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
  const baseline = (centerY: number, size: number) => centerY + size * 0.34; // ปรับตัวคูณนี้ถ้าข้อความดูสูง/ต่ำ

  const lv = LEVEL[cat.belly_status];
  const txt = t.level[cat.belly_status];
  const collared = cat.collar_status === 'collared';
  const byName = !cat.discovered_by || cat.discovered_by === 'ทาสแมวนิรนาม' ? t.anon : cat.discovered_by;

  // โหลดฟอนต์ให้ครอบคลุมตัวอักษรที่ใช้จริงบนการ์ด
  const sample =
    `${cat.name}${cat.location}${cat.details ?? ''}${byName}${txt.label}${txt.text}` +
    `${t.where}${t.belly}${t.by}${t.stray}${t.collared}CAT ID BELLY DON'T BULLY No. 0123456789 Aa`;
  try {
    await Promise.all([W_REG, W_BOLD, W_HEAVY].map((w) => document.fonts.load(`${w} 16px ${family}`, sample)));
    await document.fonts.ready;
  } catch {}

  const photoUrl = cat.photo_urls?.[0];
  const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;
  const rand = makeRng(hashStr(`${cat.id ?? ''}|${cat.name}|${cat.location}`));

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  /* ───── พื้นหลังพาสเทลม่วงฟ้า ───── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#E6E9FF');
  bg.addColorStop(0.5, '#CBD1FC');
  bg.addColorStop(1, '#A9B1F7');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(CX, 800, 40, CX, 800, 900);
  glow.addColorStop(0, 'rgba(255,255,255,0.6)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const tint = ctx.createRadialGradient(CX, 1500, 20, CX, 1500, 700);
  tint.addColorStop(0, hexA(lv.color, 0.35));
  tint.addColorStop(1, hexA(lv.color, 0));
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);

  // รอยเท้าจางๆ เป็นลายพื้นหลัง (เหมือน ref)
  ([
    [100, 520, 96], [992, 640, 84], [74, 1250, 100], [1004, 1400, 90],
    [210, 1770, 96], [850, 1790, 104], [950, 190, 86], [130, 150, 80],
  ] as const).forEach(([x, y, s]) => paw(ctx, x, y, s, 'rgba(255,255,255,0.32)', rand() * 1.2 - 0.6));

  /* ───── สายคล้อง (ลายรอยเท้า) ───── */
  {
    const sx = CX - 30, sw = 60;
    ctx.save();
    ctx.shadowColor = 'rgba(60,70,170,0.3)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 6;
    ctx.fillStyle = C.ink;
    ctx.fillRect(sx, -10, sw, 350);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(sx + 8, -10, 6, 350);
    for (let y = 20; y < 320; y += 66) paw(ctx, CX, y, 24, 'rgba(255,255,255,0.28)');
  }

  /* ───── ตัวบัตร ───── */
  // เงาแบบแฟลตเยื้อง (สไตล์สติกเกอร์)
  ctx.fillStyle = 'rgba(88,98,214,0.4)';
  rr(ctx, CARD.x + 16, CARD.y + 20, CARD.w, CARD.h, CARD.r);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(70,80,190,0.28)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  const cardBg = ctx.createLinearGradient(0, CARD.y, 0, CARD.y + CARD.h);
  cardBg.addColorStop(0, '#FFFFFF');
  cardBg.addColorStop(1, '#F6F7FF');
  ctx.fillStyle = cardBg;
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.fill();
  ctx.restore();

  // ลายน้ำรอยเท้า + แถบล่าง (ตัดตามขอบบัตร)
  ctx.save();
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.clip();

  paw(ctx, 800, 1240, 120, 'rgba(220,217,255,0.55)', 0.35);
  paw(ctx, 250, 1130, 80, 'rgba(220,217,255,0.4)', -0.3);

  ctx.fillStyle = C.ink;
  ctx.fillRect(CARD.x, BAND.y, CARD.w, BAND.h);
  // ลายจุดสีบนแถบ
  [C.orange, lv.color, '#FFB7CD'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(CARD.x + 40 + i * 22, BAND.y + 18, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // ขอบบัตร
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 8;
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.stroke();

  /* ───── หัวบัตร ───── */
  {
    ctx.fillStyle = C.muted;
    ctx.font = font(22, W_HEAVY);
    setLS(ctx, 4);
    ctx.fillText('CAT ID', LEFT, 432);
    setLS(ctx, 0);

    if (cat.id != null) {
      ctx.font = font(22, W_BOLD);
      ctx.fillStyle = C.ink;
      ctx.fillText(`No.${String(cat.id).padStart(3, '0')}`, LEFT, 464);
    }
    paw(ctx, RIGHT - 28, 452, 62, C.inkSoft, 0.2);
  }

  /* ───── รูปแมววงกลม ───── */
  {
    const { cx, cy, r } = PH;

    // ฮาโลสีสถานะ
    ctx.fillStyle = hexA(lv.color, 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 40, 0, Math.PI * 2);
    ctx.fill();

    // ขอบหนาสีเข้ม
    ctx.save();
    ctx.shadowColor = 'rgba(60,70,170,0.3)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
      drawPhoto(ctx, img, cx - r, cy - r, r * 2, r * 2);
    } else {
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, '#FFE9D6');
      g.addColorStop(1, '#FFD0DE');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
      halo.addColorStop(0, hexA(lv.color, 0.5));
      halo.addColorStop(1, hexA(lv.color, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      catFace(ctx, cx, cy + 12, 340, cat.belly_status);
    }
    ctx.restore();

    // ประกายบนขอบรูป
    sparkle(ctx, cx - 190, cy - 190, 20, C.white);
    sparkle(ctx, cx - 224, cy - 140, 11, C.white);
  }

  /* ───── ตราหน้าแมวตามอารมณ์ (ซ้อนมุมรูป) ───── */
  {
    const { x, y, r } = EMBLEM;
    ctx.save();
    ctx.shadowColor = 'rgba(60,70,170,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const g = ctx.createRadialGradient(x - 14, y - 16, 4, x, y, r - 8);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.4, lv.light);
    g.addColorStop(1, lv.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r - 8, 0, Math.PI * 2);
    ctx.fill();
    catFace(ctx, x, y + 2, 84, cat.belly_status);
  }

  /* ───── ชื่อแมว ───── */
  {
    const nameSize = fitFont(ctx, cat.name, 720, 80, 40, family, W_HEAVY);
    const nameText = wrapText(ctx, cat.name, 720, 1, lang)[0] ?? '';
    ctx.font = font(nameSize, W_HEAVY);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.fillText(nameText, CX, 1050);
    ctx.textAlign = 'left';
  }

  /* ───── ป้าย: เหมียวจร/มีบ้าน + ยอดไลก์ ───── */
  {
    const py = 1078, ph = 48, gap = 16;
    const ct = collared ? t.collared : t.stray;
    ctx.font = font(24, W_BOLD);
    const w1 = ctx.measureText(ct).width + 44;
    const likes = String(cat.likes_count || 0);
    ctx.font = font(26, W_HEAVY);
    const w2 = ctx.measureText(likes).width + 80;
    let x = CX - (w1 + gap + w2) / 2;

    ctx.fillStyle = collared ? C.mint : C.peach;
    rr(ctx, x, py, w1, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = font(24, W_BOLD);
    ctx.fillText(ct, x + 22, baseline(py + ph / 2, 24));

    x += w1 + gap;
    ctx.fillStyle = C.pinkSoft;
    rr(ctx, x, py, w2, ph, ph / 2);
    ctx.fill();
    heart(ctx, x + 32, py + ph / 2 - 1, 28, C.pinkDeep);
    ctx.fillStyle = C.ink;
    ctx.font = font(26, W_HEAVY);
    ctx.fillText(likes, x + 56, baseline(py + ph / 2, 26));
  }

  /* ───── เส้นประคั่น ───── */
  ctx.save();
  ctx.strokeStyle = '#D6D3F2';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 12]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(LEFT, 1160);
  ctx.lineTo(RIGHT, 1160);
  ctx.stroke();
  ctx.restore();

  /* ───── แถว: ป้าย + ค่า พร้อมไฮไลต์ใต้ตัวอักษร (สไตล์ ref) ───── */
  const drawRow = (label: string, value: string, labelY: number, valueY: number, hl: string, maxW: number) => {
    ctx.font = font(22, W_BOLD);
    ctx.fillStyle = C.muted;
    ctx.fillText(label, LEFT + 34, labelY);

    const size = fitFont(ctx, value, maxW, 38, 22, family, W_HEAVY);
    const text = wrapText(ctx, value, maxW, 1, lang)[0] ?? '';
    ctx.font = font(size, W_HEAVY);
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = hl;
    rr(ctx, LEFT - 8, valueY - 14, tw + 20, 24, 12);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = font(size, W_HEAVY);
    ctx.fillText(text, LEFT, valueY);
  };

  // สถานที่เจอ
  pin(ctx, LEFT + 11, 1194, 30, C.lavDeep);
  drawRow(t.where, cat.location, 1200, 1250, C.hl, INW);

  // ระดับความพุง + รอยเท้า 1–3 รอย
  heart(ctx, LEFT + 11, 1298, 24, C.pinkDeep);
  drawRow(t.belly, txt.label, 1306, 1356, lv.color, INW - 3 * 60 - 20);
  for (let i = 0; i < 3; i++) {
    paw(ctx, RIGHT - 28 - (2 - i) * 60, 1340, 46, i < lv.lv ? C.inkSoft : '#E3E0FF', 0.15);
  }

  /* ───── คำอธิบาย ───── */
  {
    ctx.font = font(26, W_REG);
    const hasDetails = !!cat.details?.trim();
    ctx.fillStyle = C.body;
    wrapText(ctx, hasDetails ? cat.details! : txt.text, INW, 2, lang).forEach((line, i) =>
      ctx.fillText(line, LEFT, 1414 + i * 34)
    );
  }

  /* ───── แถบล่าง: ผู้พบ + แบรนด์ ───── */
  {
    const by = 1546;
    const brand = "BELLY DON'T BULLY";
    ctx.font = font(20, W_HEAVY);
    setLS(ctx, 1.5);
    const bw = ctx.measureText(brand).width;
    ctx.fillStyle = C.orange;
    ctx.fillText(brand, RIGHT - bw, by);
    setLS(ctx, 0);
    paw(ctx, RIGHT - bw - 28, by - 8, 28, C.orange, 0.2);

    ctx.font = font(22, W_REG);
    ctx.fillStyle = C.cream;
    const maxBy = RIGHT - bw - 28 - 30 - LEFT;
    ctx.fillText(wrapText(ctx, `${t.by} : ${byName}`, maxBy, 1, lang)[0] ?? '', LEFT, by);
  }

  /* ───── คลิปโลหะ (ทับขอบบนบัตร) ───── */
  {
    ctx.save();
    ctx.shadowColor = 'rgba(60,70,170,0.3)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#D5D4E2';
    rr(ctx, CX - 52, 292, 104, 92, 22);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    rr(ctx, CX - 52, 292, 104, 92, 22);
    ctx.stroke();
    ctx.fillStyle = '#9C9AB0';
    rr(ctx, CX - 34, 336, 68, 30, 12);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  /* ───── ของตกแต่งนอกบัตร ───── */
  sparkle(ctx, 968, 410, 24, C.white);
  sparkle(ctx, 98, 880, 18, C.white);
  heart(ctx, 86, 1010, 36, 'rgba(255,255,255,0.85)');
  sparkle(ctx, 996, 1560, 20, C.white);
  heart(ctx, 1000, 1000, 28, 'rgba(255,255,255,0.7)');

  return canvas.toDataURL('image/png');
}
