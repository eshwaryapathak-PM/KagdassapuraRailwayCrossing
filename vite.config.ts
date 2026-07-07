import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/KagdassapuraRailwayCrossing/',
  plugins: [
    react(),
    tailwindcss(),
    // The service worker was caching the app shell so aggressively that mobile
    // devices kept running an old build (which fetched data cross-site and
    // failed with "Load failed"). `selfDestroying` ships a SW that unregisters
    // any previously-installed service worker and clears its caches, turning the
    // app back into a plain always-fresh website. Data reliability now comes from
    // the same-origin fetch in src/lib/config.ts, not from a cache.
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
    }),
  ],
})
