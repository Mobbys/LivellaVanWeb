import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/LivellaVanWeb/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Livella camper',
        short_name: 'Livella',
        description: 'Livella per camper: inclinazione e rialzo delle ruote in cm',
        lang: 'it',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0e12',
        theme_color: '#0a0e12',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      // src/core/ è l'unica parte con correttezza dimostrabile: va coperta tutta.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
})
