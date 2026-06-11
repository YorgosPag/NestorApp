/**
 * ADR-363 Phase 4.5 + 4.5b + Phase 8C — Column parametric grip handlers
 * (base + variants).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors το
 * `bim/beams/beam-grips.ts` (Phase 5.5a/5.5b) pattern και exposes τα grips που
 * περιγράφει το ADR-363 §6 Phase 4.5 + 4.5b + Phase 8C:
 *
 *   Base (Phase 4.5):
 *   - `column-center`   → translate `position` (movesEntity=true)
 *   - `column-rotation` → rotate γύρω από `position` (anchor invariant). Skip
 *                          για `circular` kind.
 *   - `column-width`    → resize width on the far edge from anchor (local X
 *                          axis). For circular + polygon kinds: resize
 *                          (circumscribed) diameter symmetric 2× factor.
 *   - `column-depth`    → resize depth on the far edge from anchor (local Y
 *                          axis). Skip για `circular` + `polygon` kinds.
 *
 *   Variant-specific Phase 4.5b (`column-variant-grips.ts`):
 *   - `column-arm-length`    → L-shape only (asymmetric, 1× factor)
 *   - `column-arm-width`     → L-shape only (asymmetric, 1× factor)
 *   - `column-flange-length` → T-shape only (symmetric, 2× factor)
 *   - `column-web-thickness` → T-shape only (symmetric, 2× factor)
 *
 *   Variant-specific Phase 8C (`column-variant-grips.ts`):
 *   - `column-i-flange-thickness` → I-shape only (asymmetric, 1× factor)
 *   - `column-i-web-thickness`    → I-shape only (symmetric, 2× factor)
 *
 *   Polygon kind (Phase 8C):
 *   - 3 grips total = center + rotation + width (circumscribed Ø).
 *     ΟΧΙ depth grip (polygon ignores depth). Rotation handle position uses
 *     actual N-gon bbox dimY (`polygonBboxMm`) ώστε το offset να ταιριάζει με
 *     τη γεωμετρία.
 *
 *   Shear-wall kind (Phase 8C):
 *   - 4 grips identical με rectangular (center + rotation + width + depth).
 *     Falls through default branch — shear-wall = rect parity.
 *
 *   I-shape kind (Phase 8C):
 *   - 6 grips = base 4 + 2 variant (flange-thickness + web-thickness).
 *
 *   Circular (unchanged): 2 grips = center + width.
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY
 *     new `ColumnParams`).
 *   - Local-frame primitives live in `column-grip-utils.ts` (shared με variant
 *     module). Anchor invariant during drag — `position` stays fixed για
 *     width/depth/rotation/variant grips· centroid shifts automatically μέσω
 *     της geometry pipeline.
 *   - Polygon bbox math centralized στο `column-anchors.ts` (`polygonBboxMm`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5/4.5b/8C
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnGripKind, GripInfo } from '../../hooks/useGripMovement';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import { ANCHOR_OFFSETS, MIN_COLUMN_DIMENSION_MM } from '../types/column-types';
import { rotatePoint } from '../../utils/rotation-math';
import { sweptAngleDegAboutPivot, farEdgeSign } from '../grips/grip-math';
import {
  RAD_TO_DEG,
  depthHandleWorld,
  projectDeltaToLocal,
  rotationHandleWorld,
  widthHandleWorld,
} from './column-grip-utils';
import { mmScaleFor } from '../../utils/scene-units';
import {
  armLengthHandlePosition,
  armWidthHandlePosition,
  baseThicknessHandlePosition,
  flangeLengthHandlePosition,
  iFlangeThicknessHandlePosition,
  iWebThicknessHandlePosition,
  legThicknessHandlePosition,
  resizeArmLength,
  resizeArmWidth,
  resizeBaseThickness,
  resizeFlangeLength,
  resizeIFlangeThickness,
  resizeIWebThickness,
  resizeLegThickness,
  resizeWebThickness,
  webThicknessHandlePosition,
} from './column-variant-grips';
import {
  columnPolygon,
  polyVertexHandlePosition,
  resizePolyVertex,
} from './column-poly-vertex-grips';
// ADR-363 Slice C — rectangular / shear-wall corners + edges via shared
// `rect-grip-engine` SSoT (wall/foundation parity). Variant/circular/polygon
// kinds keep their own transforms (this adapter returns null for them).
import {
  isRectColumn,
  rectColumnCornerGrips,
  applyRectColumnGrip,
} from './column-rect-adapter';

// ─── Grip emission (ADR-363 §6 Phase 4.5 + 4.5b) ─────────────────────────────

/**
 * Compute parametric grip positions για ένα `ColumnEntity`. Stable order.
 *
 * ADR-363 Φ1G.5 Slice 2: the `0 → center` MOVE grip listed below is NO LONGER
 * emitted (declutter — Alt+drag moves the column); every layout drops it and
 * leaves gripIndex 0 unused. The remaining indices are unchanged (no reindex).
 *
 *   rectangular / shear-wall (4 grips):
 *     0 → center, 1 → rotation, 2 → width, 3 → depth
 *
 *   L-shape (6 grips — Phase 4.5b adds 2 variant grips):
 *     0 → center, 1 → rotation, 2 → width, 3 → depth,
 *     4 → arm-length (inner-corner horizontal edge, asymmetric),
 *     5 → arm-width  (inner-corner vertical edge, asymmetric)
 *
 *   T-shape (6 grips — Phase 4.5b adds 2 variant grips):
 *     0 → center, 1 → rotation, 2 → width, 3 → depth,
 *     4 → flange-length (right side edge of πέλμα, symmetric),
 *     5 → web-thickness (right side edge of κορμός, symmetric)
 *
 *   I-shape (6 grips — Phase 8C adds 2 variant grips):
 *     0 → center, 1 → rotation, 2 → width (b), 3 → depth (h),
 *     4 → i-flange-thickness (top-flange bottom-edge, 1× factor),
 *     5 → i-web-thickness (web left-edge, 2× symmetric factor)
 *
 *   polygon (3 grips — Phase 8C):
 *     0 → center, 1 → rotation, 2 → width (= circumscribed Ø)
 *
 *   circular (2 grips):
 *     0 → center, 1 → width (= diameter, handle στο world +X)
 */
