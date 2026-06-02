/**
 * ADR-377 — BIM Subcategories Taxonomy
 *
 * 47 built-in subcategory keys across 7 structural categories
 * (42 Revit-default + 5 extras ⭐).
 *
 * WIRED  = renderer already emits per-subcategory calls → user style control active.
 * STUB   = key defined in SSoT; user can pre-configure style; renderer not yet wired.
 *
 * Stubs are intentional placeholders — geometry or cut-state pass not yet implemented.
 * They are labeled 🔒 in the key type comments below.
 *
 * Total: 23 wired, 24 stubs.
 */
import type { BimCategory } from './bim-object-styles';

// ── Per-category subcategory key types ────────────────────────────────────

export type WallSubcategoryKey =
  | 'common-edges'     // ✅ drawFootprint()
  | 'cut-pattern'      // ✅ drawMaterialHatch() hatch SSoT
  | 'surface-pattern'  // 🔒 no geometry — decorative surface pattern (ADR-378 or future ADR)
  | 'hidden-lines'     // 🔒 system-wide stub — needs cut-state driven dashed pass
  | 'sweeps'           // 🔒 no geometry — decorative wall trim
  | 'reveals';         // 🔒 no geometry — wall recess

export type SlabSubcategoryKey =
  | 'common-edges'    // ✅ drawPolygonPath() + stroke
  | 'slab-edges'      // 🔒 separation from common-edges TBD
  | 'interior-edges'  // 🔒 computation from opening cutouts TBD
  | 'cut-pattern'     // 🔒 reinforcement hatch kind-driven — wiring possible Phase B/C
  | 'hidden-lines';   // 🔒 system-wide stub

export type ColumnSubcategoryKey =
  | 'hidden-lines'     // 🔒 system-wide stub
  | 'stick-symbols'    // 🔒 schematic single-line representation TBD
  | 'reference-lines'  // 🔒 TBD
  | 'section-profile'; // ⭐✅ drawSectionProfile() — L/T/angle steel (Phase 4.5c.6)

export type BeamSubcategoryKey =
  | 'hidden-lines'     // ✅ dashed outline (OUTLINE_DASH convention)
  | 'stick-symbols'    // 🔒 TBD
  | 'rigid-links'      // 🔒 TBD
  | 'section-profile'; // ⭐✅ drawSectionProfile() — I/H/IPE/HEA steel (Phase 5.5h)

export type OpeningSubcategoryKey =
  | 'door-panel'            // 🔒 separate panel leaf from frame TBD
  | 'door-frame'            // ✅ drawOutline()
  | 'door-glass'            // ✅ drawGlazing()
  | 'door-opening'          // ✅ drawOutline()
  | 'door-plan-swing'       // ✅ drawHingeArc()
  | 'door-elevation-swing'  // 🔒 no elevation view renderer yet
  | 'door-frame-elevation'  // 🔒 no elevation view renderer yet
  | 'window-frame'          // ✅ drawOutline()
  | 'window-sash'           // 🔒 no sash geometry yet
  | 'window-glass'          // ✅ drawGlazing()
  | 'window-opening'        // ✅ drawOutline()
  | 'window-plan-swing'     // 🔒 hinged-window vs casement distinction TBD
  | 'wall-cutout-sill-head' // 🔒 TBD
  | 'wall-cutout-jambs'     // ✅ drawOutline() + drawLeafLine()
  | 'sliding-track';        // ⭐✅ drawSlidingIndicator()

export type SlabOpeningSubcategoryKey =
  | 'edges'   // ✅ drawPolygonPath() + stroke (IFC IfcOpeningElement pattern)
  | 'hidden'; // 🔒 system-wide stub

