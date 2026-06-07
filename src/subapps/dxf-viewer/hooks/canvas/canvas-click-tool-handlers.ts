/**
 * 🏢 ENTERPRISE: canvas-click tool handlers
 *
 * Click-priority handlers extracted from `useCanvasClickHandler.ts`
 * (2026-06-04 file-size split). Pure functions over the hook params:
 *   - handleRotationEntitySelection (PRIORITY 1.3) — ADR-188
 *   - handleAutoAreaClick           (PRIORITY 1.7)
 *
 * @see hooks/canvas/useCanvasClickHandler — consumer
 * @see ADR-040 Phase XXII.A — live SSoT transform reads at click time
 */
'use client';
import type { Point2D } from '../../rendering/types/Types';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { TOLERANCE_CONFIG, POLYGON_TOLERANCES } from '../../config/tolerance-config';
import { setAutoAreaState } from '../../systems/auto-area/AutoAreaResultStore';
import { collectAreaCandidates, collectHoleAreas } from '../../systems/auto-area/auto-area-hit';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { dlog } from '../../debug';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';
import { testEntityHit } from './canvas-click-entity-hit';

// ============================================================================
// ROTATION ENTITY SELECTION (PRIORITY 1.3)
// ============================================================================
/**
 * ADR-188: Rotation tool entity selection in awaiting-entity phase.
 * Checks scene entities + overlays for hit. Returns true if entity was selected.
 */
export function handleRotationEntitySelection(
  worldPoint: Point2D,
  p: UseCanvasClickHandlerParams,
): boolean {
  const scene = p.levelManager.currentLevelId
    ? p.levelManager.getLevelScene(p.levelManager.currentLevelId)
    : null;
  if (scene?.entities) {
    // ADR-040 XXII.A: live SSoT read (p.transform is dead since Phase XXII.A).
    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
    for (const entity of scene.entities) {
      if (testEntityHit(worldPoint, entity, hitTolerance)) {
        p.universalSelection.replaceEntitySelection([entity.id]);
        dlog('useCanvasClickHandler', 'Rotation entity selected:', entity.id);
        return true;
      }
    }
  }
  // Check overlays (colored layers)
  for (const overlay of p.currentOverlays) {
    if (!overlay.polygon || overlay.polygon.length < 3) continue;
    const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
    if (isPointInPolygon(worldPoint, vertices)) {
      p.universalSelection.handleOverlaySelect(overlay.id);
      dlog('useCanvasClickHandler', 'Rotation overlay selected:', overlay.id);
      return true;
    }
  }
  return false;
}

// ============================================================================
// AUTO AREA CLICK (PRIORITY 1.7)
// ============================================================================
/** Finds smallest closed polygon at worldPoint → writes result to AutoAreaResultStore. */
export function handleAutoAreaClick(worldPoint: Point2D, p: UseCanvasClickHandlerParams): void {
  // ADR-040 XXII.A: live SSoT read.
  const liveTransform = getImmediateTransform();
  const screen = CoordinateTransforms.worldToScreen(worldPoint, liveTransform, p.viewport);
  const scene = p.levelManager.currentLevelId
    ? p.levelManager.getLevelScene(p.levelManager.currentLevelId)
    : null;
  const candidates = collectAreaCandidates(worldPoint, scene?.entities ?? [], p.currentOverlays, liveTransform.scale);
  if (candidates.length === 0) {
    setAutoAreaState({ found: false, screenX: screen.x, screenY: screen.y });
    return;
  }
  const best = candidates.reduce((a, b) => a.area < b.area ? a : b);
  const holes = collectHoleAreas(best.polygon, best.area, scene?.entities ?? [], p.currentOverlays, liveTransform.scale);
  const holesArea = holes.reduce((sum, h) => sum + h.area, 0);
  setAutoAreaState({
    found: true,
    area: best.area,
    netArea: best.area - holesArea,
    holesCount: holes.length,
    holesArea,
    perimeter: best.perimeter,
    source: best.source,
    layerName: best.layerName,
    screenX: screen.x,
    screenY: screen.y,
  });
  dlog('handleAutoAreaClick', `area=${best.area.toFixed(2)} netArea=${(best.area - holesArea).toFixed(2)} holes=${holes.length} source=${best.source}`);
}

// ============================================================================
// OVERLAY POLYGON DRAW (PRIORITY 5)
// ============================================================================
/**
 * Overlay polygon drawing — accumulates click-to-add points, auto-closing
 * (and saving) when the user clicks near the first point with ≥3 points.
 * Always consumes the click while `overlayMode === 'draw'` (returns once the
 * caller has matched that mode).
 *
 * 🚀 PERF (2026-05-09): `isNearFirstPoint` is computed inline at click time
 * (was a reactive prop forcing CanvasSection to re-render on mousemove).
 * ADR-040 XXII.A: live SSoT transform read at click time.
 */
export function handleOverlayDrawClick(worldPoint: Point2D, p: UseCanvasClickHandlerParams): void {
  if (p.isSavingPolygon) return;
  const { draftPolygon } = p;
  const isNearFirst = (() => {
    if (draftPolygon.length < 3) return false;
    const [fx, fy] = draftPolygon[0];
    const dx = worldPoint.x - fx;
    const dy = worldPoint.y - fy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (POLYGON_TOLERANCES.CLOSE_DETECTION / getImmediateTransform().scale);
  })();
  if (isNearFirst && draftPolygon.length >= 3) {
    p.setIsSavingPolygon(true);
    p.finishDrawingWithPolygonRef.current(draftPolygon).then(success => {
      p.setIsSavingPolygon(false);
      if (success) p.setDraftPolygon([]);
    });
    return;
  }
  const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];
  p.setDraftPolygon(prev => [...prev, worldPointArray]);
}
