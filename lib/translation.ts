import type { CardCat, CardLang } from './catCard';
export type Translations = NonNullable<CardCat['translations']>;
const cache = new Map<string, Promise<Translations>>();
let unavailableUntil = 0;
/** One request per source/language per session. Never stores private text on disk. */
export async function translateContent(cat: CardCat, languages: Exclude<CardLang, 'th'>[]): Promise<Translations> {
  const missing = languages.filter(lang => !cat.translations?.[lang]?.location || (cat.details && !cat.translations?.[lang]?.details));
  if (!missing.length) return cat.translations || {};
  if (Date.now() < unavailableUntil) throw new Error('Translation unavailable');
  const input = { name: cat.name, name_en: cat.name_en, location: cat.location, details: cat.details || '', belly_text: '', languages: missing };
  const key = JSON.stringify(input);
  let task = cache.get(key);
  if (!task) {
    task = (async () => {
      const response = await fetch('/api/translate-cat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: AbortSignal.timeout(18000) });
      if (!response.ok) { if (response.status === 429 || response.status >= 500) unavailableUntil = Date.now() + 60000; throw new Error('Translation unavailable'); }
      const data = await response.json();
      if (!data.translations || typeof data.translations !== 'object') throw new Error('Invalid translation');
      for (const lang of missing) {
        const item = data.translations[lang];
        if (!item || typeof item.location !== 'string' || (cat.location.trim() && !item.location.trim()) || typeof item.details !== 'string' || (cat.details?.trim() && !item.details.trim())) throw new Error('Incomplete translation');
      }
      return data.translations as Translations;
    })();
    cache.set(key, task);
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    task.catch(() => { cache.delete(key); unavailableUntil = Date.now() + 60000; });
  }
  return { ...cat.translations, ...await task };
}
