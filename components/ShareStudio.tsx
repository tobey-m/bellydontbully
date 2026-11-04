'use client';

import { getCatName, catNameNote } from '@/lib/catNames';
import { tr } from '@/lib/uiText';
import { translateContent, translationNotice } from '@/lib/translation';
import Mascot from '@/components/Mascot';
import CatCutoutEditor from '@/components/CatCutoutEditor';
import AppIcon from '@/components/AppIcon';
import { useEffect, useRef, useState } from 'react';
import {
  renderShareAsset, SHARE_SIZES, SHARE_STYLES, SHARE_STYLE_NAMES,
  type CardCat, type CardLang, type ShareOptions, type ShareStyle, type ShareFormat, type ShareFileType, type ShareAsset,
} from '@/lib/catCard';

const DEFAULTS: ShareOptions = { style: 'postcard', format: 'story', fileType: 'png', lang: 'th', photoIndex: 0, showLocation: true, showDiscoverer: true, overlayTone: 'light', showNameMeaning: true };
const SETTINGS_KEY = 'bellydontbully_share_studio_v2';
const languages: CardLang[] = ['th', 'en', 'zh', 'ja', 'ko'];

function restoreSettings(lang: CardLang): ShareOptions {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (value && SHARE_STYLES.includes(value.style) && Object.hasOwn(SHARE_SIZES, value.format)) {
      return { ...DEFAULTS, lang, style: value.style, format: value.format,
        fileType: value.style === 'overlay' || value.style === 'sticker' || value.fileType !== 'jpg' ? 'png' : 'jpg',
        showLocation: typeof value.showLocation === 'boolean' ? value.showLocation : true,
        showNameMeaning: typeof value.showNameMeaning === 'boolean' ? value.showNameMeaning : true,
        showDiscoverer: typeof value.showDiscoverer === 'boolean' ? value.showDiscoverer : true,
        overlayTone: value.overlayTone === 'dark' ? 'dark' : 'light' };
    }
  } catch { /* Private browsing or broken stored settings: use safe defaults. */ }
  return { ...DEFAULTS, lang };
}

function safeFilename(cat: CardCat, options: ShareOptions, fileType: ShareFileType) {
  const name = cat.name.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-').slice(0, 60) || 'cat';
  return `bellydontbully-${name}-${options.style}-${options.format}.${fileType}`;
}

