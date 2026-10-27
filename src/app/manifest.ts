import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Star Command',
    short_name: 'Star Command',
    description: 'Mission control pribadi: misi hari ini, habit, catatan, dan kalender.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0E14',
    theme_color: '#0B0E14',
    lang: 'id',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    shortcuts: [
      { name: 'Hari Ini', url: '/' },
      { name: 'Habit', url: '/habits' },
      { name: 'Tugas', url: '/tasks' },
    ],
  };
}
