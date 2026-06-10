/**
 * ADR-437 — Pure builders for space separator (γραμμή διαχωρισμού χώρου) creation.
 *
 * SSoT:
 *   - Entity creation via `createSpaceSeparator()` factory (auto-fills id + ifcGuid +
 *     ifcType='IfcVirtualElement').
 *   - Geometry via `computeSpaceSeparatorGeometry()` — pure.
 *   - Validation via `isValidSpaceSeparatorLength()` — degenerate (μήκος≈0) blocks creation.
 *   - Types via `bim/types/space-separator-types.ts`.
 *
 * Placement flow: 2-click (start → end), `completeSpaceSeparatorFromTwoClicks`.
 *
 * @see ./mep-segment-completion.ts (2-click builder template)
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  computeSpaceSeparatorGeometry,
  isValidSpaceSeparatorLength,
  type SpaceSeparatorEntity,
  type SpaceSeparatorParams,
} from '../../bim/types/space-separator-types';
import { createSpaceSeparator } from '@/services/factories/space-separator.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

/** Field overrides for `buildDefaultSpaceSeparatorParams` (contextual ribbon). */
export interface SpaceSeparatorParamOverrides {
  readonly name?: string;
  readonly floorId?: string;
}

/**
 * Build `SpaceSeparatorParams` from 2 click points + optional overrides.
 */
export function buildDefaultSpaceSeparatorParams(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  overrides: SpaceSeparatorParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): SpaceSeparatorParams {
  const start: Point3D = { x: startPoint.x, y: startPoint.y };
  const end: Point3D = { x: endPoint.x, y: endPoint.y };
  return {
    start,
    end,
    sceneUnits,
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    ...(overrides.floorId !== undefined ? { floorId: overrides.floorId } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildSpaceSeparatorEntityResult =
  | { readonly ok: true; readonly entity: SpaceSeparatorEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `SpaceSeparatorEntity` from params. Geometry via SSoT
 * `computeSpaceSeparatorGeometry()`. A degenerate (zero-length) segment short-circuits
 * creation. Final entity via `createSpaceSeparator()` factory.
 */
export function buildSpaceSeparatorEntity(
  params: Readonly<SpaceSeparatorParams>,
  layerId: string,
): BuildSpaceSeparatorEntityResult {
  if (!isValidSpaceSeparatorLength(params)) {
    return { ok: false, hardErrors: ['space-separator: degenerate (μηδενικό μήκος)'] };
  }
  const geometry = computeSpaceSeparatorGeometry(params);
  const entity = createSpaceSeparator({ params, geometry, layerId, visible: true });
  return { ok: true, entity };
}

/**
 * High-level helper bridging the separator-tool FSM (2-click) and the builder.
 * Pure — no side effects.
 */
export function completeSpaceSeparatorFromTwoClicks(
  startPoint: Readonly<Point2D>,
  endPoint: Readonly<Point2D>,
  layerId: string,
  overrides: SpaceSeparatorParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildSpaceSeparatorEntityResult {
  const params = buildDefaultSpaceSeparatorParams(startPoint, endPoint, overrides, sceneUnits);
  return buildSpaceSeparatorEntity(params, layerId);
}
