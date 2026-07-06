/**
 * USE MOVE TOOL — AutoCAD-style 2-click state machine for DXF entity movement
 *
 * ADR-049: Unified Move Tool (DXF + Overlays)
 *
 * State machine:
 *   idle → awaiting-entity → awaiting-base-point → awaiting-destination → execute → awaiting-base-point
 *
 * When activeTool === 'move':
 *   - Entities already selected → skip to awaiting-base-point
 *   - No entities → awaiting-entity (clicks pass through for normal selection)
 *   - Click base point → awaiting-destination (anchor stored)
 *   - Mouse move → useMovePreview draws ghost at delta offset
 *   - Click destination → compute delta, apply move, reset to awaiting-base-point
 *   - Escape → clear preview, switch to 'select'
 *
 * @module hooks/tools/useMoveTool
 */

import { useState, useCallback, useEffect } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { MoveEntityCommand, MoveMultipleEntitiesCommand, CompoundCommand } from '../../core/commands';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useModifyToolActivation } from '../../systems/tools/useModifyToolActivation';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { useLevels } from '../../systems/levels';
// ADR-363 — ORTHO (F8) axis-lock for the AutoCAD MOVE destination (no F9 step here).
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
// ADR-562 Φ9.3 — AutoAlign traces during the 2-click MOVE (base point ⊕ ambient), same
// SSoT resolve as the ghost (useMovePreview) → WYSIWYG. Gated behind POLAR/AutoAlign.
import { resolveActionAlignmentTracking } from '../dimensions/dim-alignment-tracking';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { Entity } from '../../types/entities';

// ============================================================================
// TYPES
// ============================================================================

export type MovePhase =
  | 'idle'
  | 'awaiting-entity'
  | 'awaiting-base-point'
  | 'awaiting-destination';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseMoveToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  selectedOverlayIds?: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  executeOverlayMove?: (ids: string[], delta: Point2D) => void;
  /** Factory that builds the overlay move ICommand without executing it — used for mixed-selection CompoundCommand. */
  createOverlayMoveCommand?: (ids: string[], delta: Point2D) => ICommand;
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  onToolChange?: (tool: string) => void;
}

