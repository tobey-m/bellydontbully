// lib/catCard.ts
//
// Belly Don't Bully — Premium Cat Found Card
// 1080 × 1350 px — Instagram 4:5
//
// Visual direction:
// Cute Premium / Japanese-Korean Editorial / Stationery
//
// - Photo first
// - Soft editorial typography
// - Black + cream + orange brand identity
// - Small sticker / tape / doodle details
// - No emoji dependency
// - Localization: TH / EN / ZH / JA / KO
//

export type CardBellyStatus = 'safe' | 'caution' | 'danger';
export type CardLocale = 'th' | 'en' | 'zh' | 'ja' | 'ko';

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

  // Optional:
  // ถ้าไม่ส่งมา จะใช้ภาษาไทย
  locale?: CardLocale;
}

/* =========================================================
 * CANVAS
 * ========================================================= */

const W = 1080;
const H = 1350;

/* =========================================================
 * FONT
 * ========================================================= */

const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semi: 600,
};

/*
 * ใช้ font ที่เหมาะกับแต่ละภาษา
 *
 * TH  → Mitr
 * EN  → Mitr / fallback
 * ZH  → Noto Sans SC
 * JA  → Noto Sans JP
 * KO  → Noto Sans KR
 */
const FONT_STACK: Record<CardLocale, string> = {
  th: '"Mitr", "Noto Sans Thai", sans-serif',
  en: '"Mitr", "Inter", sans-serif',
  zh: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
  ja: '"Noto Sans JP", "Yu Gothic", sans-serif',
  ko: '"Noto Sans KR", "Malgun Gothic", sans-serif',
};

/* =========================================================
 * COLORS
 * ========================================================= */

const C = {
  black: '#0B0B0D',
  blackSoft: '#111114',
  blackCard: '#151518',

  cream: '#F5EFE6',
  creamSoft: '#EAE1D4',

  white: '#FAFAF7',
  muted: '#929099',
  mutedDark: '#67656C',

  orange: '#FF9F43',
  orangeSoft: '#FFB86B',

  pink: '#F59AB5',
  pinkSoft: '#FFD9E3',

  green: '#78D6A7',
  greenSoft: '#D8F5E6',

  yellow: '#F6C85F',
  yellowSoft: '#FFF1C9',

  red: '#F47D86',
  redSoft: '#FFE0E3',

  line: '#29292D',
};

/* =========================================================
 * BELLY STATUS
 * ========================================================= */

const STATUS: Record<
  CardBellyStatus,
  {
    color: string;
    soft: string;
    label: Record<CardLocale, string>;
    description: Record<CardLocale, string>;
  }
> = {
  safe: {
    color: C.green,
    soft: C.greenSoft,
    label: {
      th: 'เฟรนลี่',
      en: 'FRIENDLY',
      zh: '亲人',
      ja: 'フレンドリー',
      ko: '친화적',
    },
    description: {
      th: 'จกพุงได้สบาย ชอบให้เกา',
      en: 'Belly rubs are welcome.',
      zh: '可以放心摸肚肚。',
      ja: 'おなかをなでても大丈夫。',
      ko: '배를 쓰다듬어도 괜찮아요.',
    },
  },

  caution: {
    color: C.yellow,
    soft: C.yellowSoft,
    label: {
      th: 'คาดเดาไม่ได้',
      en: 'UNPREDICTABLE',
      zh: '性格未知',
      ja: '気分屋',
      ko: '예측 불가',
    },
    description: {
      th: 'จกได้นิดหน่อย ระวังโดนสวบ',
      en: 'Proceed with a little caution.',
      zh: '可以摸一点点，小心猫爪。',
      ja: '少しだけ注意してなでてね。',
      ko: '조금만 조심해서 쓰다듬어 주세요.',
    },
  },

  danger: {
    color: C.red,
    soft: C.redSoft,
    label: {
      th: 'โขด',
      en: 'DO NOT TOUCH',
      zh: '请勿触摸',
      ja: 'さわらないで',
      ko: '만지지 마세요',
    },
    description: {
      th: 'ห้ามจกพุงเด็ดขาด!',
      en: 'Definitely not a belly-rub cat.',
      zh: '千万不要摸肚肚！',
      ja: 'おなかは絶対にNG！',
      ko: '배는 절대 만지지 마세요!',
    },
  },
};

