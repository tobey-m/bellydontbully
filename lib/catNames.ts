import type { CardCat, CardLang } from './catCard';

export interface LocalizedName { name: string; name_meaning: string }
type Foreign = Exclude<CardLang, 'th'>;
// Curated legacy names also work when the translation service is unavailable.
// Never replace the original database name. Unknown meanings are left blank.
const names: Record<string, Record<Foreign, LocalizedName>> = {
  'หมูทอด': {
    en: { name: 'Moo Tod', name_meaning: 'Fried pork' },
    ko: { name: '무톳', name_meaning: '돼지고기 튀김' },
    ja: { name: 'ムートート', name_meaning: '揚げた豚肉' },
    zh: { name: '穆托', name_meaning: '炸猪肉' },
  },
  'อ้วนส้ม': {
    en: { name: 'Uan Som', name_meaning: 'Chubby orange cat' },
    ko: { name: '우안솜', name_meaning: '통통한 주황 고양이' },
    ja: { name: 'ウアンソム', name_meaning: 'ぽっちゃりした茶トラ猫' },
    zh: { name: '乌安松', name_meaning: '胖橘猫' },
  },
  'มะลิ': {
    en: { name: 'Mali', name_meaning: 'Jasmine' },
    ko: { name: '말리', name_meaning: '재스민' },
    ja: { name: 'マリ', name_meaning: 'ジャスミン' },
    zh: { name: '玛丽', name_meaning: '茉莉花' },
  },
};

export function curatedName(original: string, lang: Foreign): LocalizedName | undefined {
  return names[original.normalize('NFC').trim()]?.[lang];
}

export function getCatName(cat: Pick<CardCat, 'name' | 'name_en' | 'translations'>, lang: CardLang) {
  if (lang === 'th') return { name: cat.name, meaning: '', original: cat.name };
  const stored = cat.translations?.[lang];
  const curated = curatedName(cat.name, lang);
  return {
    name: (lang === 'en' ? cat.name_en?.trim() : '') || stored?.name?.trim() || curated?.name || cat.name_en?.trim() || cat.name,
    meaning: stored?.name_meaning?.trim() ?? curated?.name_meaning ?? '',
    original: cat.name,
  };
}

export function catNameNote(cat: Pick<CardCat, 'name' | 'name_en' | 'translations'>, lang: CardLang): string {
  const value = getCatName(cat, lang);
  if (lang === 'th') return '';
  return [value.meaning, value.name !== value.original ? value.original : ''].filter(Boolean).join(' · ');
}
