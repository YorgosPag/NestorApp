/**
 * ADR-363 Phase 1 — Pure builders for wall entity creation.
 *
 * SSoT:
 *   - IDs via `generateWallId()` (N.6 enterprise-id, ADR-017/210/294).
 *   - Geometry via `computeWallGeometry()` — pure function, single source of
 *     truth για axisPolyline / outer / inner / bbox / length / area / volume.
 *   - DNA via `getDefaultDnaForCategory()` — preset per category.
 *   - Validation via `validateWallParams()` — hardErrors block creation;
 *     codeViolations surface στο property panel ως red badge.
 *   - Types via `bim/types/wall-types.ts`.
 *
 * Phase 1 default `kind = 'straight'`. Curved + polyline land Phase 1.5.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §5.9
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type {
  WallCategory,
  WallEntity,
  WallGeometry,
  WallKind,
  WallParams,
} from '../../bim/types/wall-types';
import { DEFAULT_WALL_HEIGHT_MM } from '../../bim/types/wall-types';
import { getDefaultDnaForCategory } from '../../bim/types/wall-dna-types';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../bim/validators/wall-validator';
import {
  DEFAULT_WALL_BASE_BINDING,
  DEFAULT_WALL_TOP_BINDING,
} from '../../bim/types/bim-binding';
import { createWall } from '@/services/factories/wall.factory';
import { resolveAutoWallTypeId } from '../../bim/family-types/wall-type-auto-assign';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { GuideBinding } from '../../bim/hosting/guide-binding-types';
import type { AxisGuideReader } from '../../bim/foundations/foundation-from-grid';
import { resolveAxisBindings, type AxisCoord } from '../../bim/hosting/resolve-axis-bindings';
import { resolveStoreyHeightMm } from '../../systems/levels/storey-creation-defaults';
import { resolveMemberColumnFlushJustification } from '../../bim/framing/member-column-flush';
import type { StripJustification } from '../../bim/types/foundation-types';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultWallParams`. The ribbon (contextual wall tab)
 * supplies `category` + `height`; advanced overrides (`thickness`, custom `dna`,
 * `flip`) land Phase 1.5 via the WallDna editor.
 */
export interface WallParamOverrides {
  readonly category?: WallCategory;
  /** mm. */
  readonly height?: number;
  /** mm. Overrides DNA-derived thickness (advanced use only). */
  readonly thickness?: number;
  readonly flip?: boolean;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `WallParams` from 2 click points + optional overrides.
 *
 * Algorithm:
 *   1. Resolve category (override → 'exterior' default).
 *   2. Resolve DNA from category (SSoT preset).
 *   3. Resolve thickness from DNA totalThickness (or explicit override).
 *   4. Scalars (height, thickness) stored in mm — always, regardless of sceneUnits.
 *      Boundary conversion (mm → canvas units) happens in computeWallGeometry.
 */
/**
 * Resolve the wall thickness (mm) a given override set will produce — SSoT for
 * both `buildDefaultWallParams` and any caller that needs the thickness BEFORE
 * building (e.g. the on-entity rectangle axis-offset in `wall-from-entity.ts`).
 * Mirrors the Revit "Generic Wall" rule: explicit override wins, else the DNA
 * preset's `totalThickness` for the category.
 */
export function resolveWallThicknessMm(overrides: WallParamOverrides = {}): number {
  if (overrides.thickness !== undefined) return overrides.thickness;
  return getDefaultDnaForCategory(overrides.category ?? 'exterior').totalThickness;
}

export function buildDefaultWallParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  overrides: WallParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  alignmentPoint?: Readonly<Point2D> | null,
): WallParams {
  const category: WallCategory = overrides.category ?? 'exterior';
  // ADR-448 Phase 2 — storey-aware default: override → active storey height → legacy const.
  const height = resolveStoreyHeightMm(overrides.height, DEFAULT_WALL_HEIGHT_MM);
  // Thickness resolution (Revit "Generic Wall" pattern, SSoT `resolveWallThicknessMm`):
  //   - Explicit override → manual wall, NO DNA attached (caller owns layers).
  //   - Else → DNA preset SSoT, thickness === dna.totalThickness.
  const overrideThickness = overrides.thickness;
  const thickness = resolveWallThicknessMm(overrides);
  const dna: ReturnType<typeof getDefaultDnaForCategory> | null =
    overrideThickness === undefined ? getDefaultDnaForCategory(category) : null;
  // ADR-363 Phase 1F — alignment offset: shift the axis perpendicular toward
  // `alignmentPoint` so the edge AWAY from C sits on the original A→B line and
  // the wall body extends TOWARD C. `null`/`undefined` ⇒ classic centered axis.
  const offset = alignmentPoint
    ? computeWallAlignmentOffset(startPoint, endPoint, alignmentPoint, thickness, sceneUnits)
    : { x: 0, y: 0 };
  const start: Point3D = { x: startPoint.x + offset.x, y: startPoint.y + offset.y, z: 0 };
  const end: Point3D = { x: endPoint.x + offset.x, y: endPoint.y + offset.y, z: 0 };

  const base = {
    category,
    start,
    end,
    height,
    thickness,
    flip: overrides.flip ?? false,
    sceneUnits,
    baseBinding: DEFAULT_WALL_BASE_BINDING,
    topBinding: DEFAULT_WALL_TOP_BINDING,
    baseOffset: 0,
    topOffset: 0,
  };
  return dna === null ? base : { ...base, dna };
}