export interface UseMoveToolReturn {
  phase: MovePhase;
  basePoint: Point2D | null;
  isActive: boolean;
  isCollectingInput: boolean;
  handleMoveClick: (worldPoint: Point2D) => void;
  handleMoveEscape: () => void;
  prompt: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMoveTool(props: UseMoveToolProps): UseMoveToolReturn {
  const {
    activeTool,
    selectedEntityIds,
    selectedOverlayIds = [],
    levelManager,
    executeCommand,
    executeOverlayMove,
    createOverlayMoveCommand,
    previewCanvasRef,
    onToolChange,
  } = props;

  const [phase, setPhase] = useState<MovePhase>('idle');
  const [basePoint, setBasePoint] = useState<Point2D | null>(null);

  const isActive = activeTool === 'move';
  const hasAnySelected = selectedEntityIds.length > 0 || selectedOverlayIds.length > 0;
  const isCollectingInput =
    isActive &&
    hasAnySelected &&
    (phase === 'awaiting-base-point' || phase === 'awaiting-destination');

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine transitions (shared FSM SSoT, ADR-577) ──────────────────
  // Every hook-driven phase change clears the preview ghost; entering the
  // entity/base phase also drops the stale base point (mirrors the old inline
  // effect exactly). Overlays count toward the selection (move supports both).
  useModifyToolActivation({
    isActive,
    selectionCount: selectedEntityIds.length + selectedOverlayIds.length,
    phase,
    entityPhase: 'awaiting-entity',
    basePhase: 'awaiting-base-point',
    setPhase: (p) => {
      previewCanvasRef.current?.clear();
      if (p === 'awaiting-entity' || p === 'awaiting-base-point') setBasePoint(null);
      setPhase(p as MovePhase);
    },
    onDeactivate: () => {
      previewCanvasRef.current?.clear();
      setPhase('idle');
      setBasePoint(null);
    },
  });

  // ── Click handler ────────────────────────────────────────────────────────
  const handleMoveClick = useCallback(
    (worldPoint: Point2D) => {
      if (!isCollectingInput) return;

      if (phase === 'awaiting-base-point') {
        setBasePoint(worldPoint);
        setPhase('awaiting-destination');
        return;
      }

      if (phase === 'awaiting-destination' && basePoint) {
        // ORTHO (F8) locks the destination to the H/V axis from the base point
        // (AutoCAD MOVE+ORTHO). No-op when OFF. Matches the live ghost (useMovePreview).
        const orthoDelta = applyOrthoToDelta({
          x: worldPoint.x - basePoint.x,
          y: worldPoint.y - basePoint.y,
        });
        // ADR-562 Φ9.3 — AutoAlign override on the ORTHO-locked destination (base point
        // ⊕ ambient), so the committed move lands EXACTLY where the ghost trace snapped
        // (WYSIWYG). The helper gates ambient/polar behind the CAD toggles → no-op when
        // AutoAlign + POLAR are off (identity delta = the previous behaviour).
        const orthoDest: Point2D = { x: basePoint.x + orthoDelta.x, y: basePoint.y + orthoDelta.y };
        const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
        const alignTrk = resolveActionAlignmentTracking(
          orthoDest, [basePoint], getImmediateTransform().scale,
          (scene?.entities ?? null) as unknown as readonly Entity[] | null,
        );
        const finalDest = alignTrk ? alignTrk.point : orthoDest;
        const delta: Point2D = { x: finalDest.x - basePoint.x, y: finalDest.y - basePoint.y };
        if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

        const commands: ICommand[] = [];

        if (selectedEntityIds.length > 0) {
          const sm = getSceneManager();
          if (sm) {
            // ADR-049 — the move command self-cascades associative children inside
            // its execute/undo/redo: slab→slab-opening (cascadeMovedSlabOpenings)
            // and wall→opening (cascadeHostedOpeningsForWalls). No selection
            // expansion here — every gesture (tool/drag/nudge) inherits the cascade.
            commands.push(
              selectedEntityIds.length === 1
                ? new MoveEntityCommand(selectedEntityIds[0], delta, sm, false)
                : new MoveMultipleEntitiesCommand(selectedEntityIds, delta, sm, false),
            );
          }
        }

        if (selectedOverlayIds.length > 0 && createOverlayMoveCommand) {
          commands.push(createOverlayMoveCommand(selectedOverlayIds, delta));
        } else if (selectedOverlayIds.length > 0) {
          executeOverlayMove?.(selectedOverlayIds, delta);
        }

        if (commands.length === 1) {
          executeCommand(commands[0]);
        } else if (commands.length > 1) {
          executeCommand(new CompoundCommand('Move', commands));
        }

        previewCanvasRef.current?.clear();
        setPhase('awaiting-base-point');
        setBasePoint(null);
      }
    },
    [isCollectingInput, phase, basePoint, getSceneManager, selectedEntityIds, selectedOverlayIds, executeCommand, executeOverlayMove, createOverlayMoveCommand, previewCanvasRef],
  );

  // ── Escape handler ───────────────────────────────────────────────────────
  const handleMoveEscape = useCallback(() => {
    previewCanvasRef.current?.clear();
    setPhase('idle');
    setBasePoint(null);
    onToolChange?.('select');
  }, [previewCanvasRef, onToolChange]);

  // ── Prompt text (i18n) ───────────────────────────────────────────────────
  let prompt = '';
  if (phase === 'awaiting-entity') {
    prompt = i18next.t('dxf-viewer-guides:moveTool.selectEntity');
  } else if (phase === 'awaiting-base-point') {
    prompt = i18next.t('dxf-viewer-guides:moveTool.selectBasePoint');
  } else if (phase === 'awaiting-destination') {
    prompt = i18next.t('dxf-viewer-guides:moveTool.selectDestination');
  }

  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    toolHintOverrideStore.setOverride(prompt);
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, phase, prompt]);

  return { phase, basePoint, isActive, isCollectingInput, handleMoveClick, handleMoveEscape, prompt };
}
