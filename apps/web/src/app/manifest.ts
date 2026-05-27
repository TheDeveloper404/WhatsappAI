import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'waai.',
    short_name: 'waai.',
    description: 'Asistentul tău AI pentru WhatsApp — răspunde ca tine. chiar când nu ești.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0d0d',
    theme_color: '#0d0d0d',
    orientation: 'portrait',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/icon', sizes: '192x192', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
