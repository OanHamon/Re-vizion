// Schémas zod des fichiers config/*.json.
// Ils décrivent la FORME des données ; aucune valeur de gameplay n'est écrite ici.
import { z } from '../zod';
import { DIFFICULTY_MAX, DIFFICULTY_MIN } from '../deck/deckSchema';

const Id = z.string().regex(/^[a-z0-9_]+$/, 'identifiant attendu : minuscules, chiffres et _ uniquement');
const Label = z.string().min(1);
const Weights = z.record(z.string(), z.number().min(0));
const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const MALUS_SEVERITIES = ['heavy', 'light'] as const;
const Severity = z.enum(MALUS_SEVERITIES);

/** Statistiques qu'un bonus ou un malus peut modifier (lues par le combat, plus tard). */
export const STATS = [
  'damage',
  'magazineSize',
  'headshotMultiplier',
  'laserSight',
  'armorPiercing',
  'lifesteal',
  'shield',
  'headshotDamageTaken',
  'damageTaken',
  'healthRegen',
  'maxHealth',
  'moveSpeed',
  'jumpHeight',
  'airControl',
  'dashCharges',
  'extraJumps',
  'reloadTime',
  'spread',
  'fireRate',
  'recoil',
  'damageFalloff',
  'zoom',
  'pellets',
] as const;

// ---------- quiz.json ----------

export const RaritySchema = z.strictObject({
  id: Id,
  label: Label,
  difficulties: z.array(z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX)).min(1),
  costSeconds: z.number().positive(),
});

export const QuizConfigSchema = z.strictObject({
  /** Durée par défaut de la phase quiz. */
  budgetSeconds: z.number().positive(),
  /** Durées proposées au joueur sur l'accueil (doit contenir la durée par défaut). */
  budgetChoicesSeconds: z.array(z.number().positive()).min(1),
  /** Nombres max de questions par phase quiz proposés à l'hôte (0 = sans limite, borné par le temps seul). */
  maxQuestionsChoices: z.array(z.number().int().min(0)).min(1),
  /** Questions max de la phase en cours (0 = sans limite) ; posé par les réglages du salon, absent du fichier. */
  maxQuestions: z.number().int().min(0).optional(),
  cardsPerTurn: z.number().int().min(1),
  /** Compte à rebours affiché sur le retour de la dernière question, avant la fin de la phase quiz. */
  endCountdownSeconds: z.number().min(0),
  rarities: z.array(RaritySchema).min(1),
  draw: z.strictObject({
    normalWeights: Weights,
    preferDistinctFamilies: z.boolean(),
    excludeOwnedBonuses: z.boolean(),
  }),
  combos: z.strictObject({
    doubleOrNothing: z.strictObject({
      correctStreak: z.number().int().min(1),
      rarityWeights: Weights,
      malusSeverity: Severity,
    }),
    negative: z.strictObject({
      wrongStreak: z.number().int().min(1),
      malusSeverity: Severity,
    }),
  }),
});

// ---------- bonuses.json ----------

export const EffectSchema = z.strictObject({
  stat: z.enum(STATS),
  op: z.enum(['add', 'mul', 'set']),
  value: z.number(),
});

export const BonusSchema = z.strictObject({
  id: Id,
  family: Id,
  rarity: Id,
  label: Label,
  icon: Id,
  /** null = actif pendant toute la manche. */
  durationSeconds: z.number().positive().nullable(),
  /** Armes équipées concernées ; vide = toutes. */
  weapons: z.array(Id),
  /** Arme spéciale donnée par le bonus (Légendaires). */
  grantsWeapon: Id.optional(),
  effects: z.array(EffectSchema),
});

export const MalusSchema = z.strictObject({
  id: Id,
  family: Id,
  severity: Severity,
  label: Label,
  icon: Id,
  durationSeconds: z.number().positive().nullable(),
  effects: z.array(EffectSchema).min(1),
});

export const BonusesConfigSchema = z.strictObject({
  families: z.array(z.strictObject({ id: Id, label: Label })).min(1),
  bonuses: z.array(BonusSchema).min(1),
  maluses: z.array(MalusSchema),
});

