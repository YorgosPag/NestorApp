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

import { useState, useCallback, useRef, useEffect } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { MoveEntityCommand, MoveMultipleEntitiesCommand, CompoundCommand } from '../../core/commands';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { useLevels } from '../../systems/levels';

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

  const wasActiveRef = useRef(false);
  const prevEntityCountRef = useRef(0);

  const isActive = activeTool === 'move';
  const hasAnySelected = selectedEntityIds.length > 0 || selectedOverlayIds.length > 0;
  const isCollectingInput =
    isActive &&
    hasAnySelected &&
    (phase === 'awaiting-base-point' || phase === 'awaiting-destination');

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine transitions ────────────────────────────────────────────
  useEffect(() => {
    const toolIsMove = activeTool === 'move';
    const hasEntities = selectedEntityIds.length > 0 || selectedOverlayIds.length > 0;

    if (toolIsMove && !wasActiveRef.current) {
      setPhase(hasEntities ? 'awaiting-base-point' : 'awaiting-entity');
      setBasePoint(null);
      previewCanvasRef.current?.clear();
    } else if (!toolIsMove && wasActiveRef.current) {
      setPhase('idle');
      setBasePoint(null);
      previewCanvasRef.current?.clear();
    } else if (toolIsMove && wasActiveRef.current) {
      const prevCount = prevEntityCountRef.current;
      if (prevCount === 0 && hasEntities && phase === 'awaiting-entity') {
        setPhase('awaiting-base-point');
        previewCanvasRef.current?.clear();
      } else if (prevCount > 0 && !hasEntities) {
        setPhase('awaiting-entity');
        setBasePoint(null);
        previewCanvasRef.current?.clear();
      }
    }

    wasActiveRef.current = toolIsMove;
    prevEntityCountRef.current = selectedEntityIds.length + selectedOverlayIds.length;
  }, [activeTool, selectedEntityIds.length, selectedOverlayIds.length, phase, previewCanvasRef]);

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
        const delta: Point2D = {
          x: worldPoint.x - basePoint.x,
          y: worldPoint.y - basePoint.y,
        };
        if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

        const commands: ICommand[] = [];

        if (selectedEntityIds.length > 0) {
          const sm = getSceneManager();
          if (sm) {
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
