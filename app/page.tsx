'use client';

import { useState, useEffect, useRef } from 'react';
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
      useEffect(() => { onMove(map); }, []);
      return null;
    }
    return Bridge;
  }),
  { ssr: false }
);

type BellyStatus = 'safe' | 'caution' | 'danger';
type CollarStatus = 'stray' | 'collared';

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
}

const STATUS_CONFIG: Record<BellyStatus, { label: string; text: string; emoji: string; ring: string; bg: string }> = {
  safe: { label: 'SAFE ZONE', text: 'จกพุงได้สบาย ชอบให้เกา', emoji: '🟢', ring: '#34D399', bg: 'rgba(52, 211, 153, 0.15)' },
  caution: { label: 'CAUTION ZONE', text: 'จกได้นิดหน่อย ระวังโดนยัน', emoji: '🟡', ring: '#FBBF24', bg: 'rgba(251, 191, 36, 0.15)' },
  danger: { label: 'DANGER ZONE', text: 'ห้ามจับพุงเด็ดขาด!', emoji: '🔴', ring: '#FB7185', bg: 'rgba(251, 113, 133, 0.15)' },
};

const MAX_PHOTOS = 3;
const CHIANG_MAI_CENTER: [number, number] = [18.7883, 98.9853];

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);
  
  // เพิ่ม Map Ref สำหรับสั่งให้แผนที่ซูมไปหาแมว
  const mapRef = useRef<LeafletMap | null>(null);

  const [cats, setCats] = useState<CatData[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  // States ควบคุมหน้าต่างต่างๆ
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false); // ควบคุมหน้าสมุดสะสมแมว
  
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [bellyStatus, setBellyStatus] = useState<BellyStatus>('safe');
  const [collarStatus, setCollarStatus] = useState<CollarStatus>('stray');
  const [details, setDetails] = useState('');

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

    if (!isSupabaseConfigured || !supabase) {
      setLoadingCats(false);
      return;
    }

    supabase.from('cats').select('*').order('id', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setCats(data as CatData[]);
        setLoadingCats(false);
      });
  }, []);

  const getCatIcon = (cat: CatData): DivIcon | undefined => {
    if (!leafletLib) return undefined;
    const collar = cat.collar_status || 'stray';
    const status = cat.belly_status;
    const pinImageSrc = `/pins/${collar}-${status}.png`; 

    return leafletLib.divIcon({
      className: 'custom-cat-marker bg-transparent border-0',
      html: `
        <div style="width: 56px; height: 56px; position: relative; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.6)); transition: transform 0.2s;">
          <img src="${pinImageSrc}" alt="cat pin" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐱</text></svg>'" />
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
      popupAnchor: [0, -28],
    });
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    const newPreviews = selected.map((f) => URL.createObjectURL(f));
    setPhotoFiles((prev) => [...prev, ...selected].slice(0, MAX_PHOTOS));
    setPhotoPreviews((prev) => [...prev, ...newPreviews].slice(0, MAX_PHOTOS));
  };

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !locationName.trim() || !hasLocation) {
      return alert('กรุณากรอกชื่อ สถานที่ และระบุพิกัดให้เรียบร้อย');
    }
    if (!isSupabaseConfigured || !supabase) {
      return alert('ระบบฐานข้อมูลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแล');
    }

    setSaving(true);
    let photoUrls: string[] = [];

    if (photoFiles.length > 0 && isSupabaseConfigured) {
      try {
        photoUrls = await uploadCatPhotos(photoFiles);
      } catch (err) {
        console.error(err);
      }
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
    }]).select();

    if (!error && data) {
      setCats((prev) => [data[0] as CatData, ...prev]);
      setShowForm(false);
      setName('');
      setLocationName('');
      setDetails('');
      setCollarStatus('stray');
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setHasLocation(false);
    } else {
      alert('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    }
    setSaving(false);
  };

  // ฟังก์ชันซูมไปหาแมวเมื่อกดจากการ์ด
  const flyToCat = (catLat: number, catLng: number) => {
    setShowList(false);
    if (mapRef.current) {
      mapRef.current.flyTo([catLat, catLng], 18, {
        animate: true,
        duration: 1.5
      });
    }
  };

  return (
    <main className="relative w-screen h-[100svh] overflow-hidden bg-[#0B0B0D] text-[#F5F5F2] select-none font-sans">
      
      {!pickingLocation && (
        <div className="absolute top-4 left-4 right-4 z-[3000] pointer-events-none flex justify-between items-start">
          <div className="pointer-events-auto bg-[#151518]/95 backdrop-blur-md border border-[#27272A] p-3 rounded-2xl shadow-2xl flex items-center gap-3">
            <span className="text-2xl">🐾</span>
            <div>
              <h1 className="font-black text-[#F5F5F2] text-sm tracking-wide leading-tight">BELLY DON'T BULLY</h1>
              <p className="text-[#8E8E96] text-[10px] uppercase font-semibold tracking-wider">Chiang Mai Cat Map</p>
            </div>
          </div>
          {/* แก้ไขให้ปุ่ม FOUND กดได้ */}
          <button 
            onClick={() => setShowList(true)}
            className="pointer-events-auto bg-[#151518]/95 hover:bg-[#27272A] transition-colors backdrop-blur-md border border-[#27272A] px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span className="text-[#8E8E96] text-xs font-bold">FOUND</span>
            <span className="bg-[#FF9F43]/20 text-[#FF9F43] border border-[#FF9F43]/30 px-2 py-0.5 rounded-lg text-xs font-black">{cats.length} 🐱</span>
          </button>
        </div>
      )}

      <div className="w-full h-full z-0">
        {isClient ? (
          <MapContainer 
            center={CHIANG_MAI_CENTER} 
            zoom={15} 
            zoomControl={false} 
            className="w-full h-full"
            ref={mapRef} // เก็บ Ref เพื่อใช้ซูมแผนที่
          >
            <TileLayer url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png" />
            <ZoomControl position="bottomright" />

            {pickingLocation && (
              <MapEventsBridge onMove={(map) => setPickedCenter({ lat: map.getCenter().lat, lng: map.getCenter().lng })} />
            )}

            {leafletLib && cats.map((cat) => (
              <Marker key={cat.id} position={[cat.lat, cat.lng]} icon={getCatIcon(cat)}>
                <Popup>
                  <div className="w-[240px] bg-[#151518] text-[#F5F5F2] rounded-2xl overflow-hidden shadow-2xl">
                    {cat.photo_urls?.[0] && (
                      <img src={cat.photo_urls[0]} alt={cat.name} className="w-full h-36 object-cover border-b border-[#27272A]" />
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
                        <p className="text-xs text-[#8E8E96] bg-[#0B0B0D] p-2.5 rounded-xl border border-[#27272A] italic">"{cat.details}"</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
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

      {/* หน้าต่างใหม่: สมุดสะสมแมว (Cat Directory / List) */}
      {showList && (
        <div className="fixed inset-0 bg-[#0B0B0D]/90 backdrop-blur-md z-[99999] flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#27272A] bg-[#151518]">
            <div>
              <h2 className="text-[#F5F5F2] font-black text-xl flex items-center gap-2">🐾 CAT DIRECTORY</h2>
              <p className="text-[#8E8E96] text-xs font-bold uppercase mt-1 tracking-widest">สมุดสะสมแมวซอย</p>
            </div>
            <button onClick={() => setShowList(false)} className="w-10 h-10 rounded-full bg-[#27272A] hover:bg-[#3f3f46] text-[#8E8E96] font-bold flex items-center justify-center cursor-pointer transition-colors">
              ✕
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[#8E8E96]">
                <span className="text-4xl mb-3">😿</span>
                <p className="font-semibold text-sm">ยังไม่มีข้อมูลแมวเลย ออกไปสำรวจกันเถอะ!</p>
              </div>
            ) : (
              cats.map(cat => {
                const cfg = STATUS_CONFIG[cat.belly_status];
                return (
                  <div 
                    key={cat.id} 
                    onClick={() => flyToCat(cat.lat, cat.lng)}
                    className="bg-[#151518] hover:bg-[#27272A]/50 transition-colors border border-[#27272A] hover:border-[#FF9F43]/50 rounded-2xl p-3 flex gap-4 items-center cursor-pointer active:scale-[0.98]"
                  >
                    {/* ภาพน้องแมว */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#0B0B0D] flex items-center justify-center border border-[#27272A]">
                      {cat.photo_urls?.[0] ? (
                        <img src={cat.photo_urls[0]} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">🐱</span>
                      )}
                    </div>
                    
                    {/* รายละเอียด */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-black text-[#F5F5F2] truncate text-base">{cat.name}</h3>
                        {cat.collar_status === 'collared' ? (
                          <span className="bg-[#FF9F43]/20 text-[#FF9F43] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#FF9F43]/30 shrink-0">มีปลอกคอ</span>
                        ) : (
                          <span className="bg-[#8E8E96]/20 text-[#8E8E96] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[#8E8E96]/30 shrink-0">แมวจรจร</span>
                        )}
                      </div>
                      
                      <p className="text-[#8E8E96] text-[10px] font-medium truncate mb-2">📍 {cat.location}</p>
                      
                      {/* ป้ายเตือนพุงขนาดมินิ */}
                      <div className="inline-block text-[9px] font-bold px-2 py-1 rounded-lg border" style={{ color: cfg.ring, backgroundColor: cfg.bg, borderColor: cfg.ring }}>
                        {cfg.emoji} {cfg.label}
                      </div>
                    </div>
                    
                    {/* ลูกศรนำทาง */}
                    <div className="shrink-0 text-[#8E8E96] pr-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Map Location Picker Overlay ... (โค้ดส่วนนี้ยังเหมือนเดิม) ... */}
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

      {/* Cat Form Bottom Sheet ... (โค้ดส่วนนี้ยังเหมือนเดิม) ... */}
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
                          setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
                          setPhotoFiles(prev => prev.filter((_, idx) => idx !== i));
                        }} 
                        className="absolute top-1 right-1 bg-[#0B0B0D]/80 text-[#F5F5F2] w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {photoFiles.length < MAX_PHOTOS && (
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (fileInputRef.current) {
                          fileInputRef.current.click();
                        }
                      }} 
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
                  <button 
                    type="button" 
                    onClick={() => setCollarStatus('stray')} 
                    className={`py-3 rounded-xl text-xs font-bold border transition-colors ${collarStatus === 'stray' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}
                  >
                    🚷 แมวจรแท้ๆ
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setCollarStatus('collared')} 
                    className={`py-3 rounded-xl text-xs font-bold border transition-colors ${collarStatus === 'collared' ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#0B0B0D] text-[#8E8E96] border-[#27272A] hover:border-[#8E8E96]'}`}
                  >
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