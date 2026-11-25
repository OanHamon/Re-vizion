// Lien pour rejoindre un salon (mis dans le QR code) : adresse du jeu + ?code=XXXX.
// Logique pure, sans navigateur, sauf lanBase() qui interroge la page et le serveur.

/** Paramètre d'URL qui porte le code du salon. */
export const JOIN_PARAM = 'code';
/** Un code de salon : 4 lettres (donné par le serveur de match). */
const CODE_PATTERN = /^[A-Z]{4}$/;
const LOOPBACK = /^(localhost|127\.|\[::1\])/;

/** Adresse complète à ouvrir pour rejoindre : base seule si le code n'existe pas encore (écran 06). */
export function joinUrl(base: string, code?: string): string {
  const url = new URL(base);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  if (code) url.searchParams.set(JOIN_PARAM, code.toUpperCase());
  return url.toString();
}

/** Code lu dans la barre d'adresse (?code=abcd), ou null s'il est absent ou mal formé. */
export function readJoinCode(search: string): string | null {
  const code = new URLSearchParams(search).get(JOIN_PARAM)?.trim().toUpperCase() ?? '';
  return CODE_PATTERN.test(code) ? code : null;
}

/** Vrai si la page est ouverte sur ce PC seulement (localhost) : son adresse ne marche pas sur un autre PC. */
export function isLoopback(host: string): boolean {
  return LOOPBACK.test(host);
}

/**
 * Adresse du jeu pour les autres PC du réseau local : celle de la page si elle est déjà ouverte par le réseau,
 * sinon celle que donne le serveur (null si le jeu n'est pas lancé avec npm run host).
 */
export async function lanBase(): Promise<string | null> {
  if (!isLoopback(location.host)) return location.origin;
  try {
    const res = await fetch('/api/lan', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: unknown };
    return typeof body.url === 'string' ? body.url : null;
  } catch {
    return null;
  }
}