/**
 * Compute the perpendicular offset that shifts a wall axis (A→B) so that one
 * edge coincides with the A→B click line and the wall body extends toward
 * `alignmentPoint` (ADR-363 Phase 1F):
 *
 *   - cross > 0 (C on the +n_ccw / "left" side of A→B): axis shifts +n_ccw →
 *     wall extends LEFT; the "right" edge of the wall stays on A→B.
 *   - cross < 0 (C on the "right" side): axis shifts -n_ccw → wall extends
 *     RIGHT; the "left" edge of the wall stays on A→B.
 *   - cross = 0 (C colinear with axis) or len(A→B) ≈ 0: zero offset (centered).
 *
 * The returned offset is in canvas world units and is meant to be ADDED to
 * BOTH start and end of the original axis before constructing `WallParams`.
 */
export function computeWallAlignmentOffset(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  alignmentPoint: Readonly<Point2D>,
  thicknessMm: number,
  sceneUnits: SceneUnits = 'mm',
): Point2D {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 0 };

  const nx = -dy / len;
  const ny = dx / len;

  const cross = dx * (alignmentPoint.y - startPoint.y) - dy * (alignmentPoint.x - startPoint.x);
  if (cross === 0) return { x: 0, y: 0 };
  const sign = cross > 0 ? 1 : -1;

  const halfThicknessCanvas = (thicknessMm / 2) * mmToSceneUnits(sceneUnits);

  return {
    x: sign * halfThicknessCanvas * nx,
    y: sign * halfThicknessCanvas * ny,
  };
}

/**
 * ADR-363 — "Location Line = Finish Face" default for the straight wall tool:
 * returns a synthetic alignment point on the +n_ccw (left) side of A→B so the
 * drawn A→B line becomes one wall FACE (edge) and the body extends left, instead
 * of the line being the centerline. Reuses `computeWallAlignmentOffset` (SSoT) —
 * feed the returned point as `alignmentPoint` to `buildDefaultWallParams`.
 *
 * This is the PRE-PICK default shown by the `awaitingEnd` rubber-band preview and
 * applied by the dynamic-input precision commit, so preview == commit (WYSIWYG).
 * The user re-picks the actual side at the 3rd alignment click. Returns `null`
 * for a degenerate (zero-length) segment ⇒ caller falls back to centered.
 */
export function defaultEdgeAlignmentPoint(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
): Point2D | null {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  // +n_ccw (left of A→B direction): any positive distance picks the left side
  // in `computeWallAlignmentOffset` (cross > 0).
  return { x: startPoint.x + (-dy / len), y: startPoint.y + (dx / len) };
}

/**
 * ADR-508 — alignment point για ένα ΣΥΓΚΕΚΡΙΜΕΝΟ justification ('left'/'right'). 'left' =
 * +n_ccw (=`defaultEdgeAlignmentPoint`)· 'right' = −n_ccw (αντίθετη παρειά). `null` σε
 * εκφυλισμένο τμήμα.
 */
function edgeAlignmentPointForJustification(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  justification: StripJustification,
): Point2D | null {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const sign = justification === 'right' ? -1 : 1;
  return { x: startPoint.x + sign * (-dy / len), y: startPoint.y + sign * (dx / len) };
}

/**
 * ADR-508 — free-placement auto-flush (mirror του `buildAnchoredBeamParams`): όταν ένα άκρο
 * πατά μέσα σε κολόνα, η πλευρική παρειά του τοίχου ευθυγραμμίζεται flush με την παρειά της
 * (full bearing) μέσω του geometric SSoT `resolveMemberColumnFlushJustification`. Χωρίς κολόνα
 * → fallback 'left' (location-line = face, διατηρεί την υπάρχουσα default συμπεριφορά).
 * Τροφοδοτεί το ΥΠΑΡΧΟΝ `buildDefaultWallParams(..., alignmentPoint)` — καμία νέα offset math.
 */
