/**
 * stair-structure-material-defaults — coherent per-component material defaults
 * DRIVEN BY the stair's `structureType` (Revit/ArchiCAD pattern: a stair TYPE
 * carries a consistent material set — a "cast-in-place concrete" stair is all
 * concrete, a "timber stringer" stair is timber treads on metal stringers, etc.).
 *
 * Consumed by `resolveStairMaterial` as the tier BELOW an explicit per-stair /
 * per-sub-element override and ABOVE the flat `elem-stair-*` last-resort default.
 * So the coherent default replaces the previous ARBITRARY fixed mix (wood tread +
 * concrete riser/landing + metal stringer, regardless of structure) that rendered a
 * monolithic RC stair with incongruous timber treads (Giorgio 2026-07-21).
 *
 * Values are `MaterialCatalog3D` keys (`mat-*`) resolved via `getMaterial3D`, so a
 * default is texture-aware exactly like every other 3D material. A structure with no
 * entry for a component (or an unmapped structure) falls through to the element
 * default — never a hard failure. `stringer`/`handrail` stay metal across the board
 * (typical steel), overridable per-stair like any component.
 *
 * SSoT: this is the ONLY place structure→material defaults live; the resolver reads
 * it, it is not duplicated per kind. Config/data file (no logic) — N.7.1 exempt.
 *
 * @see ./stair-material-resolver.ts (resolution chain)
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md
 */

import type { StairStructureType } from '../../bim/types/stair-types';
import type { Stair3DComponent } from './MaterialCatalog3D';

const MAT_CONCRETE = 'mat-concrete';
const MAT_WOOD = 'mat-wood';
const MAT_METAL = 'mat-metal';
const MAT_GLASS = 'mat-glass';

/**
 * Per-structure coherent material set. The "walk surface" family (tread/riser/
 * landing) shares one material so the stair reads as one type; stringer + handrail
 * default to metal (the structural/support family).
 */
const STRUCTURE_MATERIAL_DEFAULTS: Record<
  StairStructureType,
  Readonly<Record<Stair3DComponent, string>>
> = {
  // Cast-in-place / precast RC → all concrete (the walk surfaces ARE the slab).
  monolithic: {
    'stair-tread': MAT_CONCRETE, 'stair-riser': MAT_CONCRETE, 'stair-landing': MAT_CONCRETE,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  cantilever: {
    'stair-tread': MAT_CONCRETE, 'stair-riser': MAT_CONCRETE, 'stair-landing': MAT_CONCRETE,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  // Timber-tread families on a metal structure (treads/risers/landing timber).
  suspended: {
    'stair-tread': MAT_WOOD, 'stair-riser': MAT_WOOD, 'stair-landing': MAT_WOOD,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  'stringer-1side': {
    'stair-tread': MAT_WOOD, 'stair-riser': MAT_WOOD, 'stair-landing': MAT_WOOD,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  'stringer-2side': {
    'stair-tread': MAT_WOOD, 'stair-riser': MAT_WOOD, 'stair-landing': MAT_WOOD,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  'central-stringer': {
    'stair-tread': MAT_WOOD, 'stair-riser': MAT_WOOD, 'stair-landing': MAT_WOOD,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  // Glass treads on a metal frame.
  'glass-tread': {
    'stair-tread': MAT_GLASS, 'stair-riser': MAT_GLASS, 'stair-landing': MAT_GLASS,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
  // Open steel grating throughout.
  'steel-grating': {
    'stair-tread': MAT_METAL, 'stair-riser': MAT_METAL, 'stair-landing': MAT_METAL,
    'stair-stringer': MAT_METAL, 'stair-handrail': MAT_METAL,
  },
};

/**
 * Coherent default `MaterialCatalog3D` key for a component given the stair's
 * structure type, or `undefined` when unmapped (→ caller falls to the element
 * default). Never throws.
 */
export function resolveStructureComponentMaterialKey(
  structureType: StairStructureType,
  component: Stair3DComponent,
): string | undefined {
  return STRUCTURE_MATERIAL_DEFAULTS[structureType]?.[component];
}
