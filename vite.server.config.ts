import { defineConfig } from 'vite';

/** Build du serveur de match autonome : un seul fichier Node (config JSON incluse), `ws` reste une dépendance. */
export default defineConfig({
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'server.js' } },
  },
});
