/**
 * Canonical Renderable Entity Type SSoT (ADR-550 Φ0).
 *
 * ΕΝΑ canonical μητρώο των entity types που έχουν renderer/converter, αντί για
 * τα διάσπαρτα unions (`EntityType` σε `types/base-entity.ts`, `BimEntityType` σε
 * `bim/config/bim-to-atoe-mapping.ts`, 24+ Kind unions). Δεν αντικαθιστά κανένα —
 * είναι additive· το compile-time bridge παρακάτω εγγυάται ότι κάθε renderable
 * type είναι έγκυρο `EntityType` (αν αποκλίνουν, σπάει το tsc).
 *
 * Συνοδεύεται από:
 *  - `entity-render-surfaces.ts` — δηλωτικό «ποιος type έχει 2D / 3D».
 *  - `__tests__/entity-render-coverage.test.ts` — δένει το δηλωτικό με τα ζωντανά
 *     dispatchers (2D `EntityRendererComposite`, 3D `BIM_3D_CONVERTER_TYPES`).
 *
 * @see ADR-549 (census) — η χάρτα του render layer
 * @see ADR-550 (Unified Entity Render Contract) — roadmap
 */

import type { EntityType } from '../../types/base-entity';

/** DXF (CAD primitive) renderable types — αποδίδονται στον 2D καμβά (καμία per-type 3D mesh). */
export const DXF_RENDERABLE_TYPES = [
  'line',
  'polyline',
  'lwpolyline',
  'circle',
  'arc',
  'ellipse',
  'text',
  'mtext',
  'spline',
  'rectangle',
  'rect',
  'point',
  'dimension',
  'angle-measurement',
  'hatch',
  'xline',
  'ray',
  // ADR-583 — annotation symbol (North arrow): lightweight non-BIM paper decoration,
  // rendered on the 2D canvas only (no per-type 3D mesh).
  'annotation-symbol',
  // ADR-583 Φ2 — graphic scale-bar: dedicated non-BIM annotation (sibling of
  // dimension/center-mark), 2D canvas only (no per-type 3D mesh).
  'scale-bar',
  // ADR-612 — opening info tag: dedicated non-BIM annotation (sibling of scale-bar),
  // 2D canvas only (no per-type 3D mesh).
  'opening-info-tag',
  // ADR-651 Φάση Ε — standalone raster image (rectangle + rotation), 2D canvas only
  // (no per-type 3D mesh).
  'image',
] as const;

/** BIM (parametric model) renderable types — 2D κάτοψη ± 3D solid. */
export const BIM_RENDERABLE_TYPES = [
  'wall',
  'opening',
  'slab',
  'slab-opening',
  'column',
  'beam',
  'foundation',
  'stair',
  'railing',
  'roof',
  'floor-finish',
  'wall-covering',
  'thermal-space',
  'space-separator',
  'furniture',
  // ADR-415 — 2D floorplan symbol (WC/κουζίνα/έπιπλα κάτοψης): pure-vector 2D κάτοψη,
  // κανένα standalone 3D solid (βλ. BIM_2D_ONLY_TYPES). Renderer: FloorplanSymbolRenderer.
  'floorplan-symbol',
  'mep-fixture',
  'electrical-panel',
  'mep-manifold',
  'mep-radiator',
  'mep-boiler',
  'mep-water-heater',
  'mep-segment',
  'mep-fitting',
  'mep-underfloor',
] as const;

/** Όλοι οι renderable entity types (DXF + BIM). */
export const RENDERABLE_ENTITY_TYPES = [
  ...DXF_RENDERABLE_TYPES,
  ...BIM_RENDERABLE_TYPES,
] as const;

export type DxfRenderableType = (typeof DXF_RENDERABLE_TYPES)[number];
export type BimRenderableType = (typeof BIM_RENDERABLE_TYPES)[number];
export type RenderableEntityType = (typeof RENDERABLE_ENTITY_TYPES)[number];

/**
 * Compile-time bridge: κάθε `RenderableEntityType` ΠΡΕΠΕΙ να είναι έγκυρο
 * `EntityType`. Αν προστεθεί renderable type που λείπει από το master union (ή
 * γραφτεί λάθος), το tsc σπάει εδώ — η ασυμφωνία δεν φτάνει ποτέ στο runtime.
 */
const _RENDERABLE_TYPES_ARE_ENTITY_TYPES: readonly EntityType[] = RENDERABLE_ENTITY_TYPES;
void _RENDERABLE_TYPES_ARE_ENTITY_TYPES;
