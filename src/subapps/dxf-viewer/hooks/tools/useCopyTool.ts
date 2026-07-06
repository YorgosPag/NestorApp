/**
 * USE COPY TOOL — ADR-363 R1 / ADR-577 (unified interactive COPY)
 *
 * AutoCAD COPY pattern for ANY entity type (DXF geometry + BIM parametric +
 * groups). Reachable from the ribbon «Αντιγραφή» button and the C+O chord —
 * both drive `activeTool === 'copy'`.
 *
 *   idle → awaiting-entity     (activated with NO selection — clicks pass through
 *                               for normal selection, mirrors the Move tool)
 *        → awaiting-base-point (selection present)
 *        → awaiting-target-point (after base click)
 *        → clone selection at (target − base) delta → loop (continuous)
 *        → ESC → select mode
 *
 * Mirrors {@link useMoveTool}'s activation FSM: when activated WITHOUT a
 * selection the tool stays alive in `awaiting-entity` (the ribbon button no
 * longer silently reverts to 'select' — that was invisible «δεν αντιγράφει»).
 * `isCollectingInput` gates the canvas click routing so `awaiting-entity` clicks
 * flow to normal selection instead of being swallowed as base/target picks.
 *
 * The clone itself goes through the SHARED clone SSoT `buildEntityCloneCommand`
 * — the SAME path the clipboard (Ctrl+V) and the Ctrl+drag body copy use — so
 * BIM entities get kind-specific enterprise IDs + host rewire + fresh IFC
 * GlobalId, DXF geometry gets an id-swap clone, and both persist through the one
 * `PasteEntitiesCommand` (N.0.2 — one clone path, no divergence).
 *
 * @see hooks/tools/useMoveTool.ts — the activation-FSM pattern this mirrors
 * @see bim/transforms/build-entity-clone-command.ts — unified clone SSoT (BIM + DXF)
 * @see core/commands/entity-commands/PasteEntitiesCommand.ts — undoable commit
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildEntityCloneCommand } from '../../bim/transforms/build-entity-clone-command';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand, SceneEntity } from '../../core/commands/interfaces';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CopyPhase =
  | 'idle'
  | 'awaiting-entity'
  | 'awaiting-base-point'
  | 'awaiting-target-point';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseCopyToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  onToolChange?: (tool: string) => void;
}

export interface UseCopyToolReturn {
  isActive: boolean;
  /** True only while collecting base/target picks — gates canvas click routing so
   *  `awaiting-entity` clicks fall through to normal selection (mirrors Move). */
  isCollectingInput: boolean;
  phase: CopyPhase;
  handleCopyClick: (worldPoint: Point2D) => void;
  handleCopyEscape: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCopyTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  onToolChange,
}: UseCopyToolProps): UseCopyToolReturn {
  const isActive = activeTool === 'copy';

  const [phase, setPhase] = useState<CopyPhase>('idle');
  const [basePoint, setBasePoint] = useState<Point2D | null>(null);

  const wasActiveRef = useRef(false);
  const prevEntityCountRef = useRef(0);

  const hasAnySelected = selectedEntityIds.length > 0;
  const isCollectingInput =
    isActive &&
    hasAnySelected &&
    (phase === 'awaiting-base-point' || phase === 'awaiting-target-point');

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine: activate / react to selection (mirrors useMoveTool) ────
  useEffect(() => {
    const toolIsCopy = activeTool === 'copy';
    const hasEntities = selectedEntityIds.length > 0;

    if (toolIsCopy && !wasActiveRef.current) {
      // Activated: skip straight to base-point when a selection exists, else wait
      // for the user to pick an entity (NEVER silently revert to 'select').
      setPhase(hasEntities ? 'awaiting-base-point' : 'awaiting-entity');
      setBasePoint(null);
    } else if (!toolIsCopy && wasActiveRef.current) {
      setPhase('idle');
      setBasePoint(null);
    } else if (toolIsCopy && wasActiveRef.current) {
      const prevCount = prevEntityCountRef.current;
      if (prevCount === 0 && hasEntities && phase === 'awaiting-entity') {
        setPhase('awaiting-base-point');
      } else if (prevCount > 0 && !hasEntities) {
        setPhase('awaiting-entity');
        setBasePoint(null);
      }
    }

    wasActiveRef.current = toolIsCopy;
    prevEntityCountRef.current = selectedEntityIds.length;
  }, [activeTool, selectedEntityIds.length, phase]);

  // ── Click: base point → target point → clone (continuous loop) ───────────
  const handleCopyClick = useCallback((worldPoint: Point2D): void => {
    if (!isCollectingInput) return;

    if (phase === 'awaiting-base-point') {
      setBasePoint(worldPoint);
      setPhase('awaiting-target-point');
      return;
    }

    if (phase === 'awaiting-target-point' && basePoint) {
      const sm = getSceneManager();
      if (!sm) return;
      const delta: Point2D = {
        x: worldPoint.x - basePoint.x,
        y: worldPoint.y - basePoint.y,
      };
      // Resolve the LIVE selection to entities, then clone through the shared
      // BIM+DXF SSoT (id regeneration + host rewire + persistence inside).
      const sources = selectedEntityIds
        .map((id) => sm.getEntity(id))
        .filter((e): e is SceneEntity => e !== null && e !== undefined);
      const result = buildEntityCloneCommand(sources, delta, sm);
      if (result) executeCommand(result.command);
      // Continuous: keep the base point, loop for the next target.
    }
  }, [isCollectingInput, phase, basePoint, getSceneManager, selectedEntityIds, executeCommand]);

  // ── Escape: exit to select ────────────────────────────────────────────────
  const handleCopyEscape = useCallback((): void => {
    setPhase('idle');
    setBasePoint(null);
    onToolChange?.('select');
  }, [onToolChange]);

  // ── Tool hint override ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    const key =
      phase === 'awaiting-entity'
        ? 'dxf-viewer-guides:moveTool.selectEntity'
        : phase === 'awaiting-base-point'
          ? 'dxf-viewer-guides:bimCopyTool.selectBasePoint'
          : 'dxf-viewer-guides:bimCopyTool.selectTargetPoint';
    toolHintOverrideStore.setOverride(i18next.t(key));
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, phase]);

  return { isActive, isCollectingInput, phase, handleCopyClick, handleCopyEscape };
}
