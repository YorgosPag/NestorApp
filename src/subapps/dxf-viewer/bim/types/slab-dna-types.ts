/**
 * BIM Slab DNA — layered build-up composition (composite Floor/Slab Types).
 *
 * The slab analogue of `wall-dna-types.ts`: a slab is no longer a single
 * material+thickness box but an ordered vertical stack of layers
 * (finish → screed → insulation → structural RC core → soffit), exactly how
 * Revit "Floor", ArchiCAD "Slab" and IFC `IfcSlab` + `IfcMaterialLayerSet`
 * model real construction.
 *
 * Built on the entity-agnostic `LayeredBuildup<Z>` SSoT. Slab zones are
 * `top | core | bottom` (Revit Core Boundary: everything above the core =
 * finishes/screed/insulation; the core = structural; below = soffit/ceiling).
 *
 * Default build-ups differ **per kind** (`getDefaultSlabBuildupForKind`):
 *   - floor      — interstorey: finishes + screed + acoustic + RC core + soffit
 *   - roof       — RC core + slope screed + vapour + thermal + membrane + gravel + soffit
 *   - ground     — finishes + screed + thermal XPS + RC core + waterproofing + blinding
 *   - foundation — thick RC core + blinding (no soffit, bears on ground)
 *   - ceiling    — suspended: acoustic + plenum air gap + gypsum board
 *
 * MEP (underfloor heating / supply / drainage) is NOT a slab layer — those are
 * separate networks (ADR-408) hosted in / penetrating the slab. See the slab
 * layered-buildup ADR for the architectural split.
 *
 * SSoT: `SlabParams.thickness` is derived from `SlabDna.totalThickness` when a
 * dna is present (no double-entry) — same rule as `WallParams.thickness`.
 *
 * @see bim/types/layered-buildup.ts — generic primitives
 * @see bim/types/wall-dna-types.ts — the wall sibling
 */

import {
  computeBuildupTotalThickness,
  type LayeredBuildup,
  type LayeredBuildupLayer,
} from './layered-buildup';
import type { SlabKind } from './slab-types';

/** Functional zone of a slab layer relative to the structural core (Revit Core Boundary). */
export type SlabLayerZone = 'top' | 'core' | 'bottom';

/** Single layer in the slab vertical build-up. Thickness in mm. */
export type SlabDnaLayer = LayeredBuildupLayer<SlabLayerZone>;

/** Complete slab DNA — ordered layers (top→bottom) + computed total thickness. */
export type SlabDna = LayeredBuildup<SlabLayerZone>;

/** Total thickness from slab layers (SSoT helper — re-export of the generic). */
export function computeSlabTotalThickness(
  layers: readonly SlabDnaLayer[],
): number {
  return computeBuildupTotalThickness(layers);
}

/** Assemble a `SlabDna` from an ordered (top→bottom) layer list. */
function buildup(layers: readonly SlabDnaLayer[]): SlabDna {
  return { layers, totalThickness: computeBuildupTotalThickness(layers) };
}

// ─── Default build-ups per kind (mm) ────────────────────────────────────────

/** Interstorey floor: tile + screed + acoustic + RC core + plaster soffit = 285 mm. */
export function createDefaultFloorBuildup(): SlabDna {
  return buildup([
    { id: 'floor-finish', name: 'Ceramic Tile', thickness: 10, materialId: 'mat-tile', zone: 'top' },
    { id: 'floor-screed', name: 'Cement Screed', thickness: 60, materialId: 'mat-screed', zone: 'top' },
    { id: 'floor-acoustic', name: 'Acoustic Insulation', thickness: 20, materialId: 'mat-insulation', zone: 'top' },
    { id: 'floor-core', name: 'Reinforced Concrete', thickness: 180, materialId: 'mat-concrete', zone: 'core' },
    { id: 'floor-soffit', name: 'Plaster Soffit', thickness: 15, materialId: 'mat-plaster', zone: 'bottom' },
  ]);
}

