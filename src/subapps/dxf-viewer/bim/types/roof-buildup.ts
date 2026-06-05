/**
 * BIM Roof DNA — layered build-ups για κεκλιμένη στέγη (ADR-417 Q4).
 *
 * Η στέγη επαναχρησιμοποιεί το entity-agnostic `LayeredBuildup<Z>` SSoT (ίδιο με
 * slab/wall) μέσω του `SlabDna` τύπου — μια στέγη είναι, κατασκευαστικά, μια
 * κεκλιμένη πολυστρωματική πλάκα. Δύο built-in συνθέσεις (ADR-417 Q4):
 *
 *   - **«Μπετονένιο δώμα»** (`concrete`) → reuse `createDefaultRoofBuildup()`
 *     (7 στρώσεις: χαλίκι/μεμβράνη/XPS/φράγμα/ρύσεις/RC core/σοβάς) από το
 *     slab-dna SSoT — μηδέν drift, ίδια σύνθεση με το επίπεδο δώμα.
 *   - **«Κεραμοσκεπή»** (`tiled`) → νέα ελαφριά σύνθεση κεκλιμένης στέγης:
 *     κεραμίδι → πέτσωμα (battens) → στεγανωτική μεμβράνη → θερμομόνωση →
 *     ξύλινο πέτσωμα (sarking) → τεγίδες/RC πλάκα = ξύλινη/μεικτή στέγη.
 *
 * SSoT: `RoofParams.thickness` παράγεται από `SlabDna.totalThickness` όταν
 * υπάρχει dna (μηδέν διπλο-καταχώρηση — ίδιος κανόνας με slab/wall).
 *
 * @see bim/types/slab-dna-types.ts — createDefaultRoofBuildup (concrete δώμα) + LayeredBuildup primitives
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §Q4
 */

import {
  computeSlabTotalThickness,
  createDefaultRoofBuildup,
  type SlabDna,
  type SlabDnaLayer,
} from './slab-dna-types';

/** Stable key της built-in σύνθεσης στέγης (όχι UI label — N.11). */
export type RoofBuildupKey = 'concrete' | 'tiled';

/** Όλα τα built-in roof build-up keys σε σταθερή σειρά (catalog determinism). */
export const ROOF_BUILDUP_KEYS: readonly RoofBuildupKey[] = ['concrete', 'tiled'] as const;

/** Assemble a `SlabDna` from an ordered (top→bottom) layer list. */
function buildup(layers: readonly SlabDnaLayer[]): SlabDna {
  return { layers, totalThickness: computeSlabTotalThickness(layers) };
}

/**
 * Κεραμοσκεπή: κεραμίδι + πέτσωμα + μεμβράνη + θερμομόνωση + sarking + RC πλάκα
 * = 295 mm. Ελαφριά κεκλιμένη στέγη (αντί για το βαρύ μπετονένιο δώμα).
 */
export function createTiledRoofBuildup(): SlabDna {
  return buildup([
    { id: 'roof-tile', name: 'Clay Roof Tile', thickness: 40, materialId: 'mat-roof-tile', zone: 'top' },
    { id: 'roof-batten', name: 'Timber Battens', thickness: 30, materialId: 'mat-wood', zone: 'top' },
    { id: 'roof-membrane', name: 'Breather Membrane', thickness: 5, materialId: 'mat-membrane', zone: 'top' },
    { id: 'roof-thermal', name: 'Thermal Insulation', thickness: 100, materialId: 'mat-insulation', zone: 'top' },
    { id: 'roof-sarking', name: 'Timber Sarking', thickness: 20, materialId: 'mat-wood', zone: 'core' },
    { id: 'roof-deck', name: 'Reinforced Concrete', thickness: 100, materialId: 'mat-concrete', zone: 'core' },
  ]);
}

/** Default roof build-up ανά key (SSoT lookup). */
export function getRoofBuildupForKey(key: RoofBuildupKey): SlabDna {
  switch (key) {
    case 'concrete':
      return createDefaultRoofBuildup();
    case 'tiled':
      return createTiledRoofBuildup();
  }
}
