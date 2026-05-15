/**
 * ARRAY GRIP HANDLERS — ADR-353 Sessions A4 + B2
 *
 * Pure math for array grip drag. Computes the next params from a
 * grip-drag delta in world space. Consumed by the entity-grip system
 * (drag end → executeCommand(new UpdateArrayParamsCommand(...))).
 *
 * Rect grip kinds (AutoCAD parity):
 *   - 'origin'      → move base point (handled by MoveCommand on parent ArrayEntity)
 *   - 'col-count'   → drag along colDir at the last column corner
 *   - 'row-count'   → drag along rowDir at the last row corner
 *   - 'col-spacing' → adjust colSpacing only (between cell (0,0) and (0,1))
 *   - 'row-spacing' → adjust rowSpacing only (between cell (0,0) and (1,0))
 *
 * Polar grip kinds (Phase B):
 *   - 'polar-center'     → translate the array center
 *   - 'polar-radius'     → drag item 0 radially → adjust explicit radius
 *   - 'polar-fill-angle' → drag last item along arc → adjust fillAngle
 *                          (suppressed for full-circle arrays; meaningless)
 *
 * Each handler returns the next params. The caller is responsible for
 * issuing UpdateArrayParamsCommand with `isDragging` toggling false on
 * pointerup so consecutive drag samples merge into a single undo step
 * (UpdateArrayParamsCommand.canMergeWith handles the merge window).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArrayEntity } from '../../types/entities';
import type { PolarParams, RectParams, SourceBbox } from './types';
import { degToRad, radToDeg } from '../../rendering/entities/shared/geometry-utils';
import { computeSourceGroupBbox } from './array-bbox';

export type RectGripKind =
  | 'origin'
  | 'col-count'
  | 'row-count'
  | 'col-spacing'
  | 'row-spacing';

export interface RectGrip {
  readonly kind: RectGripKind;
  readonly position: Point2D;
}

interface BasisVectors {
  readonly colDir: { readonly x: number; readonly y: number };
  readonly rowDir: { readonly x: number; readonly y: number };
}

function basis(params: RectParams): BasisVectors {
  const rad = degToRad(params.angle);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    colDir: { x: c, y: s },
    rowDir: { x: -s, y: c },
  };
}

function getBasePoint(entity: ArrayEntity, bbox: SourceBbox): Point2D {
  return entity.basePointOverride ?? bbox.center;
}

/**
 * Compute grip world positions for a rect array. Used by the grip renderer.
 */
export function getRectGripPositions(entity: ArrayEntity): RectGrip[] {
  if (entity.params.kind !== 'rect') return [];
  const params = entity.params;
  const bbox = computeSourceGroupBbox(entity.hiddenSources);
  const base = getBasePoint(entity, bbox);
  const { colDir, rowDir } = basis(params);

  const lastColOffset = (params.cols - 1) * params.colSpacing;
  const lastRowOffset = (params.rows - 1) * params.rowSpacing;

  const origin: RectGrip = { kind: 'origin', position: base };
  const colCount: RectGrip = {
    kind: 'col-count',
    position: {
      x: base.x + lastColOffset * colDir.x,
      y: base.y + lastColOffset * colDir.y,
    },
  };
  const rowCount: RectGrip = {
    kind: 'row-count',
    position: {
      x: base.x + lastRowOffset * rowDir.x,
      y: base.y + lastRowOffset * rowDir.y,
    },
  };
  const colSpacing: RectGrip = {
    kind: 'col-spacing',
    position: {
      x: base.x + params.colSpacing * colDir.x,
      y: base.y + params.colSpacing * colDir.y,
    },
  };
  const rowSpacing: RectGrip = {
    kind: 'row-spacing',
    position: {
      x: base.x + params.rowSpacing * rowDir.x,
      y: base.y + params.rowSpacing * rowDir.y,
    },
  };

  return [origin, colCount, rowCount, colSpacing, rowSpacing];
}

/**
 * Apply a world-space drag delta to a grip and return the next RectParams.
 * Returns `null` if the grip kind is 'origin' (move handled outside via
 * basePointOverride update — not a params mutation).
 */
