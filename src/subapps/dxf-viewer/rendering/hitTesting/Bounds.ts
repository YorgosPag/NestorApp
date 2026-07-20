/**
 * BOUNDS — spatial-index bounding boxes (Twin C: hit-test / hover / click).
 *
 * ADR-587 Φ10 — «σιωπηλό» seam κλεισμένο. ΠΡΙΝ: ένα `switch (entity.type)` με
 * `default → console.warn + null`. Ένας renderable τύπος που ξεχνιόταν εδώ έβγαινε
 * ΣΙΩΠΗΛΑ εκτός spatial index → μηδέν hover, μηδέν κλικ (ADR-654: η εικόνα· και
 * πριν από αυτήν το scale-bar, το opening-info-tag, το thermal-space…).
 *
 * ΤΩΡΑ: type-keyed registry ({@link HIT_TEST_BOUNDS_HANDLERS}) με introspectable
 * mirror ({@link HIT_TEST_BOUNDS_SUPPORTED_TYPES} = `Object.keys`, άρα ΠΟΤΕ stale) που
 * το `__tests__/bounds-calculator-coverage.test.ts` δένει με το `RENDERABLE_ENTITY_TYPES`:
 * renderable τύπος χωρίς handler ⇒ **κόκκινο test**, όχι σιωπηλή εξαφάνιση.
 *
 * Big-player idiom: κανένας (Revit `get_BoundingBox` / AutoCAD `getGeomExtents` /
 * C4D `GetRad` / Figma node bbox) δεν αφήνει per-type switch να αποφασίζει αν μια
 * οντότητα υπάρχει — υπάρχει ΕΝΑΣ πίνακας ικανοτήτων ανά τύπο, και τα υποσυστήματα
 * τον ρωτούν.
 *
 * @see ./bounds-primitives — τα per-type μαθηματικά (N.7.1 split)
 * @see ./entity-bounds-ssot — ο canonical resolver (Twin B) που delegate-άρει εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

import type { EntityModel } from '../types/Types';
import type { EntityType } from '../../types/base-entity';
import { calculateXLineBounds, calculateRayBounds } from './bounds-parametric-line';
// ADR-583/612 follow-up — annotation-family (annotation-symbol/scale-bar/opening-info-tag/image)
// bounds live in a sibling module to keep this file within the 500-line budget (N.7.1).
import {
  calculateAnnotationSymbolBounds,
  calculateScaleBarBounds,
  calculateOpeningInfoTagBounds,
  calculateImageBounds,
} from './bounds-annotation';
// ADR-587 Φ10 — τα per-type μαθηματικά (πρώην private statics του BoundsCalculator).
import {
  type EntityBoundsHandler,
  calculateLineBounds,
  calculateCircleBounds,
  calculateArcBounds,
  calculatePolylineBounds,
  calculateRectangleBounds,
  calculateEllipseBounds,
  calculateTextBounds,
  calculateSplineBounds,
  calculatePointBounds,
  calculateAngleMeasurementBounds,
  calculateHatchBounds,
  calculateTopoSurfaceBounds,
  calculateDimensionBounds,
  calculateStairBounds,
  calculateBimEntityBounds,
} from './bounds-primitives';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * 🔺 BOUNDING BOX FACTORY — Standalone exported function
 * Χρησιμοποιείται από BoundsCalculator, BoundsOperations, ViewportBounds και τα
 * sibling bounds modules (`bounds-primitives` / `bounds-annotation` / `bounds-parametric-line`).
 */