// ---------- weapons.json ----------

export const WeaponSchema = z.strictObject({
  id: Id,
  label: Label,
  /** true = arme spéciale, obtenue seulement par un bonus Légendaire. */
  special: z.boolean(),
  damagePerShot: z.number().positive(),
  pellets: z.number().int().min(1),
  fireRate: z.number().positive(),
  magazineSize: z.number().int().min(1),
  headshotMultiplier: z.number().min(1),
  reloadSeconds: z.number().positive(),
  /** true = tir en continu tant que le bouton est enfoncé. */
  automatic: z.boolean(),
  /** Demi-angle du cône de dispersion, en degrés. */
  spreadDeg: z.number().min(0),
  /** Recul vertical : par tir, en plus par tir enchaîné, plafond, retour au repos. */
  recoil: z.strictObject({
    kickDeg: z.number().min(0),
    rampDeg: z.number().min(0),
    maxDeg: z.number().min(0),
    recoverDegPerSec: z.number().positive(),
  }),
  /** Portée max d'un tir, en mètres. */
  range: z.number().positive(),
  /** Perte de dégâts avec la distance (null = aucune). */
  falloff: z
    .strictObject({
      startMeters: z.number().min(0),
      endMeters: z.number().positive(),
      minFactor: z.number().min(0).max(1),
    })
    .nullable(),
  /** Grossissement en visant (1 = aucun). */
  zoom: z.number().min(1),
  /** Rayon des dégâts de zone à l'impact (0 = aucun). */
  splashRadius: z.number().min(0),
  traits: z.array(Id),
  description: Label,
  asset: z.string().min(1),
});

export const WeaponsConfigSchema = z.strictObject({
  weapons: z.array(WeaponSchema).min(1),
});

// ---------- player.json ----------

export const PlayerConfigSchema = z.strictObject({
  maxHealth: z.number().int().positive(),
  livesPerRound: z.number().int().min(1),
  defaultWeapon: Id,
  loadout: z.array(Id).min(1),
  /** Modèles des personnages (ids de config/assets.json), attribués aux joueurs à tour de rôle selon leur couleur. */
  characters: z.array(z.string().min(1)).min(1),
  /** Corps du joueur (et des cibles) : boîte de collision et zones de tir, en mètres. */
  body: z.strictObject({
    height: z.number().positive(),
    radius: z.number().positive(),
    eyeHeight: z.number().positive(),
    headHeight: z.number().positive(),
  }),
  /** Déplacement : vitesses en m/s, accélérations en m/s². */
  movement: z.strictObject({
    walkSpeed: z.number().positive(),
    groundAcceleration: z.number().positive(),
    airAcceleration: z.number().min(0),
    jumpVelocity: z.number().positive(),
    gravity: z.number().positive(),
    aimSpeedFactor: z.number().positive().max(1),
    dashSpeed: z.number().positive(),
    dashSeconds: z.number().positive(),
    dashCooldownSeconds: z.number().positive(),
    /** Hauteur d'une marche franchie sans sauter, en marchant au sol (escaliers, reliefs). 0 = jamais. */
    stepHeight: z.number().min(0),
  }),
  controls: z.strictObject({
    mouseSensitivity: z.number().positive(),
  }),
});

// ---------- modes.json ----------

export const ModeSchema = z.strictObject({
  id: Id,
  label: Label,
  rounds: z.number().int().min(1),
  roundsToWin: z.number().int().min(1),
  quizBeforeEachRound: z.boolean(),
  respawn: z.boolean(),
  winCondition: z.enum(['last_alive', 'most_kills']),
  combatMaxSeconds: z.number().positive(),
  editable: z.boolean(),
  /** Arène par défaut du combat (config/arenas.json) ; l'hôte peut en choisir une autre parmi les cartes jouables. */
  arena: Id,
  /** Vies par manche (0 = illimitées, avec réapparition). */
  lives: z.number().int().min(0),
  /** Nombre de joueurs imposé par le mode (ex. 2 en Duel) ; absent = au choix de l'hôte. */
  maxPlayers: z.number().int().min(2).optional(),
});

