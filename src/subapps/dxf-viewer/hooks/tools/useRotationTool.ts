/**
 * USE ROTATION TOOL — State machine hook for entity rotation
 *
 * ADR-188: Entity Rotation System
 *
 * State machine (AutoCAD ROTATE with Reference pattern):
 *   idle → awaiting-entity → awaiting-base-point → awaiting-reference → awaiting-angle → (execute) → awaiting-base-point
 *
 * When activeTool === 'rotate':
 *   - If entities are already selected → skip straight to awaiting-base-point
 *   - If NO entities selected → awaiting-entity (clicks select entities normally)
 *   - Once entities are selected → transition to awaiting-base-point
 *   - Click base point → awaiting-reference (user defines 0° direction)
 *   - Click reference point → awaiting-angle (mouse rotates around base)
 *
 * @module hooks/tools/useRotationTool
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useModifyToolActivation } from '../../systems/tools/useModifyToolActivation';
import { angleBetweenPointsDeg } from '../../utils/rotation-math';
import { resolveOrthoPolarStep } from '../drawing/drawing-handler-utils';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { useLevels } from '../../systems/levels';
import type { Overlay, UpdateOverlayData } from '../../overlays/types';
import { rotatePoint } from '../../utils/rotation-math';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';
// ADR-397/513 (Giorgio 2026-07-06) — big-player parity: inline πληκτρολόγηση γωνίας (Revit/C4D/Figma),
// ΟΧΙ modal dialog. ΙΔΙΟ SSoT input-parsing με το grip hot-grip rotate-free (κόμμα ≡ τελεία).
import { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';
import { applyTypedAngleKey } from '../../systems/dynamic-input/typed-angle-entry';

// ============================================================================
// TYPES
// ============================================================================

export type RotationPhase = 'idle' | 'awaiting-entity' | 'awaiting-base-point' | 'awaiting-reference' | 'awaiting-angle';

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
  /** Current overlays for overlay rotation support */
  currentOverlays?: Overlay[];
  /** Overlay update handler for persisting rotated polygons */
  overlayUpdate?: (id: string, patch: UpdateOverlayData) => void;
}

