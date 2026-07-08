/**
 * corner-tool-core.ts — shared SSoT primitives for the CHAMFER + FILLET tool hooks (ADR-589).
 *
 * `useChamferTool` and `useFilletTool` are parallel corner state machines: pick two entities
 * (or one polyline) → build a {@link CornerEntityCommand}. The MECHANICAL parts they share —
 * scene/target resolution, layer-lock check, and the command build → execute → track-for-undo
 * boilerplate — live HERE, so each hook holds only its tool-specific geometry + store wiring
 * (chamfer d1/d2/angle, fillet radius + curve). Extracting these removes the sibling clones
 * CHECK 3.28 flagged without collapsing the two distinct state machines into one.
 *
 * @module hooks/tools/corner-tool-core
 */

import { useRef, type MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import { CornerEntityCommand, type CornerCommandParams, type CornerTrimOp } from '../../core/commands/entity-commands/CornerEntityCommand';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';

/** Props every corner tool hook takes — identical wiring from the canvas interaction layer. */
export interface CornerToolProps {
  activeTool: string;
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  /** Returns the entity ID hit by `worldPoint` within tolerance (shared with trim/offset). */
  hitTestEntity: (worldPoint: Point2D) => string | null;
  onToolChange?: (tool: string) => void;
}

/** Keyword keys shared by both corner tools (Greek + Latin). Tool-specific keys stay local. */
export const CORNER_KEYWORDS_TRIM = new Set(['t', 'T', 'τ', 'Τ']);
export const CORNER_KEYWORDS_POLYLINE = new Set(['p', 'P', 'π', 'Π']);
export const CORNER_KEYWORDS_UNDO = new Set(['u', 'U']);

/** The ref both corner tools stash their most-recent command in, for keyboard `U` undo. */
export type CornerCommandRef = MutableRefObject<CornerEntityCommand | null>;

/** Fresh {@link CornerCommandRef} — lets a corner tool track its last command without importing the command class. */
export function useCornerCommandRef(): CornerCommandRef {
  return useRef<CornerEntityCommand | null>(null);
}

/** Lookup an entity by id in a scene (the corner tools' shared `findEntity`). */
export function findCornerEntity(scene: SceneModel, id: string): Entity | undefined {
  return scene.entities.find((e) => e.id === id) as Entity | undefined;
}

/** True iff `entity` sits on a locked layer — corner tools never touch locked entities. */
export function isCornerEntityLocked(scene: SceneModel, entity: Entity): boolean {
  const layer = entity.layerId ? (scene.layersById ?? {})[entity.layerId] : undefined;
  return layer?.locked === true;
}

/**
 * Resolve the pickable, unlocked entity under `worldPoint` on the current level, together
 * with its scene — or `null` when there is no current level / scene / hit, or the hit is
 * locked. The shared preamble of every corner-tool pick.
 */
export function resolveCornerTarget(
  levelManager: SceneAdapterLevelManager,
  hitTestEntity: (worldPoint: Point2D) => string | null,
  worldPoint: Point2D,
): { scene: SceneModel; target: Entity } | null {
  if (!levelManager.currentLevelId) return null;
  const scene = levelManager.getLevelScene(levelManager.currentLevelId) as SceneModel | null;
  if (!scene) return null;
  const hitId = hitTestEntity(worldPoint);
  if (!hitId) return null;
  const target = findCornerEntity(scene, hitId);
  if (!target || isCornerEntityLocked(scene, target)) return null;
  return { scene, target };
}

/** Reshape a geometry result's trims into the command's {@link CornerTrimOp} shape. */
export function toCornerTrimOps(
  trims: ReadonlyArray<{ entityId: string; originalGeom: Entity; newGeom: Entity }>,
): CornerTrimOp[] {
  return trims.map((tr) => ({ entityId: tr.entityId, originalGeom: tr.originalGeom, newGeom: tr.newGeom }));
}

/**
 * Resolve the scene manager, and — when present — build a {@link CornerEntityCommand} from
 * `params`, execute it through `executeCommand`, record it in `lastCommandRef` as the undo
 * target, and run `afterCommit` (the store-bookkeeping tail: setLast* + clearFirst). Returns
 * `true` iff a command ran (so callers with extra post-commit logic can gate on it), `false`
 * when there was no scene manager. The boilerplate every commit* path in both corner tools
 * repeats.
 */
export function executeCornerCommand(
  getSceneManager: () => ISceneManager | null,
  params: CornerCommandParams,
  executeCommand: (cmd: ICommand) => void,
  lastCommandRef: CornerCommandRef,
  afterCommit?: () => void,
): boolean {
  const sm = getSceneManager();
  if (!sm) return false;
  const cmd = new CornerEntityCommand(params, sm);
  executeCommand(cmd);
  lastCommandRef.current = cmd;
  afterCommit?.();
  return true;
}
