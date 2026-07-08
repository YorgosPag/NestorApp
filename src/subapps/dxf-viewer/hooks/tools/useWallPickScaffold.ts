/**
 * USE WALL PICK SCAFFOLD — SSoT for two-wall pick tools (ADR-566 / ADR-568).
 *
 * The "pick two walls, then act on them" interaction (AutoCAD/Revit dual-flow) was
 * duplicated byte-for-byte across `useWallMergeTool` (merge/corner-join) and
 * `useWallGapOpeningTool` (bridge + hosted opening): identical scene helpers
 * (`getScene`/`getWallById`/`findWallAtPoint`/`collectSelectedWalls`), identical FSM
 * refs (`pickedARef` + the ADR-589 edge-triggered lifecycle), and the identical
 * two-flow state machine:
 *
 *   • Flow B (selection-first) — on activation, if exactly TWO walls are already
 *     selected, run `execute` immediately and exit to 'select'; if ONE, arm it as
 *     wall A and prompt for wall B; if none, prompt to pick wall A.
 *   • Flow A (command-first) — click wall 1 (highlight) → click wall 2 → `execute`
 *     → loop to pick again. Right-click / ESC exits to 'select'.
 *
 * Only the per-tool JOIN action differs, so that is the sole injected callback:
 * `execute(a, b, ctx)` returns `true` on success (loop resets to pickFirst) or
 * `false` (invalid — the caller surfaced a Revit-style non-blocking hint and the
 * scene is untouched). The scaffold hands the action everything it needs via `ctx`
 * (`getSceneManager`/`getScene`/`levelManager`/`setHint`) so the action stays a pure
 * closure over its own commands/geometry — no circular dependency on the scaffold.
 *
 * `useWallSplitTool` is NOT a consumer: it is a point→point knife, not a wall pick.
 *
 * Scene access reuses the ADR-577 `useSceneManagerAdapter` SSoT. Storage-agnostic:
 * generic over the level manager, so the merge tool passes a `SceneAdapterLevelManager`
 * and the gap-opening tool passes a full `LevelsHookReturn` (needed for
 * `buildOpeningResolvers`) unchanged.
 *
 * @see hooks/tools/useWallMergeTool.ts — merge/corner-join consumer
 * @see hooks/tools/useWallGapOpeningTool.ts — gap-bridge + hosted-opening consumer
 * @see systems/entity-creation/useSceneManagerAdapter.ts — the ISceneManager builder SSoT
 */
'use client';

import { useCallback, useRef } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { SceneModel } from '../../types/scene';
import { isWallEntity } from '../../types/entities';
import { SelectedEntitiesStore } from '../../systems/selection';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { projectPointOnWallAxis } from '../../bim/walls/wall-axis-projection';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';

const NS = 'dxf-viewer-shell';

/**
 * Everything a per-tool JOIN action needs, injected by the scaffold so the action
 * never re-derives scene access (no circular dependency on the scaffold's helpers).
 */
export interface WallPickExecuteContext<TLevel extends SceneAdapterLevelManager> {
  /** ISceneManager bound to the current level (`null` while no level is active). */
  readonly getSceneManager: () => ISceneManager | null;
  /** The current level's scene (`null` while no level is active). */
  readonly getScene: () => SceneModel | null;
  /** The level manager (full type for consumers that need `buildOpeningResolvers`). */
  readonly levelManager: TLevel;
  /** Surface a Revit-style non-blocking hint by i18n key (ns `dxf-viewer-shell`). */
  readonly setHint: (key: string) => void;
}

export interface UseWallPickScaffoldProps<TLevel extends SceneAdapterLevelManager> {
  activeTool: string;
  /** The tool id this scaffold is active for (e.g. `'wall-merge'`). */
  toolId: string;
  levelManager: TLevel;
  selectedEntityIds: string[];
  /** Current viewport scale factor — converts snap tolerance to world units. */
  transformScale: number;
  onToolChange?: (tool: string) => void;
  /** Selection setter (highlight) — reuses the standard selection renderer. */
  selectEntities?: (ids: string[]) => void;
  /** i18n hint keys for the two picking prompts. */
  hints: { readonly pickFirst: string; readonly pickSecond: string };
  /**
   * Act on the two picked walls. Return `true` on success (loop resets to
   * `pickFirst`) or `false` (invalid — surface a hint, keep A picked so the user
   * retries wall 2 in the click loop).
   */
  execute: (a: WallEntity, b: WallEntity, ctx: WallPickExecuteContext<TLevel>) => boolean;
}

export interface UseWallPickScaffoldReturn {
  isActive: boolean;
  handleClick: (worldPoint: Point2D) => void;
  handleEscape: () => void;
}

