import type { Metadata, Viewport } from 'next';
import { Mitr } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

// ฟอนต์เดียวกันทั้งเว็บและการ์ด (การ์ดอ่านฟอนต์จาก <body>)
// weight 400/500/600 ต้องครบ เพราะ lib/catCard.ts ใช้ทั้งสามค่านี้
const mitr = Mitr({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: "BELLY DON'T BULLY",
  description: 'แผนที่เหมียวน่ารักๆ น่าจกพุง',
};

// viewport-fit=cover ทำให้ env(safe-area-inset-*) ที่ใช้ใน page.tsx ทำงานบน iPhone
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={mitr.variable}>
      <body className={mitr.className}>{children}</body>
    </html>
  );
}
