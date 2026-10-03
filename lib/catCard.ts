// lib/catCard.ts — สร้างการ์ดเหมียวสไตล์ photocard ครีม-ชมพู (1080×1350 = IG 4:5)
// วาดหน้าแมว/หัวใจ/รอยเท้าด้วยโค้ดเอง ไม่พึ่งอีโมจิ เพื่อให้หน้าตาเหมือนกันทุกเครื่อง

export type CardBellyStatus = 'safe' | 'caution' | 'danger';

export interface CardCat {
  name: string;
  location: string;
  belly_status: CardBellyStatus;
  collar_status?: 'stray' | 'collared';
  details?: string;
  photo_urls?: string[] | null;
  discovered_by?: string;
  likes_count?: number;
}

const W = 1080;
const H = 1350;

const C = {
  cream: '#FFF8F0',
  pink: '#FFD6E0',
  pinkMid: '#FFB3C7',
  pinkDeep: '#FF8FB1',
  peach: '#FFE5D0',
  mint: '#D4F1E4',
  lavender: '#E6DCFF',
  ink: '#5B4B57',
  soft: '#8A7A86',
  white: '#FFFFFF',
  coral: '#FF6B81',
};

const LEVEL: Record<CardBellyStatus, { fill: string; label: string; text: string }> = {
  safe: { fill: '#A8E6CF', label: 'เฟรนลี่', text: 'จกพุงได้สบาย ชอบให้เกา' },
  caution: { fill: '#FFE08A', label: 'คาดเดาไม่ได้', text: 'จกได้นิดหน่อย ระวังโดนสวบ' },
  danger: { fill: '#FF9AA9', label: 'โขด', text: 'ห้ามจกพุงเด็ดขาด!' },
};

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

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, min: number, family: string, bold = true) {
  let size = start;
  ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
  }
  return size;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.4) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) * focusY, sw, sh, x, y, w, h);
}

// รูปที่ผ่านตัวครอปแล้ว (จัตุรัส) → cover พอดีเป๊ะ
// รูปเก่าที่ไม่ได้ครอป สัดส่วนต่างมาก → แสดงเต็มรูปบนพื้นหลังเบลอ ไม่ยืดและไม่ตัดหน้าแมว
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
    ctx.fillStyle = 'rgba(255,248,240,0.25)';
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

function tape(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  ctx.restore();
}

