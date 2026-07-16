/**
 * Generic layered build-up — entity-agnostic SSoT for compound cross-sections
 * (ADR-412 / ADR-414 generalization).
 *
 * Both **walls** (`WallDna`, layers across thickness exterior→core→interior) and
 * **slabs** (`SlabDna`, layers down the depth top→core→bottom) are the SAME
 * shape: an ordered list of thickness-layers whose sum is the total section
 * thickness (Revit "Compound Structure" / IFC `IfcMaterialLayerSet`).
 *
 * This module owns the ONE definition of that shape + the pure helpers
 * (`computeBuildupTotalThickness`, `buildupBoundaryFractions`). Per-entity
 * modules add their own zone vocabulary and preset factories on top.
 *
 * **Adoption status** (ADR-584 — κρατήσου ειλικρινής εδώ):
 * - `slab-dna-types.ts` + `roof-buildup.ts` → πλήρως παραμετροποιημένα
 *   (`SlabDna = LayeredBuildup<SlabLayerZone>`).
 * - `wall-dna-types.ts` → **μερικώς**: δηλώνει δικά του `WallDna`/`WallDnaLayer`
 *   (persisted `side`, όχι `zone` — βλ. την τεκμηριωμένη απόκλιση εκεί), αλλά
 *   delegate-άρει ΟΛΗ την αριθμητική εδώ μέσω του `BuildupThicknessSource`.
 *
 * Pure — no THREE, no store reads, no I/O. Each fn ≤40 lines.
 *
 * @see bim/types/wall-dna-types.ts — wall specialisation (side: exterior|core|interior)
 * @see bim/types/slab-dna-types.ts — slab specialisation (zone: top|core|bottom)
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

/**
 * One layer of a compound cross-section. `Z` = the entity's zone vocabulary
 * (e.g. wall side, slab zone). Thickness in mm (Nestor convention).
 */
export interface LayeredBuildupLayer<Z extends string> {
  readonly id: string;
  readonly name: string;
  /** mm */
  readonly thickness: number;
  /** Material library ID (→ `getMaterial3D`). */
  readonly materialId: string;
  /** Functional zone of this layer within the section. */
  readonly zone: Z;
}

/** Complete compound build-up — ordered layers + computed total thickness (SSoT). */
export interface LayeredBuildup<Z extends string> {
  readonly layers: readonly LayeredBuildupLayer<Z>[];
  /** mm — sum of layer thicknesses (SSoT). */
  readonly totalThickness: number;
}

/**
 * Minimal structural shape needed by the thickness helpers. Any build-up
 * (slab DNA, wall DNA — even though wall layers carry `side` not `zone`)
 * satisfies this, so the helpers are the single source of fraction math.
 */
export interface BuildupThicknessSource {
  readonly layers: readonly { readonly thickness: number }[];
  readonly totalThickness: number;
}

/** Total thickness from layers (SSoT helper). */
export function computeBuildupTotalThickness(
  layers: readonly { readonly thickness: number }[],
): number {
  return layers.reduce((sum, layer) => sum + layer.thickness, 0);
}

/**
 * Cumulative thickness fractions `[0, f1, f2, …, 1]` at each layer boundary,
 * measured from the FIRST layer. Length = `layers.length + 1`. Uses
 * `totalThickness` as the SSoT denominator (matches the entity's `thickness`).
 *
 * Direction is entity-defined: walls read exterior→interior, slabs read
 * top→bottom — the math is identical, only the geometric axis differs.
 */
export function buildupBoundaryFractions(src: BuildupThicknessSource): number[] {
  const total = src.totalThickness;
  const fracs: number[] = [0];
  let acc = 0;
  for (const layer of src.layers) {
    acc += layer.thickness;
    fracs.push(total > 1e-9 ? Math.min(acc / total, 1) : 1);
  }
  return fracs;
}