export function applyRectGripDrag(
  entity: ArrayEntity,
  gripKind: RectGripKind,
  worldPoint: Point2D,
): RectParams | null {
  if (entity.params.kind !== 'rect') return null;
  if (gripKind === 'origin') return null;

  const params = entity.params;
  const bbox = computeSourceGroupBbox(entity.hiddenSources);
  const base = getBasePoint(entity, bbox);
  const { colDir, rowDir } = basis(params);

  const dx = worldPoint.x - base.x;
  const dy = worldPoint.y - base.y;
  const projCol = dx * colDir.x + dy * colDir.y;
  const projRow = dx * rowDir.x + dy * rowDir.y;

  switch (gripKind) {
    case 'col-count': {
      // Drag along colDir → adjust column count using current spacing.
      const nextCols = Math.max(1, Math.round(projCol / params.colSpacing) + 1);
      return { ...params, cols: nextCols };
    }
    case 'row-count': {
      const nextRows = Math.max(1, Math.round(projRow / params.rowSpacing) + 1);
      return { ...params, rows: nextRows };
    }
    case 'col-spacing': {
      // Drag the spacing grip itself → set colSpacing to its projected distance.
      // Allow negative spacing (AutoCAD parity, Q7), forbid exact zero.
      const next = projCol === 0 ? params.colSpacing : projCol;
      return { ...params, colSpacing: next };
    }
    case 'row-spacing': {
      const next = projRow === 0 ? params.rowSpacing : projRow;
      return { ...params, rowSpacing: next };
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POLAR (Phase B)
// ──────────────────────────────────────────────────────────────────────────────

export type PolarGripKind =
  | 'polar-center'
  | 'polar-radius'
  | 'polar-fill-angle';

export interface PolarGrip {
  readonly kind: PolarGripKind;
  readonly position: Point2D;
}

interface PolarLayout {
  readonly params: PolarParams;
  readonly bbox: SourceBbox;
  /** Effective radius (auto-derived when params.radius === 0). */
  readonly radius: number;
  /** Angle (degrees) of item 0 — equals startAngle. */
  readonly firstAngleDeg: number;
  /** Angle (degrees) of the last item. */
  readonly lastAngleDeg: number;
}

function polarLayout(entity: ArrayEntity): PolarLayout | null {
  if (entity.params.kind !== 'polar') return null;
  const params = entity.params;
  const bbox = computeSourceGroupBbox(entity.hiddenSources);

  const autoRadius = Math.hypot(
    bbox.center.x - params.center.x,
    bbox.center.y - params.center.y,
  );
  const radius = params.radius > 0 ? params.radius : autoRadius;

  const isFullCircle = Math.abs(params.fillAngle) === 360;
  const divisor = isFullCircle
    ? params.count
    : Math.max(params.count - 1, 1);
  const angleStep = params.fillAngle / divisor;

  return {
    params,
    bbox,
    radius,
    firstAngleDeg: params.startAngle,
    lastAngleDeg: params.startAngle + (params.count - 1) * angleStep,
  };
}

function pointAtPolar(
  center: Point2D,
  radius: number,
  angleDeg: number,
): Point2D {
  const r = degToRad(angleDeg);
  return {
    x: center.x + radius * Math.cos(r),
    y: center.y + radius * Math.sin(r),
  };
}

/**
 * Compute polar grip world positions. Used by the grip renderer.
 * The fill-angle grip is suppressed for full-circle arrays (meaningless).
 */
export function getPolarGripPositions(entity: ArrayEntity): PolarGrip[] {
  const layout = polarLayout(entity);
  if (!layout) return [];

  const grips: PolarGrip[] = [
    { kind: 'polar-center', position: layout.params.center },
    {
      kind: 'polar-radius',
      position: pointAtPolar(
        layout.params.center,
        layout.radius,
        layout.firstAngleDeg,
      ),
    },
  ];

  const isFullCircle = Math.abs(layout.params.fillAngle) === 360;
  if (!isFullCircle && layout.params.count >= 2) {
    grips.push({
      kind: 'polar-fill-angle',
      position: pointAtPolar(
        layout.params.center,
        layout.radius,
        layout.lastAngleDeg,
      ),
    });
  }

  return grips;
}

/**
 * Apply a world-space drag to a polar grip and return the next PolarParams.
 * Returns `null` for no-op drags (zero deltas, malformed entities, etc.).
 */
export function applyPolarGripDrag(
  entity: ArrayEntity,
  gripKind: PolarGripKind,
  worldPoint: Point2D,
): PolarParams | null {
  const layout = polarLayout(entity);
  if (!layout) return null;
  const { params } = layout;

  switch (gripKind) {
    case 'polar-center': {
      const center = { x: worldPoint.x, y: worldPoint.y };
      if (center.x === params.center.x && center.y === params.center.y) {
        return null;
      }
      // Reset radius to auto so the new center re-derives a sensible value.
      return { ...params, center, radius: 0 };
    }

    case 'polar-radius': {
      const radius = Math.hypot(
        worldPoint.x - params.center.x,
        worldPoint.y - params.center.y,
      );
      if (radius <= 0) return null;
      if (radius === layout.radius) return null;
      return { ...params, radius };
    }

    case 'polar-fill-angle': {
      // Full circle has no meaningful fill-angle grip.
      if (Math.abs(params.fillAngle) === 360) return null;
      if (params.count < 2) return null;

      // Drag angle (degrees) measured from the polar center.
      const dragAngleDeg = radToDeg(
        Math.atan2(
          worldPoint.y - params.center.y,
          worldPoint.x - params.center.x,
        ),
      );

      // Span between startAngle and dragAngle (preserve sign of original
      // fillAngle so CW arrays stay CW). The last item sits at
      // startAngle + (count-1) * step, so total fillAngle = (count-1) * step.
      let span = dragAngleDeg - params.startAngle;
      // Normalize span into the same direction as the current fillAngle.
      if (params.fillAngle >= 0) {
        while (span <= 0) span += 360;
        while (span > 360) span -= 360;
      } else {
        while (span >= 0) span -= 360;
        while (span < -360) span += 360;
      }

      if (Math.abs(span) < 1e-3) return null;
      if (span === params.fillAngle) return null;
      return { ...params, fillAngle: span };
    }
  }
}