export function useWallPickScaffold<TLevel extends SceneAdapterLevelManager>({
  activeTool,
  toolId,
  levelManager,
  selectedEntityIds,
  transformScale,
  onToolChange,
  selectEntities,
  hints,
  execute,
}: UseWallPickScaffoldProps<TLevel>): UseWallPickScaffoldReturn {
  const isActive = activeTool === toolId;
  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;

  /** First-picked wall in the command-first flow (null = awaiting the first pick). */
  const pickedARef = useRef<WallEntity | null>(null);

  const setHint = useCallback((key: string): void => {
    toolHintOverrideStore.setOverride(i18next.t(key, { ns: NS }));
  }, []);

  // ── Scene helpers (the byte-identical block hoisted out of both consumers) ──

  const getSceneManager = useSceneManagerAdapter(levelManager);

  const getScene = useCallback((): SceneModel | null => {
    if (!levelManager.currentLevelId) return null;
    return levelManager.getLevelScene(levelManager.currentLevelId) ?? null;
  }, [levelManager]);

  const getWallById = useCallback((id: string | null): WallEntity | null => {
    if (!id) return null;
    const scene = getScene();
    const e = scene?.entities.find((x) => x.id === id);
    return e && isWallEntity(e) ? e : null;
  }, [getScene]);

  /**
   * Wall under the cursor. PREFERS the currently hovered entity (HoverStore) so the
   * picked wall is EXACTLY the one the user sees highlighted; falls back to an
   * axis-projection hit-test when hover is empty.
   */
  const findWallAtPoint = useCallback((worldPoint: Point2D, excludeId?: string): WallEntity | null => {
    const hovered = getWallById(getHoveredEntity());
    if (hovered && hovered.id !== excludeId) return hovered;

    const scene = getScene();
    if (!scene?.entities) return null;
    const hitTol = TOLERANCE_CONFIG.SNAP_DEFAULT / transformScaleRef.current;
    let best: WallEntity | null = null;
    let bestDist = Infinity;
    for (const e of scene.entities) {
      if (!isWallEntity(e) || e.id === excludeId) continue;
      const foot = projectPointOnWallAxis(e, worldPoint);
      if (!foot) continue;
      const d = calculateDistance(worldPoint, foot);
      if (d < hitTol && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }, [getScene, getWallById]);

  const collectSelectedWalls = useCallback((): WallEntity[] => {
    const scene = getScene();
    if (!scene?.entities) return [];
    // Prefer the prop; fall back to the selection SSoT store so activation-time reads
    // are never stale (ADR-532: the orchestrator may not have re-rendered with the
    // latest selection when the tool flips active).
    const ids = selectedEntityIds.length ? selectedEntityIds : SelectedEntitiesStore.getSelectedEntityIds();
    const idSet = new Set(ids);
    return scene.entities.filter((e): e is WallEntity => idSet.has(e.id) && isWallEntity(e));
  }, [getScene, selectedEntityIds]);

  const runExecute = useCallback((a: WallEntity, b: WallEntity): boolean => {
    return execute(a, b, { getSceneManager, getScene, levelManager, setHint });
  }, [execute, getSceneManager, getScene, levelManager, setHint]);

  // ── Activation: Flow B (selection-first) or enter picking (Flow A) ─────────

  // (ADR-589 edge-triggered SSoT — collectSelectedWalls/runExecute et al. are
  // read via closure at the transition render; the previous effect re-ran on
  // their identity changes but was edge-guarded, so behaviour is identical.)
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      pickedARef.current = null;
      const walls = collectSelectedWalls();
      if (walls.length === 2) {
        if (runExecute(walls[0], walls[1])) {
          onToolChange?.('select');
        } else {
          setHint(hints.pickFirst); // invalid pre-selection → manual picking
        }
      } else if (walls.length === 1) {
        pickedARef.current = walls[0];
        selectEntities?.([walls[0].id]);
        setHint(hints.pickSecond);
      } else {
        setHint(hints.pickFirst);
      }
    },
    () => {
      pickedARef.current = null;
      toolHintOverrideStore.setOverride(null);
    },
  );

  // ── Click: Flow A picking loop ─────────────────────────────────────────────

  const handleClick = useCallback((worldPoint: Point2D): void => {
    const hit = findWallAtPoint(worldPoint, pickedARef.current?.id);
    if (!hit) return;

    if (!pickedARef.current) {
      pickedARef.current = hit;
      selectEntities?.([hit.id]);
      setHint(hints.pickSecond);
      return;
    }

    if (runExecute(pickedARef.current, hit)) {
      pickedARef.current = null;
      setHint(hints.pickFirst); // loop (continuous tool)
    }
    // invalid: hint shows the reason; keep A picked so the user retries wall 2.
  }, [findWallAtPoint, runExecute, selectEntities, setHint, hints]);

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleEscape = useCallback((): void => {
    pickedARef.current = null;
    toolHintOverrideStore.setOverride(null);
    selectEntities?.([]);
    onToolChange?.('select');
  }, [onToolChange, selectEntities]);

  return { isActive, handleClick, handleEscape };
}
