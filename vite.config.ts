import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// A simple plugin to simulate vercel API locally
const vercelApiPlugin = () => ({
  name: 'vercel-api-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url?.startsWith('/api/')) {
        try {
          const buffers = [];
          for await (const chunk of req) buffers.push(chunk);
          const bodyStr = Buffer.concat(buffers).toString();
          req.rawBody = bodyStr;
          req.body = bodyStr ? JSON.parse(bodyStr) : {};
          
          // Since it's a Vercel-like handler, polyfill res.status and res.json
          res.status = (code: number) => { res.statusCode = code; return res; };
          res.json = (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };

          const urlPath = req.url.split('?')[0];
          const apiModule = await server.ssrLoadModule(`.${urlPath}.ts`);
          await apiModule.default(req, res);
        } catch (err: any) {
          console.error('API Error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      } else {
        next();
      }
    });
  }
});

export default defineConfig(({mode}) => {
  return {
    plugins: [
      react(), 
      tailwindcss(), 
      vercelApiPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Photofacto',
          short_name: 'Photofacto',
          description: 'Facturation intelligente pour artisans',
          start_url: '/app',
          scope: '/',
          lang: 'fr',
          categories: ['business', 'finance', 'productivity'],
          theme_color: '#E8621A',
          background_color: '#FFFFFF',
          display: 'standalone',
          orientation: 'portrait-primary',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Nouveau document',
              short_name: 'Créer',
              description: 'Créer une facture ou un devis',
              url: '/app/invoices/new',
              icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Documents',
              short_name: 'Docs',
              description: 'Voir les factures et devis',
              url: '/app/invoices',
              icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
          // Critical: clean up old chunks on each deploy + activate new SW immediately.
          // Without these, users hit "text/html is not a valid JavaScript MIME type"
          // when the SW tries to serve a stale lazy-chunk path that no longer exists.
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          // Don't cache navigation requests for /app/* via the SW — let the network handle
          // them so users always get the latest index.html (with fresh chunk hashes).
          navigateFallback: null,
          // Cache Firestore calls if possible or handle offline manually via Firebase
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split heavy libs into separate chunks
            'vendor-pdf': ['jspdf', 'jspdf-autotable', 'pdf-lib'],
            'vendor-xlsx': ['xlsx'],
            'vendor-html2canvas': ['html2canvas'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
