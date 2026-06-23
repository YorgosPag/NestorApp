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
import { clearAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { dlog } from '../../debug';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';
import { testEntityHit } from './canvas-click-entity-hit';
// ADR-507 Φ3 — pick-point (Τρόπος Β): ΕΝΑ κλικ μέσα σε περιοχή → HatchEntity.
import { buildHatchFromPick } from '../../bim/hatch/hatch-pick-completion';
import { buildHatchPostCreateCommands } from '../../bim/hatch/hatch-completion';
import { completeEntity } from '../drawing/completeEntity';
// Enterprise-id SSoT (N.6) — ίδιος generator με τον CreateEntityCommand· μηδέν δικός counter.
import { generateEntityId } from '../../systems/entity-creation/utils';
// Scene-units SSoT — μετατροπή ακατέργαστων συντεταγμένων (mm) σε m/m² για εμφάνιση.
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';

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
  // Οι συντεταγμένες είναι σε μονάδες σχεδίου (συνήθως mm). Το panel εμφανίζει m/m²
  // → μετατροπή με το scene-units SSoT (length × mPerUnit, area × mPerUnit²).
  const mPerUnit = sceneUnitsToMeters(resolveSceneUnits(scene));
  const areaFactor = mPerUnit * mPerUnit;
  setAutoAreaState({
    found: true,
    area: best.area * areaFactor,
    netArea: (best.area - holesArea) * areaFactor,
    holesCount: holes.length,
    holesArea: holesArea * areaFactor,
    perimeter: best.perimeter * mPerUnit,
    source: best.source,
    layerName: best.layerName,
    screenX: screen.x,
    screenY: screen.y,
  });
  dlog('handleAutoAreaClick', `area_m2=${(best.area * areaFactor).toFixed(2)} units=${resolveSceneUnits(scene)} holes=${holes.length} source=${best.source}`);
}

// ============================================================================
// HATCH PICK-POINT CLICK (ADR-507 Φ3 — Τρόπος Β)
// ============================================================================
/**
 * Τρόπος Β: ΕΝΑ κλικ ΜΕΣΑ σε κλειστή περιοχή → ανίχνευση ορίου (+ νησιά) μέσω
 * `auto-area-hit` SSoT → `HatchEntity` → `completeEntity` (ίδιο pipeline με τον
 * Τρόπο Α: undo + auto-send-to-back + `drawing:complete` → persistence).
 *
 * Επιστρέφει `true` αν δημιουργήθηκε γραμμοσκίαση, `false` αν δεν βρέθηκε περιοχή.
 * Σε κάθε περίπτωση ο caller καταναλώνει το κλικ (pick-point mode).
 */
export function handleHatchPickPointClick(
  worldPoint: Point2D,
  p: UseCanvasClickHandlerParams,
): boolean {
  const levelId = p.levelManager.currentLevelId;
  const setScene = p.levelManager.setLevelScene;
  if (!levelId || !setScene) return false;

  const scene = p.levelManager.getLevelScene(levelId);
  // ADR-040 XXII.A: live SSoT scale read at click time.
  const scale = getImmediateTransform().scale;
  const hatch = buildHatchFromPick({
    worldPoint,
    entities: scene?.entities ?? [],
    overlays: p.currentOverlays,
    scale,
    // Units-aware ανοχή βρόχου — ΙΔΙΟ SSoT με «Τοποθέτηση χώρου» (room detector).
    sceneUnits: resolveSceneUnits(scene),
    id: generateEntityId(),
    layerId: undefined,
  });
  if (!hatch) {
    dlog('handleHatchPickPointClick', 'no closed region under cursor');
    return false;
  }

  completeEntity(hatch, {
    tool: 'hatch',
    levelId,
    getScene: p.levelManager.getLevelScene,
    setScene,
    // ADR-507 §5δ.9 — auto-send-to-back: create + reorder σε ΕΝΑ undo.
    postCreateCommands: buildHatchPostCreateCommands,
  });
  // Καθάρισε το ghost της μόλις-γεμισμένης περιοχής (το επόμενο mouse-move το ξαναβρίσκει).
  clearAutoAreaPreview();
  dlog('handleHatchPickPointClick', `created hatch ${hatch.id} rings=${hatch.boundaryPaths.length}`);
  return true;
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
