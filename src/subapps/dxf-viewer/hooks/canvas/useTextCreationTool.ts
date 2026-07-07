'use client';

/**
 * ADR-344 Phase 6.E/6.F — Text + MText creation tool.
 *
 * Handles both 'text' (single-line) and 'mtext' (multiline, width-bounded):
 *   'text'  → click → narrow overlay (width=200px) → TEXT entity (auto) or MTEXT if multiline
 *   'mtext' → click → wide overlay (width=40% canvas) → MTEXT entity (forced)
 *
 * On commit, CreateTextCommand is dispatched and the tool returns to 'select'
 * (allowsContinuous=false on both tool definitions).
 *
 * ADR-040 note: local React state only, no useSyncExternalStore.
 * Safe to mount in the orchestrator (CanvasSection).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { CreateTextCommand } from '../../core/commands/text/CreateTextCommand';
import { useDxfTextServices } from '../../ui/text-toolbar/hooks/useDxfTextServices';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { DXF_COLOR_BY_LAYER } from '../../text-engine/types/text-toolbar.types';
import type { DxfTextNode } from '../../text-engine/types';
import type { ToolType } from '../../ui/toolbar/types';
// ADR-344 Phase 13 / Round 7 — scene-units + annotation-scale awareness for the
// default text height. The 2.5 paper-mm CAD default must be (a) scaled by the
// active drawing scale (Revit annotation scale, ADR-375 — 1:100 default) and
// (b) converted to world units, so a ribbon TEXT is legible at building scale in
// ANY unit system (mm/cm/m). SSoT helpers: scene-units + annotation-scale.
import { type SceneUnits } from '../../utils/scene-units';
import { paperHeightToModel } from '../../utils/annotation-scale';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
// ADR-508 §text-parity — flush-to-face του σημείου εισαγωγής (ΙΔΙΟΣ πυρήνας με το line commit) ώστε
// το κείμενο να μπαίνει ΑΚΡΙΒΩΣ εκεί που δείχνει το ghost-φάντασμα (preview ≡ commit).
import { resolveFaceFlushInsertionPoint } from '../drawing/line-preview-helpers';
// ADR-508 §text-parity (2-click place→rotate) — το 1ο κλικ κλειδώνει τη θέση + μπαίνει σε rotation
// phase· το 2ο ορίζει την κλίση (ΟΡΘΟ/Polar F8/F10 μέσω του ΚΟΙΝΟΥ `resolveOrthoPolarStep` SSoT).
import { resolveOrthoPolarStep } from '../drawing/drawing-handler-utils';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { setTextRotationOrigin, clearTextRotationOrigin, setTextEditingActive } from '../../systems/cursor/TextRotationStore';

interface CreatingState {
  readonly entityId: string;
  readonly position: Point2D;
  readonly initial: DxfTextNode;
  readonly anchorRect: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  /** World-space width for MTEXT bounding box. Undefined for TEXT. */
  readonly worldWidth?: number;
  /** Force MTEXT type on commit (mtext tool mode). */
  readonly forceMText?: boolean;
  /** ADR-508 §text-parity — γωνία κλίσης (CCW μοίρες) από το 2-click place→rotate. 0/undefined = οριζόντιο. */
  readonly rotation?: number;
}

/**
 * ADR-508 §text-parity — ενδιάμεση φάση «awaitingRotation» (μετά το 1ο κλικ, πριν το 2ο): το σημείο
 * εισαγωγής έχει κλειδώσει και ο χρήστης ορίζει την κλίση κινώντας τον κέρσορα. Το πεδίο ΔΕΝ ανοίγει
 * ακόμη — ανοίγει στο 2ο κλικ με την κλίση κλειδωμένη.
 */
interface RotatingState {
  readonly insertionPoint: Point2D;
  readonly units: SceneUnits;
  readonly isMText: boolean;
}

interface CanvasTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface UseTextCreationToolParams {
  readonly transformRef: React.RefObject<CanvasTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly activeTool: ToolType;
  readonly onToolChange: (tool: ToolType) => void;
  readonly executeCommand: (cmd: ICommand) => void;
  /**
   * ADR-344 Phase 13 — active scene units resolver. Returns the unit system of
   * the level the user is currently editing so the 2.5 mm paper-default lands
   * in world units (e.g. 0.0025 in a meters scene). Defaults to `'mm'` when
   * unavailable, preserving back-compat for mm-baked DXFs.
   */
  readonly getSceneUnits?: () => SceneUnits;
}

interface TextCreationToolApi {
  readonly creatingState: CreatingState | null;
  readonly handleCanvasClick: (worldPoint: Point2D) => boolean;
  readonly onCommit: (next: DxfTextNode) => void;
  readonly onCancel: () => void;
}

