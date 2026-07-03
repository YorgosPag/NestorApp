/**
 * USE WALL MERGE TOOL — ADR-566 (Merge/Join Walls, AutoCAD JOIN for walls).
 *
 * Dual-flow editing hook that merges two collinear straight walls into one.
 * The INVERSE of `useWallSplitTool`; combines two established patterns:
 *
 *   • Flow B (selection-first) — mirrors `useWallAttachTool`: on activation, if
 *     exactly two walls are already selected, merge them immediately and exit.
 *   • Flow A (command-first) — mirrors `useWallSplitTool` picking loop: click
 *     wall 1 (highlight) → click wall 2 → merge → loop to pick again.
 *
 * Both flows funnel through the same gate (`canMergeWalls`) + command
 * (`WallMergeCommand`) + pure geometry (`bim/walls/wall-merge.ts`). Invalid
 * merges surface a Revit-style non-blocking hint (`toolHintOverrideStore`) and
 * leave the scene untouched.
 *
 * Preview: no dedicated canvas renderer — the first-picked wall reuses the
 * standard selection highlight, the hover candidate reuses HoverStore (both
 * already rendered). ESC / right-click exits to 'select'.
 *
 * Lives in hooks/tools/ (editing hook) because it needs executeCommand for
 * undo/redo — same as useWallSplitTool / useWallAttachTool.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-566-merge-join-walls.md
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { isWallEntity } from '../../types/entities';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { projectPointOnWallAxis } from '../../bim/walls/wall-axis-projection';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import {
  canMergeWalls,
  buildMergedWallParams,
  collectMergedOpenings,
  type WallMergeBlockReason,
} from '../../bim/walls/wall-merge';
import { WallMergeCommand } from '../../core/commands/entity-commands/WallMergeCommand';
import { EventBus } from '../../systems/events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseWallMergeToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Current viewport scale factor — converts snap tolerance to world units. */
  transformScale: number;
  onToolChange?: (tool: string) => void;
  /** Selection setter (highlight) — reuses the standard selection renderer. */
  selectEntities?: (ids: string[]) => void;
}

export interface UseWallMergeToolReturn {
  isActive: boolean;
  handleWallMergeClick: (worldPoint: Point2D) => void;
  handleWallMergeEscape: () => void;
}

// ── i18n hint keys ──────────────────────────────────────────────────────────

const NS = 'dxf-viewer-shell';
const BLOCK_REASON_KEY: Readonly<Record<WallMergeBlockReason, string>> = {
  'not-straight': 'wallMerge.blocked.notStraight',
  'not-collinear': 'wallMerge.blocked.notCollinear',
  'different-thickness': 'wallMerge.blocked.differentThickness',
  'degenerate': 'wallMerge.blocked.degenerate',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallMergeTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  transformScale,
  onToolChange,
  selectEntities,
}: UseWallMergeToolProps): UseWallMergeToolReturn {
  const isActive = activeTool === 'wall-merge';
  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;

  /** First-picked wall in the command-first flow (null = awaiting first pick). */
  const pickedARef = useRef<WallEntity | null>(null);
  const wasActiveRef = useRef(false);

  const setHint = useCallback((key: string): void => {
    toolHintOverrideStore.setOverride(i18next.t(key, { ns: NS }));
  }, []);

  // ── Scene helpers (mirror useWallSplitTool) ───────────────────────────────

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  const getScene = useCallback(() => {
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
   * Wall under the cursor. PREFERS the currently hovered entity (HoverStore) so
   * the picked wall is EXACTLY the one the user sees highlighted (mirrors
   * `wall-on-entity`). Falls back to an axis-projection hit-test when hover is
   * empty (e.g. cursor just inside tolerance but not over the stroke).
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
    const idSet = new Set(selectedEntityIds);
    return scene.entities.filter((e): e is WallEntity => idSet.has(e.id) && isWallEntity(e));
  }, [getScene, selectedEntityIds]);

  // ── Merge execution (shared by both flows; preview ≡ commit) ───────────────

  const executeMerge = useCallback((a: WallEntity, b: WallEntity): boolean => {
    const check = canMergeWalls(a, b);
    if (!check.ok) {
      setHint(BLOCK_REASON_KEY[check.reason]);
      return false;
    }
    const sm = getSceneManager();
    const scene = getScene();
    if (!sm || !scene?.entities) return false;

    const mergedParams = buildMergedWallParams(a, b);
    const mergedId = generateWallId();

    const openingsByIdFn = (oid: string): OpeningEntity | null => {
      const e = scene.entities.find((x) => x.id === oid);
      if (!e) return null;
      const c = e as unknown as Partial<OpeningEntity>;
      return c.type === 'opening' && c.params ? (e as unknown as OpeningEntity) : null;
    };

    const openingUpdates = collectMergedOpenings(a, b, openingsByIdFn, mergedId);

    const merged: WallEntity = {
      ...a,
      id: mergedId,
      params: mergedParams,
      geometry: computeWallGeometry(mergedParams, a.kind),
      hostedOpeningIds: openingUpdates.map((u) => u.openingId),
    };

    executeCommand(new WallMergeCommand({ wallA: a, wallB: b, merged, openingUpdates }, sm));
    EventBus.emit('bim:wall-merge-committed', {
      wallAId: a.id,
      wallBId: b.id,
      merged,
      openingUpdates,
    });
    selectEntities?.([mergedId]);
    return true;
  }, [getSceneManager, getScene, executeCommand, selectEntities, setHint]);

  // ── Activation: Flow B (selection-first) or enter picking (Flow A) ─────────

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      pickedARef.current = null;
      const walls = collectSelectedWalls();
      if (walls.length === 2) {
        if (executeMerge(walls[0], walls[1])) {
          onToolChange?.('select');
        } else {
          setHint('wallMerge.pickFirst'); // invalid pre-selection → manual picking
        }
      } else if (walls.length === 1) {
        pickedARef.current = walls[0];
        selectEntities?.([walls[0].id]);
        setHint('wallMerge.pickSecond');
      } else {
        setHint('wallMerge.pickFirst');
      }
    } else if (!isActive && wasActiveRef.current) {
      pickedARef.current = null;
      toolHintOverrideStore.setOverride(null);
    }
    wasActiveRef.current = isActive;
  }, [isActive, collectSelectedWalls, executeMerge, onToolChange, selectEntities, setHint]);

  // ── Click: Flow A picking loop ─────────────────────────────────────────────

  const handleWallMergeClick = useCallback((worldPoint: Point2D): void => {
    const hit = findWallAtPoint(worldPoint, pickedARef.current?.id);
    if (!hit) return;

    if (!pickedARef.current) {
      pickedARef.current = hit;
      selectEntities?.([hit.id]);
      setHint('wallMerge.pickSecond');
      return;
    }

    if (executeMerge(pickedARef.current, hit)) {
      pickedARef.current = null;
      setHint('wallMerge.pickFirst'); // loop (continuous tool)
    }
    // invalid: hint shows the reason; keep A picked so the user retries wall 2.
  }, [findWallAtPoint, executeMerge, selectEntities, setHint]);

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleWallMergeEscape = useCallback((): void => {
    pickedARef.current = null;
    toolHintOverrideStore.setOverride(null);
    selectEntities?.([]);
    onToolChange?.('select');
  }, [onToolChange, selectEntities]);

  return { isActive, handleWallMergeClick, handleWallMergeEscape };
}
