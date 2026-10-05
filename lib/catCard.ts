// lib/catCard.ts — "Cat ID" profile card สำหรับ IG Story (1080×1920 = 9:16)
// ดีไซน์: Pet ID Card × Cat Profile × Japanese/Korean minimal cute
// รูปแมวเป็นพระเอก (ไม่มี effect ทับรูป) ข้อมูลเรียงเป็นระเบียบใต้รูป
// รองรับ th / en / zh / ja / ko, ฟอนต์หลักอ่านจาก <body> (Mitr) + ฟอนต์สำรอง CJK ของระบบ

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
  muted: '#9A96AE',
  body: '#6B6880',
  white: '#FFFFFF',
  line: '#EADFE6',
  border: '#F6E3CF',
  mint: '#D5F3E6',
  peach: '#FFE9D6',
  pinkSoft: '#FFE6EE',
  pinkDeep: '#FF7FA6',
  orange: '#FF9F43',
};

const FACE = { fur: '#FFFDF8', line: '#2F2B3F', blush: '#FF9DB8' };

const LEVEL: Record<CardBellyStatus, { color: string; light: string }> = {
  safe: { color: '#7FDDB2', light: '#DDF7EB' },
  caution: { color: '#FFCB57', light: '#FFF2CC' },
  danger: { color: '#FF8AA0', light: '#FFE0E6' },
};

// เลย์เอาต์ — เนื้อหาอยู่ช่วง y 320–1650 หลบแถบ UI ของไอจี (บน/ล่าง ~250px)
const CARD = { x: 110, y: 320, w: 860, h: 1330, r: 56 };
const PHOTO = { x: 140, y: 350, w: 800, h: 780, r: 40 };
const IX = 140; // ขอบซ้ายของเนื้อหา
const IR = 940; // ขอบขวาของเนื้อหา
const IW = IR - IX; // 800
const VALUE_X = IX + 190; // คอลัมน์ค่าในแถวข้อมูล
const VALUE_W = IR - VALUE_X; // 610

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

// รูปที่ผ่านตัวครอปแล้ว (จัตุรัส) → cover พอดี ไม่แต่งสีทับ
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

