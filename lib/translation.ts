import { tr } from './uiText';
import { curatedName } from './catNames';
import type { CardCat, CardLang } from './catCard';
export type Translations = NonNullable<CardCat['translations']>;
const cache = new Map<string, Promise<Translations>>();
let unavailableUntil = 0;
let unavailableReason = 'TRANSLATION_UNAVAILABLE';
export class TranslationError extends Error {
  constructor(public code: string) { super(code); this.name = 'TranslationError'; }
}
export function translationNotice(error: unknown, lang: CardLang): string {
  const code = error instanceof TranslationError ? error.code : '';
  if (code === 'TRANSLATION_NOT_CONFIGURED') return tr(lang,'ระบบแปลยังไม่เปิดใช้ แสดงต้นฉบับชั่วคราว');
  if (code === 'TRANSLATION_AUTH') return tr(lang,'บริการแปลต้องตรวจการเชื่อมต่อ แสดงต้นฉบับชั่วคราว');
  if (code === 'TRANSLATION_QUOTA' || code === 'TRANSLATION_RATE_LIMIT') return tr(lang,'บริการแปลเต็มชั่วคราว ลองใหม่ภายหลัง');
  return tr(lang,'แปลข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะ');
}
/** One request per source/language per session. Never stores private text on disk. */
export async function translateContent(cat: CardCat, languages: Exclude<CardLang, 'th'>[]): Promise<Translations> {
  const enriched: Translations = { ...cat.translations };
  for (const lang of languages) {
    const curated = curatedName(cat.name, lang);
    if (curated) enriched[lang] = { ...curated, ...enriched[lang], name: enriched[lang]?.name?.trim() || curated.name };
  }
  const missing = languages.filter(lang => !enriched[lang]?.name?.trim() || !enriched[lang]?.location?.trim() || (cat.details?.trim() && !enriched[lang]?.details?.trim()));
  if (!missing.length) return enriched;
  const input = { name: cat.name, name_en: cat.name_en, location: cat.location, details: cat.details || '', belly_text: '', languages: missing };
  const key = JSON.stringify(input);
  let task = cache.get(key);
  if (!task) {
    if (Date.now() < unavailableUntil) throw new TranslationError(unavailableReason);
    task = (async () => {
      const response = await fetch('/api/translate-cat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: AbortSignal.timeout(40000) });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        const allowed = ['TRANSLATION_NOT_CONFIGURED','TRANSLATION_AUTH','TRANSLATION_QUOTA'];
        unavailableReason = allowed.includes(failure.code) ? failure.code : response.status === 429 ? 'TRANSLATION_RATE_LIMIT' : 'TRANSLATION_UNAVAILABLE';
        throw new TranslationError(unavailableReason);
      }
      const data = await response.json();
      if (!data.translations || typeof data.translations !== 'object') throw new Error('Invalid translation');
      for (const lang of missing) {
        const item = data.translations[lang];
        if (!item || typeof item.location !== 'string' || (cat.location.trim() && !item.location.trim()) || typeof item.name !== 'string' || !item.name.trim() || typeof item.name_meaning !== 'string' || typeof item.details !== 'string' || (cat.details?.trim() && !item.details.trim())) throw new Error('Incomplete translation');
      }
      return data.translations as Translations;
    })();
    cache.set(key, task);
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    task.catch(() => { cache.delete(key); unavailableUntil = Date.now() + 60000; });
  }
  return { ...enriched, ...await task };
}