export const ModesConfigSchema = z.strictObject({
  defaultMode: Id,
  /** Durées de combat proposées à l'hôte (écran 06). 0 = sans limite de temps, permis seulement avec des vies limitées. */
  combatChoicesSeconds: z.array(z.number().min(0)).min(1),
  /** Taille du salon : il faut au moins `min` joueurs pour lancer ; l'hôte choisit le maximum parmi `choices`. */
  players: z.strictObject({
    min: z.number().int().min(2),
    choices: z.array(z.number().int().min(2)).min(1),
    default: z.number().int().min(2),
  }),
  /** Choix du mode Personnalisé (écran 06) ; vies 0 = illimitées. */
  custom: z.strictObject({
    roundsChoices: z.array(z.number().int().min(1).max(9)).min(1),
    livesChoices: z.array(z.number().int().min(0).max(9)).min(1),
  }),
  /** Compte à rebours de l'écran 10 avant le combat. */
  countdownSeconds: z.number().min(0),
  /** Durée de l'écran 12 entre deux manches. */
  roundEndSeconds: z.number().min(0),
  /** Délai de réapparition (modes avec réapparition). */
  respawnSeconds: z.number().min(0),
  modes: z.array(ModeSchema).min(1),
});

// ---------- arenas.json ----------

const PositiveVec3 = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]);

export const ArenaSchema = z.strictObject({
  id: Id,
  label: Label,
  /** Largeur (x) et profondeur (z) du sol, centré sur l'origine. */
  size: z.tuple([z.number().positive(), z.number().positive()]),
  wallHeight: z.number().positive(),
  /** Points d'apparition : le 1er sert en solo, un par joueur en match (dans l'ordre des couleurs). */
  spawns: z.array(z.strictObject({ position: Vec3, yawDeg: z.number() })).min(1),
  targetHealth: z.number().positive(),
  targetRespawnSeconds: z.number().min(0),
  /** Proposée à l'hôte dans le choix de la carte (écran 06). */
  selectable: z.boolean().optional(),
  /** Famille de la carte, affichée dans le choix (ex. « Ville »). */
  kind: Label.optional(),
  /** Une ligne de description, affichée dans le choix de la carte. */
  tagline: Label.optional(),
  /** Nombre de joueurs conseillé [min, max]. */
  recommendedPlayers: z.tuple([z.number().int().min(1), z.number().int().min(1)]).optional(),
  /**
   * Décor voxel (id de config/assets.json). S'il est donné, il remplace le sol, les murs et les blocs dessinés :
   * les blocs ne servent plus qu'aux collisions.
   */
  decor: z.string().regex(/^[a-z0-9_.]+$/, 'id d’asset attendu').optional(),
  /** Ambiance : les couleurs viennent des variables --map-<theme>-* du thème CSS, les intensités d'ici. */
  look: z
    .strictObject({
      theme: Id,
      sun: z.number().min(0),
      hemisphere: z.number().min(0),
      shadows: z.boolean(),
      fogNear: z.number().positive(),
      fogFar: z.number().positive(),
    })
    .optional(),
  /** Blocs : position = centre de la face du bas (x, y, z), taille (largeur, hauteur, profondeur), couleur = n° de --scene-block-N. */
  blocks: z.array(z.strictObject({ position: Vec3, size: PositiveVec3, color: z.number().int().min(1) })),
  /**
   * Éléments cassables (config/materials.json) : boîte comme un bloc (centre de la face du bas, taille),
   * découpée en morceaux à la création du combat. `color` = n° de --scene-block-N (arènes sans décor voxel).
   */
  breakables: z
    .array(z.strictObject({ material: Id, position: Vec3, size: PositiveVec3, color: z.number().int().min(1).optional() }))
    .optional(),
  /** Voxels des éléments cassables (id de config/assets.json), dessinés à part du décor. */
  breakableDecor: z.string().regex(/^[a-z0-9_.]+$/, 'id d’asset attendu').optional(),
  /** Coffres à grenades : position du pied du coffre (config/pickups.json pour les règles). */
  chests: z.array(z.strictObject({ position: Vec3, yawDeg: z.number() })).optional(),
  /** Cibles d'entraînement : position des pieds ; option de va-et-vient sur un axe. */
  targets: z.array(
    z.strictObject({
      position: Vec3,
      yawDeg: z.number(),
      moving: z
        .strictObject({ axis: z.enum(['x', 'z']), distance: z.number().positive(), speed: z.number().positive() })
        .nullable(),
    }),
  ),
});

