import {defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoupdate',
      manifest: {
        name: 'Safepath',
        short_name: 'Safepath',
        theme_color: '#7c3aed',
        display: 'standalone',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.title\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30},
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {proxy: {'/api': 'http://localhost:3001'}},
  preview: {proxy: {'/api': 'http://localhost:3001'}},
})