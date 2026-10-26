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
  applicationName: "BELLY DON'T BULLY",
  // เพิ่มลงหน้าจอหลักบน iPhone แล้วเปิดเต็มจอเหมือนแอป (ไอคอนมาจาก app/apple-icon.png, manifest จาก app/manifest.ts)
  appleWebApp: { capable: true, title: 'BellyDontBully', statusBarStyle: 'black-translucent' },
};

// viewport-fit=cover ทำให้ env(safe-area-inset-*) ที่ใช้ใน page.tsx ทำงานบน iPhone
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0B0D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={mitr.variable} suppressHydrationWarning>
      <body className={mitr.className}>{children}</body>
    </html>
  );
}
