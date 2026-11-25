import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { attachMatchServer } from './server/attach';
import { lanMiddleware } from './server/lanUrl';

/** Serveur de match (WebSocket) et adresse réseau local (/api/lan) sur le même port que le jeu, en dev comme en preview. */
function matchServer(): Plugin {
  return {
    name: 'reviz-match-server',
    configureServer(server) {
      server.middlewares.use(lanMiddleware(() => server.resolvedUrls?.network));
      if (server.httpServer) attachMatchServer(server.httpServer as import('node:http').Server);
    },
    configurePreviewServer(server) {
      server.middlewares.use(lanMiddleware(() => server.resolvedUrls?.network));
      attachMatchServer(server.httpServer as import('node:http').Server);
    },
  };
}

export default defineConfig({
  plugins: [matchServer()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
