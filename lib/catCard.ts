// lib/catCard.ts — การ์ดเหมียวสไตล์ Dreamy Holo Pastel (1080×1350 = IG 4:5)
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
}

export interface CardOptions {
  lang?: CardLang; // ไม่ส่ง = ตรวจจากภาษาเบราว์เซอร์ (zh/ja/ko) ที่เหลือเป็นไทย
}

/* ───────────── texts ───────────── */

interface Strings {
  found: string;
  belly: string;
  where: string;
  by: string;
  anon: string;
  stray: string;
  collared: string;
  level: Record<CardBellyStatus, { label: string; text: string }>;
}

const T: Record<CardLang, Strings> = {
  th: {
    found: 'เจอเหมียวแล้ว',
    belly: 'ระดับความพุง',
    where: 'สถานที่เจอ',
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
    found: 'CAT FOUND',
    belly: 'BELLY LEVEL',
    where: 'Spotted at',
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
    found: '发现小猫',
    belly: '肚肚等级',
    where: '发现地点',
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
    found: '猫発見',
    belly: 'お腹レベル',
    where: '発見場所',
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
    found: '고양이 발견',
    belly: '배 레벨',
    where: '발견 장소',
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
const H = 1350;

// น้ำหนักฟอนต์ (layout.tsx ต้องโหลด Mitr: 400, 500, 600)
const W_REG = 400;
const W_BOLD = 500;
const W_HEAVY = 600;

const C = {
  cream: '#FFFBF7',
  blush: '#FFF1F5',
  white: '#FFFFFF',
  pink: '#FFD9E4',
  pinkMid: '#FFB7CD',
  pinkDeep: '#FF7FA6',
  peach: '#FFE6D2',
  lavender: '#E7DDFF',
  lavenderDeep: '#BFA8FF',
  mint: '#D5F3E6',
  gold: '#FFD166',
  ink: '#4A3B47',
  soft: '#9A8896',
};

const FACE = { fur: '#FFFBF7', line: '#4A3B47', blush: '#FF8FB1' };

const LEVEL: Record<CardBellyStatus, { color: string; light: string; lv: number }> = {
  safe: { color: '#6FD6A8', light: '#CFF3E2', lv: 1 },
  caution: { color: '#FFCB57', light: '#FFEFC4', lv: 2 },
  danger: { color: '#FF8AA0', light: '#FFD9E1', lv: 3 },
};

// เลย์เอาต์
const CARD = { x: 60, y: 60, w: 960, h: 1230, r: 72 };
const BORDER = 14;
const IN = { x: CARD.x + BORDER, y: CARD.y + BORDER, w: CARD.w - BORDER * 2, h: CARD.h - BORDER * 2, r: 58 };
const IX = 108;
const IW = 864;
const IR = IX + IW; // 972
const PHOTO = { x: IX, y: 188, w: IW, h: 672, r: 44 };
const PHOTO_BOTTOM = PHOTO.y + PHOTO.h; // 860
const EMBLEM = { x: 872, y: 872, r: 88 };
const STICKER = { x: 132, cy: 878, h: 96, maxName: 528 };
const BANNER = { y: 972, h: 80 };
const LOC = { y: 1068, h: 42 };
const DESC = { y: 1124, h: 100 };
const FOOT_Y = 1258;

/* ───────────── fonts ───────────── */

const GENERIC = new Set(['system-ui', 'sans-serif', 'ui-sans-serif', 'serif', 'monospace', '-apple-system', 'blinkmacsystemfont']);

const CJK_STACK: Record<CardLang, string[]> = {
  th: ['"PingFang SC"', '"Hiragino Sans"', '"Yu Gothic"', '"Microsoft YaHei"', '"Malgun Gothic"', '"Apple SD Gothic Neo"', '"Noto Sans SC"', '"Noto Sans JP"', '"Noto Sans KR"'],
  en: ['"PingFang SC"', '"Hiragino Sans"', '"Yu Gothic"', '"Microsoft YaHei"', '"Malgun Gothic"', '"Apple SD Gothic Neo"', '"Noto Sans SC"', '"Noto Sans JP"', '"Noto Sans KR"'],
  zh: ['"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', '"Noto Sans SC"', '"Noto Sans CJK SC"'],
  ja: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', '"Meiryo"', '"Noto Sans JP"', '"Noto Sans CJK JP"'],
  ko: ['"Apple SD Gothic Neo"', '"Malgun Gothic"', '"Noto Sans KR"', '"Noto Sans CJK KR"'],
};

// ฟอนต์ของเว็บ (Mitr) ก่อน แล้วตามด้วยฟอนต์ CJK ของระบบตามภาษา
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
    ctx.fillStyle = 'rgba(255,248,240,0.3)';
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
    // ในหู
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
  ctx.globalAlpha = 0.45;
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

/* ───────────── main ───────────── */

export async function renderCatCard(cat: CardCat, opts: CardOptions = {}): Promise<string> {
  const lang = opts.lang ?? detectLang();
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
    `${t.found}${t.belly}${t.where}${t.by}${t.stray}${t.collared}BELLY DON'T BULLY No. 0123456789 Aa`;
  try {
    await Promise.all([W_REG, W_BOLD, W_HEAVY].map((w) => document.fonts.load(`${w} 16px ${family}`, sample)));
    await document.fonts.ready;
  } catch {}

  const photoUrl = cat.photo_urls?.[0];
  const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;

  const rand = makeRng(hashStr(`${cat.id ?? ''}|${cat.name}|${cat.location}`));

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  /* ───── พื้นหลังนอกการ์ด ───── */
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#FFE3EC');
  bg.addColorStop(0.5, '#EFE6FF');
  bg.addColorStop(1, '#DDF6EC');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ([
    [90, 150, 230, 'rgba(255,255,255,0.55)'],
    [1000, 1200, 280, 'rgba(255,214,228,0.55)'],
    [980, 120, 170, 'rgba(255,230,208,0.6)'],
    [60, 1230, 200, 'rgba(213,243,230,0.6)'],
  ] as const).forEach(([x, y, r, col]) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  /* ───── ตัวการ์ด: ขอบ holo + เงา ───── */
  ctx.save();
  ctx.shadowColor = 'rgba(255,127,166,0.38)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 22;
  const holoB = ctx.createLinearGradient(CARD.x, CARD.y, CARD.x + CARD.w, CARD.y + CARD.h);
  ['#FFB3C7', '#FFD8A8', '#FFF3B0', '#BDF2D5', '#BDE4FF', '#D9C7FF', '#FFB3C7'].forEach((c, i, a) =>
    holoB.addColorStop(i / (a.length - 1), c)
  );
  ctx.fillStyle = holoB;
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.fill();
  ctx.restore();

  /* ───── พื้นในการ์ด ───── */
  ctx.save();
  rr(ctx, IN.x, IN.y, IN.w, IN.h, IN.r);
  ctx.clip();

  const inner = ctx.createLinearGradient(0, IN.y, 0, IN.y + IN.h);
  inner.addColorStop(0, C.cream);
  inner.addColorStop(1, C.blush);
  ctx.fillStyle = inner;
  ctx.fillRect(IN.x, IN.y, IN.w, IN.h);

  // ลายรอยเท้า/ประกายจางๆ เป็นพื้น
  for (let i = 0; i < 16; i++) {
    const px = IN.x + 30 + rand() * (IN.w - 60);
    const py = IN.y + 30 + rand() * (IN.h - 60);
    if (i % 3 === 0) sparkle(ctx, px, py, 8 + rand() * 8, 'rgba(255,183,205,0.35)');
    else paw(ctx, px, py, 26 + rand() * 14, 'rgba(255,183,205,0.22)', rand() * 1.2 - 0.6);
  }

  /* ───── หัวการ์ด: ริบบิ้น + ยอดไลก์ ───── */
  {
    const hy = 102, hh = 64;
    ctx.font = font(28, W_HEAVY);
    const rw = ctx.measureText(t.found).width + 104;
    const g = ctx.createLinearGradient(IX, 0, IX + rw, 0);
    g.addColorStop(0, C.pinkMid);
    g.addColorStop(1, C.pinkDeep);
    ctx.save();
    ctx.shadowColor = 'rgba(255,127,166,0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = g;
    rr(ctx, IX, hy, rw, hh, hh / 2);
    ctx.fill();
    ctx.restore();
    heart(ctx, IX + 40, hy + hh / 2 - 1, 28, C.white);
    ctx.fillStyle = C.white;
    ctx.font = font(28, W_HEAVY);
    ctx.fillText(t.found, IX + 70, baseline(hy + hh / 2, 28));

    const likes = String(cat.likes_count || 0);
    ctx.font = font(34, W_HEAVY);
    const lw = ctx.measureText(likes).width + 96;
    ctx.save();
    ctx.shadowColor = 'rgba(255,127,166,0.25)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = C.white;
    rr(ctx, IR - lw, hy, lw, hh, hh / 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.pinkMid;
    ctx.lineWidth = 3;
    rr(ctx, IR - lw, hy, lw, hh, hh / 2);
    ctx.stroke();
    heart(ctx, IR - lw + 38, hy + hh / 2 - 1, 30, C.pinkDeep);
    ctx.fillStyle = C.ink;
    ctx.font = font(34, W_HEAVY);
    ctx.fillText(likes, IR - lw + 64, baseline(hy + hh / 2, 34));
  }

  /* ───── รูปแมว ───── */
  {
    ctx.save();
    ctx.shadowColor = 'rgba(255,127,166,0.3)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.white;
    rr(ctx, PHOTO.x - 8, PHOTO.y - 8, PHOTO.w + 16, PHOTO.h + 16, PHOTO.r + 8);
    ctx.fill();
    ctx.restore();

    ctx.save();
    rr(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r);
    ctx.clip();
    const pcx = PHOTO.x + PHOTO.w / 2, pcy = PHOTO.y + PHOTO.h / 2;

    if (img) {
      drawPhoto(ctx, img, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    } else {
      const g = ctx.createLinearGradient(PHOTO.x, PHOTO.y, PHOTO.x + PHOTO.w, PHOTO.y + PHOTO.h);
      g.addColorStop(0, C.peach);
      g.addColorStop(1, C.pink);
      ctx.fillStyle = g;
      ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
      const glow = ctx.createRadialGradient(pcx, pcy, 20, pcx, pcy, 420);
      glow.addColorStop(0, hexA(lv.color, 0.45));
      glow.addColorStop(1, hexA(lv.color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
      catFace(ctx, pcx, pcy + 10, 400, cat.belly_status);
      heart(ctx, PHOTO.x + 120, PHOTO.y + 170, 50, C.white);
      heart(ctx, PHOTO.x + PHOTO.w - 130, PHOTO.y + 250, 38, C.pinkMid);
    }

    // ไล่สีชมพูนุ่มที่ขอบล่าง ให้ป้ายชื่ออ่านชัด
    const fade = ctx.createLinearGradient(0, PHOTO_BOTTOM - 260, 0, PHOTO_BOTTOM);
    fade.addColorStop(0, 'rgba(255,200,222,0)');
    fade.addColorStop(1, 'rgba(255,200,222,0.6)');
    ctx.fillStyle = fade;
    ctx.fillRect(PHOTO.x, PHOTO_BOTTOM - 260, PHOTO.w, 260);

    // holo เรืองจางๆ
    ctx.globalCompositeOperation = 'soft-light';
    const holo = ctx.createLinearGradient(PHOTO.x, PHOTO.y, PHOTO.x + PHOTO.w, PHOTO.y + PHOTO.h);
    holo.addColorStop(0.0, 'rgba(255,183,205,0.55)');
    holo.addColorStop(0.3, 'rgba(255,240,170,0.45)');
    holo.addColorStop(0.55, 'rgba(180,235,255,0.55)');
    holo.addColorStop(0.8, 'rgba(210,190,255,0.5)');
    holo.addColorStop(1.0, 'rgba(255,183,205,0.55)');
    ctx.fillStyle = holo;
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    ctx.globalCompositeOperation = 'source-over';

    // ประกายบนรูป
    sparkle(ctx, PHOTO.x + PHOTO.w - 90, PHOTO.y + 130, 22, 'rgba(255,255,255,0.9)');
    sparkle(ctx, PHOTO.x + 150, PHOTO.y + 330, 14, 'rgba(255,255,255,0.8)');
    sparkle(ctx, PHOTO.x + PHOTO.w - 200, PHOTO.y + 400, 12, 'rgba(255,255,255,0.75)');
    ctx.restore();

    // ขอบขาวรอบรูป
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 8;
    rr(ctx, PHOTO.x + 1, PHOTO.y + 1, PHOTO.w - 2, PHOTO.h - 2, PHOTO.r);
    ctx.stroke();

    // ป้ายเหมียวจร/มีบ้าน (มุมซ้ายบนของรูป)
    const ct = collared ? t.collared : t.stray;
    ctx.font = font(24, W_BOLD);
    const cw = ctx.measureText(ct).width + 48, ch = 50;
    const cx0 = PHOTO.x + 22, cy0 = PHOTO.y + 22;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = collared ? C.mint : C.peach;
    rr(ctx, cx0, cy0, cw, ch, ch / 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    rr(ctx, cx0, cy0, cw, ch, ch / 2);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = font(24, W_BOLD);
    ctx.fillText(ct, cx0 + 24, baseline(cy0 + ch / 2, 24));
  }

  /* ───── ป้ายชื่อสติกเกอร์ ───── */
  {
    const nameSize = fitFont(ctx, cat.name, STICKER.maxName, 62, 32, family, W_HEAVY);
    const nameText = wrapText(ctx, cat.name, STICKER.maxName, 1, lang)[0] ?? '';
    ctx.font = font(nameSize, W_HEAVY);
    const nw = ctx.measureText(nameText).width;
    const sw = nw + 108, sh = STICKER.h;
    ctx.save();
    ctx.translate(STICKER.x + sw / 2, STICKER.cy);
    ctx.rotate(-0.03);
    ctx.shadowColor = 'rgba(255,127,166,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = C.white;
    rr(ctx, -sw / 2, -sh / 2, sw, sh, sh / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = C.pinkMid;
    ctx.lineWidth = 5;
    rr(ctx, -sw / 2, -sh / 2, sw, sh, sh / 2);
    ctx.stroke();
    heart(ctx, -sw / 2 + 46, 0, 32, C.pinkDeep);
    ctx.fillStyle = C.ink;
    ctx.font = font(nameSize, W_HEAVY);
    ctx.fillText(nameText, -sw / 2 + 78, nameSize * 0.34);
    sparkle(ctx, sw / 2 - 16, -sh / 2 + 6, 14, C.gold);
    ctx.restore();
  }

  /* ───── ตรา (emblem) หน้าแมวตามอารมณ์ ───── */
  {
    const { x: ex, y: ey, r } = EMBLEM;
    ctx.save();
    ctx.shadowColor = 'rgba(255,127,166,0.4)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const g = ctx.createRadialGradient(ex - 24, ey - 28, 6, ex, ey, r - 12);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.35, lv.light);
    g.addColorStop(1, lv.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, r - 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, ey, r - 22, 0, Math.PI * 2);
    ctx.setLineDash([2, 10]);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.setLineDash([]);

    catFace(ctx, ex, ey + 2, 108, cat.belly_status);
  }

  /* ───── แถบระดับความพุง + รอยเท้า 1–3 รอย ───── */
  {
    const bg2 = ctx.createLinearGradient(IX, 0, IR, 0);
    bg2.addColorStop(0, lv.light);
    bg2.addColorStop(1, lv.color);
    ctx.save();
    ctx.shadowColor = hexA(lv.color, 0.45);
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = bg2;
    rr(ctx, IX, BANNER.y, IW, BANNER.h, BANNER.h / 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 4;
    rr(ctx, IX, BANNER.y, IW, BANNER.h, BANNER.h / 2);
    ctx.stroke();

    const tx = IX + 40;
    ctx.font = font(20, W_BOLD);
    ctx.fillStyle = hexA(C.ink, 0.7);
    ctx.fillText(t.belly, tx, BANNER.y + 31);

    const pawsLeft = IR - 40 - 2 * 62 - 30;
    fitFont(ctx, txt.label, pawsLeft - tx - 16, 38, 22, family, W_HEAVY);
    ctx.fillStyle = C.ink;
    ctx.fillText(txt.label, tx, BANNER.y + 67);

    for (let i = 0; i < 3; i++) {
      const on = i < lv.lv;
      paw(ctx, IR - 40 - (2 - i) * 62, BANNER.y + BANNER.h / 2 - 2, 46, on ? C.white : 'rgba(255,255,255,0.4)', 0.15);
    }
  }

  /* ───── สถานที่เจอ ───── */
  {
    ctx.font = font(22, W_BOLD);
    const pillW = ctx.measureText(t.where).width + 36 + 34;
    ctx.fillStyle = C.lavender;
    rr(ctx, IX, LOC.y, pillW, LOC.h, LOC.h / 2);
    ctx.fill();
    pin(ctx, IX + 28, LOC.y + LOC.h / 2 + 2, 30, C.lavenderDeep);
    ctx.fillStyle = C.ink;
    ctx.font = font(22, W_BOLD);
    ctx.fillText(t.where, IX + 52, baseline(LOC.y + LOC.h / 2, 22));

    const locX = IX + pillW + 16;
    const locW = IR - locX;
    const ls = fitFont(ctx, cat.location, locW, 30, 20, family, W_REG);
    ctx.fillStyle = C.ink;
    ctx.fillText(wrapText(ctx, cat.location, locW, 1, lang)[0] ?? '', locX, baseline(LOC.y + LOC.h / 2, ls));
  }

  /* ───── กล่องคำอธิบาย ───── */
  {
    ctx.save();
    ctx.shadowColor = 'rgba(255,127,166,0.18)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = C.white;
    rr(ctx, IX, DESC.y, IW, DESC.h, 32);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = C.pinkMid;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    rr(ctx, IX + 8, DESC.y + 8, IW - 16, DESC.h - 16, 26);
    ctx.stroke();
    ctx.restore();

    ctx.font = font(26, W_REG);
    const hasDetails = !!cat.details?.trim();
    const text = hasDetails ? cat.details! : txt.text;
    ctx.fillStyle = hasDetails ? C.ink : C.soft;
    wrapText(ctx, text, IW - 72, 2, lang).forEach((line, i) => ctx.fillText(line, IX + 36, DESC.y + 44 + i * 32));
  }

  /* ───── ท้ายการ์ด ───── */
  {
    const no = cat.id != null ? `  ·  No.${String(cat.id).padStart(3, '0')}` : '';
    const brand = `BELLY DON'T BULLY${no}`;
    ctx.font = font(20, W_BOLD);
    setLS(ctx, 1.5);
    const bw = ctx.measureText(brand).width;
    ctx.fillStyle = C.pinkDeep;
    ctx.fillText(brand, IR - bw, FOOT_Y);
    setLS(ctx, 0);
    paw(ctx, IR - bw - 26, FOOT_Y - 8, 30, C.pinkMid, 0.2);

    ctx.font = font(22, W_REG);
    ctx.fillStyle = C.soft;
    const maxBy = IR - bw - 26 - 28 - IX;
    ctx.fillText(wrapText(ctx, `${t.by} : ${byName}`, maxBy, 1, lang)[0] ?? '', IX, FOOT_Y);
  }

  /* ───── ประกายโฮโลทับทั้งใบ ───── */
  ctx.globalCompositeOperation = 'soft-light';
  const sheen = ctx.createLinearGradient(IN.x, IN.y, IN.x + IN.w, IN.y + IN.h);
  sheen.addColorStop(0.0, 'rgba(255,183,205,0.22)');
  sheen.addColorStop(0.35, 'rgba(255,240,170,0.16)');
  sheen.addColorStop(0.6, 'rgba(180,235,255,0.2)');
  sheen.addColorStop(1.0, 'rgba(210,190,255,0.22)');
  ctx.fillStyle = sheen;
  ctx.fillRect(IN.x, IN.y, IN.w, IN.h);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore(); // จบ clip ในการ์ด

  /* ขอบในบางๆ */
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  rr(ctx, IN.x, IN.y, IN.w, IN.h, IN.r);
  ctx.stroke();

  /* ───── ของตกแต่งที่ทับขอบการ์ด ───── */
  heart(ctx, 52, 300, 48, C.pinkMid);
  sparkle(ctx, 1040, 230, 26, C.gold);
  sparkle(ctx, 44, 1160, 22, C.lavenderDeep);
  paw(ctx, 1034, 1190, 56, C.pinkDeep, -0.35);
  heart(ctx, 1048, 700, 34, C.pinkMid);
  sparkle(ctx, 76, 112, 18, C.white);
  sparkle(ctx, 1020, 1320, 14, C.white);

  return canvas.toDataURL('image/png');
}
