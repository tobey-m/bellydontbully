import type { Metadata, Viewport } from "next";
import { Kanit, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// Kanit: bold, rounded geometric display face — carries the playful
// "CatDex" personality for headings and big UI labels.
const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// IBM Plex Sans Thai: quiet, highly legible body face for popups, forms,
// and long-form Thai text.
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "bellydontbully — พิกัดทาสแมว",
  description: "เช็กระดับความปลอดภัยก่อนจกพุงน้องแมว!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0B0B0D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${kanit.variable} ${plexThai.variable}`}>
      <body className="antialiased touch-manipulation font-body">
        {children}
      </body>
    </html>
  );
}