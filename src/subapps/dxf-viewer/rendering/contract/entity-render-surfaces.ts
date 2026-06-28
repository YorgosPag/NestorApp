/**
 * Entity Render Surfaces — δηλωτικό SSoT «ποιος renderable type αποδίδεται σε 2D
 * και/ή 3D» (ADR-550 Φ2-lite, απαραίτητο για το Φ3 coverage test).
 *
 * Το `Record<RenderableEntityType, …>` εγγυάται completeness σε compile-time: αν
 * προστεθεί νέος renderable type χωρίς εγγραφή εδώ, σπάει το tsc. Το coverage
 * test (`__tests__/entity-render-coverage.test.ts`) δένει αυτό το δηλωτικό με τα
 * ΖΩΝΤΑΝΑ dispatchers, ώστε το μητρώο να μην μπορεί να αποκλίνει από την πραγματικότητα:
 *  - `d2` ↔ `EntityRendererComposite.getSupportedEntityTypes()` (2D)
 *  - `d3` ↔ `BIM_3D_CONVERTER_TYPES` (3D, `bim-3d/scene/bim-3d-renderable-types.ts`)
 *
 * @see ADR-549 §4.2 (SSoT audit) — ευρήματα ασυμμετρίας
 * @see ADR-550 (Unified Entity Render Contract)
 */

import type { RenderableEntityType } from './renderable-entity-type';

export interface RenderSurfaces {
  /** Αποδίδεται στον 2D καμβά μέσω `EntityRendererComposite`. */
  readonly d2: boolean;
  /** Παράγει 3D mesh/object μέσω `BimSceneLayer` per-family sync. */
  readonly d3: boolean;
}

/**
 * BIM types που είναι ΣΚΟΠΙΜΑ 2D-only (έχουν 2D renderer αλλά κανένα standalone
 * 3D solid). Τεκμηριωμένη εξαίρεση ώστε ο symmetry έλεγχος να μην τα θεωρεί
 * «λείπει 3D». Αν κάποιο αποκτήσει 3D converter → αφαιρείται από εδώ + `d3:true`.
 */
export const BIM_2D_ONLY_TYPES: readonly RenderableEntityType[] = [
  'wall-covering',   // ADR-511 — λεπτή επίστρωση στην παρειά· καμία ανεξάρτητη 3D mesh
  'thermal-space',   // ADR-422 — αναλυτικό IfcSpace· χωρίς 3D solid
  'space-separator', // ADR-437 — IfcVirtualElement· καθαρά 2D γραμμή
];

/**
 * Το μητρώο. DXF primitives = 2D-only (το 3D DXF underlay είναι ενιαίο
 * `DxfToThreeConverter`, όχι per-type). BIM = 2D + 3D εκτός των `BIM_2D_ONLY_TYPES`.
 */
export const ENTITY_RENDER_SURFACES: Readonly<Record<RenderableEntityType, RenderSurfaces>> = {
  // ── DXF primitives (2D canvas only) ──
  line: { d2: true, d3: false },
  polyline: { d2: true, d3: false },
  lwpolyline: { d2: true, d3: false },
  circle: { d2: true, d3: false },
  arc: { d2: true, d3: false },
  ellipse: { d2: true, d3: false },
  text: { d2: true, d3: false },
  mtext: { d2: true, d3: false },
  spline: { d2: true, d3: false },
  rectangle: { d2: true, d3: false },
  rect: { d2: true, d3: false },
  point: { d2: true, d3: false },
  dimension: { d2: true, d3: false },
  'angle-measurement': { d2: true, d3: false },
  hatch: { d2: true, d3: false },
  xline: { d2: true, d3: false },
  ray: { d2: true, d3: false },

  // ── BIM — 2D + 3D ──
  wall: { d2: true, d3: true },
  opening: { d2: true, d3: true }, // 3D: cutout/reveal μέσα στο wall group
  slab: { d2: true, d3: true },
  'slab-opening': { d2: true, d3: true }, // 3D: pick-mesh στο κενό (ADR-535 Φ3b)
  column: { d2: true, d3: true },
  beam: { d2: true, d3: true },
  foundation: { d2: true, d3: true },
  stair: { d2: true, d3: true },
  railing: { d2: true, d3: true },
  roof: { d2: true, d3: true },
  'floor-finish': { d2: true, d3: true },
  furniture: { d2: true, d3: true },
  'mep-fixture': { d2: true, d3: true },
  'electrical-panel': { d2: true, d3: true },
  'mep-manifold': { d2: true, d3: true },
  'mep-radiator': { d2: true, d3: true },
  'mep-boiler': { d2: true, d3: true },
  'mep-water-heater': { d2: true, d3: true },
  'mep-segment': { d2: true, d3: true },
  'mep-fitting': { d2: true, d3: true },
  'mep-underfloor': { d2: true, d3: true },

  // ── BIM — σκόπιμα 2D-only (βλ. BIM_2D_ONLY_TYPES) ──
  'wall-covering': { d2: true, d3: false },
  'thermal-space': { d2: true, d3: false },
  'space-separator': { d2: true, d3: false },
};