/* =========================================================
 * LOCALIZATION
 * ========================================================= */

const LABEL = {
  th: {
    found: 'CAT FOUND',
    location: 'สถานที่เจอ',
    foundBy: 'พบเจอโดย',
    stray: 'เหมียวจร',
    collared: 'เหมียวมีบ้าน',
    likes: 'ชอบ',
    no: 'NO.',
  },

  en: {
    found: 'CAT FOUND',
    location: 'FOUND AT',
    foundBy: 'FOUND BY',
    stray: 'STRAY',
    collared: 'HAS A HOME',
    likes: 'LIKES',
    no: 'NO.',
  },

  zh: {
    found: '发现猫咪',
    location: '发现地点',
    foundBy: '发现者',
    stray: '流浪猫',
    collared: '有主猫咪',
    likes: '喜欢',
    no: 'NO.',
  },

  ja: {
    found: 'ねこ発見',
    location: '発見場所',
    foundBy: '発見者',
    stray: '野良ねこ',
    collared: '飼いねこ',
    likes: 'いいね',
    no: 'NO.',
  },

  ko: {
    found: '고양이 발견',
    location: '발견 장소',
    foundBy: '발견자',
    stray: '길고양이',
    collared: '집이 있어요',
    likes: '좋아요',
    no: 'NO.',
  },
};

/* =========================================================
 * CARD LAYOUT
 * ========================================================= */

const CARD = {
  x: 36,
  y: 36,
  w: 1008,
  h: 1278,
  r: 44,
};

const INNER = {
  x: 68,
  y: 68,
  w: 944,
  h: 1214,
};

const PHOTO = {
  x: 84,
  y: 132,
  w: 912,
  h: 680,
  r: 34,
};

const CONTENT = {
  x: 84,
  right: 996,
};

const FOOTER_Y = 1232;

/* =========================================================
 * HELPERS
 * ========================================================= */

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);

  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);

  ctx.closePath();
}

function hexA(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);

  return `rgba(
    ${(n >> 16) & 255},
    ${(n >> 8) & 255},
    ${n & 255},
    ${alpha}
  )`;
}

function setLS(
  ctx: CanvasRenderingContext2D,
  px: number
) {
  (
    ctx as unknown as {
      letterSpacing?: string;
    }
  ).letterSpacing = `${px}px`;
}

