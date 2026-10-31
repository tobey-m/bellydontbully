import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'bellydontbully',
    short_name: 'bellydontbully',
    description: 'same cats. stranger humans. — a cat spotting community',
    id: '/',
    start_url: '/',
    scope: '/',
    orientation: 'portrait-primary',
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