/** Flat roof: gravel + membrane + XPS + vapour + slope screed + RC core + soffit = 434 mm. */
export function createDefaultRoofBuildup(): SlabDna {
  return buildup([
    { id: 'roof-gravel', name: 'Gravel Protection', thickness: 50, materialId: 'mat-gravel', zone: 'top' },
    { id: 'roof-waterproof', name: 'Waterproof Membrane', thickness: 5, materialId: 'mat-membrane', zone: 'top' },
    { id: 'roof-thermal', name: 'Thermal Insulation (XPS)', thickness: 80, materialId: 'mat-insulation', zone: 'top' },
    { id: 'roof-vapour', name: 'Vapour Barrier', thickness: 4, materialId: 'mat-membrane', zone: 'top' },
    { id: 'roof-screed', name: 'Slope Screed', thickness: 80, materialId: 'mat-screed', zone: 'top' },
    { id: 'roof-core', name: 'Reinforced Concrete', thickness: 200, materialId: 'mat-concrete', zone: 'core' },
    { id: 'roof-soffit', name: 'Plaster Soffit', thickness: 15, materialId: 'mat-plaster', zone: 'bottom' },
  ]);
}

/** Ground-bearing slab: tile + screed + XPS + RC core + waterproofing + blinding = 405 mm. */
export function createDefaultGroundBuildup(): SlabDna {
  return buildup([
    { id: 'ground-finish', name: 'Ceramic Tile', thickness: 10, materialId: 'mat-tile', zone: 'top' },
    { id: 'ground-screed', name: 'Cement Screed', thickness: 60, materialId: 'mat-screed', zone: 'top' },
    { id: 'ground-thermal', name: 'Thermal Insulation (XPS)', thickness: 80, materialId: 'mat-insulation', zone: 'top' },
    { id: 'ground-core', name: 'Reinforced Concrete', thickness: 200, materialId: 'mat-concrete', zone: 'core' },
    { id: 'ground-waterproof', name: 'Waterproofing', thickness: 5, materialId: 'mat-membrane', zone: 'bottom' },
    { id: 'ground-blinding', name: 'Blinding Concrete', thickness: 50, materialId: 'mat-concrete', zone: 'bottom' },
  ]);
}

/** Foundation slab: thick RC core + blinding (no soffit, bears on soil) = 500 mm. */
export function createDefaultFoundationBuildup(): SlabDna {
  return buildup([
    { id: 'foundation-core', name: 'Reinforced Concrete', thickness: 400, materialId: 'mat-concrete', zone: 'core' },
    { id: 'foundation-blinding', name: 'Blinding Concrete', thickness: 100, materialId: 'mat-concrete', zone: 'bottom' },
  ]);
}

/** Suspended ceiling: acoustic + plenum air gap + gypsum board = 142.5 mm. */
export function createDefaultCeilingBuildup(): SlabDna {
  return buildup([
    { id: 'ceiling-acoustic', name: 'Acoustic Absorption', thickness: 30, materialId: 'mat-insulation', zone: 'top' },
    { id: 'ceiling-plenum', name: 'Plenum (Air Gap)', thickness: 100, materialId: 'mat-insulation', zone: 'core' },
    { id: 'ceiling-board', name: 'Gypsum Board', thickness: 12.5, materialId: 'mat-plaster', zone: 'bottom' },
  ]);
}

/** Default slab build-up per kind (SSoT lookup). */
export function getDefaultSlabBuildupForKind(kind: SlabKind): SlabDna {
  switch (kind) {
    case 'floor': return createDefaultFloorBuildup();
    case 'roof': return createDefaultRoofBuildup();
    case 'ground': return createDefaultGroundBuildup();
    case 'foundation': return createDefaultFoundationBuildup();
    case 'ceiling': return createDefaultCeilingBuildup();
  }
}

/** True when the slab should render as a per-layer stack (>1 layer, positive total). */
export function isMultiLayerSlab(dna: SlabDna | undefined): dna is SlabDna {
  return !!dna && dna.layers.length > 1 && dna.totalThickness > 1e-6;
}
