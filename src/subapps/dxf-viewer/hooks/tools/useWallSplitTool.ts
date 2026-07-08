/**
 * USE WALL SPLIT TOOL — ADR-363 Phase 5.6 (KNIFE-LINE mode)
 *
 * Editing hook for the wall-split tool as a Revit/AutoCAD "split by line" knife:
 *
 *   idle → click point 1 (anywhere) → live rubber-band line [p1 → cursor]
 *        → click point 2 → EVERY wall the segment [p1,p2] crosses is split at
 *          its intersection point → loop for the next cut.
 *   right-click / ESC → exit, onToolChange('select').
 *
 * The live preview (segment + per-crossing cut indicators) is rendered by
 * `WallSplitKnifePreviewMount` (ADR-040 leaf on the PreviewCanvas), which reads
 * the first point from `WallSplitStore` and the live cursor from the shared
 * ghost-preview harness — this hook only owns the click FSM + command build.
 *
 * All cuts of a single knife stroke are wrapped in ONE `CompositeCommand` so a
 * single Ctrl+Z restores every split wall together (transaction group).
 *
 * Lives in hooks/tools/ (editing hook) not hooks/drawing/ (creation hook)
 * because it requires executeCommand for undo/redo — same as useTrimTool.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 */
'use client';

import { useCallback, useRef } from 'react';
import i18next from 'i18next';
import { toast } from 'sonner';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { AnySceneEntity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import { WallSplitStore } from '../../systems/wall-split/WallSplitStore';
import { useSceneManagerAdapter, type SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import {
  computeSplitOffset,
  computeSplitWallParams,
  redistributeOpenings,
  wallsCrossedBySegment,
} from '../../bim/walls/wall-split';
import { WallSplitCommand } from '../../core/commands/entity-commands/WallSplitCommand';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { EventBus } from '../../systems/events/EventBus';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useEdgeTriggeredLifecycle } from './useEdgeTriggeredLifecycle';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseWallSplitToolProps {
  activeTool: string;
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseWallSplitToolReturn {
  isActive: boolean;
  handleWallSplitClick: (worldPoint: Point2D) => void;
  handleWallSplitEscape: () => void;
}

// ── i18n hints ──────────────────────────────────────────────────────────────

const NS = 'dxf-viewer-shell';

/** Emitted per-wall event mirrors the single-split payload (openings survive). */
interface WallSplitBuildResult {
  readonly command: WallSplitCommand;
  readonly event: {
    originalWallId: string;
    wall1: WallEntity;
    wall2: WallEntity;
    openingUpdates: readonly import('../../bim/walls/wall-split').OpeningUpdate[];
  };
}

/**
 * Builds a single-wall split command at `splitPoint` (already on the wall axis).
 * Returns `null` when the wall cannot be split there (curved/polyline kind, or
 * the cut would leave a segment shorter than the minimum — `computeSplitOffset`).
 */
function buildWallSplitCommand(
  targetWall: WallEntity,
  splitPoint: Point2D,
  sceneEntities: readonly AnySceneEntity[],
  sm: ISceneManager,
): WallSplitBuildResult | null {
  const splitOffset = computeSplitOffset(targetWall, splitPoint);
  if (splitOffset === null) return null; // curved/polyline or too close to an end

  const { wall1Params, wall2Params } = computeSplitWallParams(targetWall, splitOffset);
  const wall1Id = generateWallId();
  const wall2Id = generateWallId();

  const wall1: WallEntity = {
    ...targetWall,
    id: wall1Id,
    params: wall1Params,
    geometry: computeWallGeometry(wall1Params, targetWall.kind),
    hostedOpeningIds: [],
  };
  const wall2: WallEntity = {
    ...targetWall,
    id: wall2Id,
    params: wall2Params,
    geometry: computeWallGeometry(wall2Params, targetWall.kind),
    hostedOpeningIds: [],
  };

  const openingsByIdFn = (oid: string): OpeningEntity | null => {
    const e = sceneEntities.find((x) => x.id === oid);
    if (!e) return null;
    const c = e as unknown as Partial<OpeningEntity>;
    return c.type === 'opening' && c.params ? (e as unknown as OpeningEntity) : null;
  };

  const { wall1OpeningIds, wall2OpeningIds, openingUpdates } = redistributeOpenings(
    targetWall.hostedOpeningIds ?? [],
    openingsByIdFn,
    splitOffset,
    wall1Id,
    wall2Id,
  );

  const finalWall1 = { ...wall1, hostedOpeningIds: wall1OpeningIds };
  const finalWall2 = { ...wall2, hostedOpeningIds: wall2OpeningIds };

  const command = new WallSplitCommand(
    { originalWall: targetWall, wall1: finalWall1, wall2: finalWall2, openingUpdates },
    sm,
  );

  return {
    command,
    event: { originalWallId: targetWall.id, wall1: finalWall1, wall2: finalWall2, openingUpdates },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallSplitTool({
  activeTool,
  levelManager,
  executeCommand,
  onToolChange,
}: UseWallSplitToolProps): UseWallSplitToolReturn {
  const isActive = activeTool === 'wall-split';

  /** First knife point (null = awaiting the first click). */
  const firstPointRef = useRef<Point2D | null>(null);

  const setHint = useCallback((key: string): void => {
    toolHintOverrideStore.setOverride(i18next.t(key, { ns: NS }));
  }, []);

  const resetKnife = useCallback((): void => {
    firstPointRef.current = null;
    WallSplitStore.reset();
  }, []);

  // ── Scene manager factory (mirrors useTrimTool pattern) ──────────────────

  const getSceneManager = useSceneManagerAdapter(levelManager);

  // ── Activation / deactivation: manage the status hint + knife reset ───────

  // (ADR-589 edge-triggered SSoT — resetKnife/setHint are stable useCallback([])
  // refs, so the transition-only contract matches the previous effect exactly.)
  useEdgeTriggeredLifecycle(
    isActive,
    () => {
      resetKnife();
      setHint('wallSplit.pickFirst');
    },
    () => {
      resetKnife();
      toolHintOverrideStore.setOverride(null);
    },
  );

  // ── Click: knife FSM (first point → multi-split) ──────────────────────────

  const handleWallSplitClick = useCallback((worldPoint: Point2D): void => {
    // First click — arm the knife, surface the live preview, prompt for point 2.
    if (firstPointRef.current === null) {
      firstPointRef.current = { x: worldPoint.x, y: worldPoint.y };
      WallSplitStore.setFirstPoint(worldPoint);
      setHint('wallSplit.pickSecond');
      return;
    }

    // Second click — split every wall the segment [p1, p2] crosses.
    const sm = getSceneManager();
    const p1 = firstPointRef.current;
    if (!sm || !levelManager.currentLevelId) { resetKnife(); setHint('wallSplit.pickFirst'); return; }
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) { resetKnife(); setHint('wallSplit.pickFirst'); return; }

    const walls = scene.entities.filter(isWallEntity) as WallEntity[];
    const crossings = wallsCrossedBySegment(walls, p1, worldPoint);

    const built = crossings
      .map((c) => buildWallSplitCommand(c.wall, c.intersectionPoint, scene.entities, sm))
      .filter((r): r is WallSplitBuildResult => r !== null);

    if (built.length === 0) {
      toast.info(i18next.t('wallSplit.noCuts', { ns: NS }));
      resetKnife();
      setHint('wallSplit.pickFirst');
      return;
    }

    executeCommand(new CompositeCommand(built.map((b) => b.command)));
    for (const b of built) EventBus.emit('bim:wall-split-committed', b.event);
    toast.success(i18next.t('wallSplit.cut', { ns: NS, count: built.length }));

    // Loop — ready for the next knife stroke.
    resetKnife();
    setHint('wallSplit.pickFirst');
  }, [getSceneManager, levelManager, executeCommand, resetKnife, setHint]);

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleWallSplitEscape = useCallback((): void => {
    resetKnife();
    toolHintOverrideStore.setOverride(null);
    onToolChange?.('select');
  }, [onToolChange, resetKnife]);

  return { isActive, handleWallSplitClick, handleWallSplitEscape };
}