// Empty AST: single paragraph, single empty run with default plain CAD style.
// Mirrors `DEFAULT_RUN_STYLE` from text-engine/templates/defaults/template-helpers
// without coupling to that private module.
//
// ADR-344 Phase 13 / Round 7 — the DEFAULT_HEIGHT (2.5) is paper-mm (CAD/ISO
// convention). It is scaled by the active drawing scale (Revit annotation scale)
// and converted to the scene's world units, so the initial TipTap node shows at
// model-space size (e.g. 2.5mm × 100 = 250mm for a 1:100 drawing) in any unit
// system — mm/cm/m all yield the same 250mm physical height.
function makeEmptyTextNode(units: SceneUnits, drawingScale = 1): DxfTextNode {
  const height = paperHeightToModel(TEXT_SIZE_LIMITS.DEFAULT_HEIGHT, drawingScale, units);
  return {
    paragraphs: [{
      runs: [{
        text: '',
        style: {
          fontFamily: 'Arial',
          bold: false,
          italic: false,
          underline: false,
          overline: false,
          strikethrough: false,
          height,
          widthFactor: 1.0,
          obliqueAngle: 0,
          tracking: 1.0,
          color: DXF_COLOR_BY_LAYER,
        },
      }],
      indent: 0,
      leftMargin: 0,
      rightMargin: 0,
      tabs: [],
      justification: 0,
      lineSpacingMode: 'multiple',
      lineSpacingFactor: 1.0,
    }],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1.0 },
    columns: undefined,
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

// ADR-344 R6 — TipTap drops the fontHeight mark for empty initial runs
// (dxf-to-tiptap skips zero-length text nodes so the mark never enters the
// editor state). User-typed chars then inherit height:0 → resolveTextHeight
// falls back to DEFAULT_FONT_SIZE=12 world-units (= 12m in meters scenes).
// Patching at commit time is unit-safe: defaultHeight comes from the initial
// node, which was already scaled via mmToSceneUnits at click time.
function patchZeroHeightRuns(node: DxfTextNode, defaultHeight: number): DxfTextNode {
  return {
    ...node,
    paragraphs: node.paragraphs.map(para => ({
      ...para,
      runs: para.runs.map(run => {
        if (!('text' in run)) return run; // StackedRun — no style.height
        if (run.style.height !== 0) return run;
        return { ...run, style: { ...run.style, height: defaultHeight } };
      }),
    })),
  };
}

const TEXT_OVERLAY_WIDTH_PX = 200;
// MTEXT overlay: 40% of canvas width, clamped to [280, 600]px screen
function mtextOverlayWidth(containerWidth: number): number {
  return Math.min(600, Math.max(280, Math.round(containerWidth * 0.4)));
}

function computeAnchorRect(
  worldPoint: Point2D,
  transform: CanvasTransform,
  container: HTMLDivElement,
  isMText: boolean,
): CreatingState['anchorRect'] & { worldWidth: number } {
  const containerRect = container.getBoundingClientRect();
  // Same Y-flip as useTextDoubleClickEditor.computeAnchorRect (ADR-040 worldToScreen parity).
  const left = containerRect.left + worldPoint.x * transform.scale + transform.offsetX;
  const canvasY = container.clientHeight - worldPoint.y * transform.scale - transform.offsetY;
  const top = containerRect.top + canvasY;
  const height = Math.max(24, 2.5 * transform.scale * 4);
  const screenWidth = isMText ? mtextOverlayWidth(container.clientWidth) : TEXT_OVERLAY_WIDTH_PX;
  const worldWidth = screenWidth / transform.scale;
  return { left, top, width: screenWidth, height, worldWidth };
}

export function useTextCreationTool(
  params: UseTextCreationToolParams,
): TextCreationToolApi {
  const { transformRef, containerRef, activeTool, onToolChange, executeCommand, getSceneUnits } = params;
  const services = useDxfTextServices();
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  // ADR-508 §text-parity — rotation phase (μεταξύ 1ου και 2ου κλικ).
  const [rotatingState, setRotatingState] = useState<RotatingState | null>(null);

  const handleCanvasClick = useCallback(
    (worldPoint: Point2D): boolean => {
      if (activeTool !== 'text' && activeTool !== 'mtext') return false;
      if (creatingState) return false; // Field already open; let the overlay handle it.
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return false;
      const isMText = activeTool === 'mtext';
      // ADR-344 Round 7 — annotation scale = the canonical `drawingScale` SSoT (ADR-375, Revit
      // annotation-scale pattern, default 1:100, set in the View ribbon, decoupled from zoom).
      // Read at click time (event-time getState, ADR-040) so it always reflects the live scale.
      const drawingScale = useDrawingScaleStore.getState().drawingScale;

      // ── 2ο κλικ (rotation phase) — κλείδωσε την κλίση → ΤΩΡΑ άνοιξε το πεδίο πληκτρολόγησης.
      //    Η γωνία κουμπώνει με ΟΡΘΟ/Polar (F8/F10) μέσω του ΚΟΙΝΟΥ `resolveOrthoPolarStep` SSoT
      //    (ίδιος περιορισμός με το preview → preview ≡ commit). CCW μοίρες (DXF σύμβαση).
      if (rotatingState) {
        const snapped = resolveOrthoPolarStep(worldPoint, rotatingState.insertionPoint, {
          ortho: cadToggleState.isOrthoOn(),
          polar: cadToggleState.isPolarOn(),
        }).stepped;
        const rotationDeg = (Math.atan2(
          snapped.y - rotatingState.insertionPoint.y,
          snapped.x - rotatingState.insertionPoint.x,
        ) * 180) / Math.PI;
        const { worldWidth, ...anchorRect } = computeAnchorRect(rotatingState.insertionPoint, transform, container, isMText);
        setRotatingState(null);
        clearTextRotationOrigin();
        setTextEditingActive(true); // πεδίο ανοιχτό → καμία stray φάντασμα-λέξη στο hover
        setCreatingState({
          entityId: generateEntityId(),
          position: rotatingState.insertionPoint,
          initial: makeEmptyTextNode(rotatingState.units, drawingScale),
          anchorRect,
          worldWidth,
          forceMText: isMText,
          rotation: rotationDeg,
        });
        return true;
      }

      // ── 1ο κλικ (φάση τοποθέτησης) — κλείδωσε το σημείο εισαγωγής (flush στην παρειά μέλους, εκτός αν
      //    νικά ορατό OSNAP· 1:1 mirror του line commit) και μπες σε rotation phase. ΔΕΝ ανοίγει ακόμη
      //    το πεδίο — ο χρήστης ορίζει πρώτα την κλίση με το 2ο κλικ. Το `worldPoint` είναι ήδη
      //    OSNAP/tracking-resolved από το click pipeline (mouse-handler-up).
      const units = getSceneUnits ? getSceneUnits() : 'mm';
      const insertionPoint = resolveFaceFlushInsertionPoint(worldPoint, units);
      setTextRotationOrigin(insertionPoint);
      setRotatingState({ insertionPoint, units, isMText });
      return true;
    },
    [activeTool, creatingState, rotatingState, containerRef, transformRef, getSceneUnits],
  );

  const finishAndExit = useCallback(() => {
    setCreatingState(null);
    // ADR-508 §text-parity — καθάρισε τυχόν rotation phase (π.χ. ESC μετά το 1ο κλικ) + το κοινό store
    // + το «πεδίο ανοιχτό» flag (ξαναεπιτρέπει το ghost στο επόμενο κείμενο).
    setRotatingState(null);
    clearTextRotationOrigin();
    setTextEditingActive(false);
    onToolChange('select');
  }, [onToolChange]);

  // ADR-508 §text-parity — αν ο χρήστης φύγει από το εργαλείο κειμένου ενώ είναι σε rotation/editing
  // phase (αλλαγή εργαλείου/ESC), καθάρισε το lock + flag ώστε να μη «διαρρέει» κατάσταση σε άλλο εργαλείο.
  useEffect(() => {
    if (activeTool !== 'text' && activeTool !== 'mtext') {
      setRotatingState(null);
      clearTextRotationOrigin();
      setTextEditingActive(false);
    }
  }, [activeTool]);

  const onCancel = useCallback(() => {
    finishAndExit();
  }, [finishAndExit]);

  const onCommit = useCallback(
    (next: DxfTextNode) => {
      const state = creatingState;
      if (!state || !services) {
        finishAndExit();
        return;
      }
      // Skip creation if user committed an empty text (no runs with content).
      const hasContent = next.paragraphs.some((p) =>
        p.runs.some((r) => 'text' in r && r.text.trim().length > 0),
      );
      if (!hasContent) {
        finishAndExit();
        return;
      }
      const firstRun = state.initial.paragraphs[0]?.runs[0];
      const defaultHeight = (firstRun && 'text' in firstRun)
        ? firstRun.style.height
        : TEXT_SIZE_LIMITS.DEFAULT_HEIGHT;
      const patchedNext = patchZeroHeightRuns(next, defaultHeight);
      const cmd = new CreateTextCommand(
        {
          position: state.position,
          layer: DXF_DEFAULT_LAYER,
          textNode: patchedNext,
          existingId: state.entityId,
          ...(state.forceMText ? { forceType: 'mtext' as const } : {}),
          ...(state.forceMText && state.worldWidth != null ? { width: state.worldWidth } : {}),
          // ADR-508 §text-parity — γωνία κλίσης από το 2-click place→rotate (entity-level rotation).
          ...(state.rotation ? { rotation: state.rotation } : {}),
        },
        services.sceneManager,
        services.auditRecorder,
      );
      executeCommand(cmd);
      finishAndExit();
    },
    [creatingState, services, executeCommand, finishAndExit],
  );

  return useMemo(
    () => ({ creatingState, handleCanvasClick, onCommit, onCancel }),
    [creatingState, handleCanvasClick, onCommit, onCancel],
  );
}
