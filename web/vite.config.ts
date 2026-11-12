import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    react(),
    // Installable app: a manifest, and a service worker that keeps the app's own
    // files so it opens at once (and offline). Map tiles, routing and search
    // always go to the network.
    VitePWA({
      // A new version waits until the app is closed, rather than reloading it mid-use.
      registerType: 'prompt',
      injectRegister: 'script-defer',
      // The icons already match the pre-store patterns below; listing them twice is a Workbox error risk.
      includeManifestIcons: false,
      manifest: {
        name: 'Bike Ottawa Maps',
        short_name: 'Bike Ottawa',
        description: 'Cycling maps for Ottawa–Gatineau: street comfort, winter pathways, routes and more.',
        lang: 'en',
        display: 'standalone',
        theme_color: '#0B6E6E',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webp}'],
        globIgnores: ['tiles/**', 'data/**', 'basemap-assets/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Basemap fonts and icons: kept once fetched, refreshed in the background.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/basemap-assets/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'basemap-assets', expiration: { maxEntries: 500 } },
          },
          {
            // The data date and the collisions: fresh when online, the last copy when not.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/(tiles\/meta\.json|data\/)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'data', expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
