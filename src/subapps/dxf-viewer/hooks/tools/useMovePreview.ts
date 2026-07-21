/**
 * USE MOVE PREVIEW — Ghost entity rendering during 2-click move operation
 *
 * ADR-049: Unified Move Tool (DXF + Overlays)
 * ADR-040: Preview Canvas Performance (imperative API, RAF, no React re-renders)
 *
 * Renders semi-transparent translated copies of selected entities on the
 * PreviewCanvas overlay. Also draws:
 *   - Base point crosshair marker (red)
 *   - Rubber band line: base point → cursor (dashed gold)
 *   - Displacement tooltip near cursor showing distance
 *
 * Ghost rendering itself is delegated to `rendering/ghost` (SSOT) — the same
 * primitives used by `useGripGhostPreview` so the two preview paths cannot
 * visually diverge.
 *
 * Built on the shared `useTranslationGhostPreview` harness (N.18, twin of
 * useCopyPreview): the deps bundle + red base-point crosshair + base/cursor
 * guards + RAF/DPR-clear lifecycle (ADR-398 §4) live ONCE in the harness; here
 * remains ONLY the MOVE-specific draw (ORTHO/AutoAlign destination, rubber band,
 * entity ghost, overlays, neighbor-clearance dims).
 *
 * @module hooks/tools/useMovePreview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { drawRubberBandWorld } from '../../canvas-v2/preview-canvas/rubber-band-paint';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { MovePhase } from './useMoveTool';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import type { Overlay } from '../../overlays/types';
import { GHOST_DEFAULTS } from '../../rendering/ghost';
// SSoT translated-selection ghost loop (deep import — pulls in the full EntityRendererComposite).
import { drawTranslatedEntitiesPreview } from '../../rendering/ghost/draw-real-entity-preview';
// ADR-363 — ORTHO (F8) axis-lock for the live MOVE ghost (no-op when OFF).
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
// ADR-090 — SSoT point+vector add (translate), replaces inline `{x:A.x+B.x,y:A.y+B.y}`.
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveSceneUnits } from '../../utils/scene-units';
// ADR-562 Φ9.3 — AutoAlign traces during the 2-click MOVE (base point ⊕ ambient). Same
// SSoT resolve + paint as the dim grip flow; WYSIWYG parity with the commit (useMoveTool).
import { resolveActionAlignmentTracking, paintActionAlignmentTracking } from '../dimensions/dim-alignment-tracking';
// ADR-508 §neighbor-clearance — κυανές listening dims στη μετακίνηση (twin του placement ghost).
import { resolveMoveClearanceForSelection } from '../../bim/framing/move-clearance-dims';
import { paintGhostFaceDimensions } from '../../canvas-v2/preview-canvas/ghost-face-dim-paint';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
// SSoT scaffolding (deps + base marker + guards + RAF) shared with useCopyPreview (N.18).
import {
  useTranslationGhostPreview,
  type TranslationGhostDrawFrame,
} from './use-translation-ghost-preview';

// ============================================================================
// TYPES
// ============================================================================

export interface UseMovePreviewProps {
  phase: MovePhase;
  basePoint: Point2D | null;
  selectedEntityIds: string[];
  selectedOverlayIds?: string[];
  getOverlay?: (id: string) => Overlay | null;
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

const PREVIEW_PHASES: ReadonlySet<MovePhase> = new Set([
  'awaiting-base-point',
  'awaiting-destination',
]);

// ============================================================================
// HOOK
// ============================================================================

export function useMovePreview(props: UseMovePreviewProps): void {
  const {
    phase,
    basePoint,
    selectedEntityIds,
    selectedOverlayIds,
    getOverlay,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
  } = props;

  const drawFrame = useCallback(({ ctx, basePoint: base, effectiveCursor, viewport, transform: t, deps }: TranslationGhostDrawFrame) => {
    // ORTHO (F8): lock the destination to the H/V axis from the base point so the
    // rubber band, ghost, and tooltip all match the committed move (useMoveTool).
    // No-op when ORTHO is OFF.
    const orthoDelta = applyOrthoToDelta({ x: effectiveCursor.x - base.x, y: effectiveCursor.y - base.y });
    const orthoDestination: Point2D = translatePoint(base, orthoDelta);

    // ADR-562 Φ9.3 — AutoAlign override + traces on the ORTHO-locked destination (base
    // point ⊕ ambient). SAME resolve as the commit (useMoveTool) → the ghost, rubber band
    // and committed move all land on the aligned point (WYSIWYG). Gated behind POLAR /
    // AutoAlign inside the helper → identity (previous behaviour) when the aids are off.
    const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
    const moveTrk = resolveActionAlignmentTracking(
      orthoDestination, [base], t.scale,
      (scene?.entities ?? null) as unknown as readonly Entity[] | null,
      new Set(selectedEntityIds), // ADR-557 — no self-OTRACK: the moving selection is excluded from ambient.
    );
    const destination = moveTrk ? moveTrk.point : orthoDestination;

    // Rubber band (dashed gold) — shared SSoT paint (CHECK 3.28 de-dup with the Rotation preview).
    drawRubberBandWorld(ctx, base, destination, t, viewport);

    // AutoAlign traces (dashed paths + intersection halo + distance tooltip) on top of the
    // rubber band, via the SAME SSoT paint the dim grip + creation flows use.
    if (moveTrk) {
      paintActionAlignmentTracking(ctx, moveTrk, t, viewport, resolveSceneUnits(scene));
    }

    // Ghost + tooltip only during awaiting-destination
    if (phase !== 'awaiting-destination') return;

    // Same ORTHO+AutoAlign-locked displacement the rubber band + commit use (WYSIWYG).
    const delta: Point2D = { x: destination.x - base.x, y: destination.y - base.y };

    // ADR-508 §neighbor-clearance — κυανές listening dims (ΕΝΑΣ κοινός entry point με το body-drag·
    // self-excluded)· «σβήνουν» την πινακίδα όταν υπάρχουν. Paint στο τέλος (μετά το ghost).
    const moveClearanceDims = resolveMoveClearanceForSelection(
      (id) => deps.getEntity(id) as unknown as Entity | null,
      selectedEntityIds, delta, scene?.entities ?? [], resolveSceneUnits(scene), worldPerPixel(t.scale),
    );

    // ΚΑΜΙΑ πινακίδα (Giorgio 2026-07-04): τα κυανά AutoAlign traces (paintActionAlignmentTracking
    // παραπάνω) + το rubber-band δείχνουν ήδη την ένδειξη· η παλιά fallback `drawDimPill`
    // αφαιρέθηκε από ΟΛΕΣ τις ροές μετακίνησης (grip + body + MOVE tool) για πλήρη συνέπεια.

    // ADR-550 (WYSIWYG preview) — solid REAL-renderer copies at the destination (full
    // fidelity, byte-identical to the committed render), AutoCAD/Revit parity. The originals
    // dim to ghosts at their source via `movePreviewActive`. The shared SSoT owns the
    // sub-epsilon no-op guard + save/restore (drawTranslatedEntitiesPreview).
    drawTranslatedEntitiesPreview({
      ctx,
      bimPreview: deps.getBimPreview(ctx),
      selectedEntityIds,
      delta,
      getEntity: deps.getEntity,
      layersById: deps.getLayersById(),
      transform: t,
      viewport,
    });

    // Solid overlay preview at destination (AutoCAD parity) — overlays are NOT entities,
    // so they ride a separate epsilon-guarded pass (the entity ghost SSoT skips them).
    const movedFar = Math.abs(delta.x) > 0.001 || Math.abs(delta.y) > 0.001;
    if (movedFar && selectedOverlayIds && selectedOverlayIds.length > 0 && getOverlay) {
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = GHOST_DEFAULTS.color;
      ctx.lineWidth = GHOST_DEFAULTS.lineWidth;
      for (const ovId of selectedOverlayIds) {
        const ov = getOverlay(ovId);
        if (!ov || ov.polygon.length < 2) continue;
        const pts = ov.polygon.map(([x, y]) =>
          CoordinateTransforms.worldToScreen({ x: x + delta.x, y: y + delta.y }, t, viewport)
        );
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    // ADR-508 §neighbor-clearance — paint των κυανών ΜΕΤΑ το ghost (convention: listening-dim overlay).
    if (moveClearanceDims) paintGhostFaceDimensions(ctx, moveClearanceDims, t, viewport);
  }, [phase, selectedEntityIds, selectedOverlayIds, getOverlay, levelManager]);

  useTranslationGhostPreview({
    isActive: PREVIEW_PHASES.has(phase),
    basePoint,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
    drawFrame,
  });
}
