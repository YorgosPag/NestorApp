/**
 * ADR-370 — BIM Characteristic-Point SSoT dispatcher (corner + midpoint + center).
 *
 * ΕΝΑ Single Source of Truth που, για ΚΑΘΕ BIM entity, επιστρέφει τα τρία είδη
 * χαρακτηριστικών σημείων (Revit "snap-to" points):
 *   - **corners**  — δομικές γωνίες (face corners / polygon vertices / box corners)
 *   - **midpoints**— μέσα ακμών / άξονα («μέσο τοίχου», «μέσο δοκαριού»)
 *   - **center**   — κεντροειδές (μόνο για area entities· γραμμικά → null)
 *
 * Ο dispatcher **DELEGATES** σε ΥΠΑΡΧΟΥΣΕΣ pure SSoT γεωμετρικές συναρτήσεις ανά
 * entity (μηδέν νέα γεωμετρία): `get*CornerWorldPoints`, `getBimEntityEdgeMidpoints2D`,
 * `getBimEntityKeyPoints2D`, `getColumnAnchorWorldPoints`, `getFoundationGrips`,
 * `getCentredBoxGrips`, `polygonCentroid`. Καταναλώνεται από τα 3 generic snap engines
 * (`BIM_CORNER` / `BIM_MIDPOINT` / `BIM_CENTER`) — «ΙΔΙΟΣ κώδικας παντού» (Giorgio).
 *
 * `labelRoot`:
 *   - string (π.χ. `'wall'`) → καθαρό ορθογ. footprint → το overlay δείχνει label
 *     («Γωνία τοίχου»/«Μέσο τοίχου»/«Κέντρο τοίχου») μέσω composition i18n.
 *   - `null` → «περίεργο σχήμα» (curved/polyline/L/T/I/U/circular/spiral/linear) → emit
 *     snap point ΧΩΡΙΣ confusing κείμενο (Giorgio req #4).
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md
 * @see snapping/engines/BimCharacteristicSnapEngine.ts — generic consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isWallEntity,
  isBeamEntity,
  isSlabEntity,
  isSlabOpeningEntity,
  isOpeningEntity,
  isColumnEntity,
  isFoundationEntity,
  isMepFixtureEntity,
  isElectricalPanelEntity,
  isMepManifoldEntity,
  isMepRadiatorEntity,
  isMepBoilerEntity,
  isMepWaterHeaterEntity,
  isFurnitureEntity,
  isFloorplanSymbolEntity,
  isRoofEntity,
  isThermalSpaceEntity,
  isFloorFinishEntity,
  isMepUnderfloorEntity,
  isMepSegmentEntity,
} from '../../types/entities';
import { getWallCornerWorldPoints } from '../walls/wall-corner-anchors';
import { getBeamCornerWorldPoints } from '../beams/beam-corner-anchors';
import { getSlabCornerWorldPoints } from '../slabs/slab-corner-anchors';
import { getOpeningCornerWorldPoints } from '../walls/opening-corner-anchors';
import { getColumnCornerWorldPoints } from '../columns/column-corner-anchors';
import { getBimEntityEdgeMidpoints2D } from './bim-entity-points';
import { getFoundationGrips } from '../foundations/foundation-grips';
import { getCentredBoxGrips, type CentredBoxParams } from '../grips/centred-box-grips';
import { polygonCentroid } from '../geometry/shared/polygon-utils';
import { isSegmentVertical } from '../types/mep-segment-types';

// ─── Public types ────────────────────────────────────────────────────────────

/** The three categories of BIM characteristic snap point. */
export type BimCharCategory = 'corner' | 'midpoint' | 'center';

/**
 * The characteristic points of one BIM entity, grouped by category, in world
 * coordinates. Empty arrays / `null` center are valid. `labelRoot` is the i18n
 * noun-root (`'wall'`…) or `null` for «no label».
 */
export interface BimCharPoints {
  readonly corners: Point2D[];
  readonly midpoints: Point2D[];
  readonly center: Point2D | null;
  readonly labelRoot: string | null;
}

const EMPTY: BimCharPoints = { corners: [], midpoints: [], center: null, labelRoot: null };