export function buildAnchoredWallParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  overrides: WallParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  columnFootprints: readonly (readonly Point2D[])[] = [],
): WallParams {
  const justification = resolveMemberColumnFlushJustification(startPoint, endPoint, columnFootprints, 'left');
  const alignmentPoint = edgeAlignmentPointForJustification(startPoint, endPoint, justification);
  return buildDefaultWallParams(startPoint, endPoint, overrides, sceneUnits, alignmentPoint);
}

// ─── Entity builder ──────────────────────────────────────────────────────────

/**
 * Result από `buildWallEntity`: είτε επιτυχία (entity + geometry valid) είτε
 * αποτυχία λόγω hard errors (validator-returned i18n keys). Mirrors stair
 * pattern — hardErrors are non-empty only when the wall is geometrically
 * invalid (e.g. zero-length, thickness 0).
 */
export type BuildWallEntityResult =
  | { readonly ok: true; readonly entity: WallEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `WallEntity` from `WallParams`. Geometry computed via the SSoT
 * `computeWallGeometry()` — Phase 1 NEVER duplicates that math here.
 * Hard errors from the validator short-circuit creation; non-blocking code
 * violations are baked into `entity.validation`.
 */
export function buildWallEntity(
  params: Readonly<WallParams>,
  layerId: string,
  kind: WallKind = 'straight',
  sceneUnits: SceneUnits = 'mm',
): BuildWallEntityResult {
  const validation = validateWallParams(params, sceneUnits);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry: WallGeometry = computeWallGeometry(params, kind);
  const entity: WallEntity = createWall({
    kind,
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  // ADR-412/414 — link the wall to its category's read-only built-in family type
  // when its cross-section still matches the category default (non-destructive;
  // manual/customised walls stay ad-hoc). Resolution + persistence already carry
  // `typeId` (zero extra wiring downstream).
  const typeId = resolveAutoWallTypeId(params);
  return { ok: true, entity: typeId ? { ...entity, typeId } : entity };
}

// ─── ADR-441 Slice WALL — host-on-snap grid bindings ─────────────────────────

/** Scene-units κατώφλι κάτω από το οποίο ο τοίχος θεωρείται axis-aligned. */
const AXIS_ALIGNED_EPS_SCENE = 1e-6;

/**
 * Resolve τα grid bindings ενός τοίχου (Revit wall-on-grid). Lookup με τα **location-line**
 * σημεία (`clickStart/clickEnd` = παρειά), extend από τα **axis** params (Finish-Face → η
 * παρειά μένει στον άξονα). ΜΟΝΟ axis-aligned τοίχοι (οριζόντιοι/κατακόρυφοι) — διαγώνιοι
 * (μη-ορθογώνιος κάναβος) επιστρέφουν `[]` (η perpendicular μετατόπιση δεν αναπαράγεται από
 * single-axis slot). Pure (ο `reader` injected) → unit-testable.
 */
export function resolveWallGridBindings(
  clickStart: Readonly<Point2D>,
  clickEnd: Readonly<Point2D>,
  params: Pick<WallParams, 'start' | 'end'>,
  reader: AxisGuideReader,
  tol: number,
  sceneUnits: SceneUnits,
): GuideBinding[] {
  const isVertical = Math.abs(params.start.x - params.end.x) < AXIS_ALIGNED_EPS_SCENE;
  const isHorizontal = Math.abs(params.start.y - params.end.y) < AXIS_ALIGNED_EPS_SCENE;
  if (!isVertical && !isHorizontal) return [];
  const canvasToMm = 1 / mmToSceneUnits(sceneUnits);
  const coords: AxisCoord[] = [
    { axis: 'X', value: clickStart.x, axisValue: params.start.x, slot: 'start-x' },
    { axis: 'Y', value: clickStart.y, axisValue: params.start.y, slot: 'start-y' },
    { axis: 'X', value: clickEnd.x, axisValue: params.end.x, slot: 'end-x' },
    { axis: 'Y', value: clickEnd.y, axisValue: params.end.y, slot: 'end-y' },
  ];
  return resolveAxisBindings(coords, reader, tol, canvasToMm);
}

// ─── Two-click completion helper ─────────────────────────────────────────────

/**
 * High-level helper bridging the wall tool state machine (Phase 1: 2 clicks =
 * start → end) and the builder pipeline. Returns a fully-formed entity or a
 * validator error list. Pure — no side effects, no Firestore writes.
 */
export function completeWallFromTwoClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  layerId: string,
  overrides: WallParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
  alignmentPoint?: Readonly<Point2D> | null,
): BuildWallEntityResult {
  const params = buildDefaultWallParams(startPoint, endPoint, overrides, sceneUnits, alignmentPoint);
  return buildWallEntity(params, layerId, 'straight', sceneUnits);
}
