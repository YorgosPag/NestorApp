/**
 * USE WALL MERGE TOOL — ADR-566 (Merge/Join Walls, AutoCAD JOIN for walls).
 *
 * Dual-flow editing hook that joins two straight walls. The join TYPE is decided
 * by `classifyWallJoin` (ADR-566 §corner-join):
 *   • collinear (same axis)     → the two walls become ONE (`WallMergeCommand`).
 *   • crossing / L (any angle)  → both axes are extended/trimmed to their
 *     intersection, forming a corner — they stay TWO walls (2×
 *     `UpdateWallParamsCommand` in a `CompositeCommand`, one Ctrl+Z).
 * The INVERSE of `useWallSplitTool`; combines two established patterns:
 *
 *   • Flow B (selection-first) — mirrors `useWallAttachTool`: on activation, if
 *     exactly two walls are already selected, join them immediately and exit.
 *   • Flow A (command-first) — mirrors `useWallSplitTool` picking loop: click
 *     wall 1 (highlight) → click wall 2 → join → loop to pick again.
 *
 * Both flows funnel through the same gate (`classifyWallJoin`) + pure geometry
 * (`bim/walls/wall-merge.ts`). Invalid joins surface a Revit-style non-blocking
 * hint (`toolHintOverrideStore`) and leave the scene untouched.
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
import { toast } from 'sonner';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { isWallEntity } from '../../types/entities';
import { SelectedEntitiesStore } from '../../systems/selection';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { projectPointOnWallAxis } from '../../bim/walls/wall-axis-projection';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import {
  classifyWallJoin,
  computeWallCornerJoin,
  buildMergedWallParams,
  collectMergedOpenings,
  type WallMergeBlockReason,
} from '../../bim/walls/wall-merge';
import { WallMergeCommand } from '../../core/commands/entity-commands/WallMergeCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { EventBus } from '../../systems/events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { toolHintOverrideStore } from '../toolHintOverrideStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseWallMergeToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: SceneAdapterLevelManager;
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
  'parallel-offset': 'wallMerge.blocked.parallelOffset',
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

  const getSceneManager = useSceneManagerAdapter(levelManager);

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
    // Prefer the prop; fall back to the selection SSoT store so activation-time
    // reads are never stale (ADR-532: the orchestrator may not have re-rendered
    // with the latest selection when the tool flips active).
    const ids = selectedEntityIds.length ? selectedEntityIds : SelectedEntitiesStore.getSelectedEntityIds();
    const idSet = new Set(ids);
    return scene.entities.filter((e): e is WallEntity => idSet.has(e.id) && isWallEntity(e));
  }, [getScene, selectedEntityIds]);

  // ── Merge execution (shared by both flows; preview ≡ commit) ───────────────

  const executeMerge = useCallback((a: WallEntity, b: WallEntity): boolean => {
    const plan = classifyWallJoin(a, b);
    if (plan.kind === 'blocked') {
      const msg = i18next.t(BLOCK_REASON_KEY[plan.reason], { ns: NS });
      setHint(BLOCK_REASON_KEY[plan.reason]);
      toast.warning(msg); // Revit-style non-blocking, prominent feedback
      return false;
    }
    const sm = getSceneManager();
    const scene = getScene();
    if (!sm || !scene?.entities) return false;

    // ── Corner join (ADR-566 §corner-join): extend/trim both axes to their L-corner.
    // The two walls stay separate; each nearest endpoint moves onto the intersection.
    // Two `UpdateWallParamsCommand` wrapped in a CompositeCommand → one Ctrl+Z; the
    // hosted-opening cascade + geometry recompute + auto-save ride the standard path.
    if (plan.kind === 'corner') {
      const join = computeWallCornerJoin(a, b);
      if (!join) {
        setHint(BLOCK_REASON_KEY.degenerate);
        toast.warning(i18next.t(BLOCK_REASON_KEY.degenerate, { ns: NS }));
        return false;
      }
      const cmdA = new UpdateWallParamsCommand(a.id, join.wallAParams, a.params, sm, false, a.kind);
      const cmdB = new UpdateWallParamsCommand(b.id, join.wallBParams, b.params, sm, false, b.kind);
      executeCommand(new CompositeCommand([cmdA, cmdB]));
      selectEntities?.([a.id, b.id]);
      toast.success(i18next.t('wallMerge.joinedCorner', { ns: NS }));
      return true;
    }

    // ── Collinear merge: the two walls become ONE (outer-to-outer span).
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
    toast.success(i18next.t('wallMerge.merged', { ns: NS }));
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