function hashStr(value: string) {
  let h = 2166136261;

  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

function makeRng(seed: number) {
  return () => {
    seed |= 0;

    seed = (seed + 0x6d2b79f5) | 0;

    let t = Math.imul(
      seed ^ (seed >>> 15),
      1 | seed
    );

    t =
      (t +
        Math.imul(
          t ^ (t >>> 7),
          61 | t
        )) ^
      t;

    return (
      (t ^ (t >>> 14)) >>> 0
    ) / 4294967296;
  };
}

/* =========================================================
 * TEXT
 * ========================================================= */

function segmentText(text: string) {
  try {
    if (
      typeof Intl !== 'undefined' &&
      typeof Intl.Segmenter === 'function'
    ) {
      return Array.from(
        new Intl.Segmenter(undefined, {
          granularity: 'word',
        }).segment(text),
        (item) => item.segment
      );
    }
  } catch {}

  return Array.from(text);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const clean = text
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  const tokens = segmentText(clean).flatMap(
    (token) => {
      if (
        ctx.measureText(token).width >
        maxWidth
      ) {
        return Array.from(token);
      }

      return [token];
    }
  );

  const lines: string[] = [];
  let line = '';

  for (const token of tokens) {
    const test = line + token;

    if (
      ctx.measureText(test).width <=
      maxWidth
    ) {
      line = test;
    } else {
      if (line) {
        lines.push(line.trimEnd());
      }

      line = token.trimStart();
    }
  }

  if (line) {
    lines.push(line.trimEnd());
  }

  if (lines.length > maxLines) {
    const output = lines.slice(
      0,
      maxLines
    );

    let last =
      output[maxLines - 1];

    while (
      last.length > 0 &&
      ctx.measureText(
        last + '…'
      ).width > maxWidth
    ) {
      last = last.slice(0, -1);
    }

    output[maxLines - 1] =
      last + '…';

    return output;
  }

  return lines;
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  family: string,
  weight: number
) {
  let size = start;

  ctx.font =
    `${weight} ${size}px ${family}`;

  while (
    size > min &&
    ctx.measureText(text).width >
      maxWidth
  ) {
    size -= 2;

    ctx.font =
      `${weight} ${size}px ${family}`;
  }

  return size;
}

/* =========================================================
 * IMAGE
 * ========================================================= */

function loadImage(
  url: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const img = new Image();

      img.crossOrigin =
        'anonymous';

      img.onload = () =>
        resolve(img);

      img.onerror = () =>
        reject(
          new Error(
            'image load failed'
          )
        );

      img.src = url;
    }
  );
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  focusY = 0.5
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  if (!iw || !ih) return;

  const scale = Math.max(
    w / iw,
    h / ih
  );

  const sw = w / scale;
  const sh = h / scale;

  const sx =
    (iw - sw) / 2;

  const sy = Math.max(
    0,
    Math.min(
      ih - sh,
      (ih - sh) * focusY
    )
  );

  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    x,
    y,
    w,
    h
  );
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const imageRatio =
    iw / ih;

  const boxRatio =
    w / h;

  /*
   * ถ้ารูปใกล้เคียงกับ card
   * → crop ปกติ
   *
   * ถ้ารูปแนวตั้ง/แนวนอนมาก
   * → ใช้ background blur
   *    แล้ววางรูปเต็มตรงกลาง
   */
  const cropLoss =
    imageRatio > boxRatio
      ? 1 -
        boxRatio /
          imageRatio
      : 1 -
        imageRatio /
          boxRatio;

  ctx.save();

  ctx.beginPath();
  rr(
    ctx,
    x,
    y,
    w,
    h,
    34
  );
  ctx.clip();

  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    'high';

  if (cropLoss <= 0.14) {
    drawCover(
      ctx,
      img,
      x,
      y,
      w,
      h,
      0.45
    );

    ctx.restore();
    return;
  }

  /*
   * blurred background
   */
  ctx.save();

  ctx.filter =
    'blur(28px)';

  ctx.globalAlpha =
    0.55;

  drawCover(
    ctx,
    img,
    x - 40,
    y - 40,
    w + 80,
    h + 80,
    0.5
  );

  ctx.restore();

  /*
   * dark overlay
   */
  ctx.fillStyle =
    'rgba(11,11,13,0.20)';

  ctx.fillRect(
    x,
    y,
    w,
    h
  );

  /*
   * original photo
   */
  const scale =
    Math.min(
      w / iw,
      h / ih
    );

  const dw =
    iw * scale;

  const dh =
    ih * scale;

  ctx.drawImage(
    img,
    x + (w - dw) / 2,
    y + (h - dh) / 2,
    dw,
    dh
  );

  ctx.restore();
}

/* =========================================================
 * VECTOR DOODLES
 * ========================================================= */

