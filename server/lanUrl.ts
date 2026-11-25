// Adresse réseau local du jeu, pour l'afficher (et la mettre en QR code) sur l'écran de l'hôte.
// Vite liste les adresses « Network » seulement quand il est lancé avec --host (npm run host).
// Un PC a souvent des cartes réseau virtuelles (VirtualBox, VMware, WSL) : on garde celle de la route par défaut,
// c'est-à-dire la vraie carte wifi ou Ethernet.
import { createSocket } from 'node:dgram';

/** Route qui renvoie { url } (adresse réseau local) ou { url: null } si le jeu n'est pas ouvert au réseau. */
export const LAN_PATH = '/api/lan';

/** Rang d'une adresse : les réseaux domestiques et d'école d'abord, les interfaces virtuelles (WSL, Docker) après. */
function rank(url: string): number {
  const host = hostOf(url);
  if (host === null) return 99;
  if (host.startsWith('192.168.56.')) return 4; // VirtualBox, réseau privé hôte
  if (host.startsWith('192.168.')) return 0;
  if (host.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return 2;
  if (host.startsWith('169.254.') || host.includes(':')) return 9;
  return 3;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Choisit l'adresse la plus probable pour les autres PC du même réseau, sans « / » final :
 * celle de la carte de la route par défaut si elle est dans la liste, sinon la mieux classée.
 */
export function pickLanUrl(networkUrls: readonly string[] | undefined, defaultRouteIp: string | null = null): string | null {
  const urls = networkUrls ?? [];
  const best = urls.find((u) => defaultRouteIp !== null && hostOf(u) === defaultRouteIp) ?? [...urls].sort((a, b) => rank(a) - rank(b))[0];
  return best && rank(best) < 9 ? best.replace(/\/+$/, '') : null;
}

/**
 * Adresse IPv4 locale de la carte qui porte la route par défaut. Une socket UDP « connectée » n'envoie aucun paquet :
 * le système choisit seulement la carte de sortie. null si aucune route (PC hors réseau).
 */
export function defaultRouteIp(): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    const done = (ip: string | null) => {
      socket.close();
      resolve(ip);
    };
    socket.on('error', () => done(null));
    socket.connect(53, '192.0.2.1', () => {
      try {
        done(socket.address().address);
      } catch {
        done(null);
      }
    });
  });
}

type Next = () => void;
type Middleware = (req: { url?: string }, res: import('node:http').ServerResponse, next: Next) => void;

/** Middleware Vite : répond sur LAN_PATH avec l'adresse réseau local. */
export function lanMiddleware(networkUrls: () => readonly string[] | undefined): Middleware {
  return (req, res, next) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== LAN_PATH) return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    void defaultRouteIp().then((ip) => res.end(JSON.stringify({ url: pickLanUrl(networkUrls(), ip) })));
  };
}
