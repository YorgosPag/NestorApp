/**
 * TRIM BOUNDARY RESOLVER — ADR-350
 *
 * SSoT for translating tool state (Quick/Standard mode, edge mode, scene)
 * into the {@link CuttingEdge}[] consumed by the cutter.
 *
 * Quick mode (`TRIMEXTENDMODE = 1`, default): every visible entity on an
 * unlocked layer becomes a candidate cutting edge.
 *
 * Standard mode (`TRIMEXTENDMODE = 0`): only entities whose ID is in
 * `selectedEdgeIds` are considered.
 *
 * Edge mode (`EDGEMODE = 1`): geometry is virtually extended via
 * {@link extendEdge} before the cutter runs intersection math.
 *
 * Pure functions — no React state, no side effects.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Boundary Resolver
 */

import type { Entity } from '../../types/entities';
import type { SceneLayer, SceneModel } from '../../types/scene';
import { extendEdge } from './trim-edge-extender';
import type { CuttingEdge, TrimEdgeMode, TrimMode } from './trim-types';

export interface ResolveCuttingEdgesArgs {
  readonly mode: TrimMode;
  readonly scene: SceneModel;
  readonly selectedEdgeIds: ReadonlyArray<string>;
  readonly edgeMode: TrimEdgeMode;
}

/**
 * Build the cutting-edge set for a TRIM session.
 * Order is stable (matches scene.entities order) for deterministic intersection
 * enumeration in tests.
 */
export function resolveCuttingEdges(args: ResolveCuttingEdgesArgs): ReadonlyArray<CuttingEdge> {
  const { mode, scene, selectedEdgeIds, edgeMode } = args;
  const allow = mode === 'standard' ? new Set(selectedEdgeIds) : null;
  const layers = scene.layers ?? {};
  const out: CuttingEdge[] = [];

  for (const entity of scene.entities) {
    if (!isValidCuttingCandidate(entity, layers)) continue;
    if (allow && !allow.has(entity.id)) continue;

    if (edgeMode === 'extend') {
      const extended = extendEdge(entity as Entity);
      out.push({
        sourceEntityId: entity.id,
        entity: extended,
        extended: extended !== entity,
      });
    } else {
      out.push({ sourceEntityId: entity.id, entity: entity as Entity, extended: false });
    }
  }
  return out;
}

/**
 * Returns true when `entity` is a valid trim cutting edge.
 * Excludes: hidden entities, locked-layer entities, HATCH (G/Q6),
 * DIMENSION / LEADER / BLOCK (industry rule — non-curve types).
 */
export function isValidCuttingCandidate(
  entity: { type: string; visible?: boolean; layer?: string },
  layers: Record<string, SceneLayer>,
): boolean {
  if (entity.visible === false) return false;
  if (entity.layer && layers[entity.layer]?.locked) return false;
  if (entity.layer && layers[entity.layer]?.visible === false) return false;

  switch (entity.type) {
    case 'line':
    case 'polyline':
    case 'lwpolyline':
    case 'circle':
    case 'arc':
    case 'ellipse':
    case 'spline':
    case 'ray':
    case 'xline':
      return true;
    default:
      return false;
  }
}

/**
 * Returns true when an entity itself can be trimmed (target of TRIM).
 * HATCH is explicitly excluded and surfaced as a toast by the caller.
 */
export function isTrimmable(entity: { type: string }): boolean {
  return isValidCuttingCandidate(entity as { type: string }, {});
}
