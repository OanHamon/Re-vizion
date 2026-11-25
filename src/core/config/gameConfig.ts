// Validation de l'ensemble des fichiers config/*.json :
// 1. chaque fichier contre son schéma zod ;
// 2. contrôles croisés (une rareté, une famille, une arme ou un asset cité doit exister).
import type { z } from '../zod';
import { formatPath } from '../zod';
import {
  ArenasConfigSchema,
  AssetsConfigSchema,
  BonusesConfigSchema,
  EconomyConfigSchema,
  ModesConfigSchema,
  MaterialsConfigSchema,
  PickupsConfigSchema,
  PlayerConfigSchema,
  QuizConfigSchema,
  SoundsConfigSchema,
  StatsConfigSchema,
  WeaponsConfigSchema,
  type ArenasConfig,
  type AssetsConfig,
  type BonusesConfig,
  type EconomyConfig,
  type ModesConfig,
  type MaterialsConfig,
  type PickupsConfig,
  type PlayerConfig,
  type QuizConfig,
  type SoundsConfig,
  type StatsConfig,
  type WeaponsConfig,
} from './schemas';

export interface GameConfig {
  quiz: QuizConfig;
  bonuses: BonusesConfig;
  weapons: WeaponsConfig;
  player: PlayerConfig;
  modes: ModesConfig;
  arenas: ArenasConfig;
  assets: AssetsConfig;
  stats: StatsConfig;
  sounds: SoundsConfig;
  economy: EconomyConfig;
  pickups: PickupsConfig;
  materials: MaterialsConfig;
}

/** Contenu brut des fichiers, tel que lu sur le disque (non validé). */
export type RawGameConfig = Record<keyof GameConfig, unknown>;

export type ConfigResult = { ok: true; config: GameConfig } | { ok: false; errors: string[] };

const FILES: Record<keyof GameConfig, { file: string; schema: z.ZodType }> = {
  quiz: { file: 'config/quiz.json', schema: QuizConfigSchema },
  bonuses: { file: 'config/bonuses.json', schema: BonusesConfigSchema },
  weapons: { file: 'config/weapons.json', schema: WeaponsConfigSchema },
  player: { file: 'config/player.json', schema: PlayerConfigSchema },
  modes: { file: 'config/modes.json', schema: ModesConfigSchema },
  arenas: { file: 'config/arenas.json', schema: ArenasConfigSchema },
  assets: { file: 'config/assets.json', schema: AssetsConfigSchema },
  stats: { file: 'config/stats.json', schema: StatsConfigSchema },
  sounds: { file: 'config/sounds.json', schema: SoundsConfigSchema },
  economy: { file: 'config/economy.json', schema: EconomyConfigSchema },
  pickups: { file: 'config/pickups.json', schema: PickupsConfigSchema },
  materials: { file: 'config/materials.json', schema: MaterialsConfigSchema },
};

export function parseGameConfig(raw: RawGameConfig): ConfigResult {
  const errors: string[] = [];
  const parsed: Partial<Record<keyof GameConfig, unknown>> = {};

  for (const key of Object.keys(FILES) as (keyof GameConfig)[]) {
    const { file, schema } = FILES[key];
    const result = schema.safeParse(raw[key]);
    if (result.success) {
      parsed[key] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors.push(`${file} · ${formatPath(issue.path)} : ${issue.message}`);
      }
    }
  }

  // Les contrôles croisés n'ont de sens que si chaque fichier est bien formé.
  if (errors.length > 0) return { ok: false, errors };

  const config = parsed as GameConfig;
  errors.push(...crossCheck(config));
  return errors.length > 0 ? { ok: false, errors } : { ok: true, config };
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}