export const ArenasConfigSchema = z.strictObject({
  arenas: z.array(ArenaSchema).min(1),
});

// ---------- assets.json ----------

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur attendue au format #rrggbb');

export const AssetSchema = z
  .strictObject({
    /** Chemin d'un modèle GLB (relatif à assets/). */
    glb: z.string().min(1).optional(),
    /** Forme de base générée en code, pour le prototype. */
    primitive: z
      .strictObject({
        shape: z.enum(['box', 'cylinder', 'sphere', 'capsule']),
        size: Vec3,
      })
      .optional(),
    /** Modèle voxel MagicaVoxel (.vox, relatif à assets/). */
    voxel: z
      .strictObject({
        path: z.string().regex(/\.vox$/, 'chemin d’un fichier .vox attendu'),
        /** Taille d'un voxel en mètres. */
        voxelSize: z.number().positive(),
        /** Couleurs du modèle rendues lumineuses (non ombrées). */
        glow: z.array(HexColor),
        /** Couleurs « marqueurs » remplacées par la couleur du joueur : claire, puis foncée (personnages). */
        tint: z.array(HexColor).max(2).optional(),
      })
      .optional(),
    /** Parties animées (personnages) : boîte de voxels (bornes incluses) et pivot, en voxels. Le reste forme le tronc. */
    parts: z
      .record(
        z.string().min(1),
        z.strictObject({
          min: Vec3,
          max: Vec3,
          pivot: Vec3,
        }),
      )
      .optional(),
    scale: z.number().positive(),
    /** Rotation en degrés (x, y, z). */
    rotation: Vec3,
    /** Point de prise en main, dans le repère du modèle (en voxels pour un modèle voxel). */
    grip: Vec3,
    /** Bout du canon (armes), même repère que grip : départ du flash, des traçantes et du laser. */
    muzzle: Vec3.optional(),
    /** Point de visée (guidon ou lunette), même repère : placé au centre de l'écran quand on vise. */
    sight: Vec3.optional(),
  })
  .refine((a) => [a.glb, a.primitive, a.voxel].filter((v) => v !== undefined).length === 1, {
    message: 'un asset doit avoir exactement une source : « glb », « primitive » ou « voxel »',
  })
  .refine((a) => a.parts === undefined || a.voxel !== undefined, {
    message: 'les parties animées (« parts ») ne sont possibles que pour un modèle voxel',
  });

export const AssetsConfigSchema = z.strictObject({
  assets: z.record(z.string().min(1), AssetSchema),
});

// ---------- types déduits ----------

// ---------- economy.json (pièces gagnées en fin de partie) ----------

const CoinRule = z.strictObject({ label: Label, coins: z.number().min(0) });

export const EconomyConfigSchema = z.strictObject({
  /** Nom de la monnaie affiché (« pièces »). */
  currencyLabel: Label,
  /** Gains d'un match, calculés sur les stats de combat seulement (pas sur le quiz). */
  match: z.strictObject({
    /** Pour avoir joué le match jusqu'au bout. */
    participation: CoinRule,
    kill: CoinRule,
    /** En plus du kill, si le coup fatal est à la tête. */
    headshotKill: CoinRule,
    /** `coins` pièces par tranche de `per` dégâts infligés. */
    damage: CoinRule.extend({ per: z.number().positive() }),
    roundWin: CoinRule,
    matchWin: CoinRule,
    /** Précision (tirs touchés ÷ tirs) × `coins`, à partir de `minShots` tirs. */
    accuracy: CoinRule.extend({ minShots: z.number().int().min(1) }),
  }),
  /** Plafond des pièces d'un match. */
  maxPerMatch: z.number().int().positive(),
});