// ใช้เฉพาะตอนไม่มีรูป (placeholder)
function catFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, mood: CardBellyStatus) {
  ctx.save();
  ctx.lineWidth = s * 0.045;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = FACE.line;
  ctx.fillStyle = FACE.fur;
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
  ctx.beginPath();
  ctx.ellipse(cx, cy, 0.5 * s, 0.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = FACE.blush;
  [-1, 1].forEach((d) => {
    ctx.beginPath();
    ctx.arc(cx + d * 0.3 * s, cy + 0.1 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
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
  ctx.fillStyle = FACE.blush;
  ctx.beginPath();
  ctx.moveTo(cx - 0.04 * s, cy + 0.06 * s);
  ctx.lineTo(cx + 0.04 * s, cy + 0.06 * s);
  ctx.lineTo(cx, cy + 0.11 * s);
  ctx.closePath();
  ctx.fill();
  if (mood === 'safe') {
    ctx.beginPath(); ctx.arc(cx - 0.045 * s, cy + 0.11 * s, 0.045 * s, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 0.045 * s, cy + 0.11 * s, 0.045 * s, 0, Math.PI); ctx.stroke();
  } else if (mood === 'caution') {
    ctx.beginPath(); ctx.moveTo(cx - 0.06 * s, cy + 0.19 * s); ctx.lineTo(cx + 0.06 * s, cy + 0.19 * s); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy + 0.22 * s, 0.06 * s, Math.PI, 0); ctx.stroke();
  }
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

  /* ───── พื้นหลังมินิมอล ครีม-ชมพู-ลาเวนเดอร์ ───── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#FFF3E8');
  bg.addColorStop(0.5, '#FFE7EF');
  bg.addColorStop(1, '#ECE6FF');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const tint = ctx.createRadialGradient(820, 420, 20, 820, 420, 760);
  tint.addColorStop(0, hexA(lv.color, 0.3));
  tint.addColorStop(1, hexA(lv.color, 0));
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);

  // รอยเท้า/ประกายจางๆ นอกบัตร
  ([[96, 540, 84], [992, 1180, 90], [84, 1420, 76], [930, 190, 80], [180, 1790, 88], [880, 1800, 80]] as const).forEach(
    ([x, y, s]) => paw(ctx, x, y, s, 'rgba(255,255,255,0.55)', rand() * 1.2 - 0.6)
  );
  sparkle(ctx, 70, 300, 16, 'rgba(255,255,255,0.9)');
  sparkle(ctx, 1010, 1660, 14, 'rgba(255,255,255,0.9)');

  /* ───── ตัวบัตร ───── */
  ctx.save();
  ctx.shadowColor = 'rgba(200,130,160,0.3)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 28;
  ctx.fillStyle = C.white;
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 3;
  rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.stroke();

  /* ───── รูปแมว (พระเอก: ไม่มี effect ทับ) ───── */
  ctx.save();
  rr(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r);
  ctx.clip();
  if (img) {
    drawPhoto(ctx, img, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
  } else {
    const g = ctx.createLinearGradient(PHOTO.x, PHOTO.y, PHOTO.x + PHOTO.w, PHOTO.y + PHOTO.h);
    g.addColorStop(0, '#FFEBD9');
    g.addColorStop(1, '#FFD6E2');
    ctx.fillStyle = g;
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    const cx = PHOTO.x + PHOTO.w / 2, cy = PHOTO.y + PHOTO.h / 2;
    const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, 380);
    halo.addColorStop(0, hexA(lv.color, 0.45));
    halo.addColorStop(1, hexA(lv.color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    catFace(ctx, cx, cy + 10, 400, cat.belly_status);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(47,43,63,0.08)';
  ctx.lineWidth = 2;
  rr(ctx, PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h, PHOTO.r);
  ctx.stroke();

  /* ───── ป้ายเล็ก: CAT ID · No. ───── */
  {
    const no = cat.id != null ? `  ·  No.${String(cat.id).padStart(3, '0')}` : '';
    ctx.font = font(20, W_HEAVY);
    setLS(ctx, 3);
    ctx.fillStyle = C.muted;
    ctx.fillText(`CAT ID${no}`, IX, 1178);
    setLS(ctx, 0);
  }

  /* ───── ชื่อแมว (เด่นที่สุดในบัตร) ───── */
  {
    const NAME_W = 700;
    const size = fitFont(ctx, cat.name, NAME_W, 74, 38, family, W_HEAVY);
    const text = wrapText(ctx, cat.name, NAME_W, 1, lang)[0] ?? '';
    ctx.font = font(size, W_HEAVY);
    ctx.fillStyle = C.ink;
    ctx.fillText(text, IX, 1256);
    paw(ctx, IR - 26, 1224, 52, '#FFD0DE', 0.2);
  }

  /* ───── ป้าย: เหมียวจร/มีบ้าน + ยอดไลก์ ───── */
  {
    const py = 1282, ph = 46, gap = 12;
    const ct = collared ? t.collared : t.stray;
    ctx.font = font(22, W_BOLD);
    const w1 = ctx.measureText(ct).width + 40;
    ctx.fillStyle = collared ? C.mint : C.peach;
    rr(ctx, IX, py, w1, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = font(22, W_BOLD);
    ctx.fillText(ct, IX + 20, baseline(py + ph / 2, 22));

    const likes = String(cat.likes_count || 0);
    ctx.font = font(24, W_HEAVY);
    const w2 = ctx.measureText(likes).width + 72;
    const x2 = IX + w1 + gap;
    ctx.fillStyle = C.pinkSoft;
    rr(ctx, x2, py, w2, ph, ph / 2);
    ctx.fill();
    heart(ctx, x2 + 30, py + ph / 2 - 1, 26, C.pinkDeep);
    ctx.fillStyle = C.ink;
    ctx.font = font(24, W_HEAVY);
    ctx.fillText(likes, x2 + 52, baseline(py + ph / 2, 24));
  }

  const dashed = (y: number) => {
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 12]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(IX, y);
    ctx.lineTo(IR, y);
    ctx.stroke();
    ctx.restore();
  };
  dashed(1356);

  /* ───── แถวข้อมูลแบบบัตรประจำตัว ───── */
  const label = (text: string, y: number) => {
    ctx.font = font(24, W_BOLD);
    ctx.fillStyle = C.muted;
    ctx.fillText(text, IX, y);
  };

  // สถานที่เจอ
  {
    const y = 1408;
    label(t.where, y);
    const size = fitFont(ctx, cat.location, VALUE_W, 30, 20, family, W_BOLD);
    ctx.font = font(size, W_BOLD);
    ctx.fillStyle = C.ink;
    ctx.fillText(wrapText(ctx, cat.location, VALUE_W, 1, lang)[0] ?? '', VALUE_X, y);
  }

  // ระดับความพุง: ป้ายสีนุ่ม + จุดสถานะ (เหมือนข้อมูลบนบัตร ไม่ใช่เกจเกม)
  {
    const y = 1464;
    label(t.belly, y);
    const size = fitFont(ctx, txt.label, VALUE_W - 60, 28, 20, family, W_HEAVY);
    const text = wrapText(ctx, txt.label, VALUE_W - 60, 1, lang)[0] ?? '';
    ctx.font = font(size, W_HEAVY);
    const tw = ctx.measureText(text).width;
    const pw = tw + 62, ph = 46, py = y - 31;
    ctx.fillStyle = lv.light;
    rr(ctx, VALUE_X, py, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = lv.color;
    ctx.beginPath();
    ctx.arc(VALUE_X + 26, py + ph / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.font = font(size, W_HEAVY);
    ctx.fillText(text, VALUE_X + 46, baseline(py + ph / 2, size));
  }

  /* ───── คำอธิบาย ───── */
  {
    ctx.font = font(24, W_REG);
    ctx.fillStyle = C.body;
    const hasDetails = !!cat.details?.trim();
    wrapText(ctx, hasDetails ? cat.details! : txt.text, IW, 2, lang).forEach((line, i) =>
      ctx.fillText(line, IX, 1522 + i * 32)
    );
  }

  dashed(1580);

  /* ───── ท้ายบัตร: ผู้พบ + แบรนด์ ───── */
  {
    const fy = 1620;
    const brand = "BELLY DON'T BULLY";
    ctx.font = font(18, W_HEAVY);
    setLS(ctx, 1.5);
    const bw = ctx.measureText(brand).width;
    ctx.fillStyle = C.orange;
    ctx.fillText(brand, IR - bw, fy);
    setLS(ctx, 0);
    paw(ctx, IR - bw - 24, fy - 7, 26, C.orange, 0.2);

    ctx.font = font(22, W_REG);
    ctx.fillStyle = C.muted;
    const maxBy = IW - bw - 24 - 30 - 10;
    ctx.fillText(wrapText(ctx, `${t.by} : ${byName}`, maxBy, 1, lang)[0] ?? '', IX, fy);
  }

  return canvas.toDataURL('image/png');
}
