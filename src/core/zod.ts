// Point d'entrée unique de zod : active les messages d'erreur en français
// avant que le moindre schéma ne soit utilisé.
import { z } from 'zod';

z.config(z.locales.fr());

export { z };

/** Formate un chemin zod (["rarities", 1, "costSeconds"]) en « rarities[1].costSeconds ». */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const key of path) {
    if (typeof key === 'number') out += `[${key}]`;
    else out += out === '' ? String(key) : `.${String(key)}`;
  }
  return out === '' ? '(racine)' : out;
}
