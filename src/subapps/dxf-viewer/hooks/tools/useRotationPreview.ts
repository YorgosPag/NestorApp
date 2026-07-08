/**
 * USE ROTATION PREVIEW — Ghost entity rendering during rotation
 *
 * 🏢 ADR-188: Entity Rotation System — Visual Feedback
 *
 * Renders semi-transparent rotated copies of selected entities on a dedicated
 * canvas overlay. Also draws:
 * - Rubber band line: pivot → cursor
 * - Angle arc indicator near pivot
 * - Angle tooltip near cursor
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform + clear-on-exit ζουν
 * πλέον ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
 *
 * @module hooks/tools/useRotationPreview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { AnySceneEntity, Entity } from '../../types/entities';
// ADR-188 SSoT — the SAME per-entity rotate the commit (`RotateEntityCommand.computeUpdates`)
// applies: BIM-aware pivot rotate first, generic `rotateEntity` fallback. Preview ≡ commit.
import { rotateEntity } from '../../utils/rotation-math';
import { calculateBimRotatedGeometry } from '../../bim/transforms/bim-rotate-geometry';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { drawRotationPivotMarker } from '../../rendering/ui/rotation-pivot-marker';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
// ADR-397 / ADR-357 / ADR-572 §8.3 — πορτοκαλί POLAR γραμμή κατά το 2-click ROTATE, μέσω ΤΟΥ ΙΔΙΟΥ
// SSoT chain που χρησιμοποιεί το commit (`useRotationTool.handleRotationMouseMove`) και το hot-grip
// rotation (`rotation-tracking-overlay`). Zero νέα μηχανή — reuse `resolveOrthoPolarStep` + `paintPolarTrackingLine`.
import { resolveOrthoPolarStep } from '../drawing/drawing-handler-utils';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { formatPolarLabel } from '../../systems/constraints/polar-utils';
import { paintPolarTrackingLine } from '../../canvas-v2/preview-canvas/polar-tracking-line-paint';
import { resolveSceneUnits } from '../../utils/scene-units';
import { sceneDistanceToMeters } from '../../bim/labels/move-readout';
// ADR-550 (WYSIWYG) — moving copies render through the REAL entity renderer (full fidelity).
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
import type { RotationPhase } from './useRotationTool';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

// ============================================================================
// TYPES
// ============================================================================

export interface UseRotationPreviewProps {
  phase: RotationPhase;
  basePoint: Point2D | null;
  /** Reference direction point (from awaiting-reference phase) */
  referencePoint: Point2D | null;
  currentAngle: number;
  selectedEntityIds: string[];
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  /** Callback returning the canvas element to draw on (PreviewCanvas) */
  getCanvas: () => HTMLCanvasElement | null;
  /** Callback returning the DxfCanvas element — used for viewport calculation
   *  to ensure worldToScreen uses the SAME dimensions as the click handler.
   *  Falls back to getCanvas() if not provided. */
  getViewportElement?: () => HTMLElement | null;
}

// Phases where the rotation preview consumes the live cursor (SSoT for the
// cursor-subscription gate; harness also uses it for clear-on-exit).
const PREVIEW_PHASES: ReadonlySet<RotationPhase> = new Set(['awaiting-reference', 'awaiting-angle']);

// ============================================================================
// HOOK
// ============================================================================

