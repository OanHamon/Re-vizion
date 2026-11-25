// Inventaire des bonus gagnés (et des malus subis) pendant la phase quiz.
// Le combat lira cet inventaire pour appliquer les effets.
import type { BonusDef, Effect, MalusDef, MalusSeverity } from '../config/schemas';

export interface InventoryEntry {
  kind: 'bonus' | 'malus';
  defId: string;
  label: string;
  icon: string;
  family: string;
  /** Rareté (bonus uniquement). */
  rarity: string | null;
  /** Gravité (malus uniquement). */
  severity: MalusSeverity | null;
  durationSeconds: number | null;
  effects: readonly Effect[];
  grantsWeapon: string | null;
  /** Numéro de la question qui l'a donné. */
  turn: number;
}

export class Inventory {
  private readonly entries: InventoryEntry[] = [];

  addBonus(def: BonusDef, turn: number): InventoryEntry {
    const entry: InventoryEntry = {
      kind: 'bonus',
      defId: def.id,
      label: def.label,
      icon: def.icon,
      family: def.family,
      rarity: def.rarity,
      severity: null,
      durationSeconds: def.durationSeconds,
      effects: def.effects,
      grantsWeapon: def.grantsWeapon ?? null,
      turn,
    };
    this.entries.push(entry);
    return entry;
  }

  addMalus(def: MalusDef, turn: number): InventoryEntry {
    const entry: InventoryEntry = {
      kind: 'malus',
      defId: def.id,
      label: def.label,
      icon: def.icon,
      family: def.family,
      rarity: null,
      severity: def.severity,
      durationSeconds: def.durationSeconds,
      effects: def.effects,
      grantsWeapon: null,
      turn,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Tout, dans l'ordre d'obtention. */
  all(): readonly InventoryEntry[] {
    return this.entries;
  }

  bonuses(): InventoryEntry[] {
    return this.entries.filter((e) => e.kind === 'bonus');
  }

  maluses(): InventoryEntry[] {
    return this.entries.filter((e) => e.kind === 'malus');
  }

  ownedBonusIds(): Set<string> {
    return new Set(this.bonuses().map((e) => e.defId));
  }

  /** Armes spéciales obtenues (bonus Légendaires de la famille Arme). */
  grantedWeapons(): string[] {
    return this.entries.flatMap((e) => (e.grantsWeapon ? [e.grantsWeapon] : []));
  }
}
