import type { Metadata, Viewport } from 'next';
import { Mali } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

// ฟอนต์เดียวกันทั้งเว็บและการ์ด (การ์ดอ่านฟอนต์จาก <body>)
const mali = Mali({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
    <html lang="th">
      <body className={mali.className}>{children}</body>
    </html>
  );
}
