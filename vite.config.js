import { defineConfig } from 'vite';

export default defineConfig({
  // The reference has its own CDN import map; it is not an application entry.
  optimizeDeps: { entries: ['index.html'] },
  build: { rollupOptions: { input: ['index.html', 'vehicle-review.html', 'asset-library.html'] } },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, watch: { ignored: ['**/artifacts/**'] } },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