// ---------- pickups.json (coffres et grenades, pendant le combat) ----------

export const PickupsConfigSchema = z.strictObject({
  chests: z.strictObject({
    label: Label,
    /** Modèle du coffre (id de config/assets.json). */
    asset: z.string().min(1),
    /** Distance max (m) entre le joueur et le coffre pour l'ouvrir. */
    openRadius: z.number().positive(),
    /** Difficultés des questions, par ordre de préférence ; à défaut, la difficulté restante la plus proche. */
    questionDifficulties: z.array(z.number().int().min(DIFFICULTY_MIN).max(DIFFICULTY_MAX)).min(1),
    /** Temps pour répondre. */
    answerSeconds: z.number().positive(),
    /** Coffre bloqué pour tout le monde après une erreur (ou temps écoulé, ou mort pendant la question). */
    lockSecondsOnFail: z.number().min(0),
    /** Coffre refermé pour tout le monde après une bonne réponse. */
    lockSecondsOnSuccess: z.number().min(0),
    /** Durée d'affichage de la correction sur le HUD. */
    feedbackSeconds: z.number().min(0),
    reward: z.strictObject({ grenades: z.number().int().min(1) }),
  }),
  grenade: z.strictObject({
    label: Label,
    asset: z.string().min(1),
    /** Grenades au début de chaque manche. */
    startCount: z.number().int().min(0),
    maxCarried: z.number().int().min(1),
    throwCooldownSeconds: z.number().min(0),
    /** Vitesse de lancer dans l'axe du regard (m/s), plus une poussée vers le haut. */
    throwSpeed: z.number().positive(),
    throwUpBoost: z.number().min(0),
    gravity: z.number().positive(),
    /** Rayon de la grenade pour les rebonds (m). */
    radius: z.number().positive(),
    /** Part de la vitesse gardée à chaque rebond (perpendiculaire), et le long de la surface. */
    bounce: z.number().min(0).max(1),
    friction: z.number().min(0).max(1),
    fuseSeconds: z.number().positive(),
    /** Dégâts au centre de l'explosion, qui baissent jusqu'à minFactor × damage au bord du rayon. */
    damage: z.number().positive(),
    blastRadius: z.number().positive(),
    minFactor: z.number().min(0).max(1),
    /** Part des dégâts subis par le lanceur dans sa propre explosion. */
    selfDamageFactor: z.number().min(0).max(1),
  }),
});

// ---------- materials.json (destruction limitée du décor) ----------

export const MaterialsConfigSchema = z.strictObject({
  /** Taille (m) des morceaux d'un élément cassable : chacun a ses propres PV. */
  cellSize: z.number().positive(),
  materials: z
    .array(
      z.strictObject({
        id: Id,
        label: Label,
        /** PV d'un morceau. */
        health: z.number().positive(),
        /** Part des dégâts d'une balle (0 = insensible). */
        bulletFactor: z.number().min(0),
        /** Part des dégâts d'une explosion. */
        blastFactor: z.number().min(0),
      }),
    )
    .min(1),
});

// ---------- stats.json (hexagone de l'écran 14) ----------

/** Axes connus du code ; l'ordre et les libellés viennent de config/stats.json. */
export const STAT_AXES = ['knowledge', 'boldness', 'speed', 'accuracy', 'aggression', 'consistency'] as const;