/** Suffix appended to `bim-${labelRoot}-…` to form the snap `description` per category. */
const CATEGORY_DESCRIPTION_SUFFIX: Readonly<Record<BimCharCategory, string>> = {
  corner: 'corner',
  midpoint: 'mid',
  center: 'center',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * The i18n noun-root of an entity's characteristic-point labels («wall» →
 * «Γωνία/Μέσο/Κέντρο τοίχου»), or `null` for «περίεργα σχήματα» (curved / polyline /
 * L / circular / spiral / linear) → snap emitted ΧΩΡΙΣ confusing label (req #4).
 *
 * Geometry-free (only type + `kind`/`shape` discriminators) so the snap engine can
 * resolve a candidate's label cheaply per mouse-move. SINGLE source of the label policy.
 */
export function getBimCharacteristicLabelRoot(entity: Entity): string | null {
  if (isWallEntity(entity)) return entity.kind === 'straight' ? 'wall' : null;
  if (isBeamEntity(entity)) return entity.params.kind === 'curved' ? null : 'beam';
  if (isSlabEntity(entity)) return 'slab';
  if (isSlabOpeningEntity(entity)) return 'slabOpening';
  if (isOpeningEntity(entity)) return 'opening';
  if (isColumnEntity(entity)) {
    return entity.params.kind === 'rectangular' || entity.params.kind === 'shear-wall' ? 'column' : null;
  }
  if (isFoundationEntity(entity)) {
    // Distinct nouns per foundation kind (Giorgio): pad → «πέδιλο», strip → «πεδιλοδοκός»,
    // tie-beam → «συνδετήρας» — NOT a generic «θεμελίωση».
    const k = entity.params.kind;
    return k === 'pad' ? 'foundationPad' : k === 'strip' ? 'foundationStrip' : 'foundationTieBeam';
  }
  if (isMepFixtureEntity(entity)) return entity.params.shape === 'circular' ? null : 'mepFixture';
  if (isElectricalPanelEntity(entity)) return 'electricalPanel';
  if (isMepManifoldEntity(entity)) return 'mepManifold';
  if (isMepRadiatorEntity(entity)) return 'mepRadiator';
  if (isMepBoilerEntity(entity)) return 'mepBoiler';
  if (isMepWaterHeaterEntity(entity)) return 'mepWaterHeater';
  if (isFurnitureEntity(entity)) return 'furniture';
  if (isFloorplanSymbolEntity(entity)) return 'floorplanSymbol';
  if (isRoofEntity(entity)) return 'roof';
  if (isThermalSpaceEntity(entity)) return 'thermalSpace';
  if (isFloorFinishEntity(entity)) return 'floorFinish';
  if (isMepUnderfloorEntity(entity)) return 'mepUnderfloor';
  if (isMepSegmentEntity(entity)) return isSegmentVertical(entity.params) ? null : 'mepSegment';
  return null;
}

/**
 * The snap-candidate `description` for an entity + category — e.g. `'bim-wall-corner'`
 * (→ «Γωνία τοίχου»), or `''` when the entity has no label root (περίεργο σχήμα) so the
 * overlay renders the glyph ΧΩΡΙΣ text. SSoT for the 3 generic BIM snap engines.
 */
export function bimCharacteristicDescription(entity: Entity, category: BimCharCategory): string {
  const root = getBimCharacteristicLabelRoot(entity);
  return root ? `bim-${root}-${CATEGORY_DESCRIPTION_SUFFIX[category]}` : '';
}

/**
 * Dispatch a BIM entity to its characteristic points (corner / midpoint / center).
 * Returns `EMPTY` for non-BIM and the few v1-deferred entities (railing / mep-fitting).
 */
export function getBimCharacteristicPoints(entity: Entity): BimCharPoints {
  if (isWallEntity(entity)) return wallPoints(entity);
  if (isBeamEntity(entity)) return beamPoints(entity);
  if (isColumnEntity(entity)) return columnPoints(entity);
  if (isMepSegmentEntity(entity)) return linearPoints(entity, segmentEndpoints(entity));
  if (isFoundationEntity(entity)) return foundationPoints(entity);
  if (isCentredBoxEntity(entity)) return centredBoxPoints(entity);
  const polygon = polygonFootprint(entity);
  if (polygon) return polygonPoints(entity, polygon);
  return EMPTY;
}

/**
 * Convenience accessor — the points of ONE category as a flat `Point2D[]`.
 * Used by the generic snap engine to build its per-category spatial index.
 */
export function getBimCharacteristicPointsOfCategory(
  entity: Entity,
  category: BimCharCategory,
): Point2D[] {
  const all = getBimCharacteristicPoints(entity);
  if (category === 'corner') return all.corners;
  if (category === 'midpoint') return all.midpoints;
  return all.center ? [all.center] : [];
}

// ─── Per-family resolvers ────────────────────────────────────────────────────

/** Wall: 4 face corners + axis midpoint. Linear → center = null. Straight → labelled. */
function wallPoints(entity: Entity): BimCharPoints {
  if (!isWallEntity(entity)) return EMPTY;
  const corners = getWallCornerWorldPoints(entity).map((c) => c.point);
  const straight = entity.kind === 'straight';
  return {
    corners,
    midpoints: straight ? getBimEntityEdgeMidpoints2D(entity) : [],
    center: null,
    labelRoot: getBimCharacteristicLabelRoot(entity),
  };
}

/** Beam: 4 face-end corners + axis midpoint. Linear → center = null. Curved → no label. */
function beamPoints(entity: Entity): BimCharPoints {
  if (!isBeamEntity(entity)) return EMPTY;
  const corners = getBeamCornerWorldPoints(entity).map((c) => c.point);
  const curved = entity.params.kind === 'curved';
  return {
    corners,
    midpoints: curved ? [] : getBimEntityEdgeMidpoints2D(entity),
    center: null,
    labelRoot: getBimCharacteristicLabelRoot(entity),
  };
}

/**
 * Column: 4 diagonal perimeter corners + 4 cardinal edge-midpoints + center anchor.
 * Only orthogonal footprints (`rectangular`/`shear-wall`) get a label.
 */
function columnPoints(entity: Entity): BimCharPoints {
  if (!isColumnEntity(entity)) return EMPTY;
  const corners = getColumnCornerWorldPoints(entity).map((c) => c.point);
  // ADR-363 Phase 5.5i — the column CENTER axis is owned by the dedicated
  // ColumnCenterSnapEngine (⊕ "Επί άξονα κολώνας"), so the generic BIM_CENTER does NOT
  // re-emit it here (avoids a duplicate centre candidate). Full ColumnCenter→BIM_CENTER
  // collapse is deferred (ADR-370).
  return {
    corners,
    // SAME edge-midpoint SSoT as every other area entity (4 side midpoints).
    midpoints: edgeMidpointsFromCorners(corners),
    center: null,
    labelRoot: getBimCharacteristicLabelRoot(entity),
  };
}

/**
 * Foundation: corners + edge-midpoints from the existing 7-grip SSoT (`getFoundationGrips`);
 * pad center = centroid of its corners (rectangle); strip / tie-beam are linear → no center.
 */
function foundationPoints(entity: Entity): BimCharPoints {
  if (!isFoundationEntity(entity)) return EMPTY;
  const grips = getFoundationGrips(entity);
  const corners = grips.filter((g) => isCornerGrip(g.foundationGripKind)).map((g) => g.position);
  const isPad = entity.params.kind === 'pad';
  return {
    corners,
    // SAME edge-midpoint SSoT as every other area entity → midpoints on ALL sides.
    midpoints: edgeMidpointsFromCorners(corners),
    center: isPad && corners.length >= 3 ? centroid2D(corners) : null,
    labelRoot: getBimCharacteristicLabelRoot(entity),
  };
}

/**
 * Centre-anchored box (8 point-based fixtures): 4 corners + 4 edge-midpoints + center
 * (`position`). Circular fixtures (mep-fixture) → center only, no corners, no label.
 */
function centredBoxPoints(entity: Entity): BimCharPoints {
  const box = toCentredBoxParams(entity);
  if (!box) return EMPTY;
  const center: Point2D = { x: box.position.x, y: box.position.y };
  const labelRoot = getBimCharacteristicLabelRoot(entity);
  if (labelRoot === null && isMepFixtureEntity(entity) && entity.params.shape === 'circular') {
    return { corners: [], midpoints: [], center, labelRoot: null };
  }
  const corners = getCentredBoxGrips(box).filter((g) => g.role.startsWith('corner-')).map((g) => g.position);
  return { corners, midpoints: edgeMidpointsFromCorners(corners), center, labelRoot };
}

/** Polygon-footprint entity (slab / slab-opening / roof / thermal-space / floor-finish / mep-underfloor). */
function polygonPoints(entity: Entity, vertices: Point2D[]): BimCharPoints {
  return {
    corners: vertices,
    midpoints: edgeMidpointsFromCorners(vertices),
    center: vertices.length >= 3 ? centroid2D(vertices) : null,
    labelRoot: getBimCharacteristicLabelRoot(entity),
  };
}

/** Linear entity (mep-segment): endpoints as "corners" + axis midpoint, no center. */
function linearPoints(entity: Entity, endpoints: Point2D[]): BimCharPoints {
  if (endpoints.length < 2) return { corners: endpoints, midpoints: [], center: null, labelRoot: null };
  const [a, b] = endpoints;
  return {
    corners: endpoints,
    midpoints: [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }],
    center: null,
    labelRoot: getBimCharacteristicLabelRoot(entity),
  };
}

