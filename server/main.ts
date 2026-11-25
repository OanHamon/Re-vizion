// Serveur de match autonome, sans Vite : pour un hébergeur (Render) ou un PC.
// Le jeu (client) est servi ailleurs (itch.io, npm run dev) et se connecte en WebSocket sur /ws.
// Usage : npm run server   (construit puis lance, port 8787 par défaut, ou PORT=xxxx)
import { createServer } from 'node:http';
import { attachMatchServer, MATCH_PATH } from './attach';

/** Port par défaut hors hébergeur (Render fournit le sien dans PORT). */
const DEFAULT_PORT = 8787;
const port = Number(process.env.PORT) || DEFAULT_PORT;

const http = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  // /health : vérifié par l'hébergeur, et appelé par le client pour réveiller un serveur endormi
  if (path === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' });
    res.end('ok');
    return;
  }
  res.writeHead(path === '/' ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(path === '/' ? `Réviz Arena · serveur de match · WebSocket sur ${MATCH_PATH}` : 'introuvable');
});

attachMatchServer(http, { exclusive: true });

http.listen(port, () => console.log(`[match] serveur autonome à l'écoute sur le port ${port}`));

// arrêt propre (redémarrage de l'hébergeur, Ctrl+C)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    http.close();
    process.exit(0);
  });
}
