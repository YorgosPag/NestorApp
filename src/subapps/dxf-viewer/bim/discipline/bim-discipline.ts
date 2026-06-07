/**
 * ADR-405 — BIM Discipline Taxonomy SSoT (Step 1).
 *
 * Canonical source of truth for the **Discipline** dimension — the top tier of
 * the BIM classification hierarchy (above Category, above Type), aligned with
 * Revit/ArchiCAD/IFC "Discipline":
 *
 *   Discipline → Category (BimCategory) → Type → Instance (BaseEntity)
 *
 * This module owns the `Discipline` union. `types/scene-types.ts` re-exports it
 * as `AecLayerCategory` (alias) so the ADR-358 layer-level taxonomy and the
 * entity-level discipline share ONE truth (zero churn for the 13 ADR-358
 * consumers).
 *
 * Annotation separation (Revit "Model vs Annotation Categories"): the helper
 * categories `dimension`/`hatch`/`grip` are not model elements → they map to the
 * explicit sentinel `'annotation'` (filtered separately, never silent null).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-405-bim-discipline-taxonomy-and-mep-foundation.md
 */

import type { BimCategory } from '../../config/bim-object-styles';

/**
 * AEC discipline — top-level classification (Revit/ArchiCAD/IFC "Discipline").
 * Values mirror the ADR-358 layer taxonomy exactly so `AecLayerCategory` can be
 * a pure alias of this type (ONE taxonomy, no duplication).
 */
export type Discipline =
  | 'architectural' | 'structural' | 'electrical' | 'mechanical'
  | 'plumbing' | 'fire' | 'civil' | 'telecom' | 'interior' | 'general';

/** Explicit sentinel for annotation/helper categories (not a model discipline). */
export type DisciplineOrAnnotation = Discipline | 'annotation';

/**
 * The model disciplines a user actively places/filters in the viewport (Revit
 * "View Discipline" set). Drives the discipline visibility multi-toggle UI. The
 * remaining disciplines (`fire`/`civil`/`telecom`/`general`) exist in the
 * taxonomy for layer classification but have no placeable categories yet.
 * ADR-410: `interior` became placeable (furniture is its first category).
 */
export const MODEL_DISCIPLINES: readonly Discipline[] = [
  'architectural', 'structural', 'mechanical', 'electrical', 'plumbing',
  // ADR-410 — furniture made `interior` a placeable, filterable discipline.
  'interior',
] as const;

/**
 * Type-driven (BIM-native) default discipline per category — the mapping a user
 * gets without any per-instance override. Total over `BimCategory`.
 *
 * Locked decisions (Giorgio 2026-06-02):
 *   • slab → `structural` (load-bearing element, per-instance override allowed)
 *   • dimension/hatch/grip → `'annotation'` (Revit Model vs Annotation Categories)
 */