function crossCheck(c: GameConfig): string[] {
  const errors: string[] = [];
  const err = (file: string, path: string, message: string) => errors.push(`config/${file} · ${path} : ${message}`);

  const rarityIds = new Set(c.quiz.rarities.map((r) => r.id));
  const familyIds = new Set(c.bonuses.families.map((f) => f.id));
  const weaponIds = new Set(c.weapons.weapons.map((w) => w.id));
  const assetIds = new Set(Object.keys(c.assets.assets));

  // --- quiz.json
  for (const id of duplicates(c.quiz.rarities.map((r) => r.id))) err('quiz.json', 'rarities', `rareté « ${id} » définie deux fois`);
  const minCost = Math.min(...c.quiz.rarities.map((r) => r.costSeconds));
  if (!c.quiz.budgetChoicesSeconds.includes(c.quiz.budgetSeconds)) {
    err('quiz.json', 'budgetSeconds', `doit faire partie de budgetChoicesSeconds (${c.quiz.budgetChoicesSeconds.join(', ')})`);
  }
  c.quiz.budgetChoicesSeconds.forEach((s, i) => {
    if (s < minCost) err('quiz.json', `budgetChoicesSeconds[${i}]`, `${s} s ne permet même pas une carte à ${minCost} s`);
  });
  const weightTables = [
    ['draw.normalWeights', c.quiz.draw.normalWeights],
    ['combos.doubleOrNothing.rarityWeights', c.quiz.combos.doubleOrNothing.rarityWeights],
  ] as const;
  for (const [path, weights] of weightTables) {
    for (const id of Object.keys(weights)) {
      if (!rarityIds.has(id)) err('quiz.json', `${path}.${id}`, `rareté inconnue (connues : ${[...rarityIds].join(', ')})`);
    }
    if (!Object.values(weights).some((w) => w > 0)) err('quiz.json', path, 'au moins une rareté doit avoir un poids > 0');
  }

  // --- bonuses.json
  for (const id of duplicates(c.bonuses.families.map((f) => f.id))) err('bonuses.json', 'families', `famille « ${id} » définie deux fois`);
  for (const id of duplicates([...c.bonuses.bonuses, ...c.bonuses.maluses].map((b) => b.id))) {
    err('bonuses.json', 'bonuses/maluses', `identifiant « ${id} » utilisé deux fois`);
  }
  c.bonuses.bonuses.forEach((b, i) => {
    const at = `bonuses[${i}] (${b.id})`;
    if (!familyIds.has(b.family)) err('bonuses.json', `${at}.family`, `famille inconnue « ${b.family} »`);
    if (!rarityIds.has(b.rarity)) err('bonuses.json', `${at}.rarity`, `rareté inconnue « ${b.rarity} »`);
    for (const w of b.weapons) if (!weaponIds.has(w)) err('bonuses.json', `${at}.weapons`, `arme inconnue « ${w} »`);
    if (b.grantsWeapon !== undefined && !weaponIds.has(b.grantsWeapon)) {
      err('bonuses.json', `${at}.grantsWeapon`, `arme inconnue « ${b.grantsWeapon} »`);
    }
    if (b.effects.length === 0 && b.grantsWeapon === undefined) {
      err('bonuses.json', at, 'un bonus doit avoir au moins un effet ou donner une arme (grantsWeapon)');
    }
  });
  c.bonuses.maluses.forEach((m, i) => {
    if (!familyIds.has(m.family)) err('bonuses.json', `maluses[${i}] (${m.id}).family`, `famille inconnue « ${m.family} »`);
  });
  const usedSeverities = new Set([c.quiz.combos.doubleOrNothing.malusSeverity, c.quiz.combos.negative.malusSeverity]);
  for (const severity of usedSeverities) {
    if (!c.bonuses.maluses.some((m) => m.severity === severity)) {
      err('bonuses.json', 'maluses', `aucun malus de gravité « ${severity} », alors que quiz.json en a besoin`);
    }
  }

  // --- weapons.json
  for (const id of duplicates(c.weapons.weapons.map((w) => w.id))) err('weapons.json', 'weapons', `arme « ${id} » définie deux fois`);
  c.weapons.weapons.forEach((w, i) => {
    if (!assetIds.has(w.asset)) err('weapons.json', `weapons[${i}] (${w.id}).asset`, `asset inconnu « ${w.asset} » dans config/assets.json`);
  });

  // --- player.json
  const loadoutSet = new Set(c.player.loadout);
  c.player.loadout.forEach((id, i) => {
    const weapon = c.weapons.weapons.find((w) => w.id === id);
    if (!weapon) err('player.json', `loadout[${i}]`, `arme inconnue « ${id} »`);
    else if (weapon.special) err('player.json', `loadout[${i}]`, `« ${id} » est une arme spéciale, elle ne peut pas être dans le loadout`);
  });
  if (!loadoutSet.has(c.player.defaultWeapon)) err('player.json', 'defaultWeapon', `« ${c.player.defaultWeapon} » doit faire partie du loadout`);
  c.player.characters.forEach((id, i) => {
    if (!assetIds.has(id)) err('player.json', `characters[${i}]`, `asset inconnu « ${id} » dans config/assets.json`);
  });

  // --- modes.json
  for (const id of duplicates(c.modes.modes.map((m) => m.id))) err('modes.json', 'modes', `mode « ${id} » défini deux fois`);
  if (!c.modes.modes.some((m) => m.id === c.modes.defaultMode)) err('modes.json', 'defaultMode', `mode inconnu « ${c.modes.defaultMode} »`);
  const arenaIds = new Set(c.arenas.arenas.map((a) => a.id));
  const { players } = c.modes;
  c.modes.modes.forEach((m, i) => {
    if (m.roundsToWin > m.rounds) err('modes.json', `modes[${i}] (${m.id}).roundsToWin`, 'ne peut pas dépasser « rounds »');
    if (!arenaIds.has(m.arena)) err('modes.json', `modes[${i}] (${m.id}).arena`, `arène inconnue « ${m.arena} » dans config/arenas.json`);
    if (!c.modes.combatChoicesSeconds.includes(m.combatMaxSeconds)) {
      err('modes.json', `modes[${i}] (${m.id}).combatMaxSeconds`, `doit faire partie de combatChoicesSeconds`);
    }
    // une apparition par joueur possible
    const spawns = c.arenas.arenas.find((x) => x.id === m.arena)?.spawns.length ?? 0;
    const most = m.maxPlayers ?? Math.max(...players.choices);
    if (m.id !== 'training' && spawns > 0 && spawns < most) {
      err('arenas.json', `${m.arena}.spawns`, `${spawns} apparitions pour ${most} joueurs possibles en ${m.id}`);
    }
  });
  players.choices.forEach((n, i) => {
    if (n < players.min) err('modes.json', `players.choices[${i}]`, `${n} est sous le minimum (${players.min})`);
  });
  if (!players.choices.includes(players.default)) err('modes.json', 'players.default', 'doit faire partie de players.choices');

  // --- player.json : cohérence du corps
  const { body } = c.player;
  if (body.eyeHeight >= body.height) err('player.json', 'body.eyeHeight', 'doit être plus petit que body.height');
  if (body.headHeight >= body.height) err('player.json', 'body.headHeight', 'doit être plus petit que body.height');

  // --- arenas.json
  for (const id of duplicates(c.arenas.arenas.map((a) => a.id))) err('arenas.json', 'arenas', `arène « ${id} » définie deux fois`);
  c.arenas.arenas.forEach((a, i) => {
    const at = `arenas[${i}] (${a.id})`;
    const [w, d] = a.size;
    const inside = (p: readonly number[]) => Math.abs(p[0]!) <= w / 2 && Math.abs(p[2]!) <= d / 2;
    a.spawns.forEach((s, j) => {
      if (!inside(s.position)) err('arenas.json', `${at}.spawns[${j}].position`, 'hors de l’arène');
    });
    a.targets.forEach((t, j) => {
      if (!inside(t.position)) err('arenas.json', `${at}.targets[${j}].position`, 'hors de l’arène');
    });
    // une carte jouable doit accueillir le plus grand salon possible
    const most = Math.max(...players.choices);
    if (a.selectable && a.spawns.length < most) err('arenas.json', `${at}.spawns`, `${a.spawns.length} apparitions pour ${most} joueurs possibles`);
    if (a.decor !== undefined && !assetIds.has(a.decor)) err('arenas.json', `${at}.decor`, `asset inconnu « ${a.decor} » dans config/assets.json`);
    if (a.look && a.look.fogFar <= a.look.fogNear) err('arenas.json', `${at}.look.fogFar`, 'doit être plus grand que fogNear');
  });
  // --- pickups.json et coffres des arènes
  for (const [key, asset] of [['chests.asset', c.pickups.chests.asset], ['grenade.asset', c.pickups.grenade.asset]] as const) {
    if (!assetIds.has(asset)) err('pickups.json', key, `asset inconnu « ${asset} » dans config/assets.json`);
  }
  if (c.pickups.grenade.startCount > c.pickups.grenade.maxCarried) err('pickups.json', 'grenade.startCount', 'ne peut pas dépasser maxCarried');
  // --- materials.json et éléments cassables
  for (const id of duplicates(c.materials.materials.map((m) => m.id))) err('materials.json', 'materials', `matériau « ${id} » défini deux fois`);
  const materialIds = new Set(c.materials.materials.map((m) => m.id));
  c.arenas.arenas.forEach((a, i) => {
    (a.breakables ?? []).forEach((b, j) => {
      if (!materialIds.has(b.material)) err('arenas.json', `arenas[${i}] (${a.id}).breakables[${j}].material`, `matériau inconnu « ${b.material} » (connus : ${[...materialIds].join(', ')})`);
    });
    if (a.breakableDecor !== undefined && !assetIds.has(a.breakableDecor)) err('arenas.json', `arenas[${i}] (${a.id}).breakableDecor`, `asset inconnu « ${a.breakableDecor} » dans config/assets.json`);
  });
  c.arenas.arenas.forEach((a, i) => {
    const [w, d] = a.size;
    (a.chests ?? []).forEach((ch, j) => {
      if (Math.abs(ch.position[0]) > w / 2 || Math.abs(ch.position[2]) > d / 2) err('arenas.json', `arenas[${i}] (${a.id}).chests[${j}].position`, 'hors de l’arène');
    });
  });

  if (!c.arenas.arenas.some((a) => a.selectable)) err('arenas.json', 'arenas', 'il faut au moins une carte jouable (« selectable »)');

  // --- sounds.json : une couche « noise » n'a pas de fréquence, les autres en ont une
  for (const [id, sound] of Object.entries(c.sounds.sounds)) {
    sound.layers.forEach((l, i) => {
      if (l.wave !== 'noise' && !l.freq) err('sounds.json', `sounds.${id}.layers[${i}].freq`, `obligatoire pour une onde « ${l.wave} »`);
    });
  }
  if (!c.sounds.sounds['shot.default']) err('sounds.json', 'sounds', 'il faut un son « shot.default » (repli des armes sans son propre)');

  return errors;
}
