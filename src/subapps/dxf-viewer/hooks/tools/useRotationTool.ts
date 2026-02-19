/**
 * USE ROTATION TOOL — State machine hook for entity rotation
 *
 * ADR-188: Entity Rotation System
 *
 * State machine (AutoCAD ROTATE pattern):
 *   idle → awaiting-entity → awaiting-base-point → awaiting-angle → (execute) → awaiting-base-point
 *
 * When activeTool === 'rotate':
 *   - If entities are already selected → skip straight to awaiting-base-point
 *   - If NO entities selected → awaiting-entity (clicks select entities normally)
 *   - Once entities are selected → transition to awaiting-base-point
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

export type RotationPhase = 'idle' | 'awaiting-entity' | 'awaiting-base-point' | 'awaiting-angle';

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
  /** Whether the rotation tool is active (activeTool === 'rotate') */
  isActive: boolean;
  /** Whether the tool is collecting geometric input (base-point or angle — intercepts clicks) */
  isCollectingInput: boolean;
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

  // isActive: rotation tool is the current tool (even without selection)
  const isActive = activeTool === 'rotate';

  // isCollectingInput: rotation tool needs clicks for base-point or angle
  // (NOT awaiting-entity — that phase lets clicks pass through for entity selection)
  const isCollectingInput = isActive && selectedEntityIds.length > 0
    && (phase === 'awaiting-base-point' || phase === 'awaiting-angle');

  // Track previous states to detect transitions
  const wasActiveRef = useRef(false);
  const prevEntityCountRef = useRef(0);

  // Build scene manager adapter on demand
  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine transitions ──────────────────────────────────────────
  useEffect(() => {
    const toolIsRotate = activeTool === 'rotate';
    const hasEntities = selectedEntityIds.length > 0;

    if (toolIsRotate && !wasActiveRef.current) {
      // Transition: entering rotation mode
      if (hasEntities) {
        // Entities already selected → skip to base-point
        setPhase('awaiting-base-point');
      } else {
        // No entities → prompt user to select
        setPhase('awaiting-entity');
      }
      setBasePoint(null);
      setCurrentAngle(0);
      firstMoveAfterBaseRef.current = true;
      previewCanvasRef.current?.clear();
    } else if (!toolIsRotate && wasActiveRef.current) {
      // Transition: leaving rotation mode
      setPhase('idle');
      setBasePoint(null);
      setCurrentAngle(0);
      previewCanvasRef.current?.clear();
    } else if (toolIsRotate && wasActiveRef.current) {
      // Still in rotation mode — check if entities were just selected
      const prevCount = prevEntityCountRef.current;
      if (prevCount === 0 && hasEntities && phase === 'awaiting-entity') {
        // Entity just selected during awaiting-entity → transition to base-point
        setPhase('awaiting-base-point');
        previewCanvasRef.current?.clear();
      } else if (hasEntities && prevCount > 0 && selectedEntityIds.length === 0) {
        // Entities deselected during rotation → back to awaiting-entity
        setPhase('awaiting-entity');
        setBasePoint(null);
        setCurrentAngle(0);
        previewCanvasRef.current?.clear();
      }
    }

    wasActiveRef.current = toolIsRotate;
    prevEntityCountRef.current = selectedEntityIds.length;
  }, [activeTool, selectedEntityIds.length, phase, previewCanvasRef]);

  /**
   * Handle canvas click during rotation
   */
  const handleRotationClick = useCallback((worldPoint: Point2D) => {
    if (!isCollectingInput) return;

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
  }, [isCollectingInput, phase, basePoint, currentAngle, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef]);

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
  let prompt = '';
  if (phase === 'awaiting-entity') prompt = 'Select entity to rotate';
  else if (phase === 'awaiting-base-point') prompt = 'Specify base point';
  else if (phase === 'awaiting-angle') prompt = 'Specify rotation angle';

  return {
    phase,
    basePoint,
    currentAngle,
    isActive,
    isCollectingInput,
    handleRotationClick,
    handleRotationMouseMove,
    handleRotationEscape,
    handleAngleInput,
    prompt,
  };
}