export const DISCIPLINE_BY_CATEGORY: Readonly<Record<BimCategory, DisciplineOrAnnotation>> = {
  wall:           'architectural',
  opening:        'architectural',
  'slab-opening': 'architectural',
  roof:           'architectural',
  ceiling:        'architectural',
  envelope:       'architectural',
  column:         'structural',
  beam:           'structural',
  slab:           'structural',
  stair:          'structural',
  dimension:      'annotation',
  hatch:          'annotation',
  grip:           'annotation',
  // ADR-406 — MEP point-based fixtures (first placeable electrical category).
  'light-fixture': 'electrical',
  // ADR-408 Φ3 — electrical panel (circuit source) ⊂ electrical.
  'electrical-panel': 'electrical',
  // ADR-407 — railings ⊂ Architecture (Revit).
  railing:         'architectural',
  // ADR-408 Φ7 — home-run circuit wires ⊂ electrical (hidden by the electrical toggle).
  'mep-wire':      'electrical',
  // ADR-410 — furniture (first placeable `interior` category).
  furniture:       'interior',
  // ADR-408 Φ8 — duct run (first placeable `mechanical` category).
  duct:            'mechanical',
  // ADR-408 Φ8 — pipe run (first placeable `plumbing` category).
  pipe:            'plumbing',
  // ADR-408 Φ14 — sanitary drainage pipe run ⊂ plumbing (hidden by the plumbing
  // discipline toggle too; the dedicated «Αποχέτευση» toggle gives finer control).
  'drain-pipe':    'plumbing',
  // ADR-408 Φ12 — plumbing manifold (συλλέκτης, water distribution source) ⊂ plumbing.
  'mep-manifold':  'plumbing',
  // ADR-408 Εύρος Β — heating radiator (καλοριφέρ, hydronic terminal) ⊂ plumbing.
  'mep-radiator':  'plumbing',
  // ADR-408 Εύρος Β #2 — heating boiler (λέβητας, hydronic source) ⊂ plumbing.
  'mep-boiler':    'plumbing',
  // ADR-408 Εύρος Β #3 — underfloor heating loop (ενδοδαπέδια, hydronic terminal area) ⊂ plumbing.
  'mep-underfloor': 'plumbing',
  // ADR-415 — sanitary plan symbols (WC/washbasin/…) ⊂ plumbing (Revit Plumbing Fixtures).
  sanitary:        'plumbing',
  // ADR-415 — kitchen plan symbols (sink/stove/fridge/counter) ⊂ architectural (Revit Casework).
  kitchen:         'architectural',
  // ADR-419 — floor-finish covering per room ⊂ architectural (Revit Floors / Covering).
  'floor-finish':  'architectural',
  // ADR-422 — thermal space (IfcSpace analytical) ⊂ architectural (Revit Spaces).
  'thermal-space': 'architectural',
} as const;

/**
 * Inverse of {@link DISCIPLINE_BY_CATEGORY}: the categories that belong to each
 * discipline. Disciplines with no placeable category yet map to `[]` (reserved
 * for the MEP roadmap — duct/pipe/fixture…). Annotation categories are excluded
 * (they are not model disciplines).
 */
export const CATEGORIES_BY_DISCIPLINE: Readonly<Record<Discipline, readonly BimCategory[]>> = (() => {
  const inverse: Record<Discipline, BimCategory[]> = {
    architectural: [], structural: [], electrical: [], mechanical: [],
    plumbing: [], fire: [], civil: [], telecom: [], interior: [], general: [],
  };
  for (const cat of Object.keys(DISCIPLINE_BY_CATEGORY) as BimCategory[]) {
    const disc = DISCIPLINE_BY_CATEGORY[cat];
    if (disc !== 'annotation') inverse[disc].push(cat);
  }
  return inverse;
})();

/** Input for {@link resolveEntityDiscipline}. All fields optional → falls through. */
export interface DisciplineResolutionInput {
  /** Per-instance override (Firestore-persisted `entity.discipline`). Highest priority. */
  readonly discipline?: Discipline | null;
  /** The entity's BIM category. Type-derived default (priority 2). */
  readonly category?: BimCategory | null;
  /** Owning layer's AEC category (`= Discipline` after the scene-types alias). Priority 3. */
  readonly layerCategory?: Discipline | null;
}

/**
 * Resolve an entity's effective discipline. Priority (industry-faithful):
 *   1. explicit per-instance `discipline` override
 *   2. type-derived `DISCIPLINE_BY_CATEGORY[category]` (may be `'annotation'`)
 *   3. owning layer `aecCategory`
 *   4. `null` (DXF primitive with no BIM category nor classified layer)
 */
export function resolveEntityDiscipline(
  input: DisciplineResolutionInput,
): DisciplineOrAnnotation | null {
  if (input.discipline) return input.discipline;
  if (input.category != null) return DISCIPLINE_BY_CATEGORY[input.category];
  if (input.layerCategory) return input.layerCategory;
  return null;
}
