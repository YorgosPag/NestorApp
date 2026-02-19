/**
 * USE ROTATION TOOL — State machine hook for entity rotation
 *
 * 🏢 ADR-188: Entity Rotation System
 *
 * State machine:
 *   idle → awaiting-base-point → awaiting-angle → (execute) → idle
 *
 * The hook is active when activeTool === 'rotate' AND entities are selected.
 * It exposes click/move/escape handlers that CanvasSection routes to the canvas.
 *
 * @module hooks/tools/useRotationTool
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { angleBetweenPointsDeg } from '../../utils/rotation-math';
import type { useLevels } from '../../systems/levels';

// ============================================================================
// TYPES
// ============================================================================

export type RotationPhase = 'idle' | 'awaiting-base-point' | 'awaiting-angle';

/** Subset of useLevels return type needed by rotation tool */
type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'setLevelScene' | 'currentLevelId'>;

export interface UseRotationToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  /** Level manager for scene access (creates ISceneManager adapter internally) */
  levelManager: LevelManagerLike;
  /** Command executor (from useCommandHistory) */
  executeCommand: (cmd: ICommand) => void;
  /** PreviewCanvas ref for clearing on complete */
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  /** Callback to switch tool back to select */
  onToolChange?: (tool: string) => void;
}

export interface UseRotationToolReturn {
  /** Current phase of the rotation state machine */
  phase: RotationPhase;
  /** The chosen base point (pivot), or null if not yet picked */
  basePoint: Point2D | null;
  /** The current rotation angle in degrees (updated on mouse move) */
  currentAngle: number;
  /** Whether the rotation tool is actively collecting input */
  isActive: boolean;
  /** Handle canvas click — routes to base-point or angle selection */
  handleRotationClick: (worldPoint: Point2D) => void;
  /** Handle mouse move — updates angle + triggers preview redraw */
  handleRotationMouseMove: (worldPoint: Point2D) => void;
  /** Cancel rotation and return to idle */
  handleRotationEscape: () => void;
  /** Set angle directly from DynamicInput (degrees) */
  handleAngleInput: (angleDeg: number) => void;
  /** Prompt text for DynamicInput */
  prompt: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRotationTool(props: UseRotationToolProps): UseRotationToolReturn {
  const {
    activeTool,
    selectedEntityIds,
    levelManager,
    executeCommand,
    previewCanvasRef,
    onToolChange,
  } = props;

  const [phase, setPhase] = useState<RotationPhase>('idle');
  const [basePoint, setBasePoint] = useState<Point2D | null>(null);
  const [currentAngle, setCurrentAngle] = useState(0);

  // Ref for start angle (angle from pivot to first mouse position after base point)
  const startAngleRef = useRef(0);
  const firstMoveAfterBaseRef = useRef(true);

  const isActive = activeTool === 'rotate' && selectedEntityIds.length > 0;

  // Track previous active state to clear preview ONLY on rotation transitions
  const wasActiveRef = useRef(false);

  // Build scene manager adapter on demand
  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // Reset when rotation activates/deactivates
  // CRITICAL: Only clear PreviewCanvas on actual rotation transitions,
  // never during drawing tool usage (that would wipe rubber-band preview)
  useEffect(() => {
    const nowActive = activeTool === 'rotate' && selectedEntityIds.length > 0;

    if (nowActive && !wasActiveRef.current) {
      // Transition: inactive → active (entering rotation mode)
      setPhase('awaiting-base-point');
      setBasePoint(null);
      setCurrentAngle(0);
      firstMoveAfterBaseRef.current = true;
      previewCanvasRef.current?.clear();
    } else if (!nowActive && wasActiveRef.current) {
      // Transition: active → inactive (leaving rotation mode)
      setPhase('idle');
      setBasePoint(null);
      setCurrentAngle(0);
      previewCanvasRef.current?.clear();
    }
    // No clear() when rotation was never active — preserves drawing preview

    wasActiveRef.current = nowActive;
  }, [activeTool, selectedEntityIds.length]);

  /**
   * Handle canvas click during rotation
   */
  const handleRotationClick = useCallback((worldPoint: Point2D) => {
    if (!isActive) return;

    if (phase === 'awaiting-base-point') {
      // Save pivot and transition to angle selection
      setBasePoint(worldPoint);
      startAngleRef.current = 0;
      firstMoveAfterBaseRef.current = true;
      setCurrentAngle(0);
      setPhase('awaiting-angle');
      return;
    }

    if (phase === 'awaiting-angle' && basePoint) {
      // Calculate final angle and execute rotation
      const sm = getSceneManager();
      if (!sm) return;

      const finalAngle = currentAngle; // Use the angle that was being previewed

      if (Math.abs(finalAngle) < 0.001) return; // Skip zero rotation

      const cmd = new RotateEntityCommand(
        selectedEntityIds,
        basePoint,
        finalAngle,
        sm,
        false
      );
      executeCommand(cmd);

      previewCanvasRef.current?.clear();

      // Reset for next rotation (continuous mode)
      setPhase('awaiting-base-point');
      setBasePoint(null);
      setCurrentAngle(0);
      firstMoveAfterBaseRef.current = true;
      return;
    }
  }, [isActive, phase, basePoint, currentAngle, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef]);

  /**
   * Handle mouse move — update angle for preview
   */
  const handleRotationMouseMove = useCallback((worldPoint: Point2D) => {
    if (phase !== 'awaiting-angle' || !basePoint) return;

    // On first mouse move after base point selection, record the reference angle
    if (firstMoveAfterBaseRef.current) {
      startAngleRef.current = angleBetweenPointsDeg(basePoint, worldPoint);
      firstMoveAfterBaseRef.current = false;
    }

    const rawAngle = angleBetweenPointsDeg(basePoint, worldPoint);
    const angle = rawAngle - startAngleRef.current;
    setCurrentAngle(angle);
  }, [phase, basePoint]);

  /**
   * Cancel rotation
   */
  const handleRotationEscape = useCallback(() => {
    previewCanvasRef.current?.clear();
    setPhase('idle');
    setBasePoint(null);
    setCurrentAngle(0);
    onToolChange?.('select');
  }, [previewCanvasRef, onToolChange]);

  /**
   * Handle direct angle input from DynamicInput
   */
  const handleAngleInput = useCallback((angleDeg: number) => {
    if (phase !== 'awaiting-angle' || !basePoint) return;

    const sm = getSceneManager();
    if (!sm) return;

    if (Math.abs(angleDeg) < 0.001) return;

    const cmd = new RotateEntityCommand(
      selectedEntityIds,
      basePoint,
      angleDeg,
      sm,
      false
    );
    executeCommand(cmd);

    previewCanvasRef.current?.clear();

    // Reset for next rotation
    setPhase('awaiting-base-point');
    setBasePoint(null);
    setCurrentAngle(0);
    firstMoveAfterBaseRef.current = true;
  }, [phase, basePoint, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef]);

  // Prompt text based on phase
  const prompt = phase === 'awaiting-base-point'
    ? 'Specify base point'
    : phase === 'awaiting-angle'
      ? 'Specify rotation angle'
      : '';

  return {
    phase,
    basePoint,
    currentAngle,
    isActive,
    handleRotationClick,
    handleRotationMouseMove,
    handleRotationEscape,
    handleAngleInput,
    prompt,
  };
}
