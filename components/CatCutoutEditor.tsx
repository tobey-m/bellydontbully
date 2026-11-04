'use client';

import { useEffect, useState } from 'react';

type Point = { x: number; y: number };
export default function CatCutoutEditor({ src, onApply, thai }: { src?: string; onApply: (png: string) => void; thai: boolean }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<Point>({ x: .5, y: .5 });
  const text = (th: string, en: string) => thai ? th : en;

  useEffect(() => {
    let cancelled = false;
    setImage(null); setPoints([]); setError('');
    if (!src) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { if (!cancelled) setError(text('โหลดรูปไม่สำเร็จ ลองเลือกรูปอื่น', 'Could not load this photo. Try another.')); }, 15000);
    img.onload = () => { clearTimeout(timer); if (!cancelled) { setImage(img); setError(''); } };
    img.onerror = () => { clearTimeout(timer); if (!cancelled) setError(text('โหลดรูปไม่สำเร็จ ลองเลือกรูปอื่น', 'Could not load this photo. Try another.')); };
    img.src = src;
    return () => { cancelled = true; clearTimeout(timer); img.onload = null; img.onerror = null; };
    // The image should reset only when the source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function add(point: Point) {
    if (points.length >= 100) return;
    setError('');
    setPoints(previous => [...previous, point]);
  }

  function apply() {
    if (!image || points.length < 3) return;
    let twiceArea = 0;
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length];
      twiceArea += p.x * next.y - next.x * p.y;
    });
    if (Math.abs(twiceArea) < .002) {
      setError(text('แตะจุดล้อมรอบตัวแมวให้เป็นพื้นที่ก่อนนะ', 'Outline an area around your cat first.'));
      return;
    }
    try {
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const sourceW = image.naturalWidth * scale, sourceH = image.naturalHeight * scale;
      const xs = points.map(p => p.x * sourceW), ys = points.map(p => p.y * sourceH);
      const left = Math.min(...xs), top = Math.min(...ys), pad = 20;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(Math.max(...xs) - left) + pad * 2;
      canvas.height = Math.ceil(Math.max(...ys) - top) + pad * 2;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
      ctx.translate(pad - left, pad - top);
      const outline = () => {
        ctx.beginPath();
        points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x * sourceW, p.y * sourceH); else ctx.lineTo(p.x * sourceW, p.y * sourceH); });
        ctx.closePath();
      };
      outline(); ctx.lineJoin = 'round'; ctx.lineWidth = 22; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
      ctx.save(); outline(); ctx.clip(); ctx.drawImage(image, 0, 0, sourceW, sourceH); ctx.restore();
      onApply(canvas.toDataURL('image/png'));
      setError('');
    } catch {
      setError(text('ตัดรูปนี้ไม่ได้ ลองเลือกรูปอื่นแล้วตัดใหม่', 'Could not cut out this image. Try another photo.'));
    }
  }

  return <fieldset className="cat-cutout-editor">
    <legend>{text('ทำสติกเกอร์แมว', 'Make a cat sticker')}</legend>
    <p>{text('แตะจุดรอบตัวแมวตามลำดับ แล้วกดตัดตามเส้น ขอบนอกจะเป็นพื้นใส ทำในเครื่องของคุณ', 'Tap points around the cat in order, then cut along the outline. The outside becomes transparent, on your device.')}</p>
    {!src ? <p role="status">{text('แมวตัวนี้ยังไม่มีรูปสำหรับตัดสติกเกอร์', 'This cat has no photo for a sticker yet.')}</p> : image ? <div className="cat-cutout-canvas" style={{ aspectRatio: image.naturalWidth / image.naturalHeight }}>
      <img src={src} alt={text('รูปต้นฉบับสำหรับล้อมตัวแมว', 'Original cat photo to outline')} crossOrigin="anonymous" draggable={false} />
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="application" tabIndex={0}
        aria-label={text('แตะรอบตัวแมว หรือใช้ปุ่มลูกศรเลื่อนจุด กด Enter เพิ่มจุด Backspace ย้อนกลับ', 'Outline the cat. Use arrow keys to move, Enter to add a point, Backspace to undo.')}
        onClick={event => {
          const box = event.currentTarget.getBoundingClientRect();
          add({ x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) });
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); add(cursor); }
          else if (event.key === 'Backspace') { event.preventDefault(); setPoints(previous => previous.slice(0, -1)); }
          else if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            setCursor(p => ({ x: Math.max(0, Math.min(1, p.x + (event.key === 'ArrowRight' ? .02 : event.key === 'ArrowLeft' ? -.02 : 0))), y: Math.max(0, Math.min(1, p.y + (event.key === 'ArrowDown' ? .02 : event.key === 'ArrowUp' ? -.02 : 0))) }));
          }
        }}>
        <polygon points={points.map(p => p.x * 1000 + ',' + p.y * 1000).join(' ')} fill="#ffc07833" stroke="#ff9f43" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => <circle key={i} cx={p.x * 1000} cy={p.y * 1000} r={9} fill="white" stroke="#9a491b" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        <circle className="cat-cutout-cursor" cx={cursor.x * 1000} cy={cursor.y * 1000} r={12} fill="none" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div> : !error && <p role="status">{text('กำลังโหลดรูป…', 'Loading photo…')}</p>}
    <p aria-live="polite">{text('จุดที่เลือก: ', 'Outline points: ')}{points.length}</p>
    {error && <p role="alert">{error}</p>}
    <div className="cat-cutout-actions">
      <button type="button" className="cat-studio-secondary" disabled={!points.length} onClick={() => setPoints(p => p.slice(0, -1))}>{text('ย้อนจุด', 'Undo point')}</button>
      <button type="button" className="cat-studio-secondary" disabled={!points.length} onClick={() => setPoints([])}>{text('เริ่มใหม่', 'Reset')}</button>
      <button type="button" className="cat-studio-primary" disabled={!image || points.length < 3} onClick={apply}>{text('ตัดตามเส้น', 'Cut outline')}</button>
    </div>
  </fieldset>;
}
