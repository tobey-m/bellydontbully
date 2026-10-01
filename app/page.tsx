'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import dynamic from 'next/dynamic';
import type { DivIcon, Map as LeafletMap } from 'leaflet';
import { supabase, isSupabaseConfigured, uploadCatPhotos } from '@/lib/supabase';

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
  caution: { label: 'CAUTION ZONE', text: 'จกได้นิดหน่อย ระวังโดนยัน', emoji: '🟡', ring: '#FBBF24', bg: 'rgba(251, 191, 36, 0.15)' },
  danger: { label: 'DANGER ZONE', text: 'ห้ามจับพุงเด็ดขาด!', emoji: '🔴', ring: '#FB7185', bg: 'rgba(251, 113, 133, 0.15)' },
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

const MAX_PHOTOS = 3;
const DEFAULT_CENTER: [number, number] = [18.7883, 98.9853];

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);
  
  const mapRef = useRef<LeafletMap | null>(null);
  const iconCacheRef = useRef(new Map<string, DivIcon>());
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    map.setView(mapCenter, map.getZoom(), { animate: false });
  }, [mapCenter]);

  const [cats, setCats] = useState<CatData[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [likedCats, setLikedCats] = useState<Record<number, boolean>>({});
  const [activePhotoIndexes, setActivePhotoIndexes] = useState<Record<number, number>>({});

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

  useEffect(() => {
    setIsClient(true);
    import('leaflet').then((L) => setLeafletLib(L));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(userCoords);
          if (mapRef.current) {
            mapRef.current.flyTo(userCoords, 15, { animate: true, duration: 1.5 });
          }
        },
        () => {
          console.log('User location denied, using default center.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    try {
      const savedLikes = localStorage.getItem('bellydontbully_liked_cats');
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

  const nextPhoto = (e: ReactMouseEvent, catId: number, totalPhotos: number) => {
    e.stopPropagation();
    setActivePhotoIndexes(prev => {
      const current = prev[catId] || 0;
      const next = (current + 1) % totalPhotos;
      return { ...prev, [catId]: next };
    });
  };

  const prevPhoto = (e: ReactMouseEvent, catId: number, totalPhotos: number) => {
    e.stopPropagation();
    setActivePhotoIndexes(prev => {
      const current = prev[catId] || 0;
      const prevIdx = (current - 1 + totalPhotos) % totalPhotos;
      return { ...prev, [catId]: prevIdx };
    });
  };

  const filteredCats = useMemo(() => {
    if (selectedFilter === 'all') return cats;

    return cats.filter((cat) => {
      if (selectedFilter === 'safe' || selectedFilter === 'caution' || selectedFilter === 'danger') {
        return cat.belly_status === selectedFilter;
      }
      if (selectedFilter === 'stray') {
        return !cat.collar_status || cat.collar_status === 'stray';
      }
      if (selectedFilter === 'collared') {
        return cat.collar_status === 'collared';
      }
      return true;
    });
  }, [cats, selectedFilter]);

  const getCatIcon = useCallback((cat: CatData): DivIcon | undefined => {
    if (!leafletLib) return undefined;

    const collar = cat.collar_status || 'stray';
    const cacheKey = `${collar}-${cat.belly_status}`;
    const cached = iconCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const pinImageSrc = `/pins/${cacheKey}.png`;

    const icon = leafletLib.divIcon({
      className: 'custom-cat-marker bg-transparent border-0',
      html: `
        <div style="width:56px;height:56px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6));">
          <img
            src="${pinImageSrc}"
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
    e.target.value = '';
    if (selected.length === 0) return;

    const remaining = MAX_PHOTOS - photoFiles.length;
    if (remaining <= 0) return;

    const accepted = selected.slice(0, remaining);
    setPhotoFiles((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [
      ...prev,
      ...accepted.map((file) => URL.createObjectURL(file)),
    ]);
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
      likes_count: 0
    }]).select();

    if (!error && data) {
      setCats((prev) => [data[0] as CatData, ...prev]);
      photoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
      photoPreviewsRef.current = [];
      setShowForm(false);
      setName('');
      setLocationName('');
      setDetails('');
      setDiscoveredBy('');
      setCollarStatus('stray');
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setHasLocation(false);
    } else {
      alert('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    }
    setSaving(false);
  };

  const flyToCat = (catLat: number, catLng: number) => {
    setShowList(false);
    if (mapRef.current) {
      mapRef.current.flyTo([catLat, catLng], 18, { animate: true, duration: 1.5 });
    }
  };

  const handleLike = async (e: ReactMouseEvent, catId: number, currentLikes: number) => {
    e.stopPropagation();
    if (!supabase) return;

    const isAlreadyLiked = likedCats[catId];
    const newLikes = isAlreadyLiked ? Math.max(0, (currentLikes || 0) - 1) : (currentLikes || 0) + 1;

    const updatedLikedCats = { ...likedCats, [catId]: !isAlreadyLiked };
    setLikedCats(updatedLikedCats);
    localStorage.setItem('bellydontbully_liked_cats', JSON.stringify(updatedLikedCats));

    setCats(prev => prev.map(c => c.id === catId ? { ...c, likes_count: newLikes } : c));
    await supabase.from('cats').update({ likes_count: newLikes }).eq('id', catId);
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // 🃏 ฟังก์ชันสร้างการ์ดโปเกมอนสไตล์ TCG
  const generatePokemonCard = (cat: CatData) => {
    setShareCat(cat);
    const canvas = document.createElement('canvas');
    canvas.width = 825;  // สัดส่วนการ์ดโปเกมอนมาตรฐาน
    canvas.height = 1125;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. พื้นหลังกรอบการ์ด (สีทองสไตล์การ์ดหายาก)
    const bgGradient = ctx.createLinearGradient(0, 0, 825, 1125);
    bgGradient.addColorStop(0, '#E6C687');
    bgGradient.addColorStop(0.5, '#F9E4B7');
    bgGradient.addColorStop(1, '#C8A25D');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 825, 1125);

    // ขอบในสีขาวสะอาด
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    drawRoundedRect(ctx, 35, 35, 755, 1055, 24);
    ctx.fill();

    // 2. ส่วนหัวการ์ด (ชื่อแมว + HP)
    ctx.fillStyle = '#4A3525';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('พื้นฐาน แมวเหมียว', 65, 80);

    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(cat.name, 65, 130);

    // HP และไอคอนพลังงานด้านขวาบน
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#C0392B';
    ctx.fillText('HP', 690, 125);
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('160', 760, 130);

    // 3. กรอบรูปภาพโปเกมอนตรงกลาง
    const imgUrl = cat.photo_urls?.[0];
    if (imgUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgUrl;
      img.onload = () => {
        ctx.save();
        ctx.fillStyle = '#E0D6C3';
        ctx.beginPath();
        drawRoundedRect(ctx, 65, 165, 695, 480, 16);
        ctx.fill();
        ctx.clip();
        ctx.drawImage(img, 65, 165, 695, 480);
        ctx.restore();

        // กรอบนอกรูป
        ctx.strokeStyle = '#9A7B4C';
        ctx.lineWidth = 6;
        ctx.beginPath();
        drawRoundedRect(ctx, 65, 165, 695, 480, 16);
        ctx.stroke();

        drawPokemonDetails(ctx, cat);
        setShareCardImage(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        drawPokemonDetails(ctx, cat);
        setShareCardImage(canvas.toDataURL('image/png'));
      };
    } else {
      drawPokemonDetails(ctx, cat);
      setShareCardImage(canvas.toDataURL('image/png'));
    }
  };

  const drawPokemonDetails = (ctx: CanvasRenderingContext2D, cat: CatData) => {
    const cfg = STATUS_CONFIG[cat.belly_status];

    // แถบข้อมูลย่อยใต้รูป (Location & ID)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5A4A3A';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`📍 สถานที่: ${cat.location} | โปเกมอนสายพันธุ์พุงนิ่ม`, 412, 675);

    // เส้นคั่น
    ctx.strokeStyle = '#D4C4A8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(65, 695);
    ctx.lineTo(760, 695);
    ctx.stroke();

    // 4. สกิลที่ 1: สถานะพุง (ความสามารถพิเศษ)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2C221E';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`🟢 ${cfg.label}`, 90, 745);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#555';
    // ตัดคำอธิบายให้อยู่ในกรอบการ์ด
    ctx.fillText(`ความสามารถ: ${cfg.text}`, 90, 780);
    if (cat.details) {
      ctx.fillText(`" ${cat.details} "`, 90, 810);
    }

    // เส้นคั่นสกิล
    ctx.strokeStyle = '#EAE2D0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(65, 840);
    ctx.lineTo(760, 840);
    ctx.stroke();

    // 5. สกิลที่ 2: ท่าโจมตี (ดาเมจตามยอดไลก์)
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#2C221E';
    ctx.fillText('🐾 ฮีลใจขยُمพุง', 90, 895);

    ctx.textAlign = 'right';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`${(cat.likes_count || 0) * 10 + 50}`, 740, 895);

    ctx.textAlign = 'left';
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('สร้างดาเมจความน่ารักใส่ทาสแมว ทำให้อยากวิ่งเข้าไปหวีดทันที', 90, 930);

    // 6. ขอบล่างการ์ด (จุดอ่อน, ต้านทาน, ผู้วาร์ป)
    ctx.strokeStyle = '#C8A25D';
    ctx.lineWidth = 3;
    ctx.beginPath();
    drawRoundedRect(ctx, 65, 965, 695, 75, 12);
    ctx.stroke();

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#444';
    ctx.fillText(`เปิดวาร์ปโดย: ${cat.discovered_by || 'ทาสแมวนิรนาม'}`, 85, 995);
    ctx.fillText('© 2026 Belly Don\'t Bully • TCG Edition', 85, 1020);

    ctx.textAlign = 'right';
    ctx.fillText('Illus. Cat Lover Club', 740, 1007);
  };

  // ฟังก์ชันดาวน์โหลดรูปภาพที่ปรับปรุงใหม่ รองรับมือถือและคอมพิวเตอร์
  const downloadCard = () => {
    if (!shareCardImage || !shareCat) return;
    
    // สร้างลิงก์หลอกสำหรับดาวน์โหลด
    const link = document.createElement('a');
    link.href = shareCardImage;
    link.download = `${shareCat.name}-pokemon-card.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const photoPreviewsRef = useRef<string[]>([]);
  useEffect(() => {
    photoPreviewsRef.current = photoPreviews;
  }, [photoPreviews]);

  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
              <span className="bg-[#FF9F43]/20 text-[#FF9F43] border border-[#FF9F43]/30 px-2 py-0.5 rounded-lg text-xs font-black">{cats.length} 🐱</span>
            </button>
          </div>

          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'ทั้งหมด 🐾' },
              { id: 'safe', label: '🟢 Safe Zone' },
              { id: 'caution', label: '🟡 Caution' },
              { id: 'danger', label: '🔴 Danger' },
              { id: 'stray', label: '🚷 แมวจร' },
              { id: 'collared', label: '🏷️ มีปลอกคอ' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id as FilterType)}
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

            {pickingLocation && (
              <MapEventsBridge onMove={(map) => setPickedCenter({ lat: map.getCenter().lat, lng: map.getCenter().lng })} />
            )}

            {leafletLib && filteredCats.map((cat) => {
              const isLiked = likedCats[cat.id];
              const photos = cat.photo_urls && cat.photo_urls.length > 0 ? cat.photo_urls : [];
              const activeIndex = activePhotoIndexes[cat.id] || 0;

              return (
                <Marker key={cat.id} position={[cat.lat, cat.lng]} icon={getCatIcon(cat)}>
                  <Popup>
                    <div className="w-[240px] bg-[#151518] text-[#F5F5F2] rounded-2xl overflow-hidden shadow-2xl relative">
                      <div className="absolute top-2 right-2 bg-[#0B0B0D]/80 backdrop-blur-md px-2 py-1 rounded-full border border-[#27272A] flex items-center gap-1.5 text-[10px] font-black text-[#FB7185] z-10 shadow-lg">
                        ❤️ {cat.likes_count || 0}
                      </div>

                      {photos.length > 0 ? (
                        <div className="relative w-full h-36 bg-[#0B0B0D] border-b border-[#27272A]">
                          <img src={photos[activeIndex]} alt={cat.name} className="w-full h-full object-cover" />
                          
                          {photos.length > 1 && (
                            <>
                              <button 
                                onClick={(e) => prevPhoto(e, cat.id, photos.length)}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold cursor-pointer"
                              >
                                ‹
                              </button>
                              <button 
                                onClick={(e) => nextPhoto(e, cat.id, photos.length)}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold cursor-pointer"
                              >
                                ›
                              </button>
                              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[#0B0B0D]/70 px-2 py-0.5 rounded-full text-[9px] font-bold text-white tracking-widest">
                                {activeIndex + 1} / {photos.length}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-[#0B0B0D] border-b border-[#27272A] flex items-center justify-center text-3xl">
                          🐱
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-black text-base flex items-center gap-1.5">🐱 {cat.name}</h3>
                          {cat.collar_status === 'collared' ? (
                            <span className="bg-[#FF9F43]/20 text-[#FF9F43] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#FF9F43]/30">มีปลอกคอ</span>
                          ) : (
                            <span className="bg-[#8E8E96]/20 text-[#8E8E96] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#8E8E96]/30">แมวจรจร</span>
                          )}
                        </div>
                        <p className="text-[#8E8E96] text-xs font-medium mb-3">📍 {cat.location}</p>
                        
                        <div className="text-[11px] font-bold p-2.5 rounded-xl mb-2.5 border" style={{ color: STATUS_CONFIG[cat.belly_status].ring, backgroundColor: STATUS_CONFIG[cat.belly_status].bg, borderColor: STATUS_CONFIG[cat.belly_status].ring }}>
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
                <span className="text-4xl mb-3">😿</span>
                <p className="font-semibold text-sm">ไม่พบแมวในหมวดหมู่นี้</p>
              </div>
            ) : (
              filteredCats.map(cat => {
                const cfg = STATUS_CONFIG[cat.belly_status];
                const isLiked = likedCats[cat.id];
                const photos = cat.photo_urls && cat.photo_urls.length > 0 ? cat.photo_urls : [];
                const activeIndex = activePhotoIndexes[cat.id] || 0;

                return (
                  <div 
                    key={cat.id} 
                    className="bg-[#151518] border border-[#27272A] rounded-2xl p-3 flex gap-4 items-center"
                  >
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-[#0B0B0D] border border-[#27272A]">
                      {photos.length > 0 ? (
                        <>
                          <img src={photos[activeIndex]} alt={cat.name} className="w-full h-full object-cover" />
                          {photos.length > 1 && (
                            <>
                              <button 
                                onClick={(e) => prevPhoto(e, cat.id, photos.length)}
                                className="absolute left-1 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold cursor-pointer"
                              >
                                ‹
                              </button>
                              <button 
                                onClick={(e) => nextPhoto(e, cat.id, photos.length)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#0B0B0D]/70 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold cursor-pointer"
                              >
                                ›
                              </button>
                              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-[#0B0B0D]/70 px-1.5 py-0.2 rounded-full text-[8px] font-bold text-white">
                                {activeIndex + 1}/{photos.length}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🐱</div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div onClick={() => flyToCat(cat.lat, cat.lng)} className="cursor-pointer">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-black text-[#F5F5F2] truncate text-base">{cat.name}</h3>
                          {cat.collar_status === 'collared' ? (
                            <span className="bg-[#FF9F43]/20 text-[#FF9F43] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#FF9F43]/30 shrink-0">มีปลอกคอ</span>
                          ) : (
                            <span className="bg-[#8E8E96]/20 text-[#8E8E96] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#8E8E96]/30 shrink-0">แมวจรจร</span>
                          )}
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
                            🃏 การ์ดโปเกมอน
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

      {/* Modal พรีวิวการ์ดโปเกมอน & ปุ่มดาวน์โหลด */}
      {shareCat && shareCardImage && (
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[999999] flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#151518] border border-[#27272A] p-4 rounded-3xl max-w-sm w-full flex flex-col items-center shadow-2xl">
            <h3 className="font-black text-base mb-1 text-[#FF9F43]">🃏 การ์ดโปเกมอน (TCG) พร้อมแล้ว!</h3>
            <p className="text-xs text-[#8E8E96] mb-3 text-center">กดปุ่มดาวน์โหลดด้านล่างเพื่อบันทึกรูปภาพ</p>
            
            <div className="w-full h-96 rounded-2xl overflow-hidden border border-[#27272A] mb-4 bg-[#0B0B0D] flex items-center justify-center">
              <img src={shareCardImage} alt="Pokemon Card" className="h-full object-contain" />
            </div>

            <div className="flex gap-2 w-full">
              <button 
                onClick={downloadCard}
                className="flex-1 bg-[#FF9F43] hover:bg-[#ff8f24] text-[#0B0B0D] font-black py-3 rounded-xl text-xs text-center cursor-pointer shadow-lg"
              >
                📥 บันทึกการ์ดลงเครื่อง
              </button>
              <button 
                onClick={() => { setShareCat(null); setShareCardImage(null); }}
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
                <label className="block text-xs font-bold text-[#8E8E96] mb-2 uppercase">📷 รูปถ่ายน้องแมว (สูงสุด 3 รูป)</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative min-w-[80px] h-[80px] rounded-2xl overflow-hidden border border-[#27272A]">
                      <img src={src} className="w-full h-full object-cover" alt="" />
                      <button 
                        type="button" 
                        onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  setPhotoPreviews((prev) => {
    const url = prev[i];
    if (url) URL.revokeObjectURL(url);
    return prev.filter((_, idx) => idx !== i);
  });
  setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
}} 
                        className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer"
                      >✕</button>
                    </div>
                  ))}
                  {photoFiles.length < MAX_PHOTOS && (
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (fileInputRef.current) fileInputRef.current.click(); }} className="min-w-[80px] h-[80px] rounded-2xl border-2 border-dashed border-[#27272A] flex flex-col items-center justify-center text-[#FF9F43] hover:bg-[#27272A]/30 cursor-pointer">
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
                  <button type="button" onClick={() => setCollarStatus('stray')} className={`py-3 rounded-xl text-xs font-bold border transition-colors ${collarStatus === 'stray' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}>
                    🚷 แมวจรแท้ๆ
                  </button>
                  <button type="button" onClick={() => setCollarStatus('collared')} className={`py-3 rounded-xl text-xs font-bold border transition-colors ${collarStatus === 'collared' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}>
                    🏷️ มีปลอกคอ
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8E8E96] mb-1.5">ระดับความปลอดภัยพุง</label>
                <select value={bellyStatus} onChange={(e) => setBellyStatus(e.target.value as BellyStatus)} className="w-full p-3 bg-[#0B0B0D] border border-[#27272A] rounded-xl text-[#F5F5F2] text-sm outline-none focus:border-[#FF9F43] font-semibold">
                  <option value="safe">🟢 SAFE ZONE — จกได้สบาย ชอบให้เกา</option>
                  <option value="caution">🟡 CAUTION ZONE — ระวังโดนยัน</option>
                  <option value="danger">🔴 DANGER ZONE — ห้ามจับพุงเด็ดขาด!</option>
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

              <button type="submit" disabled={saving} className="w-full bg-[#FF9F43] hover:bg-[#ff8f24] text-[#0B0B0D] font-black py-4 rounded-xl text-sm tracking-wide mt-2 cursor-pointer shadow-lg">
                {saving ? 'กำลังบันทึก...' : 'SAVE CAT SPOT 🐾'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}