export function getColumnGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const { params } = entity;
  const grips: GripInfo[] = [];

  // ADR-363 Φ1G.5 Slice 2 — the central MOVE grip (`column-center`, gripIndex 0)
  // is no longer emitted: Alt+drag from any remaining grip (rotation / width /
  // depth / variant; circular keeps its width handle) moves the whole column
  // (declutter). gripIndex 0 is left unused — NO reindex. The `column-center`
  // transform (`moveCenter`) + hot-grip move path are retained but unreachable.

  if (params.kind === 'circular') {
    grips.push({
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: widthHandleWorld(params),
      movesEntity: false,
      columnGripKind: 'column-width',
    });
    return grips;
  }

  if (params.kind === 'polygon') {
    grips.push({
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: rotationHandleWorld(params),
      movesEntity: false,
      columnGripKind: 'column-rotation',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 2,
      type: 'vertex',
      position: widthHandleWorld(params),
      movesEntity: false,
      columnGripKind: 'column-width',
    });
    return grips;
  }

  // ADR-363 Phase 2b — polygon-backed U-shape / composite (από-περίγραμμα):
  // center + rotation + ΜΙΑ λαβή ανά κορυφή. ΟΧΙ width/depth grips — είναι
  // no-ops για polygon-backed (`buildUshapeLocal`/`buildCompositeLocal`
  // αγνοούν width/depth όταν υπάρχει polygon).
  const backingPoly = columnPolygon(params);
  if (backingPoly && backingPoly.length >= 3) {
    grips.push({
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: rotationHandleWorld(params),
      movesEntity: false,
      columnGripKind: 'column-rotation',
    });
    backingPoly.forEach((_, i) => {
      grips.push({
        entityId: entity.id,
        gripIndex: 10 + i,
        type: 'vertex',
        position: polyVertexHandlePosition(params, i),
        movesEntity: false,
        columnGripKind: `column-poly-vertex-${i}`,
      });
    });
    return grips;
  }

  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: rotationHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-rotation',
  });
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'vertex',
    position: widthHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-width',
  });
  grips.push({
    entityId: entity.id,
    gripIndex: 3,
    type: 'vertex',
    position: depthHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-depth',
  });

  if (params.kind === 'L-shape') {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'edge',
      position: armLengthHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-arm-length',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'edge',
      position: armWidthHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-arm-width',
    });
  } else if (params.kind === 'T-shape') {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'edge',
      position: flangeLengthHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-flange-length',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'edge',
      position: webThicknessHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-web-thickness',
    });
  } else if (params.kind === 'I-shape') {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'edge',
      position: iFlangeThicknessHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-i-flange-thickness',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'edge',
      position: iWebThicknessHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-i-web-thickness',
    });
  } else if (params.kind === 'U-shape') {
    // ADR-363 Phase 2b — manual παραμετρικό Π (χωρίς polygon): base 4 grips +
    // πάχος ποδιού + πάχος βάσης. (Το polygon-backed U επιστρέφει νωρίτερα.)
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'edge',
      position: legThicknessHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-leg-thickness',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'edge',
      position: baseThicknessHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-base-thickness',
    });
  }
  // ADR-363 Slice C — rectangular / shear-wall: add the 4 corner grips (indices
  // 4..7) so the rect column matches the wall/foundation 7-grip layout, sharing
  // the rect-grip-engine. (Variant kinds already consumed indices 4/5 above and
  // are excluded by `isRectColumn`.)
  if (isRectColumn(params)) {
    grips.push(...rectColumnCornerGrips(entity));
  }

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface ColumnGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: ColumnParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /**
   * ADR-397 — current world cursor position. Supplied by the 6-click rotation
   * hot-grip (`column-rotation`); the anchor is `currentPos − delta`.
   */
  readonly currentPos?: Point2D;
  /**
   * ADR-397 — optional rotation pivot for `column-rotation`. When set (6-click
   * AutoCAD ROTATE→Reference flow), the column rotates around this user-picked
   * centre: both `position` and `rotation` change. The swept angle is
   * anchor-relative (`currentPos − delta` → `currentPos`), so there is no snap.
   * Undefined → legacy handle-delta rotation about the column's own `position`.
   */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: column grip kind + drag input → new `ColumnParams`. Geometry
 * is NOT recomputed here — ο caller (`UpdateColumnParamsCommand.execute`) είναι
 * υπεύθυνος για την `computeColumnGeometry()` κλήση ώστε το math SSoT να μένει
 * σε ένα σημείο.
 *
 * Zero delta ή unknown grip kind → επιστρέφει `originalParams` referentially
 * unchanged ώστε ο caller να μπορεί να short-circuit το commit (no-op).
 */