export type StairSubcategoryKey =
  | 'treads'        // ✅ renderTreadsForStructure()
  | 'risers'        // 🔒 TBD — no separate riser geometry currently
  | 'outlines'      // ✅ renderStringersForStructure() (stringers)
  | 'walkline'      // ✅ drawWalkline()
  | 'cut-marks'     // 🔒 TBD
  | 'down-arrows'   // ✅ drawArrow() + "DOWN"
  | 'up-arrows'     // ✅ drawArrow() + "UP"
  | 'boundary'      // 🔒 perimeter — partial via hover halo; structural TBD
  | 'support'       // 🔒 TBD
  | 'handrails'     // ⭐✅ drawHandrails() — Phase 7b1 ADA-extended
  | 'tread-labels'; // ⭐✅ drawTreadLabels() — Phase 3e numbering

// ── Taxonomy SSoT ──────────────────────────────────────────────────────────

/**
 * All subcategory keys per BimCategory.
 * Categories without subcategory model (roof, ceiling, dimension, hatch, grip,
 * envelope, light-fixture, railing) return empty arrays — no subcategory
 * styling applies.
 */
export const SUBCATEGORY_TAXONOMY: Readonly<Record<BimCategory, ReadonlyArray<string>>> = {
  wall:  ['common-edges', 'cut-pattern', 'surface-pattern', 'hidden-lines', 'sweeps', 'reveals'],
  slab:  ['common-edges', 'slab-edges', 'interior-edges', 'cut-pattern', 'hidden-lines'],
  column: ['hidden-lines', 'stick-symbols', 'reference-lines', 'section-profile'],
  beam:   ['hidden-lines', 'stick-symbols', 'rigid-links', 'section-profile'],
  opening: [
    'door-panel', 'door-frame', 'door-glass', 'door-opening', 'door-plan-swing',
    'door-elevation-swing', 'door-frame-elevation',
    'window-frame', 'window-sash', 'window-glass', 'window-opening', 'window-plan-swing',
    'wall-cutout-sill-head', 'wall-cutout-jambs',
    'sliding-track',
  ],
  'slab-opening': ['edges', 'hidden'],
  stair: [
    'treads', 'risers', 'outlines', 'walkline', 'cut-marks',
    'down-arrows', 'up-arrows', 'boundary', 'support',
    'handrails', 'tread-labels',
  ],
  roof:      [],
  ceiling:   [],
  dimension: [],
  hatch:     [],
  grip:      [],
  // ADR-405/406/407/408 — no subcategory model yet.
  envelope:        [],
  'light-fixture': [],
  'electrical-panel': [],
  railing:         [],
};

/**
 * 23 wired subcategory keys in 'category:key' format.
 * Wired = the renderer already passes subcategoryKey to resolveSubcategoryStyle().
 * Stub keys not in this set fall back to parent ObjectStyle at render time (Phase C).
 */
export const WIRED_SUBCATEGORIES: ReadonlySet<string> = new Set<string>([
  // Wall (2)
  'wall:common-edges',
  'wall:cut-pattern',
  // Slab (1)
  'slab:common-edges',
  // Column (1)
  'column:section-profile',
  // Beam (2)
  'beam:hidden-lines',
  'beam:section-profile',
  // Opening (9)
  'opening:door-frame',
  'opening:door-glass',
  'opening:door-opening',
  'opening:door-plan-swing',
  'opening:window-frame',
  'opening:window-glass',
  'opening:window-opening',
  'opening:wall-cutout-jambs',
  'opening:sliding-track',
  // SlabOpening (1)
  'slab-opening:edges',
  // Stair (7)
  'stair:treads',
  'stair:outlines',
  'stair:walkline',
  'stair:down-arrows',
  'stair:up-arrows',
  'stair:handrails',
  'stair:tread-labels',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

export function isWiredSubcategory(category: BimCategory, key: string): boolean {
  return WIRED_SUBCATEGORIES.has(`${category}:${key}`);
}

export function getAllSubcategoryKeysForCategory(category: BimCategory): ReadonlyArray<string> {
  return SUBCATEGORY_TAXONOMY[category];
}