// ─── Source helpers ──────────────────────────────────────────────────────────

/** True if the entity is one of the 8 centre-anchored box fixtures. */
function isCentredBoxEntity(entity: Entity): boolean {
  return (
    isMepFixtureEntity(entity) || isElectricalPanelEntity(entity) || isMepManifoldEntity(entity) ||
    isMepRadiatorEntity(entity) || isMepBoilerEntity(entity) || isMepWaterHeaterEntity(entity) ||
    isFurnitureEntity(entity) || isFloorplanSymbolEntity(entity)
  );
}

/** Map a centre-anchored fixture's params to the shared `CentredBoxParams` shape. */
function toCentredBoxParams(entity: Entity): CentredBoxParams | null {
  if (isFurnitureEntity(entity) || isFloorplanSymbolEntity(entity)) {
    const p = entity.params as { position: { x: number; y: number; z?: number }; rotationDeg: number; widthMm: number; depthMm: number; sceneUnits?: CentredBoxParams['sceneUnits'] };
    return { position: p.position, rotation: p.rotationDeg, width: p.widthMm, length: p.depthMm, sceneUnits: p.sceneUnits };
  }
  if (isCentredBoxEntity(entity)) {
    return (entity as unknown as { params: CentredBoxParams }).params;
  }
  return null;
}

