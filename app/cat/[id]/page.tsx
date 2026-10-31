// app/cat/[id]/page.tsx — ลิงก์แชร์แมวหนึ่งตัว: ให้ตัวอย่างลิงก์ (OG) สวยๆ แล้วพาเข้าแผนที่ที่หมุดนั้น
import type { Metadata } from 'next';
import RedirectHome from '@/components/RedirectHome';

export const revalidate = 300;

type Belly = 'safe' | 'caution' | 'danger';
interface Row {
  id: number;
  name: string;
  name_en?: string | null;
  location: string;
  belly_status: Belly;
  photo_urls?: string[] | null;
}

const EMOJI: Record<Belly, string> = { safe: '', caution: '', danger: '' };
const LABEL: Record<Belly, string> = { safe: 'เฟรนลี่ จกพุงได้', caution: 'พร้อมสวบ ดูอารมณ์น้องก่อน', danger: 'โขด ห้ามจกพุง!' };

async function getCat(raw: string): Promise<Row | null> {
  if (!/^\d{1,12}$/.test(raw)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const headers: Record<string, string> = { apikey: key };
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // คีย์แบบ JWT เดิมเท่านั้น
    const res = await fetch(
      `${url}/rest/v1/cats?id=eq.${raw}&select=id,name,name_en,location,belly_status,photo_urls&limit=1`,
      { headers, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const cat = await getCat(id);
  if (!cat) return { title: "BELLYDONTBULLY" };
  const title = `${cat.name} · BELLYDONTBULLY`;
  const description = `${EMOJI[cat.belly_status]} ${LABEL[cat.belly_status]} —  ${cat.location}`;
  const image = cat.photo_urls?.[0];
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
  };
}

export default async function CatLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = await getCat(id);
  const target = /^\d{1,12}$/.test(id) ? `/?cat=${id}` : '/';
  const photo = cat?.photo_urls?.[0];

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      {photo && <img src={photo} alt={cat?.name ?? ''} className="w-40 h-40 rounded-3xl object-cover border border-[#27272A]" />}
      {cat && (
        <>
          <h1 className="font-black text-xl">{cat.name}</h1>
          <p className="text-[#8E8E96] text-sm"> {cat.location}</p>
        </>
      )}
      <a href={target} className="bg-[#FF9F43] text-[#0B0B0D] font-black px-6 py-3 rounded-full text-sm"> เปิดบนแผนที่ / Open on map</a>
      <RedirectHome to={target} />
    </main>
  );
}