function heart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  const s =
    size / 2;

  ctx.save();

  ctx.fillStyle =
    color;

  ctx.beginPath();

  ctx.moveTo(
    cx,
    cy + s * 0.9
  );

  ctx.bezierCurveTo(
    cx - s * 1.6,
    cy - s * 0.1,
    cx - s * 0.9,
    cy - s * 1.2,
    cx,
    cy - s * 0.45
  );

  ctx.bezierCurveTo(
    cx + s * 0.9,
    cy - s * 1.2,
    cx + s * 1.6,
    cy - s * 0.1,
    cx,
    cy + s * 0.9
  );

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function star(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();

  ctx.fillStyle =
    color;

  ctx.beginPath();

  for (let i = 0; i < 8; i++) {
    const angle =
      -Math.PI / 2 +
      (Math.PI / 4) * i;

    const radius =
      i % 2 === 0
        ? size
        : size * 0.22;

    const px =
      cx +
      Math.cos(angle) *
        radius;

    const py =
      cy +
      Math.sin(angle) *
        radius;

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function paw(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();

  ctx.fillStyle =
    color;

  /*
   * center pad
   */
  ctx.beginPath();

  ctx.ellipse(
    cx,
    cy + size * 0.18,
    size * 0.30,
    size * 0.34,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * toes
   */
  const toes = [
    [-0.30, -0.28],
    [-0.10, -0.40],
    [0.10, -0.40],
    [0.30, -0.28],
  ];

  toes.forEach(
    ([dx, dy]) => {
      ctx.beginPath();

      ctx.arc(
        cx + dx * size,
        cy + dy * size,
        size * 0.12,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  );

  ctx.restore();
}

/* =========================================================
 * TAPE
 * ========================================================= */

function drawTape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number
) {
  ctx.save();

  ctx.translate(
    x + w / 2,
    y + h / 2
  );

  ctx.rotate(rotation);

  ctx.fillStyle =
    'rgba(255,239,210,0.82)';

  ctx.fillRect(
    -w / 2,
    -h / 2,
    w,
    h
  );

  ctx.fillStyle =
    'rgba(255,255,255,0.18)';

  ctx.fillRect(
    -w / 2,
    -h / 2,
    w,
    h / 3
  );

  ctx.restore();
}

/* =========================================================
 * PAPER SHAPE
 * ========================================================= */

function drawPaperShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();

  ctx.fillStyle =
    C.cream;

  ctx.beginPath();

  ctx.moveTo(
    x,
    y + 14
  );

  ctx.lineTo(
    x + 18,
    y
  );

  ctx.lineTo(
    x + w - 18,
    y + 4
  );

  ctx.lineTo(
    x + w,
    y + 18
  );

  ctx.lineTo(
    x + w - 5,
    y + h - 12
  );

  ctx.lineTo(
    x + w - 22,
    y + h
  );

  ctx.lineTo(
    x + 12,
    y + h - 4
  );

  ctx.lineTo(
    x,
    y + h - 18
  );

  ctx.closePath();

  ctx.fill();

  ctx.restore();
}

/* =========================================================
 * STATUS STICKER
 * ========================================================= */

function drawStatusSticker(
  ctx: CanvasRenderingContext2D,
  status: CardBellyStatus,
  locale: CardLocale,
  x: number,
  y: number,
  maxWidth: number,
  family: string
) {
  const data =
    STATUS[status];

  const label =
    data.label[locale];

  ctx.save();

  ctx.font =
    `${FONT_WEIGHT.semi} 26px ${family}`;

  const textWidth =
    ctx.measureText(label)
      .width;

  const w =
    Math.min(
      maxWidth,
      textWidth + 64
    );

  const h = 58;

  /*
   * shadow
   */
  ctx.shadowColor =
    'rgba(0,0,0,0.25)';

  ctx.shadowBlur = 14;

  ctx.shadowOffsetY = 5;

  ctx.fillStyle =
    data.soft;

  rr(
    ctx,
    x,
    y,
    w,
    h,
    29
  );

  ctx.fill();

  ctx.shadowColor =
    'transparent';

  /*
   * little dot
   */
  ctx.fillStyle =
    data.color;

  ctx.beginPath();

  ctx.arc(
    x + 25,
    y + h / 2,
    7,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * text
   */
  ctx.fillStyle =
    C.black;

  ctx.fillText(
    label,
    x + 42,
    y + 38
  );

  ctx.restore();

  return {
    width: w,
    height: h,
  };
}

/* =========================================================
 * MAIN
 * ========================================================= */

export async function renderCatCard(
  cat: CardCat
): Promise<string> {
  const canvas =
    document.createElement(
      'canvas'
    );

  canvas.width = W;
  canvas.height = H;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) {
    throw new Error(
      'Canvas not supported'
    );
  }

  /*
   * Locale
   */
  const locale =
    cat.locale ?? 'th';

  const family =
    FONT_STACK[locale];

  const status =
    STATUS[cat.belly_status];

  const labels =
    LABEL[locale];

  const isCollared =
    cat.collar_status ===
    'collared';

  /*
   * Load fonts
   */
  const fontSample =
    [
      cat.name,
      cat.location,
      cat.details ?? '',
      cat.discovered_by ?? '',
      status.label[locale],
      status.description[locale],
      labels.found,
      labels.location,
      labels.foundBy,
      labels.stray,
      labels.collared,
      'Belly Don’t Bully',
      '0123456789',
    ].join(' ');

  try {
    await Promise.all(
      [
        FONT_WEIGHT.regular,
        FONT_WEIGHT.medium,
        FONT_WEIGHT.semi,
      ].map((weight) =>
        document.fonts.load(
          `${weight} 24px ${family}`,
          fontSample
        )
      )
    );

    await document.fonts.ready;
  } catch {
    // fallback font
  }

  /*
   * Load first photo
   */
  const photoUrl =
    cat.photo_urls?.[0];

  const img =
    photoUrl
      ? await loadImage(
          photoUrl
        ).catch(
          () => null
        )
      : null;

  /*
   * Deterministic decoration
   */
  const seed =
    hashStr(
      [
        cat.id ?? '',
        cat.name,
        cat.location,
      ].join('|')
    );

  const rand =
    makeRng(seed);

  /* =======================================================
   * BACKGROUND
   * ======================================================= */

  ctx.fillStyle =
    C.black;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * soft orange glow
   */
  const bgGlow =
    ctx.createRadialGradient(
      W * 0.78,
      H * 0.08,
      20,
      W * 0.78,
      H * 0.08,
      520
    );

  bgGlow.addColorStop(
    0,
    hexA(C.orange, 0.18)
  );

  bgGlow.addColorStop(
    1,
    hexA(C.orange, 0)
  );

  ctx.fillStyle =
    bgGlow;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * subtle pink glow
   */
  const pinkGlow =
    ctx.createRadialGradient(
      W * 0.08,
      H * 0.88,
      10,
      W * 0.08,
      H * 0.88,
      420
    );

  pinkGlow.addColorStop(
    0,
    hexA(C.pink, 0.10)
  );

  pinkGlow.addColorStop(
    1,
    hexA(C.pink, 0)
  );

  ctx.fillStyle =
    pinkGlow;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /* =======================================================
   * CARD BASE
   * ======================================================= */

  ctx.save();

  ctx.shadowColor =
    'rgba(0,0,0,0.55)';

  ctx.shadowBlur = 55;

  ctx.shadowOffsetY = 20;

  ctx.fillStyle =
    C.blackCard;

  rr(
    ctx,
    CARD.x,
    CARD.y,
    CARD.w,
    CARD.h,
    CARD.r
  );

  ctx.fill();

  ctx.restore();

  /*
   * card clip
   */
  ctx.save();

  rr(
    ctx,
    CARD.x,
    CARD.y,
    CARD.w,
    CARD.h,
    CARD.r
  );

  ctx.clip();

  /*
   * card background
   */
  const cardBg =
    ctx.createLinearGradient(
      0,
      CARD.y,
      0,
      CARD.y +
        CARD.h
    );

  cardBg.addColorStop(
    0,
    '#19191C'
  );

  cardBg.addColorStop(
    0.55,
    '#111114'
  );

  cardBg.addColorStop(
    1,
    '#0B0B0D'
  );

  ctx.fillStyle =
    cardBg;

  ctx.fillRect(
    CARD.x,
    CARD.y,
    CARD.w,
    CARD.h
  );

  /* =======================================================
   * HEADER
   * ======================================================= */

  ctx.fillStyle =
    C.cream;

  ctx.font =
    `${FONT_WEIGHT.semi} 24px ${family}`;

  setLS(ctx, 3);

  ctx.fillText(
    'BELLY DON’T BULLY',
    INNER.x,
    102
  );

  setLS(ctx, 0);

  /*
   * small orange line
   */
  ctx.fillStyle =
    C.orange;

  rr(
    ctx,
    INNER.x,
    111,
    88,
    5,
    3
  );

  ctx.fill();

  /*
   * right top number
   */
  ctx.textAlign =
    'right';

  ctx.fillStyle =
    C.muted;

  ctx.font =
    `${FONT_WEIGHT.medium} 18px ${family}`;

  const cardNo =
    cat.id != null
      ? `#${String(
          cat.id
        ).padStart(
          3,
          '0'
        )}`
      : '#CAT';

  ctx.fillText(
    cardNo,
    INNER.x +
      INNER.w,
    101
  );

  ctx.textAlign =
    'left';

  /* =======================================================
   * PHOTO
   * ======================================================= */

  /*
   * photo shadow
   */
  ctx.save();

  ctx.shadowColor =
    'rgba(0,0,0,0.5)';

  ctx.shadowBlur = 26;

  ctx.shadowOffsetY = 12;

  ctx.fillStyle =
    C.black;

  rr(
    ctx,
    PHOTO.x,
    PHOTO.y,
    PHOTO.w,
    PHOTO.h,
    PHOTO.r
  );

  ctx.fill();

  ctx.restore();

  if (img) {
    drawPhoto(
      ctx,
      img,
      PHOTO.x,
      PHOTO.y,
      PHOTO.w,
      PHOTO.h
    );
  } else {
    /*
     * placeholder
     */
    const photoBg =
      ctx.createLinearGradient(
        PHOTO.x,
        PHOTO.y,
        PHOTO.x +
          PHOTO.w,
        PHOTO.y +
          PHOTO.h
      );

    photoBg.addColorStop(
      0,
      '#262329'
    );

    photoBg.addColorStop(
      1,
      '#101013'
    );

    ctx.save();

    rr(
      ctx,
      PHOTO.x,
      PHOTO.y,
      PHOTO.w,
      PHOTO.h,
      PHOTO.r
    );

    ctx.clip();

    ctx.fillStyle =
      photoBg;

    ctx.fillRect(
      PHOTO.x,
      PHOTO.y,
      PHOTO.w,
      PHOTO.h
    );

    /*
     * large paw decoration
     */
    paw(
      ctx,
      PHOTO.x +
        PHOTO.w / 2,
      PHOTO.y +
        PHOTO.h / 2,
      110,
      hexA(
        C.orange,
        0.85
      )
    );

    ctx.restore();
  }

  /*
   * soft photo overlay
   */
  ctx.save();

  rr(
    ctx,
    PHOTO.x,
    PHOTO.y,
    PHOTO.w,
    PHOTO.h,
    PHOTO.r
  );

  ctx.clip();

  const photoShade =
    ctx.createLinearGradient(
      0,
      PHOTO.y,
      0,
      PHOTO.y +
        PHOTO.h
    );

  photoShade.addColorStop(
    0,
    'rgba(0,0,0,0.02)'
  );

  photoShade.addColorStop(
    0.62,
    'rgba(0,0,0,0.00)'
  );

  photoShade.addColorStop(
    1,
    'rgba(0,0,0,0.32)'
  );

  ctx.fillStyle =
    photoShade;

  ctx.fillRect(
    PHOTO.x,
    PHOTO.y,
    PHOTO.w,
    PHOTO.h
  );

  ctx.restore();

  /* =======================================================
   * PHOTO STICKERS
   * ======================================================= */

  /*
   * stray / home
   */
  const typeLabel =
    isCollared
      ? labels.collared
      : labels.stray;

  ctx.font =
    `${FONT_WEIGHT.semi} 22px ${family}`;

  const typeWidth =
    ctx.measureText(
      typeLabel
    ).width + 46;

  ctx.save();

  /*
   * white sticker
   */
  ctx.translate(
    PHOTO.x + 26,
    PHOTO.y + 26
  );

  ctx.rotate(
    -0.025
  );

  ctx.fillStyle =
    C.cream;

  ctx.shadowColor =
    'rgba(0,0,0,0.25)';

  ctx.shadowBlur = 12;

  ctx.shadowOffsetY = 5;

  rr(
    ctx,
    0,
    0,
    typeWidth,
    48,
    24
  );

  ctx.fill();

  ctx.shadowColor =
    'transparent';

  ctx.fillStyle =
    C.black;

  ctx.fillText(
    typeLabel,
    23,
    32
  );

  ctx.restore();

  /*
   * heart sticker
   */
  ctx.save();

  ctx.fillStyle =
    C.cream;

  ctx.shadowColor =
    'rgba(0,0,0,0.25)';

  ctx.shadowBlur = 14;

  ctx.shadowOffsetY = 5;

  ctx.beginPath();

  ctx.arc(
    PHOTO.x +
      PHOTO.w -
      48,
    PHOTO.y + 48,
    31,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.shadowColor =
    'transparent';

  heart(
    ctx,
    PHOTO.x +
      PHOTO.w -
      48,
    PHOTO.y + 49,
    27,
    C.pink
  );

  ctx.restore();

  /*
   * little decorative star
   */
  star(
    ctx,
    PHOTO.x +
      PHOTO.w -
      75,
    PHOTO.y +
      PHOTO.h -
      72,
    14,
    C.orange
  );

  /* =======================================================
   * PAPER TAPE
   * ======================================================= */

  drawTape(
    ctx,
    PHOTO.x +
      PHOTO.w / 2 -
      65,
    PHOTO.y -
      18,
    130,
    38,
    -0.035
  );

  /* =======================================================
   * CONTENT PAPER
   * ======================================================= */

  const paperX =
    CONTENT.x;

  const paperY =
    850;

  const paperW =
    CONTENT.right -
    CONTENT.x;

  const paperH =
    294;

  /*
   * paper
   */
  drawPaperShape(
    ctx,
    paperX,
    paperY,
    paperW,
    paperH
  );

  /*
   * little paper shadow
   */
  ctx.save();

  ctx.globalAlpha =
    0.12;

  ctx.fillStyle =
    C.orange;

  ctx.fillRect(
    paperX + 20,
    paperY + 10,
    90,
    3
  );

  ctx.restore();

  /* =======================================================
   * CAT FOUND LABEL
   * ======================================================= */

  ctx.fillStyle =
    C.orange;

  ctx.font =
    `${FONT_WEIGHT.semi} 18px ${family}`;

  setLS(ctx, 3);

  ctx.fillText(
    labels.found,
    paperX + 32,
    paperY + 45
  );

  setLS(ctx, 0);

  /* =======================================================
   * CAT NAME
   * ======================================================= */

  const nameX =
    paperX + 32;

  const nameY =
    paperY + 103;

  const nameMaxW =
    paperW - 64;

  const nameSize =
    fitFont(
      ctx,
      cat.name,
      nameMaxW,
      66,
      34,
      family,
      FONT_WEIGHT.semi
    );

  ctx.font =
    `${FONT_WEIGHT.semi} ${nameSize}px ${family}`;

  ctx.fillStyle =
    C.black;

  const nameLines =
    wrapText(
      ctx,
      cat.name,
      nameMaxW,
      1
    );

  ctx.fillText(
    nameLines[0] ?? '',
    nameX,
    nameY
  );

  /* =======================================================
   * STATUS
   * ======================================================= */

  const sticker =
    drawStatusSticker(
      ctx,
      cat.belly_status,
      locale,
      nameX,
      paperY + 126,
      nameMaxW,
      family
    );

  /*
   * decorative small heart
   */
  heart(
    ctx,
    paperX +
      paperW -
      52,
    paperY + 44,
    26,
    C.pink
  );

  /* =======================================================
   * LOCATION
   * ======================================================= */

  const locationY =
    paperY + 207;

  /*
   * location dot
   */
  ctx.fillStyle =
    C.orange;

  ctx.beginPath();

  ctx.arc(
    nameX + 7,
    locationY - 6,
    6,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.font =
    `${FONT_WEIGHT.semi} 18px ${family}`;

  ctx.fillStyle =
    C.mutedDark;

  ctx.fillText(
    labels.location,
    nameX + 24,
    locationY
  );

  /*
   * location
   */
  const locX =
    nameX;

  const locY =
    locationY + 35;

  const locMaxW =
    paperW - 64;

  const locSize =
    fitFont(
      ctx,
      cat.location,
      locMaxW,
      27,
      19,
      family,
      FONT_WEIGHT.medium
    );

  ctx.font =
    `${FONT_WEIGHT.medium} ${locSize}px ${family}`;

  ctx.fillStyle =
    C.black;

  const locationLine =
    wrapText(
      ctx,
      cat.location,
      locMaxW,
      1
    )[0] ?? '';

  ctx.fillText(
    locationLine,
    locX,
    locY
  );

  /* =======================================================
   * DECORATION AROUND PAPER
   * ======================================================= */

  /*
   * tiny handwritten-like marks
   */
  ctx.strokeStyle =
    C.orange;

  ctx.lineWidth = 4;

  ctx.lineCap =
    'round';

  ctx.beginPath();

  ctx.moveTo(
    paperX + paperW - 115,
    paperY + 220
  );

  ctx.lineTo(
    paperX + paperW - 95,
    paperY + 238
  );

  ctx.lineTo(
    paperX + paperW - 72,
    paperY + 214
  );

  ctx.stroke();

  /* =======================================================
   * DESCRIPTION
   * ======================================================= */

  const detail =
    cat.details?.trim()
      ? cat.details.trim()
      : status.description[
          locale
        ];

  ctx.font =
    `${FONT_WEIGHT.regular} 20px ${family}`;

  const detailMaxW =
    paperW - 64;

  const detailLines =
    wrapText(
      ctx,
      detail,
      detailMaxW,
      2
    );

  /*
   * description starts below paper
   * only if enough room
   */
  const descY =
    1174;

  ctx.fillStyle =
    cat.details?.trim()
      ? '#C8C3BB'
      : status.color;

  detailLines
    .slice(0, 2)
    .forEach(
      (line, index) => {
        ctx.fillText(
          line,
          CONTENT.x,
          descY +
            index * 28
        );
      }
    );

  /* =======================================================
   * FOOTER
   * ======================================================= */

  ctx.fillStyle =
    C.muted;

  ctx.font =
    `${FONT_WEIGHT.regular} 16px ${family}`;

  const foundBy =
    cat.discovered_by?.trim()
      ? cat.discovered_by.trim()
      : locale === 'th'
        ? 'ทาสแมวนิรนาม'
        : 'Anonymous';

  const footerText =
    `${labels.foundBy} : ${foundBy}`;

  ctx.fillText(
    footerText,
    CONTENT.x,
    FOOTER_Y
  );

  /*
   * brand footer
   */
  ctx.textAlign =
    'right';

  ctx.font =
    `${FONT_WEIGHT.semi} 15px ${family}`;

  setLS(ctx, 1.5);

  ctx.fillStyle =
    C.orange;

  ctx.fillText(
    'BELLY DON’T BULLY',
    CONTENT.right,
    FOOTER_Y
  );

  setLS(ctx, 0);

  ctx.textAlign =
    'left';

  /* =======================================================
   * OUTER CARD DETAILS
   * ======================================================= */

  /*
   * little orange corner
   */
  ctx.fillStyle =
    C.orange;

  rr(
    ctx,
    CARD.x,
    CARD.y + 82,
    7,
    86,
    3.5
  );

  ctx.fill();

  /*
   * tiny dots
   */
  ctx.fillStyle =
    C.pink;

  ctx.beginPath();

  ctx.arc(
    CARD.x + 22,
    CARD.y + 225,
    5,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.fillStyle =
    C.orange;

  ctx.beginPath();

  ctx.arc(
    CARD.x + 22,
    CARD.y + 245,
    3,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * top-right tiny star
   */
  star(
    ctx,
    CARD.x +
      CARD.w -
      26,
    CARD.y + 115,
    11,
    C.orange
  );

  ctx.restore();

  /* =======================================================
   * CARD BORDER
   * ======================================================= */

  /*
   * primary border
   */
  ctx.strokeStyle =
    'rgba(245,239,230,0.18)';

  ctx.lineWidth = 2;

  rr(
    ctx,
    CARD.x,
    CARD.y,
    CARD.w,
    CARD.h,
    CARD.r
  );

  ctx.stroke();

  /*
   * orange accent border
   */
  ctx.strokeStyle =
    hexA(
      C.orange,
      0.65
    );

  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.moveTo(
    CARD.x + 70,
    CARD.y
  );

  ctx.lineTo(
    CARD.x + 280,
    CARD.y
  );

  ctx.stroke();

  /* =======================================================
   * OUTSIDE SPARKLES
   * ======================================================= */

  star(
    ctx,
    25,
    330,
    12,
    C.orange
  );

  star(
    ctx,
    1050,
    840,
    17,
    C.pink
  );

  /*
   * tiny hand-drawn lines
   */
  ctx.strokeStyle =
    hexA(
      C.cream,
      0.55
    );

  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.moveTo(
    20,
    1060
  );

  ctx.lineTo(
    48,
    1060
  );

  ctx.moveTo(
    1030,
    280
  );

  ctx.lineTo(
    1058,
    280
  );

  ctx.stroke();

  /* =======================================================
   * EXPORT
   * ======================================================= */

  return canvas.toDataURL(
    'image/png'
  );
}
