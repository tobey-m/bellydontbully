'use client';

// components/CatFeedback.tsx — แถบ "ยังเจออยู่ / โหวตระดับความพุง / สะสม" ใน bottom sheet
import type { CardLang } from '@/lib/catCard';
import { X, timeAgo } from '@/lib/extraI18n';

type Belly = 'safe' | 'caution' | 'danger';

export interface FeedbackCat {
  id: number;
  belly_status: Belly;
  last_seen_at?: string | null;
  vote_safe?: number | null;
  vote_caution?: number | null;
  vote_danger?: number | null;
}

interface Props {
  cat: FeedbackCat;
  lang: CardLang;
  featuresReady: boolean; // false = ยังไม่ได้รัน SQL migration → ซ่อนปุ่มที่ต้องใช้ฐานข้อมูล
  myVote?: Belly;
  seenRecently: boolean;
  collected: boolean;
  onSeen: () => void;
  onVote: (status: Belly) => void;
  onToggleCollect: () => void;
}

const STALE_MS = 60 * 24 * 3600 * 1000;
const DOT: Record<Belly, { emoji: string; color: string }> = {
  safe: { emoji: '🟢', color: '#34D399' },
  caution: { emoji: '🟡', color: '#FBBF24' },
  danger: { emoji: '🔴', color: '#FB7185' },
};

export default function CatFeedback({ cat, lang, featuresReady, myVote, seenRecently, collected, onSeen, onVote, onToggleCollect }: Props) {
  const t = X[lang];
  const votes: Record<Belly, number> = { safe: cat.vote_safe ?? 0, caution: cat.vote_caution ?? 0, danger: cat.vote_danger ?? 0 };
  const stale = cat.last_seen_at ? Date.now() - Date.parse(cat.last_seen_at) > STALE_MS : false;
  const warn = featuresReady && votes.danger >= 2 && votes.danger > votes.safe && cat.belly_status !== 'danger';

  return (
    <div className="mt-2 space-y-1.5">
      {featuresReady && cat.last_seen_at && (
        <p className={`text-[10px] ${stale ? 'text-[#FBBF24]' : 'text-[#8E8E96]'}`}>
          🕒 {t.lastSeen} {timeAgo(cat.last_seen_at, lang)}{stale && <> · {t.staleHint}</>}
        </p>
      )}

      {warn && (
        <p className="text-[11px] font-bold text-[#FB7185] bg-[#FB7185]/10 border border-[#FB7185]/30 rounded-lg px-2 py-1">⚠️ {t.dangerWarn}</p>
      )}

      <div className="flex gap-1.5">
        {featuresReady && (
          <button
            type="button"
            onClick={onSeen}
            disabled={seenRecently}
            className="flex-1 h-9 rounded-lg text-[11px] font-black cursor-pointer whitespace-nowrap bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 disabled:opacity-60"
          >
            {seenRecently ? `✓ ${t.seenThanks}` : `✅ ${t.seenBtn}`}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollect}
          aria-pressed={collected}
          className={`flex-1 h-9 rounded-lg text-[11px] font-black cursor-pointer whitespace-nowrap border ${collected ? 'bg-[#FF9F43] text-[#0B0B0D] border-[#FF9F43]' : 'bg-[#27272A] text-[#F5F5F2] border-[#27272A]'}`}
        >
          {collected ? t.collectedBtn : t.collect}
        </button>
      </div>

      {featuresReady && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#8E8E96] shrink-0">{t.voteTitle}</span>
          {(['safe', 'caution', 'danger'] as Belly[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onVote(s)}
              aria-pressed={myVote === s}
              className="flex-1 h-8 rounded-lg text-[11px] font-black cursor-pointer border transition-colors"
              style={myVote === s
                ? { background: DOT[s].color, color: '#0B0B0D', borderColor: DOT[s].color }
                : { background: '#0B0B0D', color: DOT[s].color, borderColor: '#27272A' }}
            >
              {DOT[s].emoji} {votes[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
