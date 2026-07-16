'use client';

/**
 * array-tool-core.ts — shared SSoT primitives for the ARRAY tool hooks (ADR-353).
 *
 * `useArrayTool` (rect), `useArrayPolarTool` and `useArrayPathTool` are three parallel
 * activation state machines over the SAME command: pre-select N sources → (optionally pick
 * a centre / a path entity) → build a {@link CreateArrayCommand}. The MECHANICAL parts they
 * share — hint plumbing, scene resolution, source collection + nested-array guard, and the
 * command build → execute → reselect boilerplate — live HERE, so each hook holds only its
 * tool-specific params and pick semantics.
 *
 * Deliberately NOT collapsed into one hook: rect is single-shot (creates on activation),
 * polar awaits a snapped world point, path awaits a hovered curve entity. Same doctrine as
 * the sibling {@link module:hooks/tools/corner-tool-core} (fillet/chamfer).
 *
 * @module hooks/tools/array-tool-core
 */

import { useCallback, useMemo, useRef, type MutableRefObject } from 'react';
import i18next from 'i18next';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import { CreateArrayCommand } from '../../core/commands/entity-commands/CreateArrayCommand';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { ArrayKind, ArrayParams } from '../../systems/array/types';
import type { Entity, EntityType } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';

/** Props every array tool hook takes — identical wiring from the canvas interaction layer. */
export interface ArrayToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  setSelectedEntityIds: (ids: string[]) => void;
  onToolChange?: (tool: string) => void;
}

/** Hint key surfaced when there is nothing usable to build an array from. */
export const ARRAY_HINT_NEEDS_SELECTION = 'arrayTool.needsSelection';
/** Hint key for the Q19 guard — an ArrayEntity may not be a source of another array. */
export const ARRAY_HINT_NESTED_FORBIDDEN = 'arrayTool.nestedForbidden';

/** Surface `key` from the `tool-hints` namespace in the status bar. */
export function showArrayHint(key: string): void {
  toolHintOverrideStore.setOverride(i18next.t(`tool-hints:${key}`));
}

/** Drop any array tool hint currently held in the status bar. */
export function clearArrayHint(): void {
  toolHintOverrideStore.setOverride(null);
}

/** The current level's scene, or `null` when no level / no scene is active. */
export function resolveArrayScene(levelManager: SceneAdapterLevelManager): SceneModel | null {
  const levelId = levelManager.currentLevelId;
  if (!levelId) return null;
  return levelManager.getLevelScene(levelId);
}

/** Lookup an entity by id in a scene (the array tools' shared `findEntity`). */
export function findArrayEntity(scene: SceneModel, id: string): Entity | undefined {
  return scene.entities.find((e) => e.id === id) as Entity | undefined;
}

/** Types of the entities `ids` still resolve to — ids gone from the scene are skipped. */
export function collectSourceTypes(scene: SceneModel, ids: readonly string[]): EntityType[] {
  const types: EntityType[] = [];
  for (const id of ids) {
    const entity = findArrayEntity(scene, id);
    if (entity) types.push(entity.type);
  }
  return types;
}

/** Usable sources, or the hint key explaining why the selection cannot seed an array. */
export type ArraySourceResult =
  | { readonly ok: true; readonly sources: Entity[]; readonly sourceTypes: EntityType[] }
  | { readonly ok: false; readonly hintKey: string };

/**
 * Validate a pre-selection as array sources: non-empty, resolvable, and free of nested
 * arrays. The shared activation guard of all three array tools.
 */
export function collectArraySources(scene: SceneModel, ids: readonly string[]): ArraySourceResult {
  if (ids.length === 0) return { ok: false, hintKey: ARRAY_HINT_NEEDS_SELECTION };

  const sources: Entity[] = [];
  const sourceTypes: EntityType[] = [];
  for (const id of ids) {
    const entity = findArrayEntity(scene, id);
    if (!entity) continue;
    if (isArrayEntity(entity)) return { ok: false, hintKey: ARRAY_HINT_NESTED_FORBIDDEN };
    sources.push(entity);
    sourceTypes.push(entity.type);
  }

  if (sources.length === 0) return { ok: false, hintKey: ARRAY_HINT_NEEDS_SELECTION };
  return { ok: true, sources, sourceTypes };
}

/**
 * Build a {@link CreateArrayCommand} from `params`, execute it, and replace the selection
 * with the new ArrayEntity so its contextual ribbon tab auto-opens. Returns `false` (having
 * done nothing) when no scene manager is available, so callers keep their own exit policy.
 */
