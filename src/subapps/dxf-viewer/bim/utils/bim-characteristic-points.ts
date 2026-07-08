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
import { computeColumnGeometry } from '../geometry/column-geometry';
import { getFoundationGrips } from '../foundations/foundation-grips';
import { gripKindOf } from '../../hooks/grip-kinds';
import { getCentredBoxGrips, type CentredBoxParams } from '../grips/centred-box-grips';
import { polygon2DCentroid, polygon2DAreaCentroid, footprintEdgeMidpoints, projectVerticesTo2D } from '../geometry/shared/polygon-utils';
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
    // ADR-370 §L-label (Giorgio 2026-07-05): ΚΑΘΕ πολυγωνική κολόνα (rectangular / shear-wall /
    // L / Γ / T / U / I / polygon / composite) δείχνει «Γωνία/Μέσο/Κέντρο κολόνας» — οι γωνίες
    // της είναι πραγματικές δομικές γωνίες, όχι «περίεργο σχήμα». ΜΟΝΟ η circular μένει χωρίς
    // label (δεν έχει γωνίες — μόνο 45° perimeter anchors).
    return entity.params.kind === 'circular' ? null : 'column';
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
//
// EVERY footprint entity goes through the SAME `footprintPoints` core (Giorgio: «ίδια
// συμπεριφορά σε όλα, ενοποιημένος κώδικας, όχι διπλότυπα»): corners → edge-midpoints on
// ALL sides → centroid. Each family differs ONLY in how it sources its corner points.

/**
 * The ONE corner→midpoint→center derivation, shared by wall / beam / column / foundation /
 * centred-box / slab / roof / … Returns a midpoint for ALL sides + a centroid. Always emits
 * the points; `labelRoot=null` (περίεργα σχήματα) just suppresses the text (req #4).
 */
/**
 * @param isOrderedPolygon τα `corners` είναι ΗΔΗ σε polygon winding order (footprint vertices).
 *   ADR-370 §non-convex-fix: για ΜΗ-ΚΥΡΤΑ αποτυπώματα (L/Γ/T/U columns, αυθαίρετα slab polygons)
 *   ΠΡΕΠΕΙ true — αλλιώς το angular sort των midpoints + ο μέσος-όρος-κορυφών centroid πέφτουν
 *   ΕΚΤΟΣ σχήματος (στο notch). Convex 4-corner sources (wall/beam/foundation/box) → false.
 */
function footprintPoints(corners: Point2D[], labelRoot: string | null, isOrderedPolygon = false): BimCharPoints {
  return {
    corners,
    midpoints: edgeMidpointsFromCorners(corners, isOrderedPolygon),
    center: corners.length >= 3
      ? (isOrderedPolygon ? centroidOrdered2D(corners) : centroid2D(corners))
      : null,
    labelRoot,
  };
}

function wallPoints(entity: Entity): BimCharPoints {
  if (!isWallEntity(entity)) return EMPTY;
  return footprintPoints(getWallCornerWorldPoints(entity).map((c) => c.point), getBimCharacteristicLabelRoot(entity));
}

function beamPoints(entity: Entity): BimCharPoints {
  if (!isBeamEntity(entity)) return EMPTY;
  return footprintPoints(getBeamCornerWorldPoints(entity).map((c) => c.point), getBimCharacteristicLabelRoot(entity));
}

function columnPoints(entity: Entity): BimCharPoints {
  if (!isColumnEntity(entity)) return EMPTY;
  const labelRoot = getBimCharacteristicLabelRoot(entity);
  // Circular → keep the 4 perimeter (45°) anchors as "corners". A circle has NO real
  // vertices; its `computeColumnGeometry` footprint is a fine tessellation (~32-64 pts)
  // that must NOT be indexed as snap corners.
  if (entity.params.kind === 'circular') {
    return footprintPoints(getColumnCornerWorldPoints(entity).map((c) => c.point), labelRoot);
  }
  // ADR-398 / ADR-363 Φ1G.5 — polygonal kinds (rectangular / shear-wall / L / T / U / I /
  // composite / polygon): index the ACTUAL footprint vertices, via the SAME
  // `computeColumnGeometry` footprint SSoT the per-vertex grips + the moving column's
  // corner projection use. So a STATIONARY L/T/U/Π column exposes its reentrant/notch
  // corners (+ midpoints of ALL real edges + centroid) as snap targets — symmetric with
  // the moving side — not just the 4 bounding-box corners. Rectangular → the 4 real
  // vertices ARE the 4 bbox corners (zero regression).
  const verts = projectVerticesTo2D(computeColumnGeometry(entity.params).footprint.vertices);
  // ADR-370 §non-convex-fix: το footprint είναι polygon σε winding order → isOrderedPolygon=true
  // ώστε L/Γ/T/U να μη βγάζουν midpoints/κέντρο στο κενό (notch).
  return footprintPoints(verts, labelRoot, true);
}

function foundationPoints(entity: Entity): BimCharPoints {
  if (!isFoundationEntity(entity)) return EMPTY;
  const corners = getFoundationGrips(entity).filter((g) => isCornerGrip(gripKindOf(g, 'foundation'))).map((g) => g.position);
  return footprintPoints(corners, getBimCharacteristicLabelRoot(entity));
}

/** Centre-anchored box (8 fixtures). Circular fixtures → center only (no corners), no label. */
function centredBoxPoints(entity: Entity): BimCharPoints {
  const box = toCentredBoxParams(entity);
  if (!box) return EMPTY;
  if (isMepFixtureEntity(entity) && entity.params.shape === 'circular') {
    return { corners: [], midpoints: [], center: { x: box.position.x, y: box.position.y }, labelRoot: null };
  }
  const corners = getCentredBoxGrips(box).filter((g) => g.role.startsWith('corner-')).map((g) => g.position);
  return footprintPoints(corners, getBimCharacteristicLabelRoot(entity));
}

/** Polygon-footprint entity (slab / slab-opening / roof / thermal-space / floor-finish / mep-underfloor). */
function polygonPoints(entity: Entity, vertices: Point2D[]): BimCharPoints {
  // ADR-370 §non-convex-fix: polygon outline σε winding order → isOrderedPolygon=true (μπορεί
  // να είναι κοίλο — π.χ. slab/roof με notch).
  return footprintPoints(vertices, getBimCharacteristicLabelRoot(entity), true);
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
  return verts ? projectVerticesTo2D(verts) : [];
}

const CORNER_GRIP_RE = /corner/;
function isCornerGrip(kind: string | undefined): boolean {
  return !!kind && CORNER_GRIP_RE.test(kind);
}

/** Per-edge midpoints (all sides) — geometry SSoT in `polygon-utils.footprintEdgeMidpoints`.
 *  `preOrdered` → τα corners είναι polygon winding order (μη-κυρτά footprints· §non-convex-fix). */
function edgeMidpointsFromCorners(corners: readonly Point2D[], preOrdered = false): Point2D[] {
  return footprintEdgeMidpoints(corners, { preOrdered });
}

/** Arithmetic-mean centroid (XY) — convex/unordered sources (vertex-mean = area-centroid εκεί). */
function centroid2D(pts: readonly Point2D[]): Point2D {
  return polygon2DCentroid(pts);
}

/** Area (mass) centroid (XY) για ordered polygon footprints — μένει ΜΕΣΑ στο υλικό για κοίλα
 *  L/Γ/T/U (όπου ο μέσος όρος κορυφών πέφτει στο notch). §non-convex-fix (ADR-370). */
function centroidOrdered2D(pts: readonly Point2D[]): Point2D {
  return polygon2DAreaCentroid(pts);
}