export default function ShareStudio({ cat, lang, onClose }: { cat: CardCat; lang: CardLang; onClose: () => void }) {
  const [options, setOptions] = useState<ShareOptions>(() => restoreSettings(lang));
  const [preview, setPreview] = useState<{ url: string; asset: ShareAsset; file: File; cat: CardCat; headline?: string } | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const th = options.lang === 'th';
  const text = (thai: string, en: string) => tr(options.lang, thai, en);
  const overlay = options.style === 'overlay';
  const sticker = options.style === 'sticker';
  const transparent = overlay || sticker;
  const dimensions = SHARE_SIZES[options.format];
  const bytes = preview?.asset.blob.size ?? 0;
  const labelClass = 'text-[10px] font-bold tracking-wide text-[#806148] block mb-2';
  const selectClass = 'w-full bg-[#fffaf2] border border-[#ddc5aa] rounded-xl px-3 py-2.5 text-[#503323] min-h-11';

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);

  useEffect(() => {
    const id = ++request.current;
    let cancelled = false;
    let url: string | undefined;
    setPreview(null); setError(false); setStatus('');
    try {
      // Store preferences only; photo choices and personal cat details are not stored here.
      const { photoIndex: _photo, lang: _lang, headline: _headline, stickerPhoto: _cutout, ...settings } = options;
      void _photo; void _lang; void _headline; void _cutout;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
    if (options.style === 'sticker' && !options.stickerPhoto) return;
    const timer = setTimeout(() => {
      void (async () => {
        let translated = cat;
        if (options.lang !== 'th') {
          try { translated = {...cat, translations: await translateContent(cat, [options.lang])}; }
          catch (error) { if (!cancelled) setStatus(translationNotice(error, options.lang)); }
        }
        let headline = options.headline;
        if (options.lang !== 'th' && headline?.trim()) {
          try {
            const quote = await translateContent({...cat, details: headline, translations: undefined}, [options.lang]);
            headline = quote[options.lang]?.details || headline;
          } catch (error) { if (!cancelled) setStatus(translationNotice(error, options.lang)); }
        }
        return { asset: await renderShareAsset(translated, {...options, headline}), translated, headline };
      })().then(({asset, translated, headline}) => {
        if (cancelled || request.current !== id) return;
        url = URL.createObjectURL(asset.blob);
        setPreview({ url, asset, cat: translated, headline, file: new File([asset.blob], safeFilename(cat, options, asset.fileType), { type: asset.blob.type }) });
      }).catch(() => { if (!cancelled && request.current === id) setError(true); });
    }, options.headline?.trim() ? 700 : 100);
    return () => { cancelled = true; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [cat, options, revision]);

  function change<K extends keyof ShareOptions>(key: K, value: ShareOptions[K]) {
    // Invalidate immediately, before the next render effect: no stale export after a setting changes.
    request.current++; setPreview(null); setStatus('');
    setOptions(previous => ({ ...previous, [key]: value, ...(key === 'photoIndex' ? { stickerPhoto: undefined } : {}), ...(key === 'style' && (value === 'overlay' || value === 'sticker') ? { fileType: 'png' as const } : {}), ...(key === 'style' && value === 'sticker' ? { showLocation: false, showDiscoverer: false } : {}) }));
  }

  function saveFile() {
    if (!preview) return;
    const anchor = document.createElement('a'); anchor.href = preview.url; anchor.download = preview.file.name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setStatus(text('ส่งไฟล์ให้เบราว์เซอร์บันทึกแล้ว หาก iPhone เปิดรูปแทน ให้กดค้างที่รูปเพื่อบันทึก', 'Download requested. If your iPhone opens the image, touch and hold it to save.'));
  }

  async function shareFile() {
    if (!preview || sharing) return;
    if (!navigator.share || !navigator.canShare?.({ files: [preview.file] })) {
      setStatus(text('เครื่องนี้ไม่รองรับแชร์ไฟล์โดยตรง กดบันทึกไฟล์ แล้วอัปโหลดใน Instagram ได้เลย', 'File sharing is unavailable here. Save the file, then upload it in Instagram.')); return;
    }
    setSharing(true);
    try {
      // File is prepared while previewing, so the share call stays inside this user gesture.
      await navigator.share({ files: [preview.file], title: cat.name });
      setStatus(text('ปิดเมนูแชร์แล้ว ตรวจผลในแอปที่คุณเลือกได้เลย', 'Share menu closed. Check the app you selected.'));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setStatus(text('แชร์ไม่สำเร็จ ลองบันทึกไฟล์แล้วอัปโหลดเองได้ครับ', 'Could not share. Save the file and upload it manually.'));
    } finally { setSharing(false); }
  }

  async function copyCaption() {
    if (!preview) return;
    const preparedCat = preview.cat;
    const name = getCatName(preparedCat, options.lang).name;
    const local = options.lang === 'th' ? undefined : preparedCat.translations?.[options.lang];
    const place = options.lang === 'th' ? preparedCat.location : (local?.location || preparedCat.translations?.en?.location || preparedCat.location);
    const url = cat.id == null ? '' : `${window.location.origin}/cat/${cat.id}`;
    const statusLabel = { safe: text('เฟรนลี่', 'Friendly'), caution: text('พร้อมสวบ', 'Ready to chomp'), danger: text('โขด', 'Spicy') }[cat.belly_status];
    const caption = ["BELLYDONTBULLY", name, options.showNameMeaning !== false ? catNameNote(preparedCat, options.lang) : '', options.style === 'meme' || options.style === 'zine' || options.style === 'scrapbook' ? preview.headline?.trim() : '', options.showLocation ? place : '', `${text('ระดับความพุง', 'Belly level')}: ${statusLabel}`, url, '#bellydontbully #CatSpotting'].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(caption); setStatus(text('คัดลอกแคปชันแล้ว นำไปวางในโพสต์ได้เลย', 'Caption copied. Paste it into your post.')); }
    catch { setStatus(text('คัดลอกไม่ได้ในเบราว์เซอร์นี้ ลองเปิดเว็บผ่าน HTTPS', 'Clipboard is unavailable. Try opening the website over HTTPS.')); }
  }

  function pickStyle(style: ShareStyle) { change('style', style); }

  return (
    <dialog ref={dialogRef} aria-labelledby="share-studio-title" className="cat-share-studio" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
      <header className="flex justify-between items-center gap-4 border-b border-[#ead8c3] pb-4 mb-5">
        <div className="flex items-center gap-3"><Mascot mood="share" size={58}/><div><p className="text-[9px] tracking-[0.18em] text-[#ffc078] font-bold">BELLYDONTBULLY / SHARE STUDIO</p><h2 id="share-studio-title" className="font-semibold text-lg mt-1">{text('เจอเจ้าถิ่นมา อวดหน่อย', 'Local cat. Main character.')}</h2></div></div>
        <button type="button" onClick={onClose} aria-label={text('ปิด', 'Close')} className="rounded-full w-11 h-11 shrink-0 bg-[#f6e6d2] cursor-pointer"><AppIcon name="close"/></button>
      </header>
      <div className="cat-studio-grid">
        <section aria-label={text('ภาพตัวอย่าง', 'Export preview')} className="min-w-0">
          <div className={`cat-studio-preview ${transparent ? 'cat-studio-checker' : ''}`} aria-busy={!preview && !error && !(sticker && !options.stickerPhoto)}>
            {preview ? <div className="relative w-full flex justify-center">
              <img src={preview.url} alt={text(`การ์ดของ ${cat.name}`, `Card for ${cat.name}`)} className="cat-studio-image" />
              {showGuides && options.format === 'story' && <div className="cat-studio-guides" aria-hidden="true"><span>STORY SAFE AREA / GUIDE ONLY</span></div>}
            </div> : sticker && !options.stickerPhoto ? <div className="text-center p-6"><Mascot mood="share" size={72}/><p className="text-sm mt-3">{text('ล้อมตัวแมวแล้วกดตัดตามเส้น เพื่อสร้างสติกเกอร์พื้นใส', 'Outline your cat and cut it out to create a transparent sticker.')}</p></div> : error ? <div className="text-center p-6"><p className="text-sm mb-3">{text('สร้างภาพไม่สำเร็จ ลองอีกครั้งได้เลย', 'Could not render your card. Please retry.')}</p><button type="button" className="px-4 py-2 rounded-xl bg-[#ffc078] text-black" onClick={() => setRevision(n => n + 1)}>{text('ลองอีกครั้ง', 'Retry')}</button></div> : <div className="py-20 flex flex-col items-center gap-3" role="status"><span className="w-9 h-9 rounded-full border-4 border-[#ffc078] border-t-transparent animate-spin" /><span className="text-xs text-[#806148]">{text('กำลังทำการ์ด...', 'Making your card…')}</span></div>}
          </div>
          <p className="text-[10px] text-[#806148] mt-3 text-center">{dimensions.width} × {dimensions.height} px · {(preview?.asset.fileType ?? options.fileType).toUpperCase()}{preview ? ` · ${(bytes / 1024 / 1024).toFixed(2)} MB` : ''}</p>
          {options.format === 'story' && <label className="text-[11px] text-[#806148] flex gap-2 justify-center items-center mt-3"><input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} />{text('แสดงไกด์ Story (ไม่ติดในไฟล์)', 'Story safe-area guide (not exported)')}</label>}
        </section>
        <section aria-label={text('ตั้งค่าการ์ด', 'Card settings')} className="min-w-0 space-y-4">
          <fieldset><legend className={labelClass}>{text('เลือกการ์ดของเจ้านาย', 'PICK A KEEPSAKE')}</legend><div className="grid grid-cols-2 gap-2">{(['postcard','scrapbook','sticker'] as ShareStyle[]).map(style => <button key={style} type="button" aria-pressed={options.style === style} onClick={() => pickStyle(style)} className={`belly-style-choice text-xs font-medium rounded-xl min-h-11 py-2 px-2 border cursor-pointer ${options.style === style ? 'bg-[#ffc078] text-[#503323] border-[#df9c59]' : 'bg-[#fffaf2] border-[#ddc5aa] text-[#76583f]'}`}><Mascot mood={style==='sticker'?'share':style==='postcard'?'sweet':'explore'} size={38}/>{tr(options.lang, SHARE_STYLE_NAMES[style].th, SHARE_STYLE_NAMES[style].en)}</button>)}</div></fieldset>
          <details className="belly-classic-styles" open={!['postcard','scrapbook','sticker'].includes(options.style) || undefined}><summary>{text('สไตล์อื่น / ข้อความทับรูป', 'More styles / text overlay')}</summary><div className="grid grid-cols-2 gap-2 mt-3">{SHARE_STYLES.filter(style=>!['postcard','scrapbook','sticker'].includes(style)).map(style=><button key={style} type="button" aria-pressed={options.style===style} onClick={()=>pickStyle(style)} className={`cat-studio-secondary ${options.style===style?'belly-classic-active':''}`}>{tr(options.lang, SHARE_STYLE_NAMES[style].th, SHARE_STYLE_NAMES[style].en)}</button>)}</div></details>
          {(options.style === 'meme' || options.style === 'zine' || options.style === 'scrapbook') && <label className="block"><span className={labelClass}>{text('คำของเจ้านาย / เว้นว่างให้แมวพูดเอง', 'CAT QUOTE / BLANK FOR AUTO')}</span><input className={selectClass} value={options.headline || ''} maxLength={90} placeholder={text('เช่น มองได้ แต่อย่าจก', 'e.g. Cute. With conditions.')} onChange={e => change('headline', e.target.value)} /><span className="text-[10px] text-[#806148]">{text('คำสั้น ๆ จะเด่นที่สุด · ไม่บันทึกข้อความไว้ในเครื่อง', 'Short quotes work best · quote is not stored')}</span></label>}
          <div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>{text('ขนาดภาพ', 'CANVAS')}</span><select className={selectClass} value={options.format} onChange={e => change('format', e.target.value as ShareFormat)}>{Object.entries(SHARE_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label}</option>)}</select></label>
          <label><span className={labelClass}>{text('ไฟล์', 'FILE')}</span><select className={selectClass} value={options.fileType} onChange={e => change('fileType', e.target.value as ShareFileType)}><option value="png">PNG</option><option value="jpg" disabled={transparent}>JPG · 94%</option></select></label></div>
          <label className="block"><span className={labelClass}>{text('ภาษาบนการ์ด', 'CARD LANGUAGE')}</span><select className={selectClass} value={options.lang} onChange={e => change('lang', e.target.value as CardLang)}>{languages.map((value, i) => <option key={value} value={value}>{['ไทย', 'English', '中文', '日本語', '한국어'][i]}</option>)}</select></label>
          {overlay ? <><label className="block"><span className={labelClass}>{text('สีข้อความ', 'OVERLAY TEXT')}</span><select className={selectClass} value={options.overlayTone} onChange={e => change('overlayTone', e.target.value as 'light' | 'dark')}><option value="light">{text('ขาว / สำหรับรูปมืด', 'Light / dark photos')}</option><option value="dark">{text('ดำ / สำหรับรูปสว่าง', 'Dark / light photos')}</option></select></label><p className="text-[11px] text-[#76583f] leading-relaxed">{text('PNG พื้นใสสำหรับวางทับรูปของคุณ ไม่ใช่การตัดพื้นหลังรูปแมว บันทึกแล้วเพิ่มเป็นรูป/สติกเกอร์ใน Story ตามที่แอปรองรับ', 'Transparent PNG graphic layer, not a cat-photo cutout. Save it and add it over your photo using your Story editor’s photo/sticker tools.')}</p></> : (cat.photo_urls?.length ?? 0) > 1 && <fieldset><legend className={labelClass}>{text('เลือกรูปแมว', 'CHOOSE PHOTO')}</legend><div className="flex flex-wrap gap-2">{cat.photo_urls?.map((url, index) => <button key={`${url}-${index}`} type="button" aria-label={text(`รูปที่ ${index + 1}`, `Photo ${index + 1}`)} aria-pressed={options.photoIndex === index} onClick={() => change('photoIndex', index)} className={`w-14 h-14 overflow-hidden rounded-xl border-2 cursor-pointer ${options.photoIndex === index ? 'border-[#ffc078]' : 'border-[#ddc5aa]'}`}><img src={url} alt="" className="w-full h-full object-cover" /></button>)}</div></fieldset>}
          {sticker && <CatCutoutEditor key={cat.photo_urls?.[options.photoIndex] || 'no-photo'} src={cat.photo_urls?.[options.photoIndex]} thai={th} onApply={png => change('stickerPhoto', png)}/>}
          {sticker && options.stickerPhoto && <p className="text-[11px]">{text('ตัดรูปแล้ว บันทึก PNG เพื่อใช้เป็นสติกเกอร์ได้เลย หรือปรับเส้นแล้วตัดใหม่', 'Your cutout is ready. Save the PNG as a sticker, or adjust the outline and cut again.')}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-3 text-xs">{options.lang !== 'th' && <label className="flex items-center gap-2"><input type="checkbox" checked={options.showNameMeaning !== false} onChange={e => change('showNameMeaning', e.target.checked)} />{text('ความหมายชื่อ + ชื่อไทย', 'Name meaning + original')}</label>}<label className="flex items-center gap-2"><input type="checkbox" checked={options.showLocation} onChange={e => change('showLocation', e.target.checked)} />{text('แสดงสถานที่', 'Show location')}</label><label className="flex items-center gap-2"><input type="checkbox" checked={options.showDiscoverer} onChange={e => change('showDiscoverer', e.target.checked)} />{text('เครดิตผู้พบ', 'Discoverer credit')}</label></div>
          {!['postcard', 'scrapbook', 'sticker', 'meme', 'zine', 'field', 'pocket', 'poster', 'overlay'].includes(options.style) && options.format !== 'story' && <p className="text-[10px] text-[#806148] leading-relaxed">{text('การ์ดเดิมจะวางเต็มใบในเฟรม เพื่อรักษาลายเดิมโดยไม่ตัดหรือยืดภาพ', 'Classic cards are contained in a frame, without cropping or stretching.')}</p>}
          {preview?.asset.photoMissing && <p role="alert" className="text-xs text-[#914616] leading-relaxed">{text('โหลดรูปแมวไม่ได้ ใช้หน้าแมววาดแทน กรุณาตรวจภาพก่อนบันทึก', 'The photo could not load. A drawn cat is used instead. Check the preview before saving.')} <button className="underline" onClick={() => setRevision(n => n + 1)}>{text('ลองโหลดรูปใหม่', 'Retry photo')}</button></p>}
          <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!preview} onClick={saveFile} className="cat-studio-primary">{text('บันทึก', 'Save')} {(preview?.asset.fileType ?? options.fileType).toUpperCase()} ↓</button><button type="button" disabled={!preview || sharing} onClick={() => void shareFile()} className="cat-studio-secondary">{sharing ? text('กำลังแชร์...', 'Sharing…') : text('แชร์ไฟล์ ↗', 'Share file ↗')}</button></div>
          <button type="button" disabled={!preview} onClick={() => void copyCaption()} className="cat-studio-secondary w-full">{text('คัดลอกแคปชัน + ลิงก์แมว', 'Copy caption + cat link')}</button>
          <p className="text-[10px] text-[#806148] leading-relaxed">{text('บันทึกภาพ → เปิด Instagram → เลือก Story หรือ Post แล้วเพิ่มภาพที่บันทึก เมนูแชร์ขึ้นอยู่กับแอปที่ติดตั้งในเครื่อง', 'Save → open Instagram → create a Story or Post → choose your saved image. Share destinations depend on your device and installed apps.')}</p>
          <p className="text-xs text-[#914616] leading-relaxed min-h-5" role="status" aria-live="polite">{status}</p>
        </section>
      </div>
    </dialog>
  );
}
