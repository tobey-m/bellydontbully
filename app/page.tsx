'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import dynamic from 'next/dynamic';
import type { DivIcon, Map as LeafletMap } from 'leaflet';
import { supabase, isSupabaseConfigured, uploadCatPhotos } from '@/lib/supabase';
import { renderCatCard, type CardLang } from '@/lib/catCard';
import PhotoCropper from '@/components/PhotoCropper';

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


const UI: Record<CardLang, {
  all: string; friendly: string; unpredictable: string; spicy: string; stray: string; home: string;
  viewAll: string; scan: string; scanFound: (n: number) => string; findCat: string;
  catsList: string; catsFound: string; loading: string; noCats: string; navigate: string; card: string;
  shareReady: string; creatingCard: string; shareHint: string; shareStory: string; save: string; close: string;
  cancel: string; searchPlace: string; search: string; confirmPin: string; addCat: string; editCat: string;
  photoLabel: string; name: string; place: string; currentLocation: string; chooseMap: string; status: string;
  belly: string; foundBy: string; optional: string; details: string; saveCat: string; saveEdit: string;
  language: string; locationFound: string; editingOnce: string; sharing: string; shareFailed: string;
}> = {
  th: {
    all:'ทั้งหมด 🐾', friendly:'🟢 เฟรนลี่', unpredictable:'🟡 คาดเดาไม่ได้', spicy:'🔴 โขด', stray:'🚷 เหมียวจร', home:'🏷️ มีบ้าน',
    viewAll:'ดูทั้งหมด', scan:'📡 กำลังสแกนรอบๆ...', scanFound:n=>`🚨 พบแมว ${n} ตัว ในรัศมี 3 กม.`, findCat:'FIND A CAT',
    catsList:'🐾 รายการเหมียว', catsFound:'เหมียวที่เจอทั้งหมด', loading:'กำลังโหลด...', noCats:'ไม่พบเหมียวในหมวดหมู่นี้',
    navigate:'🗺 นำทาง', card:'📱 การ์ด', shareReady:'การ์ดเหมียวพร้อมแล้ว!', creatingCard:'กำลังสร้างการ์ดเหมียว...',
    shareHint:'แชร์รูป 9:16 ไปยัง Instagram Story หรือบันทึกลงเครื่อง', shareStory:'📸 แชร์ลง IG Story', save:'เซฟรูป', close:'ปิด',
    cancel:'✕ ยกเลิก', searchPlace:'เลื่อนหรือค้นหาสถานที่', search:'ค้นหา', confirmPin:'✓ ยืนยันพิกัดนี้',
    addCat:'🐱 เพิ่มแมวที่พบ', editCat:'✏️ แก้ไขข้อมูล (ได้ครั้งเดียว)', photoLabel:'📷 รูปถ่ายน้องแมว (สูงสุด 3 รูป)',
    name:'ชื่อเรียก', place:'สถานที่เจอ', currentLocation:'ตำแหน่งปัจจุบัน', chooseMap:'🔍 ค้นหา / ปักหมุดเอง',
    status:'สถานะน้องเหมียว', belly:'ระดับความพุง', foundBy:'พบเจอโดย', optional:'- ไม่บังคับ', details:'คำอธิบายเพิ่มเติม',
    saveCat:'SAVE CAT SPOT', saveEdit:'บันทึกการแก้ไข', language:'ภาษา', locationFound:'✓ ระบุตำแหน่งแล้ว',
    editingOnce:'แก้ไขได้ครั้งเดียว', sharing:'กำลังเปิดเมนูแชร์...', shareFailed:'แชร์ไม่สำเร็จ ลองบันทึกรูปแทนได้เลย'
  },
  en: {
    all:'All 🐾', friendly:'🟢 Friendly', unpredictable:'🟡 Unpredictable', spicy:'🔴 Spicy', stray:'🚷 Stray', home:'🏷️ Has a home',
    viewAll:'View all', scan:'📡 Scanning nearby...', scanFound:n=>`🚨 ${n} cats found within 3 km`, findCat:'FIND A CAT',
    catsList:'🐾 CATS LIST', catsFound:'Cats spotted', loading:'Loading...', noCats:'No cats in this category',
    navigate:'🗺 Navigate', card:'📱 Card', shareReady:'Cat card is ready!', creatingCard:'Creating cat card...',
    shareHint:'Share the 9:16 image to Instagram Story or save it', shareStory:'📸 Share to IG Story', save:'Save image', close:'Close',
    cancel:'✕ Cancel', searchPlace:'Move or search for a place', search:'Search', confirmPin:'✓ Confirm this location',
    addCat:'🐱 Add a cat', editCat:'✏️ Edit cat (once)', photoLabel:'📷 Cat photos (up to 3)',
    name:'Name', place:'Spotted at', currentLocation:'Current location', chooseMap:'🔍 Search / pin on map',
    status:'Cat status', belly:'Belly level', foundBy:'Found by', optional:'- optional', details:'Additional details',
    saveCat:'SAVE CAT SPOT', saveEdit:'Save changes', language:'Language', locationFound:'✓ Location set',
    editingOnce:'Can edit once', sharing:'Opening share menu...', shareFailed:'Sharing failed — you can save the image instead'
  },
  zh: {
    all:'全部 🐾', friendly:'🟢 亲人', unpredictable:'🟡 看心情', spicy:'🔴 超凶', stray:'🚷 流浪猫', home:'🏷️ 有主人',
    viewAll:'查看全部', scan:'📡 正在扫描附近...', scanFound:n=>`🚨 3公里内发现 ${n} 只猫`, findCat:'寻找猫咪',
    catsList:'🐾 猫咪列表', catsFound:'发现的猫咪', loading:'加载中...', noCats:'这个分类没有猫咪',
    navigate:'🗺 导航', card:'📱 卡片', shareReady:'猫咪卡片完成！', creatingCard:'正在制作猫咪卡片...',
    shareHint:'分享 9:16 图片到 Instagram Story 或保存', shareStory:'📸 分享到 IG Story', save:'保存图片', close:'关闭',
    cancel:'✕ 取消', searchPlace:'移动地图或搜索地点', search:'搜索', confirmPin:'✓ 确认位置',
    addCat:'🐱 添加猫咪', editCat:'✏️ 编辑资料（仅一次）', photoLabel:'📷 猫咪照片（最多3张）',
    name:'名字', place:'发现地点', currentLocation:'当前位置', chooseMap:'🔍 搜索 / 在地图上标记',
    status:'猫咪状态', belly:'肚肚等级', foundBy:'发现者', optional:'- 可选', details:'补充说明',
    saveCat:'保存猫咪地点', saveEdit:'保存修改', language:'语言', locationFound:'✓ 已定位',
    editingOnce:'只能编辑一次', sharing:'正在打开分享菜单...', shareFailed:'分享失败，可以先保存图片'
  },
  ja: {
    all:'すべて 🐾', friendly:'🟢 フレンドリー', unpredictable:'🟡 気まぐれ', spicy:'🔴 ツンツン', stray:'🚷 野良猫', home:'🏷️ 飼い猫',
    viewAll:'すべて見る', scan:'📡 近くをスキャン中...', scanFound:n=>`🚨 3km以内に${n}匹`, findCat:'猫を見つける',
    catsList:'🐾 猫リスト', catsFound:'見つかった猫', loading:'読み込み中...', noCats:'このカテゴリに猫はいません',
    navigate:'🗺 ナビ', card:'📱 カード', shareReady:'猫カードの完成！', creatingCard:'猫カードを作成中...',
    shareHint:'9:16画像をInstagram Storyへ共有、または保存', shareStory:'📸 IG Storyへ共有', save:'画像を保存', close:'閉じる',
    cancel:'✕ キャンセル', searchPlace:'地図を動かすか場所を検索', search:'検索', confirmPin:'✓ この場所を確定',
    addCat:'🐱 猫を追加', editCat:'✏️ 情報を編集（1回のみ）', photoLabel:'📷 猫の写真（最大3枚）',
    name:'名前', place:'発見場所', currentLocation:'現在地', chooseMap:'🔍 検索 / 地図でピン留め',
    status:'猫の状態', belly:'お腹レベル', foundBy:'発見者', optional:'- 任意', details:'追加情報',
    saveCat:'猫スポットを保存', saveEdit:'変更を保存', language:'言語', locationFound:'✓ 位置を設定済み',
    editingOnce:'編集は1回のみ', sharing:'共有メニューを開いています...', shareFailed:'共有できませんでした。画像を保存できます'
  },
  ko: {
    all:'전체 🐾', friendly:'🟢 친화적', unpredictable:'🟡 변덕쟁이', spicy:'🔴 까칠함', stray:'🚷 길고양이', home:'🏷️ 집고양이',
    viewAll:'전체 보기', scan:'📡 주변 검색 중...', scanFound:n=>`🚨 3km 안에 ${n}마리 발견`, findCat:'고양이 찾기',
    catsList:'🐾 고양이 목록', catsFound:'발견된 고양이', loading:'로딩 중...', noCats:'이 카테고리에는 고양이가 없습니다',
    navigate:'🗺 길찾기', card:'📱 카드', shareReady:'고양이 카드 완성!', creatingCard:'고양이 카드 만드는 중...',
    shareHint:'9:16 이미지를 Instagram Story에 공유하거나 저장하세요', shareStory:'📸 IG Story 공유', save:'이미지 저장', close:'닫기',
    cancel:'✕ 취소', searchPlace:'지도를 움직이거나 장소 검색', search:'검색', confirmPin:'✓ 이 위치 확인',
    addCat:'🐱 고양이 추가', editCat:'✏️ 정보 수정 (1회)', photoLabel:'📷 고양이 사진 (최대 3장)',
    name:'이름', place:'발견 장소', currentLocation:'현재 위치', chooseMap:'🔍 검색 / 지도에서 핀 지정',
    status:'고양이 상태', belly:'배 레벨', foundBy:'발견자', optional:'- 선택', details:'추가 설명',
    saveCat:'고양이 위치 저장', saveEdit:'변경사항 저장', language:'언어', locationFound:'✓ 위치 설정됨',
    editingOnce:'한 번만 수정 가능', sharing:'공유 메뉴를 여는 중...', shareFailed:'공유하지 못했습니다. 이미지를 저장할 수 있어요'
  }
};

