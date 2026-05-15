/**
 * ARRAY GRIP HANDLERS — ADR-353 Session A4
 *
 * Pure math for rectangular-array grip drag. Computes new RectParams from
 * a grip-drag delta in world space. Consumed by the entity-grip system
 * (drag end → executeCommand(new UpdateArrayParamsCommand(...))).
 *
 * Grip kinds (AutoCAD parity):
 *   - 'origin'      → move base point (handled by MoveCommand on parent ArrayEntity)
 *   - 'col-count'   → drag along colDir at the last column corner
 *   - 'row-count'   → drag along rowDir at the last row corner
 *   - 'col-spacing' → adjust colSpacing only (between cell (0,0) and (0,1))
 *   - 'row-spacing' → adjust rowSpacing only (between cell (0,0) and (1,0))
 *
 * Each handler returns the next RectParams. The caller is responsible for
 * issuing UpdateArrayParamsCommand with `isDragging` toggling false on
 * pointerup so consecutive drag samples merge into a single undo step
 * (UpdateArrayParamsCommand.canMergeWith handles the merge window).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArrayEntity } from '../../types/entities';
import type { RectParams, SourceBbox } from './types';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
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
