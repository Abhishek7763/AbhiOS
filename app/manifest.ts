import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'AbhiOS',
    short_name: 'AbhiOS',
    description:
      "Abhishek's Personal Operating System (AbhiOS): Brain-dump-first, quality-gated goals, duty-aware daily routines, and guilt-free reviews.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0F17',
    theme_color: '#0F766E',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Brain Dump',
        short_name: 'Dump',
        description: 'Instant 5-second thought capture bina kisi commitment ke',
        url: '/?action=capture',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
          },
        ],
      },
      {
        name: 'Aaj (Today)',
        short_name: 'Aaj',
        description: 'Aaj ka daily focus, routines, paani aur tasks',
        url: '/?tab=today',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
          },
        ],
      },
    ],
    // Android Share Target: share text, URLs or notes directly into Goal OS Brain Dump
    share_target: {
      action: '/',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },
  };
}