export function createBoundingBox(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/**
 * 🔺 PER-TYPE BOUNDS REGISTRY (ADR-587 Φ10) — ΕΝΑΣ πίνακας ικανοτήτων, keyed σε
 * `EntityType`. Απόν κλειδί ⇒ ο τύπος ΔΕΝ μπαίνει στο spatial index (ούτε hover ούτε
 * κλικ) — γι' αυτό το coverage test απαιτεί `RENDERABLE_ENTITY_TYPES ⊆ keys`.
 */
export const HIT_TEST_BOUNDS_HANDLERS: Partial<Record<EntityType, EntityBoundsHandler>> = {
  // ── DXF primitives ──
  line: calculateLineBounds,
  circle: calculateCircleBounds,
  arc: calculateArcBounds,
  polyline: calculatePolylineBounds,
  lwpolyline: calculatePolylineBounds,
  rectangle: calculateRectangleBounds,
  rect: calculateRectangleBounds,
  ellipse: calculateEllipseBounds,
  text: calculateTextBounds,
  mtext: calculateTextBounds,
  spline: calculateSplineBounds,
  point: calculatePointBounds,
  'angle-measurement': calculateAngleMeasurementBounds,
  // ADR-507 S2 — hatch bounds = AABB πάνω σε όλα τα boundaryPaths.
  hatch: calculateHatchBounds,
  // ADR-362 Phase I3 — dimension spatial-index bounds via defPoints + textMidpoint.
  dimension: calculateDimensionBounds,
  // ADR-359 Phase 11 — XLINE/RAY (infinite/semi-infinite) στο sibling module.
  xline: calculateXLineBounds,
  ray: calculateRayBounds,

  // ── Annotation family (paper-space decorations, sibling module) ──
  // ADR-583 — annotation symbol (North arrow): annotative square footprint γύρω από το
  // insertion point (χωρίς geometry.bbox — lightweight).
  'annotation-symbol': calculateAnnotationSymbolBounds,
  // ADR-583 Φ2 — graphic scale-bar: axis-extent bbox padded με το live annotative
  // half-thickness, ώστε το broad phase να εγκλείει τον ±half-thickness διάδρομο pick.
  'scale-bar': calculateScaleBarBounds,
  // ADR-612 — opening info tag: rotation-aware world-mm box AABB (χωρίς annotative όρο).
  'opening-info-tag': calculateOpeningInfoTagBounds,
  // ADR-654 — standalone raster image (entourage / furniture-plan sprite): AABB των 4
  // περιστραμμένων κορυφών. Ο τύπος που έλειπε και γέννησε ΟΛΗ τη Φ10.
  image: calculateImageBounds,
  // ADR-662 Φάση 2β (Δρόμος Γ) — topo surface: AABB πάνω σε όλες τις κορυφές του footprint.
  'topo-surface': calculateTopoSurfaceBounds,
  // ADR-635 Φάση B — leader callout: AABB πάνω στα path vertices (reuse polyline SSoT).
  leader: calculatePolylineBounds,

  // ── BIM parametric: όλα προβάλλουν το pre-computed `geometry.bbox` στο XY. Added by:
  // ADR-363 (wall/opening/slab/slab-opening/column/beam), ADR-358 (stair), ADR-436
  // (foundation), ADR-406 (mep-fixture), ADR-408 Φ3 (electrical-panel), ADR-407 (railing),
  // ADR-410 (furniture), ADR-408 Φ8/Φ11/Φ12 (mep-segment/fitting/manifold), ADR-415
  // (floorplan-symbol), ADR-417 (roof), ADR-419 (floor-finish), ADR-422 L0 (thermal-space),
  // ADR-437 (space-separator), ADR-408 Εύρος Β (mep-radiator/boiler/water-heater/underfloor).
  wall: calculateBimEntityBounds,
  opening: calculateBimEntityBounds,
  slab: calculateBimEntityBounds,
  'slab-opening': calculateBimEntityBounds,
  column: calculateBimEntityBounds,
  beam: calculateBimEntityBounds,
  foundation: calculateBimEntityBounds,
  stair: calculateStairBounds,
  railing: calculateBimEntityBounds,
  roof: calculateBimEntityBounds,
  'floor-finish': calculateBimEntityBounds,
  // ADR-511 / ADR-587 Φ10 — GAP FIX: το wall-covering ΕΛΕΙΠΕ από το switch → `default` →
  // `null` → ΠΟΤΕ δεν έμπαινε στο spatial index → η επένδυση τοίχου δεν φωτιζόταν στο hover
  // ούτε επιλεγόταν με κλικ (μόνο marquee, που περνά από άλλο bounds SSoT — η ΙΔΙΑ ασυμμετρία
  // που έκρυβε το ADR-654 bug της εικόνας). Έχει `geometry.bbox` (computeWallCoveringGeometry).
  'wall-covering': calculateBimEntityBounds,
  'thermal-space': calculateBimEntityBounds,
  'space-separator': calculateBimEntityBounds,
  furniture: calculateBimEntityBounds,
  // ADR-683 Φ3 — εισαγόμενο πλέγμα: το `geometry.bbox` του μετρημένου κουτιού. Διαθέσιμο
  // ΧΩΡΙΣ φορτωμένο glTF, ώστε η επιλογή να δουλεύει αμέσως μετά το reload.
  'imported-mesh': calculateBimEntityBounds,
  'floorplan-symbol': calculateBimEntityBounds,
  'mep-fixture': calculateBimEntityBounds,
  'electrical-panel': calculateBimEntityBounds,
  'mep-segment': calculateBimEntityBounds,
  'mep-fitting': calculateBimEntityBounds,
  'mep-manifold': calculateBimEntityBounds,
  'mep-radiator': calculateBimEntityBounds,
  'mep-boiler': calculateBimEntityBounds,
  'mep-water-heater': calculateBimEntityBounds,
  'mep-underfloor': calculateBimEntityBounds,
};

/**
 * Κάθε entity type με bounds handler (runtime mirror του registry — `Object.keys`, άρα
 * ΠΟΤΕ stale). Το δένει με το `RENDERABLE_ENTITY_TYPES` το coverage test.
 */
export const HIT_TEST_BOUNDS_SUPPORTED_TYPES: readonly EntityType[] =
  Object.keys(HIT_TEST_BOUNDS_HANDLERS) as EntityType[];

/**
 * 🔺 BOUNDING BOX CALCULATOR
 * Υπολογίζει bounding boxes για όλους τους τύπους entities (thin resolver πάνω στο
 * {@link HIT_TEST_BOUNDS_HANDLERS}).
 */
export class BoundsCalculator {
  /**
   * 🔺 MAIN ENTITY BOUNDS CALCULATION
   * Υπολογίζει το bounding box ενός entity με μικρό tolerance. Άγνωστος τύπος → `warn`
   * + `null` (ίδιο συμβόλαιο με το πρώην `default:` του switch — ο caller τον αφήνει
   * gracefully εκτός spatial index).
   */
  static calculateEntityBounds(entity: EntityModel, tolerance = 0): BoundingBox | null {
    const handler = HIT_TEST_BOUNDS_HANDLERS[entity.type as EntityType];
    if (!handler) {
      console.warn(`BoundsCalculator: Unknown entity type: ${entity.type}`);
      return null;
    }
    return handler(entity, tolerance);
  }
}

export { BoundsOperations, ViewportBounds } from './bounds-operations';