export function useRotationPreview(props: UseRotationPreviewProps): void {
  const {
    phase, basePoint, referencePoint, currentAngle,
    selectedEntityIds, levelManager,
    transform, getCanvas, getViewportElement,
  } = props;

  /** Read an entity from the current level scene (read-only) */
  const getEntity = useCallback((entityId: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    return scene.entities.find(e => e.id === entityId) ?? null;
  }, [levelManager]);

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const layersById = useLevelLayersById(levelManager);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const isReferencePhase = phase === 'awaiting-reference';
    const isAnglePhase = phase === 'awaiting-angle';
    if ((!isReferencePhase && !isAnglePhase) || !basePoint) return;

    // Convert pivot to screen coords (CSS pixels) — used by rubber band / arc below.
    const pivotScreen = CoordinateTransforms.worldToScreen(basePoint, t, viewport);

    // === Rotation-centre marker (⊙) — visible in BOTH phases. ===
    drawRotationPivotMarker(ctx, basePoint, t, viewport);

    // === Rubber band line: pivot → cursor — visible in BOTH phases ===
    if (effectiveCursor) {
      const cursorScreen = CoordinateTransforms.worldToScreen(effectiveCursor, t, viewport);

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pivotScreen.x, pivotScreen.y);
      ctx.lineTo(cursorScreen.x, cursorScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // === Reference phase: only base marker + rubber band (drawn above) ===
    if (isReferencePhase) return;

    // === Angle phase: reference line + angle arc + tooltip + ghost entities ===

    // Draw reference direction line (dimmed) from pivot to reference point
    if (referencePoint) {
      const refScreen = CoordinateTransforms.worldToScreen(referencePoint, t, viewport);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pivotScreen.x, pivotScreen.y);
      ctx.lineTo(refScreen.x, refScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (effectiveCursor) {
      const cursorScreen = CoordinateTransforms.worldToScreen(effectiveCursor, t, viewport);

      // Angle arc near pivot (from reference direction to cursor direction)
      const arcRadius = 30;
      const refAngleRad = referencePoint
        ? Math.atan2(-(referencePoint.y - basePoint.y), referencePoint.x - basePoint.x)
        : 0;
      const endRad = refAngleRad - degToRad(currentAngle);

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(
        pivotScreen.x,
        pivotScreen.y,
        arcRadius,
        refAngleRad,
        endRad,
        currentAngle > 0
      );
      ctx.stroke();
      ctx.restore();

      // Angle tooltip near cursor
      const angleText = `${currentAngle.toFixed(1)}°`;
      ctx.save();
      ctx.font = '12px monospace';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(angleText, cursorScreen.x + 15, cursorScreen.y - 10);
      ctx.restore();

      // ADR-397 / ADR-357 — πορτοκαλί POLAR tracking γραμμή pivot→cursor όταν το POLAR(F10)/ORTHO(F8)
      // κουμπώνει τη γωνία. Recompute 1:1 από τον live cursor με το ΙΔΙΟ SSoT `resolveOrthoPolarStep`
      // που τρέχει το commit (`handleRotationMouseMove`) → η γραμμή ταυτίζεται με την περιστροφή
      // (preview ≡ commit· το `applyAlongAxisStepSnap` αλλάζει απόσταση, όχι γωνία). ΙΔΙΟΣ painter με
      // τη σχεδίαση & το hot-grip rotation — μηδέν διπλότυπη μηχανή.
      const { stepped, polarResult } = resolveOrthoPolarStep(
        effectiveCursor, basePoint, { ortho: cadToggleState.isOrthoOn(), polar: cadToggleState.isPolarOn() },
      );
      if (polarResult?.isSnapped && polarResult.snappedAngle !== null) {
        const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
        const units = resolveSceneUnits(scene);
        paintPolarTrackingLine(
          ctx,
          basePoint,
          polarResult.snappedAngle,
          formatPolarLabel(polarResult.snappedAngle, sceneDistanceToMeters(polarResult.distance, units) * 1000),
          stepped,
          t,
          viewport,
        );
      }
    }

    // Real WYSIWYG rotated copies (full fidelity) — originals dim to ghosts at their source.
    if (Math.abs(currentAngle) > 0.01) {
      ctx.save();
      const bimPreview = getBimPreview(ctx);
      const layers = layersById();
      for (const entityId of selectedEntityIds) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        const e = entity as unknown as Entity;
        // Preview ≡ commit: BIM-aware pivot rotate first, generic rotate fallback.
        const patch = calculateBimRotatedGeometry(e, basePoint, currentAngle)
          ?? rotateEntity(e, basePoint, currentAngle);
        const rotated = { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
        drawRealEntityPreview(bimPreview, rotated, layers, t, viewport);
      }
      ctx.restore();
    }
  }, [phase, basePoint, referencePoint, currentAngle, selectedEntityIds, getEntity, getBimPreview, layersById, levelManager]);

  useCanvasGhostPreview({
    isActive: PREVIEW_PHASES.has(phase),
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