export const StatsConfigSchema = z.strictObject({
  /** Valeur max d'un axe (0 à scale). */
  scale: z.number().positive(),
  /** Bornes de difficulté pour l'Audace. */
  difficultyRange: z.tuple([z.number(), z.number()]).refine(([min, max]) => max > min, 'le max doit dépasser le min'),
  /** Part de vitesse d'une question au temps écoulé (0 à 1). */
  timedOutSpeed: z.number().min(0).max(1),
  /** Axes dans l'ordre d'affichage (sens horaire, en partant du haut). */
  axes: z
    .array(z.strictObject({ id: z.enum(STAT_AXES), label: Label, formula: z.string() }))
    .min(3)
    .refine((axes) => new Set(axes.map((a) => a.id)).size === axes.length, 'un axe apparaît deux fois'),
  /** Petite note sous le tableau des valeurs. */
  note: z.string(),
});

// ---------- sounds.json (sons synthétisés par le navigateur) ----------

const FreqRange = z.tuple([z.number().positive(), z.number().positive()]);

export const SoundLayerSchema = z.strictObject({
  /** Forme d'onde ; « noise » = bruit blanc (souffles, tirs), à colorer avec un filtre. */
  wave: z.enum(['sine', 'triangle', 'square', 'sawtooth', 'noise']),
  /** Fréquence de départ et d'arrivée (Hz), glissement exponentiel. Ignorée pour « noise ». */
  freq: FreqRange.optional(),
  /** Durée de la couche (s), montée comprise. */
  duration: z.number().positive().max(5),
  /** Montée du volume (s). */
  attack: z.number().min(0).max(2).default(0.005),
  gain: z.number().min(0).max(1),
  /** Décalage par rapport au début du son (s). */
  delay: z.number().min(0).max(5).default(0),
  filter: z
    .strictObject({
      type: z.enum(['lowpass', 'highpass', 'bandpass']),
      freq: FreqRange,
      q: z.number().positive().default(1),
    })
    .optional(),
});

export const SoundSchema = z.strictObject({
  volume: z.number().min(0).max(1),
  /** Variation aléatoire de hauteur à chaque lecture (0,05 = ±5 %), pour éviter l'effet mitraillette. */
  pitchJitter: z.number().min(0).max(0.5).default(0),
  /** Écart minimal entre deux lectures du même son (ms). */
  cooldownMs: z.number().min(0).default(0),
  layers: z.array(SoundLayerSchema).min(1),
});

export const SoundsConfigSchema = z.strictObject({
  /** Volume général par défaut (le joueur le règle ensuite dans Paramètres). */
  masterVolume: z.number().min(0).max(1),
  sounds: z.record(z.string().min(1), SoundSchema),
});

export type Rarity = z.infer<typeof RaritySchema>;
export type QuizConfig = z.infer<typeof QuizConfigSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type BonusDef = z.infer<typeof BonusSchema>;
export type MalusDef = z.infer<typeof MalusSchema>;
export type MalusSeverity = (typeof MALUS_SEVERITIES)[number];
export type BonusesConfig = z.infer<typeof BonusesConfigSchema>;
export type Weapon = z.infer<typeof WeaponSchema>;
export type WeaponsConfig = z.infer<typeof WeaponsConfigSchema>;
export type PlayerConfig = z.infer<typeof PlayerConfigSchema>;
export type Mode = z.infer<typeof ModeSchema>;
export type ModesConfig = z.infer<typeof ModesConfigSchema>;
export type Arena = z.infer<typeof ArenaSchema>;
export type ArenasConfig = z.infer<typeof ArenasConfigSchema>;
export type StatName = (typeof STATS)[number];
export type AssetDef = z.infer<typeof AssetSchema>;
export type AssetsConfig = z.infer<typeof AssetsConfigSchema>;
export type StatsConfig = z.infer<typeof StatsConfigSchema>;
export type EconomyConfig = z.infer<typeof EconomyConfigSchema>;
export type PickupsConfig = z.infer<typeof PickupsConfigSchema>;
export type MaterialsConfig = z.infer<typeof MaterialsConfigSchema>;
export type SoundDef = z.infer<typeof SoundSchema>;
export type SoundLayer = z.infer<typeof SoundLayerSchema>;
export type SoundsConfig = z.infer<typeof SoundsConfigSchema>;
export type StatAxis = (typeof STAT_AXES)[number];