const LANGUAGE_OPTIONS: {id: CardLang; label: string}[] = [
  {id:'th',label:'ไทย'}, {id:'en',label:'English'}, {id:'zh',label:'中文'}, {id:'ja',label:'日本語'}, {id:'ko',label:'한국어'}
];

function getStatusConfig(lang: CardLang, status: BellyStatus) {
  const base = STATUS_CONFIG[status];
  const labels: Record<CardLang, Record<BellyStatus,{label:string;text:string}>> = {
    th:{safe:{label:'เฟรนลี่',text:'จกพุงได้สบาย ชอบให้เกา'},caution:{label:'คาดเดาไม่ได้',text:'จกได้นิดหน่อย ระวังโดนสวบ'},danger:{label:'โขด',text:'ห้ามจกพุงเด็ดขาด!'}},
    en:{safe:{label:'Friendly',text:'Belly rubs welcome!'},caution:{label:'Unpredictable',text:'A few pats are OK, watch the claws'},danger:{label:'Spicy',text:'No belly rubs. Ever!'}},
    zh:{safe:{label:'亲人',text:'可以放心摸肚肚，超爱被挠'},caution:{label:'看心情',text:'摸一下就好，小心被挠'},danger:{label:'超凶',text:'绝对不能摸肚肚！'}},
    ja:{safe:{label:'フレンドリー',text:'お腹なでなでOK！'},caution:{label:'気まぐれ',text:'少しならOK、猫パンチ注意'},danger:{label:'ツンツン',text:'お腹は絶対さわらないで！'}},
    ko:{safe:{label:'친화적',text:'배 쓰다듬어도 좋아요'},caution:{label:'변덕쟁이',text:'살짝만, 냥펀치 주의'},danger:{label:'까칠함',text:'배는 절대 만지지 마세요!'}}
  };
  return {...base, ...labels[lang][status]};
}

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

