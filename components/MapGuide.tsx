'use client';
import { useEffect, useId, useState } from 'react';
import type { CardLang } from '@/lib/catCard';
import Mascot from './Mascot';
import AppIcon from './AppIcon';
import { tr } from '@/lib/uiText';

const KEY = 'bellydontbully_map_guide_collapsed';
export default function MapGuide({lang, loading, error, onRetry}: {lang: CardLang; loading: boolean; error: boolean; onRetry: () => void}) {
  const [collapsed, setCollapsed] = useState(true);
  const contentId = useId();
  useEffect(() => { try { setCollapsed(localStorage.getItem(KEY) !== 'false'); } catch {} }, []);
  function toggle() {
    const next = !collapsed; setCollapsed(next);
    try { localStorage.setItem(KEY, String(next)); } catch {}
  }
  return <aside className={`belly-map-note belly-map-guide ${collapsed ? 'is-collapsed' : ''}`}>
    <button type="button" className="belly-guide-toggle" onClick={toggle} aria-expanded={!collapsed} aria-controls={contentId}>
      <Mascot mood={error ? 'sleep' : 'deadpan'} size={36}/>
      <span>{collapsed ? tr(lang, error ? 'แผนที่ยังโหลดไม่ได้' : 'คู่มือเจ้าถิ่น') : tr(lang,'ย่อคู่มือ')}</span>
      <AppIcon name={collapsed ? 'plus' : 'close'} size={16}/>
    </button>
    <div id={contentId} hidden={collapsed}>
      <h2>{tr(lang,'แมวไม่ได้นัด แต่เราเจอกัน','Not a date. A cat encounter.')}</h2>
      <p>{error ? tr(lang,'ยังโหลดข้อมูลไม่ได้ ลองอีกครั้งได้เลย','Could not load sightings. Try again.') : loading ? tr(lang,'กำลังตามหาเจ้ามึนแถวนี้...','Looking for the local weirdos…') : tr(lang,'แตะหมุดเพื่อรู้จักเจ้าถิ่น หรือเพิ่มแมวที่คุณเพิ่งเจอ','Tap a pin. Meet a local. Add a cat you just spotted.')}</p>
      {error && <button type="button" className="belly-retry" onClick={onRetry}>{tr(lang,'ลองโหลดใหม่','Retry')}</button>}
    </div>
  </aside>;
}
