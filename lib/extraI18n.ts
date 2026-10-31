// lib/extraI18n.ts — ข้อความของฟีเจอร์ใหม่ (ยังเจออยู่ / โหวต / สะสม / แชร์ลิงก์ / ค้นหา)
// แยกไฟล์เพื่อไม่ต้องแตะตาราง UI ใหญ่ใน page.tsx
import type { CardLang } from '@/lib/catCard';

export interface Extra {
  seenBtn: string;
  seenThanks: string;
  lastSeen: string;
  staleHint: string;
  voteTitle: string;
  votedThanks: string;
  dangerWarn: string;
  collect: string;
  collectedBtn: string;
  collectedTab: string;
  shareLink: string;
  linkCopied: string;
  searchPlaceholder: string;
  fuzzNote: string;
}

export const X: Record<CardLang, Extra> = {
  th: {
    seenBtn: 'ยังเจออยู่',
    seenThanks: 'ขอบคุณที่ยืนยัน',
    lastSeen: 'เจอล่าสุด',
    staleHint: 'ไม่มีใครยืนยันมานานแล้ว น้องอาจย้ายที่',
    voteTitle: 'โหวตระดับความพุง',
    votedThanks: 'บันทึกโหวตแล้ว',
    dangerWarn: 'มีคนบอกว่าน้องพร้อมสวบกว่าที่คิด ดูอารมณ์น้องก่อนนะ',
    collect: 'เก็บน้องเข้ากระเป๋า',
    collectedBtn: ' สะสมแล้ว',
    collectedTab: ' สะสมแล้ว',
    shareLink: 'แชร์ลิงก์',
    linkCopied: 'คัดลอกลิงก์แล้ว',
    searchPlaceholder: 'ค้นหาชื่อหรือสถานที่',
    fuzzNote: 'พิกัดของเหมียวมีบ้านจะถูกปัดให้คลาดเคลื่อนประมาณ 100 เมตร เพื่อความเป็นส่วนตัวของเจ้าของ',
  },
  en: {
    seenBtn: 'Still here',
    seenThanks: 'Thanks for confirming',
    lastSeen: 'Last seen',
    staleHint: 'Not confirmed for a while — this cat may have moved',
    voteTitle: 'Vote belly level',
    votedThanks: 'Vote saved',
    dangerWarn: 'Visitors report this cat may be grumpier than listed — be careful',
    collect: ' Collect',
    collectedBtn: ' Collected',
    collectedTab: ' Collected',
    shareLink: 'Share link',
    linkCopied: 'Link copied',
    searchPlaceholder: 'Search name or place',
    fuzzNote: "A home cat's location is rounded to about 100 m to protect its owner's privacy",
  },
  zh: {
    seenBtn: '还在这里',
    seenThanks: '谢谢确认',
    lastSeen: '最近看到',
    staleHint: '很久没人确认了，这只猫可能已经搬走',
    voteTitle: '投票肚肚等级',
    votedThanks: '投票已保存',
    dangerWarn: '有访客反馈这只猫可能比标注的更凶，请小心',
    collect: ' 收藏',
    collectedBtn: ' 已收藏',
    collectedTab: ' 已收藏',
    shareLink: '分享链接',
    linkCopied: '链接已复制',
    searchPlaceholder: '搜索名字或地点',
    fuzzNote: '有主人的猫咪位置会模糊约 100 米，以保护主人隐私',
  },
  ja: {
    seenBtn: 'まだいるよ',
    seenThanks: '確認ありがとう',
    lastSeen: '最終目撃',
    staleHint: 'しばらく確認がありません。移動したかも',
    voteTitle: 'お腹レベルに投票',
    votedThanks: '投票しました',
    dangerWarn: '「記載より気難しいかも」という報告があります。ご注意ください',
    collect: ' コレクト',
    collectedBtn: ' コレクト済み',
    collectedTab: ' コレクト済み',
    shareLink: 'リンクを共有',
    linkCopied: 'リンクをコピーしました',
    searchPlaceholder: '名前・場所で検索',
    fuzzNote: '飼い猫の位置は飼い主のプライバシー保護のため約100mずらして保存されます',
  },
  ko: {
    seenBtn: '아직 있어요',
    seenThanks: '확인 고마워요',
    lastSeen: '마지막 목격',
    staleHint: '한동안 확인이 없어요. 이동했을 수 있어요',
    voteTitle: '배 레벨 투표',
    votedThanks: '투표 완료',
    dangerWarn: '표기보다 까칠할 수 있다는 방문자 제보가 있어요. 조심하세요',
    collect: ' 수집',
    collectedBtn: ' 수집 완료',
    collectedTab: ' 수집함',
    shareLink: '링크 공유',
    linkCopied: '링크를 복사했어요',
    searchPlaceholder: '이름 또는 장소 검색',
    fuzzNote: '집고양이 위치는 주인의 개인정보 보호를 위해 약 100m 정도 흐리게 저장돼요',
  },
};

// "3 วันที่แล้ว" / "3 days ago" ตามภาษา (ใช้ Intl ไม่ต้องเขียนเอง)
export function timeAgo(iso: string, lang: CardLang): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const sec = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), 'month');
  return rtf.format(Math.round(sec / (86400 * 365)), 'year');
}