// หน้าแมวสไตล์สติกเกอร์ ตามอารมณ์ของระดับความพุง
function catFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, mood: CardBellyStatus) {
  ctx.save();
  ctx.lineWidth = s * 0.04;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.cream;
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
  ctx.fillStyle = C.pinkDeep;
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
      ctx.fillStyle = C.ink;
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
  ctx.fillStyle = C.pinkDeep;
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

export async function renderCatCard(cat: CardCat): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not supported');

  // ใช้ฟอนต์เดียวกับหน้าเว็บ (ตั้งที่ <body> ใน layout.tsx)
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const font = (size: number, bold = false) => `${bold ? 700 : 400} ${size}px ${family}`;
  try {
    await Promise.all([
      document.fonts.load(`400 16px ${family}`, 'กขค Aa'),
      document.fonts.load(`700 16px ${family}`, 'กขค Aa'),
    ]);
    await document.fonts.ready;
  } catch {}

  const lv = LEVEL[cat.belly_status];
  const collared = cat.collar_status === 'collared';
  const photoUrl = cat.photo_urls?.[0];
  const img = photoUrl ? await loadImage(photoUrl).catch(() => null) : null;
  ctx.textBaseline = 'alphabetic';

  /* พื้นหลังพาสเทล */
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#FFE4EC');
  bg.addColorStop(0.5, '#FFF3E6');
  bg.addColorStop(1, '#E0F5EC');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ([
    [90, 170, 190, 'rgba(230,220,255,0.65)'],
    [1000, 1180, 240, 'rgba(212,241,228,0.7)'],
    [980, 110, 150, 'rgba(255,229,208,0.7)'],
  ] as const).forEach(([x, y, r, col]) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  /* ตัวการ์ด */
  ctx.save();
  ctx.shadowColor = 'rgba(190,110,140,0.32)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.cream;
  rr(ctx, 60, 60, 960, 1230, 64);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 14;
  rr(ctx, 67, 67, 946, 1216, 57);
  ctx.stroke();
  ctx.save();
  ctx.strokeStyle = C.pinkMid;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.setLineDash([1, 16]);
  rr(ctx, 88, 88, 904, 1174, 40);
  ctx.stroke();
  ctx.restore();

  /* หัวการ์ด */
  ctx.textAlign = 'left';
  const title = 'CAT FOUND ! PROFILE';
  const ts = fitFont(ctx, title, 480, 40, 28, family);
  const tw = ctx.measureText(title).width;
  const pillW = tw + 110;
  ctx.fillStyle = C.pinkDeep;
  rr(ctx, 108, 104, pillW, 72, 36);
  ctx.fill();
  heart(ctx, 108 + 40, 140, 28, C.white);
  ctx.fillStyle = C.white;
  ctx.fillText(title, 108 + 68, 140 + ts * 0.35);

  const likes = String(cat.likes_count || 0);
  ctx.font = font(34, true);
  const chipW = ctx.measureText(likes).width + 96;
  ctx.fillStyle = C.peach;
  rr(ctx, 972 - chipW, 104, chipW, 72, 36);
  ctx.fill();
  heart(ctx, 972 - chipW + 40, 140, 28, C.pinkDeep);
  ctx.fillStyle = C.ink;
  ctx.fillText(likes, 972 - chipW + 68, 152);

  /* รูป (จัตุรัส) */
  const PX = 212, PY = 198, PS = 760;
  ctx.save();
  ctx.shadowColor = 'rgba(190,110,140,0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.white;
  rr(ctx, PX - 6, PY - 6, PS + 12, PS + 12, 42);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, PX, PY, PS, PS, 36);
  ctx.clip();
  if (img) drawPhoto(ctx, img, PX, PY, PS, PS);
  else {
    ctx.fillStyle = C.peach;
    ctx.fillRect(PX, PY, PS, PS);
    catFace(ctx, PX + PS / 2, PY + PS / 2, 320, cat.belly_status);
  }
  ctx.restore();

  /* เทปกระดาษ */
  tape(ctx, PX + PS - 14, PY + 8, 170, 46, 0.7, C.lavender);
  tape(ctx, PX + PS - 8, PY + PS - 6, 150, 44, -0.7, C.mint);

  /* ป้ายมีบ้าน/จร */
  const collarText = collared ? 'มีบ้าน' : 'เหมียวจร';
  ctx.font = font(28, true);
  const cw = ctx.measureText(collarText).width + 48;
  ctx.save();
  ctx.translate(PX + 24 + cw / 2, PY + 26 + 28);
  ctx.rotate(-0.05);
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = collared ? C.mint : C.peach;
  rr(ctx, -cw / 2, -28, cw, 56, 28);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.fillText(collarText, 0, 10);
  ctx.restore();

  /* ป้ายชื่อแมว (สติกเกอร์) */
  ctx.textAlign = 'left';
  const nameSize = fitFont(ctx, cat.name, 500, 62, 34, family);
  const nameText = wrapText(ctx, cat.name, 500, 1)[0] ?? '';
  const nw = ctx.measureText(nameText).width;
  const sw = nw + 108, sh = 92;
  ctx.save();
  ctx.translate(PX + 22 + sw / 2, PY + PS - 22 - sh / 2);
  ctx.rotate(-0.04);
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = C.white;
  rr(ctx, -sw / 2, -sh / 2, sw, sh, 32);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = C.pinkMid;
  ctx.lineWidth = 5;
  rr(ctx, -sw / 2, -sh / 2, sw, sh, 32);
  ctx.stroke();
  heart(ctx, -sw / 2 + 44, 0, 30, C.pinkDeep);
  ctx.fillStyle = C.ink;
  ctx.font = font(nameSize, true);
  ctx.fillText(nameText, -sw / 2 + 76, nameSize * 0.32);
  ctx.restore();

  /* แถบ B E L L Y / DONT / B U L L Y แนวตั้ง */
  const letters = ['B', 'E', 'L', 'L', 'Y', 'DONT', 'B', 'U', 'L', 'L', 'Y'];
  const top = PY + 24, slot = (PY + PS - 8 - top) / letters.length;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  letters.forEach((ch, i) => {
    const dont = ch === 'DONT';
    ctx.font = font(dont ? 22 : 40, true);
    ctx.fillStyle = dont ? C.coral : C.ink;
    ctx.fillText(ch, 154, top + (i + 0.5) * slot);
  });
  ctx.textBaseline = 'alphabetic';

  /* สถานที่เจอ */
  ctx.textAlign = 'left';
  ctx.font = font(24, true);
  const lw = ctx.measureText('สถานที่เจอ').width + 40;
  ctx.fillStyle = C.lavender;
  rr(ctx, 108, 980, lw, 44, 22);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.fillText('สถานที่เจอ', 128, 1011);
  const locX = 108 + lw + 18;
  fitFont(ctx, cat.location, 972 - locX, 34, 22, family);
  ctx.fillText(wrapText(ctx, cat.location, 972 - locX, 1)[0] ?? '', locX, 1013);

  /* กล่องคำอธิบาย */
  ctx.fillStyle = C.white;
  rr(ctx, 108, 1044, 730, 130, 28);
  ctx.fill();
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 4;
  rr(ctx, 108, 1044, 730, 130, 28);
  ctx.stroke();
  ctx.font = font(30);
  ctx.fillStyle = cat.details ? C.ink : C.soft;
  wrapText(ctx, cat.details || lv.text, 674, 3).forEach((line, i) => ctx.fillText(line, 136, 1092 + i * 36));

  /* วงกลมระดับความพุง + หน้าแมวตามอารมณ์ */
  const CX = 880, CY = 1126, CR = 88;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = lv.fill;
  ctx.beginPath();
  ctx.arc(CX, CY, CR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(CX, CY, CR, 0, Math.PI * 2);
  ctx.stroke();
  catFace(ctx, CX, CY - 14, 84, cat.belly_status);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink;
  fitFont(ctx, lv.label, 130, 24, 16, family);
  ctx.fillText(lv.label, CX, CY + 66);

  /* ท้ายการ์ด */
  ctx.textAlign = 'left';
  ctx.font = font(26, true);
  ctx.fillStyle = C.soft;
  ctx.fillText(wrapText(ctx, `พบเจอโดย : ${cat.discovered_by || 'ทาสแมวนิรนาม'}`, 640, 1)[0] ?? '', 108, 1244);
  paw(ctx, 946, 1232, 40, C.pinkMid, 0.3);

  /* ของตกแต่งที่ทับขอบการ์ด */
  sparkle(ctx, 1030, 360, 26, C.pinkDeep);
  sparkle(ctx, 44, 1180, 22, '#FFD166');
  heart(ctx, 46, 700, 40, C.pinkMid);
  paw(ctx, 1034, 1110, 46, C.pinkDeep, -0.35);
  sparkle(ctx, 70, 330, 16, C.lavender);

  return canvas.toDataURL('image/png');
}
