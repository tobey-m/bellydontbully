import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BELLY DON'T BULLY",
    short_name: 'BellyDontBully',
    description: 'แผนที่เหมียวน่ารักๆ น่าจกพุง',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0B0D',
    theme_color: '#0B0B0D',
    lang: 'th',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