export interface UseRotationToolReturn {
  /** Current phase of the rotation state machine */
  phase: RotationPhase;
  /** The chosen base point (pivot), or null if not yet picked */
  basePoint: Point2D | null;
  /** The reference direction point (clicked by user in awaiting-reference phase) */
  referencePoint: Point2D | null;
  /** The current rotation angle in degrees (updated on mouse move) */
  currentAngle: number;
  /** Whether the rotation tool is active (activeTool === 'rotate') */
  isActive: boolean;
  /** Whether the tool is collecting geometric input (base-point, reference, or angle — intercepts clicks) */
  isCollectingInput: boolean;
  /** Handle canvas click — routes to base-point, reference, or angle selection */
  handleRotationClick: (worldPoint: Point2D) => void;
  /** Handle mouse move — updates angle + triggers preview redraw */
  handleRotationMouseMove: (worldPoint: Point2D) => void;
  /** Cancel rotation and return to idle */
  handleRotationEscape: () => void;
  /** Set angle directly from DynamicInput (degrees) */
  handleAngleInput: (angleDeg: number) => void;
  /** ADR-397/513 — inline typed-angle keyboard handler (awaiting-angle): ψηφία/κόμμα/Backspace/Enter. */
  handleRotationKeyDown: (key: string) => boolean;
  /** True όταν η φάση είναι `awaiting-angle` (gate για το inline typed-angle keyboard routing). */
  isAwaitingAngle: boolean;
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
    currentOverlays = [],
    overlayUpdate,
  } = props;

  const [phase, setPhase] = useState<RotationPhase>('idle');
  const [basePoint, setBasePoint] = useState<Point2D | null>(null);
  const [referencePoint, setReferencePoint] = useState<Point2D | null>(null);
  const [currentAngle, setCurrentAngle] = useState(0);

  // Ref for start angle (angle from pivot to reference point — set explicitly by click)
  const startAngleRef = useRef(0);

  // ADR-397/513 — inline typed-angle buffer (ΙΔΙΟ DirectDistanceEntry SSoT με το grip hot-grip). Όσο
  // `status==='buffering'` (πληκτρολογείς), το φάντασμα δείχνει τη ΓΩΝΙΑ που χτίζεις και το mouse-move/κλικ
  // ΔΕΝ την αλλάζουν (option Β)· Enter οριστικοποιεί. Reset σε κάθε φυγή από `awaiting-angle` (effect κάτω).
  const angleDdeRef = useRef(new DirectDistanceEntry());
  const isTypingAngle = useCallback(() => angleDdeRef.current.snapshot().status === 'buffering', []);

  // ADR-357 Phase 12 — armed when the grip-context-menu "Copy" toggle was on at
  // handoff. Forwarded to `RotateEntityCommand` so the rotation produces clones
  // and leaves the originals intact. Auto-clears after the first execute.
  const copyModeHandoffRef = useRef(false);

  // isActive: rotation tool is the current tool (even without selection)
  const isActive = activeTool === 'rotate';

  // isCollectingInput: rotation tool needs clicks for base-point, reference, or angle
  // (NOT awaiting-entity — that phase lets clicks pass through for entity selection)
  const isCollectingInput = isActive && selectedEntityIds.length > 0
    && (phase === 'awaiting-base-point' || phase === 'awaiting-reference' || phase === 'awaiting-angle');

  // Build scene manager adapter on demand
  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── State machine transitions (shared FSM SSoT, ADR-577) ──────────────────
  // Every hook-driven phase change clears the ghost + drops stale pivot/ref/angle.
  // The grip-drag handoff (pre-seeded pivot → jump to reference, or reference
  // vector → jump to angle) is the tool-specific ACTIVATE variant (`onActivate`).
  useModifyToolActivation({
    isActive,
    selectionCount: selectedEntityIds.length,
    phase,
    entityPhase: 'awaiting-entity',
    basePhase: 'awaiting-base-point',
    setPhase: (p) => {
      previewCanvasRef.current?.clear();
      if (p === 'awaiting-entity' || p === 'awaiting-base-point') {
        setBasePoint(null); setReferencePoint(null); setCurrentAngle(0);
      }
      setPhase(p as RotationPhase);
    },
    onDeactivate: () => {
      previewCanvasRef.current?.clear();
      setPhase('idle'); setBasePoint(null); setReferencePoint(null); setCurrentAngle(0);
    },
    onActivate: (hasSelection) => {
      const handoff = GripHandoffStore.consume('rotate');
      if (hasSelection && handoff) {
        previewCanvasRef.current?.clear();
        copyModeHandoffRef.current = handoff.options.copyMode === true;
        if (handoff.options.refStart && handoff.options.refEnd) {
          // Reference modifier: fast-forward past awaiting-reference to awaiting-angle.
          setBasePoint(handoff.point);
          setReferencePoint(handoff.options.refEnd);
          startAngleRef.current = angleBetweenPointsDeg(handoff.options.refStart, handoff.options.refEnd);
          setCurrentAngle(0);
          setPhase('awaiting-angle');
        } else {
          // Grip drag pre-seeded the pivot → skip straight to reference.
          setBasePoint(handoff.point);
          setReferencePoint(null);
          setCurrentAngle(0);
          setPhase('awaiting-reference');
        }
        return true;
      }
      return false; // default (hasSelection ? base : entity) resets pivot/ref/angle via setPhase
    },
  });

  /**
   * Handle canvas click during rotation
   */
  const handleRotationClick = useCallback((worldPoint: Point2D) => {
    if (!isCollectingInput) return;

    if (phase === 'awaiting-base-point') {
      // Save pivot and transition to reference direction
      setBasePoint(worldPoint);
      setReferencePoint(null);
      startAngleRef.current = 0;
      setCurrentAngle(0);
      setPhase('awaiting-reference');
      return;
    }

    if (phase === 'awaiting-reference' && basePoint) {
      // Set reference direction (0° angle) and transition to angle picking
      const dx = worldPoint.x - basePoint.x;
      const dy = worldPoint.y - basePoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return; // Too close to base point — ignore

      setReferencePoint(worldPoint);
      startAngleRef.current = angleBetweenPointsDeg(basePoint, worldPoint);
      setCurrentAngle(0);
      setPhase('awaiting-angle');
      return;
    }

    if (phase === 'awaiting-angle' && basePoint) {
      // ADR-397/513 (Giorgio 2026-07-06, option Β) — όσο πληκτρολογείς γωνία, το κλικ είναι no-op:
      // ΜΟΝΟ το Enter κλειδώνει την πληκτρολογημένη γωνία (parity με το grip hot-grip rotate-free).
      if (isTypingAngle()) return;
      // Calculate final angle and execute rotation
      const finalAngle = currentAngle; // Use the angle that was being previewed

      if (Math.abs(finalAngle) < 0.001) return; // Skip zero rotation

      // Check if we're rotating an overlay or a DXF entity
      const overlayId = selectedEntityIds.find(id =>
        currentOverlays.some(o => o.id === id)
      );

      if (overlayId && overlayUpdate) {
        // ── Overlay rotation: rotate all polygon vertices around pivot ──
        const overlay = currentOverlays.find(o => o.id === overlayId);
        if (overlay?.polygon) {
          const rotatedPolygon: Array<[number, number]> = overlay.polygon.map(([x, y]) => {
            const rotated = rotatePoint({ x, y }, basePoint, finalAngle);
            return [rotated.x, rotated.y];
          });
          overlayUpdate(overlayId, { polygon: rotatedPolygon });
        }
      } else {
        // ── DXF entity rotation: use RotateEntityCommand ──
        const sm = getSceneManager();
        if (!sm) return;

        // ADR-357 Phase 12 — honor `copyMode` from the grip handoff (one-shot).
        const useCopy = copyModeHandoffRef.current;
        copyModeHandoffRef.current = false;
        const cmd = new RotateEntityCommand(
          selectedEntityIds,
          basePoint,
          finalAngle,
          sm,
          false,
          useCopy,
        );
        executeCommand(cmd);
      }

      previewCanvasRef.current?.clear();

      // Reset for next rotation (continuous mode)
      setPhase('awaiting-base-point');
      setBasePoint(null);
      setReferencePoint(null);
      setCurrentAngle(0);
      return;
    }
  }, [isCollectingInput, phase, basePoint, currentAngle, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef, currentOverlays, overlayUpdate, isTypingAngle]);

  /**
   * Handle mouse move — update angle for preview
   */
  const handleRotationMouseMove = useCallback((worldPoint: Point2D) => {
    if (phase !== 'awaiting-angle' || !basePoint) return;
    // ADR-397/513 (option Β) — όσο πληκτρολογείς γωνία, το ποντίκι ΔΕΝ την αλλάζει (το typed νικά· Enter οριστικοποιεί).
    if (isTypingAngle()) return;

    // ORTHO(F8)/POLAR(F10) angle-lock around the pivot — SAME SSoT chain the hot-grip
    // rotation uses (rotation-tracking-overlay.resolveRotationTracking). No-op when both
    // toggles are off, so default behaviour is unchanged. The commit path reads
    // `currentAngle`, so snapping the previewed angle snaps the committed one too
    // (preview ≡ commit), matching AutoCAD/Revit ROTATE angle-lock.
    const ortho = cadToggleState.isOrthoOn();
    const polar = cadToggleState.isPolarOn();
    const stepped = resolveOrthoPolarStep(worldPoint, basePoint, { ortho, polar }).stepped;

    // Reference angle was set explicitly in awaiting-reference phase
    const rawAngle = angleBetweenPointsDeg(basePoint, stepped);
    const angle = rawAngle - startAngleRef.current;
    setCurrentAngle(angle);
  }, [phase, basePoint, isTypingAngle]);

  /**
   * Cancel rotation
   */
  const handleRotationEscape = useCallback(() => {
    previewCanvasRef.current?.clear();
    angleDdeRef.current.reset(); // ADR-397/513 — καθάρισε τυχόν πληκτρολογημένη γωνία
    setPhase('idle');
    setBasePoint(null);
    setReferencePoint(null);
    setCurrentAngle(0);
    onToolChange?.('select');
  }, [previewCanvasRef, onToolChange]);

  /**
   * Handle direct angle input from DynamicInput
   */
  const handleAngleInput = useCallback((angleDeg: number) => {
    if (phase !== 'awaiting-angle' || !basePoint) return;

    if (Math.abs(angleDeg) < 0.001) return;

    // Check if we're rotating an overlay or a DXF entity
    const overlayId = selectedEntityIds.find(id =>
      currentOverlays.some(o => o.id === id)
    );

    if (overlayId && overlayUpdate) {
      const overlay = currentOverlays.find(o => o.id === overlayId);
      if (overlay?.polygon) {
        const rotatedPolygon: Array<[number, number]> = overlay.polygon.map(([x, y]) => {
          const rotated = rotatePoint({ x, y }, basePoint, angleDeg);
          return [rotated.x, rotated.y];
        });
        overlayUpdate(overlayId, { polygon: rotatedPolygon });
      }
    } else {
      const sm = getSceneManager();
      if (!sm) return;

      // ADR-357 Phase 12 — honor `copyMode` from the grip handoff (one-shot).
      const useCopy = copyModeHandoffRef.current;
      copyModeHandoffRef.current = false;
      const cmd = new RotateEntityCommand(
        selectedEntityIds,
        basePoint,
        angleDeg,
        sm,
        false,
        useCopy,
      );
      executeCommand(cmd);
    }

    previewCanvasRef.current?.clear();

    // Reset for next rotation
    setPhase('awaiting-base-point');
    setBasePoint(null);
    setReferencePoint(null);
    setCurrentAngle(0);
  }, [phase, basePoint, getSceneManager, selectedEntityIds, executeCommand, previewCanvasRef, currentOverlays, overlayUpdate]);

  /**
   * ADR-397/513 (Giorgio 2026-07-06) — big-player inline typed-angle (Revit / Maxon Cinema-4D / Figma):
   * στη φάση `awaiting-angle`, ψηφία/κόμμα/τελεία χτίζουν τη γωνία (ζωντανό preview στο ghost),
   * `Backspace` επεξεργάζεται, `Enter` οριστικοποιεί. ΙΔΙΟ SSoT input-parsing (`applyTypedAngleKey`) +
   * option-Β semantics με το grip hot-grip rotate-free (κόμμα ≡ τελεία· ΜΟΝΟ Enter κλειδώνει το typed).
   * Επιστρέφει `true` όταν καταναλώθηκε το πλήκτρο (ο keyboard hook κάνει preventDefault + stopImmediatePropagation).
   */
  const handleRotationKeyDown = useCallback((key: string): boolean => {
    if (phase !== 'awaiting-angle' || !basePoint) return false;
    const res = applyTypedAngleKey(angleDdeRef.current, key);
    if (res.kind === 'none') return res.consumed;   // δεν είναι πλήκτρο γωνίας → falls through
    if (res.kind === 'commit') {
      // Enter → οριστικοποίηση: πληκτρολογημένη γωνία αν υπάρχει, αλλιώς η τρέχουσα (cursor) preview γωνία.
      const deg = res.value ?? currentAngle;
      angleDdeRef.current.reset();
      handleAngleInput(deg);   // commit + reset phase (→ το effect καθαρίζει το buffer)
      return true;
    }
    // 'buffer' → live preview: το ghost γυρίζει στην πληκτρολογημένη γωνία (override cursor).
    setCurrentAngle(res.value ?? 0);
    return true;
  }, [phase, basePoint, currentAngle, handleAngleInput]);

  // ADR-397/513 — καθάρισε το typed-angle buffer σε ΚΑΘΕ φυγή από `awaiting-angle` (commit/escape/deselect/
  // tool-change), ώστε η επόμενη περιστροφή να ξεκινά με άδειο buffer (μηδέν stale typed γωνία).
  useEffect(() => {
    if (phase !== 'awaiting-angle') angleDdeRef.current.reset();
  }, [phase]);

  // Prompt text based on phase
  let prompt = '';
  if (phase === 'awaiting-entity') prompt = 'Επιλέξτε οντότητα για περιστροφή';
  else if (phase === 'awaiting-base-point') prompt = 'Κλικ: κέντρο περιστροφής';
  else if (phase === 'awaiting-reference') prompt = 'Κλικ: κατεύθυνση αναφοράς';
  else if (phase === 'awaiting-angle') prompt = 'Πληκτρολόγησε γωνία + Enter, ή μετακίνησε + κλικ';

  // Sync prompt to toolbar status bar via external store
  useEffect(() => {
    if (!isActive || phase === 'idle') {
      toolHintOverrideStore.setOverride(null);
      return;
    }
    toolHintOverrideStore.setOverride(prompt);
    return () => { toolHintOverrideStore.setOverride(null); };
  }, [isActive, phase, prompt]);

  return {
    phase,
    basePoint,
    referencePoint,
    currentAngle,
    isActive,
    isCollectingInput,
    handleRotationClick,
    handleRotationMouseMove,
    handleRotationEscape,
    handleAngleInput,
    handleRotationKeyDown,
    isAwaitingAngle: isActive && phase === 'awaiting-angle',
    prompt,
  };
}