export function applyColumnGripDrag(
  gripKind: ColumnGripKind,
  input: Readonly<ColumnGripDragInput>,
): ColumnParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;
  if (gripKind === 'column-center') return moveCenter(input);
  if (gripKind === 'column-rotation') {
    return input.pivot ? rotateAroundPivot(input) : rotateAroundPosition(input);
  }
  // ADR-363 Slice C — rect/shear-wall corners + width/depth edges → shared engine.
  // Returns null for non-rect kinds (circular/polygon/L/T/I/U) → fall through to
  // their own transforms below.
  const rectResult = applyRectColumnGrip(gripKind, input.originalParams, input.delta);
  if (rectResult) return rectResult;
  if (gripKind === 'column-width') return resizeWidth(input);
  if (gripKind === 'column-depth') return resizeDepth(input);
  if (gripKind === 'column-arm-length') return resizeArmLength(input);
  if (gripKind === 'column-arm-width') return resizeArmWidth(input);
  if (gripKind === 'column-flange-length') return resizeFlangeLength(input);
  if (gripKind === 'column-web-thickness') return resizeWebThickness(input);
  if (gripKind === 'column-i-flange-thickness') return resizeIFlangeThickness(input);
  if (gripKind === 'column-i-web-thickness') return resizeIWebThickness(input);
  // ADR-363 Phase 2b — U-shape (Π) parametric + polygon-backed per-vertex grips.
  if (gripKind === 'column-leg-thickness') return resizeLegThickness(input);
  if (gripKind === 'column-base-thickness') return resizeBaseThickness(input);
  if (gripKind.startsWith('column-poly-vertex-')) {
    const idx = parseInt(gripKind.slice('column-poly-vertex-'.length), 10);
    if (!Number.isFinite(idx) || idx < 0) return input.originalParams;
    return resizePolyVertex(input, idx);
  }
  return input.originalParams;
}

