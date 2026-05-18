/**
 * ADR-363 Phase 4 — Pure builders για column entity creation.
 *
 * SSoT:
 *   - IDs via `generateColumnId()` (N.6 enterprise-id).
 *   - Geometry via `computeColumnGeometry()` — pure function.
 *   - Validation via `validateColumnParams()` — hardErrors block creation.
 *   - Types via `bim/types/column-types.ts`.
 *
 * Single-click flow:
 *   - User picks Column tool → kind preselected (default 'rectangular').
 *   - Click on canvas → `buildDefaultColumnParams(clickPoint, kind, overrides)`
 *     resolves position + width + depth + height + anchor (defaults +
 *     ribbon overrides).
 *   - `buildColumnEntity()` validates + builds entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_COLUMN_DEPTH_MM,
  DEFAULT_COLUMN_HEIGHT_MM,
  DEFAULT_COLUMN_ROTATION_DEG,
  DEFAULT_COLUMN_WIDTH_MM,
  type ColumnAnchor,
  type ColumnEntity,
  type ColumnKind,
  type ColumnLshapeParams,
  type ColumnParams,
  type ColumnTshapeParams,
} from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../bim/validators/column-validator';
import { generateColumnId } from '@/services/enterprise-id-convenience';

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultColumnParams`. Ribbon (contextual column
 * tab) supplies kind / anchor / width / depth / height / rotation /
 * material. Variant geometry overrides (`lshape`, `tshape`) propagated.
 */
export interface ColumnParamOverrides {
  readonly kind?: ColumnKind;
  readonly anchor?: ColumnAnchor;
  /** mm. Width / διάμετρος αν circular. */
  readonly width?: number;
  /** mm. Αγνοείται αν circular. */
  readonly depth?: number;
  /** mm. */
  readonly height?: number;
  /** Μοίρες CCW. Αγνοείται αν circular. */
  readonly rotation?: number;
  readonly material?: string;
  readonly lshape?: ColumnLshapeParams;
  readonly tshape?: ColumnTshapeParams;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `ColumnParams` από clicked point + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'rectangular' default).
 *   2. Resolve anchor (override → 'center' default).
 *   3. Resolve width / depth / height / rotation (override → defaults).
 *   4. Lift 2D click point σε Point3D (z=0).
 */
export function buildDefaultColumnParams(
  clickPoint: Readonly<Point2D>,
  kindArg?: ColumnKind,
  overrides: ColumnParamOverrides = {},
): ColumnParams {
  const kind = overrides.kind ?? kindArg ?? 'rectangular';
  const anchor: ColumnAnchor = overrides.anchor ?? 'center';
  const width = overrides.width ?? DEFAULT_COLUMN_WIDTH_MM;
  const depth = overrides.depth ?? DEFAULT_COLUMN_DEPTH_MM;
  const height = overrides.height ?? DEFAULT_COLUMN_HEIGHT_MM;
  const rotation = overrides.rotation ?? DEFAULT_COLUMN_ROTATION_DEG;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  const params: ColumnParams = {
    kind,
    position,
    anchor,
    width,
    depth,
    height,
    rotation,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.lshape !== undefined ? { lshape: overrides.lshape } : {}),
    ...(overrides.tshape !== undefined ? { tshape: overrides.tshape } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildColumnEntityResult =
  | { readonly ok: true; readonly entity: ColumnEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `ColumnEntity` από `ColumnParams`. Geometry computed via SSoT
 * `computeColumnGeometry()`. Hard errors short-circuit creation.
 */
export function buildColumnEntity(
  params: Readonly<ColumnParams>,
  layerId: string,
): BuildColumnEntityResult {
  const validation = validateColumnParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeColumnGeometry(params);
  const entity: ColumnEntity = {
    id: generateColumnId(),
    type: 'column',
    kind: params.kind,
    layerId,
    params,
    geometry,
    validation: validation.bimValidation,
    visible: true,
  };
  return { ok: true, entity };
}

// ─── Single-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το column-tool FSM (Phase 4: single-click)
 * και το builder pipeline. Pure — no side effects.
 */
export function completeColumnFromClick(
  clickPoint: Readonly<Point2D>,
  layerId: string,
  kind?: ColumnKind,
  overrides: ColumnParamOverrides = {},
): BuildColumnEntityResult {
  const params = buildDefaultColumnParams(clickPoint, kind, overrides);
  return buildColumnEntity(params, layerId);
}
