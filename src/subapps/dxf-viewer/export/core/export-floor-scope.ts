/**
 * ============================================================================
 * EXPORT FLOOR SCOPE — which levels, and how they are separated (SSoT)
 * ============================================================================
 *
 * Resolves the user's floor choice (`active` / `all-zip` / `all-single`) into a
 * concrete list of levels-with-scenes, each tagged with the layer prefix to
 * apply. Pure: levels + scenes are passed in (no hook, fully testable).
 *
 *   active      → [active level]                 prefix ''      → 1 file
 *   all-zip     → [every level], each its file   prefix ''      → N files (zip)
 *   all-single  → [every level], merged          prefix 'FLnn_' → 1 file
 *
 * ADR-505 §A.
 */

import type { Level } from '../../systems/levels/config';
import type { ExportFloorScope, ExportLevelScene } from '../types';

export interface ResolvedExportFloor {
  readonly level: Level;
  readonly scene: ExportLevelScene['scene'];
  /** Layer-name prefix to apply to this floor's entities ('' = none). */
  readonly layerPrefix: string;
}

/**
 * Build the ordered list of floors to export for the given scope.
 * Throws when `active` is requested but the active level has no loaded scene
 * (caller surfaces a friendly error in the dialog).
 */
export function resolveExportFloors(
  levelScenes: readonly ExportLevelScene[],
  activeLevelId: string | null,
  scope: ExportFloorScope,
): ResolvedExportFloor[] {
  const ordered = [...levelScenes].sort((a, b) => a.level.order - b.level.order);

  if (scope === 'active') {
    const active = ordered.find((ls) => ls.level.id === activeLevelId);
    if (!active) {
      throw new Error('EXPORT_NO_ACTIVE_SCENE');
    }
    return [{ level: active.level, scene: active.scene, layerPrefix: '' }];
  }

  const withPrefix = scope === 'all-single';
  return ordered.map((ls) => ({
    level: ls.level,
    scene: ls.scene,
    layerPrefix: withPrefix ? makeFloorLayerPrefix(ls.level) : '',
  }));
}

/**
 * Stable per-floor layer prefix, e.g. order 0 → `FL01_`, order 9 → `FL10_`.
 * Used by `all-single` so a single DXF keeps each storey on its own layers.
 */
export function makeFloorLayerPrefix(level: Level): string {
  const n = String(level.order + 1).padStart(2, '0');
  return `FL${n}_`;
}

/** True when the scope produces multiple files (→ zip packaging needed). */
export function floorScopeProducesMultipleFiles(scope: ExportFloorScope): boolean {
  return scope === 'all-zip';
}