export function commitArrayCommand(
  getSceneManager: () => ISceneManager | null,
  sourceIds: string[],
  kind: ArrayKind,
  params: ArrayParams,
  executeCommand: (cmd: ICommand) => void,
  setSelectedEntityIds: (ids: string[]) => void,
  pathEntityId?: string,
): boolean {
  const sceneManager = getSceneManager();
  if (!sceneManager) return false;

  const cmd = new CreateArrayCommand(sourceIds, kind, params, sceneManager, pathEntityId);
  executeCommand(cmd);

  const newArrayId = cmd.getAffectedEntityIds()[0];
  if (newArrayId) setSelectedEntityIds([newArrayId]);
  return true;
}

/** Awaiting-pick state shared by the polar (centre) and path (curve) array tools. */
export interface ArraySourcePick {
  /** Source ids captured at activation — read at pick time, not re-derived from selection. */
  readonly pendingSourceIds: MutableRefObject<string[]>;
  /** True while the tool is armed and waiting for its pick. */
  readonly isAwaiting: () => boolean;
  /** Clear pick state + hint and hand the tool back to 'select'. */
  readonly exitToSelect: () => void;
}

/**
 * Arm a two-step array tool: on the activation edge validate the pre-selection, stash the
 * source ids, and prompt with `promptHintKey`; on the deactivation edge clear everything.
 * An invalid selection hints and reverts to 'select' without arming.
 */
export function useArraySourcePick(
  props: ArrayToolProps,
  isActive: boolean,
  promptHintKey: string,
): ArraySourcePick {
  const { selectedEntityIds, levelManager, onToolChange } = props;

  const pendingSourceIds = useRef<string[]>([]);
  const awaitingRef = useRef(false);

  const reset = useCallback((): void => {
    pendingSourceIds.current = [];
    awaitingRef.current = false;
    clearArrayHint();
  }, []);

  const isAwaiting = useCallback((): boolean => awaitingRef.current, []);

  const exitToSelect = useCallback((): void => {
    reset();
    onToolChange?.('select');
  }, [reset, onToolChange]);

  function armFromSelection(): void {
    const scene = resolveArrayScene(levelManager);
    if (!scene) {
      onToolChange?.('select');
      return;
    }

    const result = collectArraySources(scene, selectedEntityIds);
    if (!result.ok) {
      showArrayHint(result.hintKey);
      onToolChange?.('select');
      return;
    }

    pendingSourceIds.current = selectedEntityIds.slice();
    awaitingRef.current = true;
    showArrayHint(promptHintKey);
  }

  // Activation / deactivation lifecycle (ADR-589 edge-triggered SSoT)
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      armFromSelection();
    },
    () => {
      reset();
    },
  );

  return useMemo(
    () => ({ pendingSourceIds, isAwaiting, exitToSelect }),
    [isAwaiting, exitToSelect],
  );
}

/** The pending sources resolved against the live scene, ready to seed a command. */
export interface ArrayCommitContext {
  readonly scene: SceneModel;
  readonly sourceIds: string[];
  readonly sourceTypes: EntityType[];
}

/**
 * The pending sources re-resolved against an already-held `scene`. Returns `null` — having
 * already hinted and exited to 'select' — when every source vanished while the tool was
 * armed. For tools that inspect the scene before committing (path picks its curve there).
 */
export function resolvePendingSourcesInScene(
  scene: SceneModel,
  pick: ArraySourcePick,
): ArrayCommitContext | null {
  const sourceIds = pick.pendingSourceIds.current;
  const sourceTypes = collectSourceTypes(scene, sourceIds);
  if (sourceTypes.length === 0) {
    showArrayHint(ARRAY_HINT_NEEDS_SELECTION);
    pick.exitToSelect();
    return null;
  }
  return { scene, sourceIds, sourceTypes };
}

/**
 * The shared preamble of every awaiting-pick array commit: resolve the scene and the
 * still-live pending sources. Returns `null` — having already hinted and exited to 'select'
 * — when the level, scene, or sources vanished while the tool was armed.
 */
export function resolvePendingArraySources(
  levelManager: SceneAdapterLevelManager,
  pick: ArraySourcePick,
): ArrayCommitContext | null {
  const scene = resolveArrayScene(levelManager);
  if (!scene) {
    pick.exitToSelect();
    return null;
  }
  return resolvePendingSourcesInScene(scene, pick);
}
