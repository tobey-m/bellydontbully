'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// ตัวครอปรูปเป็นสี่เหลี่ยมจัตุรัส: ลากเลื่อน + ถ่างสองนิ้ว/สไลด์/ล้อเมาส์เพื่อซูม
// ผลลัพธ์เป็น JPEG 1:1 (สูงสุด 1080px) ทุกใบเท่ากัน ทำให้การ์ดสวยสม่ำเสมอและไฟล์เล็กลงด้วย

const MAX_ZOOM = 4;
const OUT_SIZE = 1080;

export default function PhotoCropper({
  file,
  remaining = 0,
  onCancel,
  onDone,
}: {
  file: File;
  remaining?: number;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState(320);
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; z: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNat(null);
    setZ(1);
    setPos({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setBox(Math.max(240, Math.min(window.innerWidth - 40, 380)));
  }, []);

  // scale ต่ำสุดที่รูปยังคลุมกรอบเต็ม (cover) — z=1 คือค่านี้
  const base = nat ? Math.max(box / nat.w, box / nat.h) : 1;

  const clamp = (p: { x: number; y: number }, zz: number) => {
    if (!nat) return p;
    const s = base * zz;
    const mx = Math.max(0, (nat.w * s - box) / 2);
    const my = Math.max(0, (nat.h * s - box) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };

  const applyZoom = (nz: number) => {
    const v = Math.min(MAX_ZOOM, Math.max(1, nz));
    setZ(v);
    setPos((p) => clamp(p, v));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, z };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);

    if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + cur.x - prev.x, y: p.y + cur.y - prev.y }, z));
    } else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      applyZoom(pinch.current.z * (dist / pinch.current.dist));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !nat || busy) return;
    setBusy(true);

    const s = base * z;
    const side = box / s; // ขนาดพื้นที่ครอปในหน่วยพิกเซลของรูปจริง
    const sx = Math.min(Math.max(0, nat.w / 2 - pos.x / s - side / 2), Math.max(0, nat.w - side));
    const sy = Math.min(Math.max(0, nat.h / 2 - pos.y / s - side / 2), Math.max(0, nat.h - side));
    const out = Math.max(1, Math.round(Math.min(OUT_SIZE, side))); // ไม่ขยายเกินความละเอียดจริง

    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setBusy(false); return; }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return alert('ครอปรูปไม่สำเร็จ ลองใหม่อีกครั้งนะ');
        const stem = file.name.replace(/\.[^.]+$/, '') || 'cat';
        onDone(new File([blob], `${stem}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.88
    );
  };

  const s = base * z;

  return (
    <div
      className="fixed inset-0 z-[999990] bg-[#0B0B0D]/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 px-5 animate-fade-in"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="text-center">
        <h3 className="font-black text-base text-[#FF9F43]">✂️ ครอปรูปให้พอดีการ์ด</h3>
        <p className="text-[11px] text-[#8E8E96] mt-1">
          ลากรูปให้หน้าน้องอยู่ในกรอบ • ถ่างสองนิ้วหรือเลื่อนแถบเพื่อซูม
          {remaining > 0 && <span className="text-[#FF9F43] font-bold"> (เหลืออีก {remaining} รูป)</span>}
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl border-2 border-[#FF9F43] bg-[#151518] cursor-grab active:cursor-grabbing"
        style={{ width: box, height: box, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => applyZoom(z - e.deltaY * 0.002)}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
            style={{
              width: nat ? nat.w * s : undefined,
              height: nat ? nat.h * s : undefined,
              opacity: nat ? 1 : 0,
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
            }}
          />
        )}
        {/* เส้นช่วยจัดองค์ประกอบ 3×3 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />
        </div>
        {!nat && <div className="absolute inset-0 flex items-center justify-center text-[#8E8E96] text-xs font-bold">กำลังโหลดรูป...</div>}
      </div>

      <div className="flex items-center gap-3" style={{ width: box }}>
        <span className="text-sm">🔍</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={z}
          onChange={(e) => applyZoom(parseFloat(e.target.value))}
          className="flex-1 accent-[#FF9F43]"
          aria-label="ซูม"
        />
      </div>

      <div className="flex gap-2" style={{ width: box }}>
        <button type="button" onClick={onCancel} className="px-5 bg-[#27272A] text-[#F5F5F2] font-bold py-3.5 rounded-xl text-sm cursor-pointer">
          ข้ามรูปนี้
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!nat || busy}
          className="flex-1 bg-[#FF9F43] disabled:opacity-40 text-[#0B0B0D] font-black py-3.5 rounded-xl text-sm cursor-pointer shadow-lg"
        >
          {busy ? 'กำลังครอป...' : '✓ ใช้รูปนี้'}
        </button>
      </div>
    </div>
  );
}