/** Polygon-footprint vertices in world coords, or null if the entity is not polygon-based. */
function polygonFootprint(entity: Entity): Point2D[] | null {
  if (isSlabEntity(entity)) return getSlabCornerWorldPoints(entity).map((c) => c.point);
  if (isSlabOpeningEntity(entity)) return verticesOf(entity.params.outline?.vertices);
  if (isOpeningEntity(entity)) return getOpeningCornerWorldPoints(entity).map((c) => c.point);
  if (isRoofEntity(entity)) return verticesOf(entity.params.outline?.vertices);
  if (isThermalSpaceEntity(entity)) return verticesOf(entity.params.footprint?.vertices);
  if (isFloorFinishEntity(entity)) return verticesOf(entity.params.footprint?.vertices);
  if (isMepUnderfloorEntity(entity)) return verticesOf(entity.params.footprint?.vertices);
  return null;
}

/** Opening is a polygon but its label/center differ (handled by polygonPoints + labelRoot). */
function segmentEndpoints(entity: Entity): Point2D[] {
  if (!isMepSegmentEntity(entity)) return [];
  const { startPoint: s, endPoint: e } = entity.params;
  return [{ x: s.x, y: s.y }, { x: e.x, y: e.y }];
}

function verticesOf(verts: ReadonlyArray<{ x: number; y: number }> | undefined): Point2D[] {
  return verts ? verts.map((v) => ({ x: v.x, y: v.y })) : [];
}

const CORNER_GRIP_RE = /corner/;
function isCornerGrip(kind: string | undefined): boolean {
  return !!kind && CORNER_GRIP_RE.test(kind);
}

/**
 * Per-edge midpoints of a footprint given its corner points — the ONE SSoT used by
 * EVERY area BIM entity (column / foundation / centred-box / slab / roof …). Returns a
 * midpoint for ALL sides (Giorgio: «τα μέσα σε όλες τις πλευρές»). Corners are sorted
 * into perimeter order (by angle about the centroid) FIRST, so a caller's corner order
 * (grip emission order, diagonal-anchor order, polygon winding) does not matter — every
 * footprint yields the same N edge midpoints. Convex footprints (≈all BIM) are exact.
 */
function edgeMidpointsFromCorners(corners: readonly Point2D[]): Point2D[] {
  if (corners.length < 2) return [];
  if (corners.length === 2) {
    const [a, b] = corners;
    return [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
  }
  const ordered = sortPerimeter(corners);
  return ordered.map((c, i) => {
    const next = ordered[(i + 1) % ordered.length]!;
    return { x: (c.x + next.x) / 2, y: (c.y + next.y) / 2 };
  });
}

/** Order points counter-clockwise around their centroid (perimeter order for a convex footprint). */
function sortPerimeter(corners: readonly Point2D[]): Point2D[] {
  const c = centroid2D(corners);
  return [...corners].sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
}

/** Arithmetic-mean centroid (XY), via the polygon-utils SSoT (z ignored). */
function centroid2D(pts: readonly Point2D[]): Point2D {
  return polygonCentroid(pts.map((p) => ({ x: p.x, y: p.y, z: 0 })));
}