// ─── Per-grip base transforms ────────────────────────────────────────────────

function moveCenter(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    position: {
      x: originalParams.position.x + delta.x,
      y: originalParams.position.y + delta.y,
      z: originalParams.position.z ?? 0,
    },
  };
}

function rotateAroundPosition(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular') return originalParams;
  const oldHandle = rotationHandleWorld(originalParams);
  const newHandle = { x: oldHandle.x + delta.x, y: oldHandle.y + delta.y };
  const oldVec = {
    x: oldHandle.x - originalParams.position.x,
    y: oldHandle.y - originalParams.position.y,
  };
  const newVec = {
    x: newHandle.x - originalParams.position.x,
    y: newHandle.y - originalParams.position.y,
  };
  const oldAngle = Math.atan2(oldVec.y, oldVec.x);
  const newAngle = Math.atan2(newVec.y, newVec.x);
  const deltaDeg = (newAngle - oldAngle) * RAD_TO_DEG;
  return { ...originalParams, rotation: originalParams.rotation + deltaDeg };
}

/**
 * ADR-397 — 6-click AutoCAD ROTATE→Reference rotation about a user-picked pivot.
 * Both `position` and `rotation` change so the column ORBITS the pivot (mirror of
 * the wall `rotateWall` pivot path). Swept angle is anchor-relative
 * (`currentPos − delta` → `currentPos`) so grabbing the handle does not snap.
 *
 * Point rotation delegates to the canonical `rotatePoint` SSoT (ADR-188,
 * `utils/rotation-math.ts`) — the same primitive `bim-rotate-geometry.rotateColumn`,
 * RotateEntityCommand and the array/guide rotate tools use. No re-implemented cos/sin.
 */
function rotateAroundPivot(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta, currentPos, pivot } = input;
  if (!currentPos || !pivot) return originalParams;
  const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const sweptDeg = sweptAngleDegAboutPivot(pivot, anchor, currentPos);
  if (sweptDeg === null) return originalParams;
  const newPos = rotatePoint(
    { x: originalParams.position.x, y: originalParams.position.y },
    pivot,
    sweptDeg,
  );
  return {
    ...originalParams,
    position: { x: newPos.x, y: newPos.y, z: originalParams.position.z ?? 0 },
    rotation: originalParams.rotation + sweptDeg,
  };
}

function resizeWidth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  // ADR-397 — `delta` is in scene units, `width` in mm; convert the scene-unit
  // local delta back to mm (÷ s) before adding, so resize tracks the cursor 1:1
  // in metre/cm scenes (mirror wall `resizeThickness` / `mmScaleFor`).
  const s = mmScaleFor(originalParams);
  if (originalParams.kind === 'circular') {
    const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + (2 * delta.x) / s);
    return { ...originalParams, width: newWidth };
  }
  if (originalParams.kind === 'polygon') {
    // Phase 8C — polygon scales symmetrically about centroid. Handle at local
    // (width/2, 0) → drag dxLocal → newWidth = width + 2·dxLocal (mirror των
    // T-shape flange-length / column-web-thickness symmetric 2× pattern).
    const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
    const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + (2 * dxLocal) / s);
    return { ...originalParams, width: newWidth };
  }
  const { dx } = ANCHOR_OFFSETS[originalParams.anchor];
  const signX = farEdgeSign(dx);
  const coefX = signX * 0.5 - dx;
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + dxLocal / (coefX * s));
  return { ...originalParams, width: newWidth };
}

function resizeDepth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular' || originalParams.kind === 'polygon') {
    return originalParams;
  }
  const s = mmScaleFor(originalParams);
  const { dy } = ANCHOR_OFFSETS[originalParams.anchor];
  const signY = farEdgeSignY(dy);
  const coefY = signY * 0.5 - dy;
  const { dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newDepth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.depth + dyLocal / (coefY * s));
  return { ...originalParams, depth: newDepth };
}