/* ────────────────────────────── Small shared components ────────────────────────────── */

function PhotoCarousel({ photos, alt, onOpen }: { photos: string[]; alt: string; onOpen?: (index: number) => void }) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  const safeIndex = index < total ? index : 0;

  if (total === 0) return <div className="w-full h-full bg-[#0B0B0D] flex items-center justify-center text-4xl">🐱</div>;

  const go = (e: ReactMouseEvent, delta: number) => { e.stopPropagation(); setIndex((safeIndex + delta + total) % total); };

  return (
    <div className="relative w-full h-full bg-[#0B0B0D]">
      <img
        src={photos[safeIndex]}
        alt={alt}
        onClick={() => onOpen?.(safeIndex)}
        className="w-full h-full object-cover cursor-zoom-in"
        loading="lazy"
      />
      {total > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, -1)} aria-label="รูปก่อนหน้า" className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#0B0B0D]/60 text-white rounded-full text-xs flex items-center justify-center font-bold cursor-pointer">‹</button>
          <button type="button" onClick={(e) => go(e, 1)} aria-label="รูปถัดไป" className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#0B0B0D]/60 text-white rounded-full text-xs flex items-center justify-center font-bold cursor-pointer">›</button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
            {photos.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ดูรูปเต็มจอ: ปัดซ้าย/ขวา, กดลูกศร, Esc เพื่อปิด
function PhotoLightbox({ photos, startIndex, onClose }: { photos: string[]; startIndex: number; onClose: () => void }) {
  const total = photos.length;
  const [index, setIndex] = useState(startIndex < total ? startIndex : 0);
  const touchX = useRef<number | null>(null);
  const go = useCallback((d: number) => setIndex((i) => (i + d + total) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999999] bg-black/95 flex items-center justify-center animate-fade-in"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null || total < 2) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx > 0 ? -1 : 1);
      }}
    >
      <img
        src={photos[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain select-none"
        draggable={false}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="ปิด"
        className="absolute right-4 w-11 h-11 rounded-full bg-white/15 text-white font-bold cursor-pointer"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >✕</button>
      {total > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="รูปก่อนหน้า" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white text-xl font-bold cursor-pointer">‹</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="รูปถัดไป" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white text-xl font-bold cursor-pointer">›</button>
          <div className="absolute left-1/2 -translate-x-1/2 text-white/80 text-xs font-bold bg-white/10 px-3 py-1 rounded-full" style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            {index + 1} / {total}
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
  const [lang, setLang] = useState<CardLang>('th');
  const ui = UI[lang];
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

  // ดูรูปใหญ่
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

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
  const [keptPhotoUrls, setKeptPhotoUrls] = useState<string[]>([]); // รูปเดิมที่ยังเก็บไว้ตอนแก้ไข
  const [cropQueue, setCropQueue] = useState<File[]>([]); // รูปที่รอครอป
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
    try {
      const saved = localStorage.getItem('bellydontbully_language') as CardLang | null;
      if (saved && UI[saved]) setLang(saved);
    } catch {}
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
        if (error) console.error('โหลดข้อมูลแมวไม่สำเร็จ:', error.message, error);
        else if (data) setCats(data as unknown as CatData[]);
        setLoadingCats(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('bellydontbully_language', lang); } catch {}
  }, [lang]);

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
    const remaining = MAX_PHOTOS - keptPhotoUrls.length - photoFiles.length;
    if (remaining <= 0) return;
    setCropQueue(selected.slice(0, remaining)); // ส่งเข้าตัวครอปทีละรูป
  };

  // เรียกเมื่อครอปเสร็จ 1 รูป
  const handleCropped = (file: File) => {
    setPhotoFiles((prev) => [...prev, file]);
    setPhotoPreviews((prev) => [...prev, URL.createObjectURL(file)]);
    setCropQueue((q) => q.slice(1));
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
    setPhotoFiles([]); setPhotoPreviews([]); setKeptPhotoUrls([]); setCropQueue([]);
    setLat(''); setLng(''); setHasLocation(false);
  };

  /* ───────── แก้ไขข้อมูล (ได้ 1 ครั้ง) ───────── */

  const canEdit = (cat: CatData) => !!myCats[cat.id] && (cat.edit_count ?? 0) < 1;

  const closeForm = () => {
    setShowForm(false);
    if (editingCat) { setEditingCat(null); resetForm(); }
  };

  const openEdit = (cat: CatData) => {
    resetForm();
    setEditingCat(cat);
    setName(cat.name);
    setLocationName(cat.location);
    setBellyStatus(cat.belly_status);
    setCollarStatus(cat.collar_status || 'stray');
    setDetails(cat.details || '');
    setDiscoveredBy(cat.discovered_by === 'ทาสแมวนิรนาม' ? '' : cat.discovered_by || '');
    setKeptPhotoUrls(cat.photo_urls ?? []);
    setLat(String(cat.lat));
    setLng(String(cat.lng));
    setHasLocation(true);
    setActiveId(null);
    setShowList(false);
    setShowForm(true);
  };

  const submitEdit = async () => {
    if (!editingCat || !supabase) return;
    const token = myCats[editingCat.id];
    if (!token || !name.trim() || !locationName.trim() || !hasLocation) return alert('กรุณากรอกชื่อ สถานที่ และพิกัดให้ครบ');
    if (!window.confirm('แก้ไขได้แค่ครั้งเดียวนะ แน่ใจว่าข้อมูลถูกต้องแล้ว?')) return;

    setSaving(true);
    let photoUrls = keptPhotoUrls;
    if (photoFiles.length > 0) {
      try { photoUrls = [...keptPhotoUrls, ...(await uploadCatPhotos(photoFiles))]; }
      catch (err) { console.error(err); setSaving(false); return alert('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'); }
    }

    const cfg = STATUS_CONFIG[bellyStatus];
    const patch = {
      name: name.trim(),
      location: locationName.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      belly_status: bellyStatus,
      collar_status: collarStatus,
      belly_text: `${cfg.emoji} ${cfg.label} — ${cfg.text}`,
      details: details.trim(),
      discovered_by: discoveredBy.trim() || 'ทาสแมวนิรนาม',
      photo_urls: photoUrls,
    };
    const { error } = await supabase.rpc('edit_cat_v2', {
      p_id: editingCat.id,
      p_token: token,
      p_name: patch.name,
      p_location: patch.location,
      p_lat: patch.lat,
      p_lng: patch.lng,
      p_belly_status: patch.belly_status,
      p_collar_status: patch.collar_status,
      p_belly_text: patch.belly_text,
      p_details: patch.details,
      p_discovered_by: patch.discovered_by,
      p_photo_urls: patch.photo_urls,
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
    try { setShareCardImage(await renderCatCard(cat, { lang })); } catch (err) { console.error(err); alert('สร้างการ์ดไม่สำเร็จ ลองใหม่อีกครั้งนะ'); setShareCat(null); }
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

  const shareToInstagram = async () => {
    if (!shareCardImage || !shareCat) return;
    const fileName = `${shareCat.name}-instagram-story.png`;
    try {
      const blob = await (await fetch(shareCardImage)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: shareCat.name, text: "BELLY DON'T BULLY" });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
    }
    // Desktop / browsers without file-share: save the 9:16 image.
    const link = document.createElement('a');
    link.href = shareCardImage;
    link.download = fileName;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    alert(ui.shareFailed);
  };

  const inputCls = 'w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] outline-none focus:border-[#FF9F43]';

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0B0B0D] text-[#F5F5F2]">

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
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as CardLang)}
                aria-label={ui.language}
                className="bg-[#27272A] text-[#F5F5F2] border border-[#3f3f46] rounded-full px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <button
                onClick={() => { setActiveId(null); setShowList(true); }}
                className="bg-[#FF9F43]/15 text-[#FF9F43] border border-[#FF9F43]/30 px-3 py-1.5 rounded-full text-[11px] font-black cursor-pointer active:scale-95"
              >
                {loadingCats ? '…' : cats.length} 🐱 {ui.viewAll}
              </button>
            </div>
          </div>

          {/* ตัวกรอง: เลื่อนแนวนอนได้ ไม่มีแถบ scroll */}
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_92%,transparent)]">
            {([
              {id:'all' as FilterType, label:ui.all},
              {id:'safe' as FilterType, label:ui.friendly},
              {id:'caution' as FilterType, label:ui.unpredictable},
              {id:'danger' as FilterType, label:ui.spicy},
              {id:'stray' as FilterType, label:ui.stray},
              {id:'collared' as FilterType, label:ui.home},
            ]).map((tab) => (
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
              {isScanning ? ui.scan : ui.scanFound(scannedResultCount)}
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
        const cfg = getStatusConfig(lang, activeCat.belly_status);
        const isLiked = !!likedCats[activeCat.id];
        return (
          <div className="fixed inset-x-0 bottom-0 z-[9000] animate-sheet-in px-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="bg-[#151518]/95 backdrop-blur-md border border-[#27272A] rounded-3xl p-3 shadow-2xl">
              <div className="flex gap-3">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-[#27272A]">
                  <PhotoCarousel
                    photos={activeCat.photo_urls ?? []}
                    alt={activeCat.name}
                    onOpen={(i) => setLightbox({ photos: activeCat.photo_urls ?? [], index: i })}
                  />
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
                {ui.foundBy} <span className="text-[#F5F5F2] font-semibold">{activeCat.discovered_by || 'ทาสแมวนิรนาม'}</span>
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={(e) => handleLike(e, activeCat.id, activeCat.likes_count || 0)}
                  className={`h-11 px-3 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap ${isLiked ? 'bg-[#FB7185] text-[#0B0B0D]' : 'bg-[#27272A] text-[#FB7185]'}`}
                >
                  {isLiked ? '❤️' : '🤍'} {activeCat.likes_count || 0}
                </button>
                <button onClick={() => openGoogleMaps(activeCat.lat, activeCat.lng)} className="flex-1 h-11 bg-[#27272A] text-[#34D399] rounded-xl text-xs font-black cursor-pointer whitespace-nowrap">{ui.navigate}</button>
                <button onClick={() => generatePokemonCard(activeCat)} className="flex-1 h-11 bg-[#FF9F43] text-[#0B0B0D] rounded-xl text-xs font-black cursor-pointer whitespace-nowrap">{ui.card}</button>
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
            <span>{ui.findCat}</span>
          </button>
        </div>
      )}

      {/* ────────────────────────────── List Overlay ────────────────────────────── */}
      {showList && (
        <div className="fixed inset-0 bg-[#0B0B0D]/95 backdrop-blur-md z-[99999] flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-5 pb-3 border-b border-[#27272A] bg-[#151518]" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div>
              <h2 className="text-[#F5F5F2] font-black text-lg flex items-center gap-2">{ui.catsList}</h2>
              <p className="text-[#8E8E96] text-[10px] font-bold mt-0.5">{ui.catsFound}</p>
            </div>
            <button onClick={() => setShowList(false)} aria-label="ปิด" className="w-10 h-10 rounded-full bg-[#27272A] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
            {filteredCats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#8E8E96]">
                <span className="text-4xl mb-3">{loadingCats ? '⏳' : '😿'}</span>
                <p className="font-semibold text-sm">{loadingCats ? ui.loading : ui.noCats}</p>
              </div>
            ) : (
              filteredCats.map((cat) => {
                const cfg = getStatusConfig(lang, cat.belly_status);
                const isLiked = !!likedCats[cat.id];
                const photos = cat.photo_urls ?? [];
                return (
                  <div key={cat.id} className="bg-[#151518] border border-[#27272A] rounded-2xl p-3 flex gap-3 items-center">
                    <div
                      onClick={() => photos.length > 0 && setLightbox({ photos, index: 0 })}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#27272A] bg-[#0B0B0D] ${photos.length > 0 ? 'cursor-zoom-in' : ''}`}
                    >
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
            <div className="bg-[#0B0B0D] max-w-md w-full flex flex-col items-center shadow-2xl">
              <h3 className="font-black text-base mb-1 text-[#FF9F43]">{shareCardImage ? ui.shareReady : ui.creatingCard}</h3>
              <p className="text-xs text-[#8E8E96] mb-3 text-center">{ui.shareHint}</p>
              <div className="w-full mb-4 bg-black flex items-center justify-center">
                {shareCardImage ? <img src={shareCardImage} alt="Profile Card" className="max-h-[72dvh] w-auto max-w-full object-contain" /> : <div className="w-10 h-10 border-4 border-[#FF9F43] border-t-transparent rounded-full animate-spin" />}
              </div>
              <div className="flex gap-2 w-full p-4 pt-0">
                <button onClick={shareToInstagram} disabled={!shareCardImage} className="flex-1 bg-[#FF9F43] disabled:opacity-40 text-[#0B0B0D] font-black py-3.5 rounded-xl text-sm text-center cursor-pointer shadow-lg">{ui.shareStory}</button>
                <button onClick={downloadCard} disabled={!shareCardImage} className="bg-[#27272A] disabled:opacity-40 text-[#F5F5F2] font-bold py-3.5 px-4 rounded-xl text-sm cursor-pointer">{ui.save}</button>
                <button onClick={closeShare} className="px-4 bg-[#27272A] text-[#F5F5F2] font-bold py-3.5 rounded-xl text-sm cursor-pointer">{ui.close}</button>
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
              <button onClick={() => { setPickingLocation(false); setShowForm(true); }} className="text-[#F5F5F2] font-bold text-sm cursor-pointer py-1">{ui.cancel}</button>
              <span className="text-[#FF9F43] font-bold text-sm">{ui.searchPlace}</span>
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
              <span className="text-lg">✓</span> {ui.confirmPin.replace('✓ ','')}
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
                {editingCat ? ui.editCat : ui.addCat}
              </h2>
              <button onClick={closeForm} aria-label="ปิด" className="w-9 h-9 rounded-full bg-[#27272A] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddCat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8E8E96] mb-2">{ui.photoLabel}</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {keptPhotoUrls.map((src, i) => (
                    <div key={src} className="relative min-w-[80px] h-[80px] rounded-2xl overflow-hidden border border-[#27272A]">
                      <img src={src} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setKeptPhotoUrls((p) => p.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-6 h-6 rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                    </div>
                  ))}
                  {photoPreviews.map((src, i) => (
                    <div key={src} className="relative min-w-[80px] h-[80px] rounded-2xl overflow-hidden border border-[#27272A]">
                      <img src={src} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePhoto(i); }} className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-6 h-6 rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                    </div>
                  ))}
                  {keptPhotoUrls.length + photoFiles.length < MAX_PHOTOS && (
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }} className="min-w-[80px] h-[80px] rounded-2xl border-2 border-dashed border-[#27272A] flex flex-col items-center justify-center text-[#FF9F43] cursor-pointer"><span className="text-xl">+</span></button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">{ui.name}</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เจ้าส้ม" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">{ui.place}</label>
                  <input type="text" required value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="เช่น หน้าคาเฟ่" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระบุพิกัด {hasLocation && <span className="text-[#34D399] ml-1">✓ ระบุตำแหน่งแล้ว</span>}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={handleUseMyLocation} disabled={locating} className="bg-[#27272A] text-[#F5F5F2] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer">{locating ? '⏳ กำลังหา...' : ui.currentLocation}</button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setPickingLocation(true);
                      if (hasLocation) mapRef.current?.setView([parseFloat(lat), parseFloat(lng)], 17);
                    }}
                    className="bg-[#27272A] text-[#FF9F43] font-semibold py-3 rounded-xl text-xs border border-[#3f3f46] cursor-pointer"
                  >{ui.chooseMap}</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">{ui.status}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setCollarStatus('stray')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'stray' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A]'}`}>เหมียวจร</button>
                  <button type="button" onClick={() => setCollarStatus('collared')} className={`py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${collarStatus === 'collared' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A]'}`}>เหมียวมีบ้าน</button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">{ui.belly}</label>
                <select value={bellyStatus} onChange={(e) => setBellyStatus(e.target.value as BellyStatus)} className={`${inputCls} font-semibold`}>
                  <option value="safe">เฟรนลี่ — จกพุงได้สบาย ชอบให้เกา</option>
                  <option value="caution">คาดเดาไม่ได้ — ระวังโดนสวบ</option>
                  <option value="danger">โขด — ห้ามจับพุงเด็ดขาด!</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">{ui.foundBy} <span className="font-normal opacity-50">- ไม่บังคับ</span></label>
                <input type="text" value={discoveredBy} onChange={(e) => setDiscoveredBy(e.target.value)} placeholder="IG / name" className={inputCls} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">{ui.details}</label>
                <textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className={inputCls} />
              </div>

              <button type="submit" disabled={saving} className="w-full bg-[#FF9F43] disabled:opacity-60 disabled:cursor-not-allowed text-[#0B0B0D] font-black py-4 rounded-xl text-sm tracking-wide mt-2 cursor-pointer shadow-lg">
                {saving ? 'กำลังบันทึก...' : editingCat ? ui.saveEdit : ui.saveCat}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────── Photo Cropper ────────────────────────────── */}
      {cropQueue.length > 0 && (
        <PhotoCropper
          key={`${cropQueue[0].name}-${cropQueue[0].size}-${cropQueue[0].lastModified}`}
          file={cropQueue[0]}
          remaining={cropQueue.length - 1}
          onCancel={() => setCropQueue((q) => q.slice(1))}
          onDone={handleCropped}
        />
      )}

      {/* ────────────────────────────── Photo Lightbox ────────────────────────────── */}
      {lightbox && <PhotoLightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </main>
  );
}
