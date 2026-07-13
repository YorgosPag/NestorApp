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
import { buildHatchFromPick, isPointInsideExistingHatch } from '../../bim/hatch/hatch-pick-completion';
// ADR-507 Φ3 — preview ≡ commit (WYSIWYG): το commit γεμίζει ΑΚΡΙΒΩΣ την περιοχή που
// δείχνει το μπλε ghost (AutoAreaPreviewStore), όχι μια νέα ανίχνευση στο σημείο του click.
import { getAutoAreaPreview } from '../../systems/auto-area/AutoAreaPreviewStore';
// ADR-507 Φ3 — warn+allow όταν η περιοχή έχει ήδη γραμμοσκίαση (επιλογή Giorgio).
import { requestHatchOverlapConfirm } from '../../bim/hatch/hatch-overlap-confirm-store';
import { buildHatchPostCreateCommands, buildHatchEntityFromRegion } from '../../bim/hatch/hatch-completion';
import { completeEntity } from '../drawing/completeEntity';
// Enterprise-id SSoT (N.6) — ίδιος generator με τον CreateEntityCommand· μηδέν δικός counter.
import { generateEntityId } from '../../systems/entity-creation/utils';
// Scene-units SSoT — μετατροπή ακατέργαστων συντεταγμένων (mm) σε m/m² για εμφάνιση.
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
// ADR-583 — annotation symbol (North arrow) single-click placement.
import type { AnnotationSymbolEntity } from '../../types/annotation-symbol';
import { useAnnotationSymbolSelectionStore } from '../../state/annotation-symbol-selection-store';
import { getAnnotationSymbol } from '../../config/annotation-symbol-catalog';
import type { ToolType } from '../../ui/toolbar/types';
// ADR-649 — «Ετικέτα Εμβαδού Γραμμοσκίασης» (2 κλικ: pick hatch → place label).
import { isHatchEntity, type Entity } from '../../types/entities';
import { pickTopHatchAt } from '../../bim/hatch/hatch-pick-at';
import { buildHatchAreaLabelEntity } from '../../bim/hatch/hatch-area-label';
import {
  getHatchAreaLabelState,
  armHatchAreaLabelPlacement,
  resetHatchAreaLabel,
} from '../../bim/hatch/hatch-area-label-store';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { i18n } from '@/i18n';

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
 * ADR-507 Φ3 — αντιπροσωπευτικό ΕΣΩΤΕΡΙΚΟ σημείο της περιοχής που πρόκειται να γεμίσει
 * (preview), για τον έλεγχο επικάλυψης. Το κεντροειδές είναι εντός για κυρτά/τυπικά
 * κελιά· σε κοίλο πολύγωνο (κεντροειδές εκτός) πέφτουμε στο σημείο του click. Έτσι ο
 * έλεγχος «η περιοχή έχει ήδη γραμμοσκίαση;» αφορά ό,τι ΓΕΜΙΖΟΥΜΕ (preview ≡ commit),
 * όχι το σημείο του click που λόγω jitter μπορεί να πέσει εκτός κελιού.
 */
function pickRegionInteriorPoint(polygon: Point2D[] | undefined, fallback: Point2D): Point2D {
  if (!polygon || polygon.length < 3) return fallback;
  let cx = 0;
  let cy = 0;
  for (const v of polygon) { cx += v.x; cy += v.y; }
  const centroid = { x: cx / polygon.length, y: cy / polygon.length };
  return isPointInPolygon(centroid, polygon) ? centroid : fallback;
}

/**
 * SSoT for the «resolve active level» preamble every commit-style click handler shares:
 * grab the current level id + scene setter, bail if either is missing, and expose the
 * current scene + its entities. ADR-583 (N.18): three handlers (hatch pick-point,
 * annotation symbol, hatch area label) previously copy-pasted this block — one place now.
 * Returns `null` when there is no active level to draw into (caller returns `false`).
 */
function resolveActiveLevelContext(p: UseCanvasClickHandlerParams) {
  const levelId = p.levelManager.currentLevelId;
  const setScene = p.levelManager.setLevelScene;
  if (!levelId || !setScene) return null;

  const scene = p.levelManager.getLevelScene(levelId);
  const entities = scene?.entities ?? [];
  return { levelId, setScene, scene, entities };
}

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
  const ctx = resolveActiveLevelContext(p);
  if (!ctx) return false;
  const { levelId, setScene, entities } = ctx;
  // ADR-040 XXII.A: live SSoT scale read at click time.
  const scale = getImmediateTransform().scale;
  // ADR-507 Φ3 — preview ≡ commit (WYSIWYG): γέμισε ΑΚΡΙΒΩΣ την περιοχή που δείχνει το
  // μπλε ghost. Λόγω throttle/μικρο-κίνησης, το σημείο του click μπορεί να πέσει λίγο
  // έξω από το κελί που έδειξε το hover → η ξανα-ανίχνευση στο click επέστρεφε ΟΛΟ το
  // δωμάτιο («ξεχείλισμα σε όμορες περιοχές»). Το preview store ΕΙΝΑΙ ό,τι βλέπει ο
  // χρήστης· το reuse εγγυάται «what you see is what you get» (reuse buildHatchEntityFromRegion,
  // μηδέν νέα γεωμετρία). Fallback σε click-detection μόνο όταν δεν υπάρχει ενεργό ghost.
  const preview = getAutoAreaPreview();
  const hatch = (preview && preview.polygon.length >= 3)
    ? buildHatchEntityFromRegion(preview.polygon, preview.holes, generateEntityId(), undefined)
    : buildHatchFromPick({
        worldPoint,
        entities,
        overlays: p.currentOverlays,
        scale,
        id: generateEntityId(),
        layerId: undefined,
      });
  if (!hatch) {
    dlog('handleHatchPickPointClick', 'no closed region under cursor');
    return false;
  }

  const commit = (): void => {
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
  };

  // ADR-507 Φ3 — η περιοχή έχει ΗΔΗ γραμμοσκίαση: προειδοποίηση + επιτρέπεται (Giorgio,
  // «ΠΟΤΕ σιωπηλά»). Σαν AutoCAD (στοιβάζει μετά από confirm)· οι χώροι Revit είναι
  // αποκλειστικοί ανά περιοχή — εδώ το αφήνουμε opt-in με ρητή επιβεβαίωση.
  const overlapTestPoint = pickRegionInteriorPoint(preview?.polygon, worldPoint);
  if (isPointInsideExistingHatch(overlapTestPoint, entities)) {
    void (async () => {
      const action = await requestHatchOverlapConfirm();
      if (action === 'create') commit();
      else clearAutoAreaPreview(); // ακύρωση → σβήσε το ghost
    })();
    return true; // κλικ καταναλώθηκε (η ροή συνεχίζει στο resolve)
  }

  commit();
  return true;
}

// ============================================================================
// ANNOTATION SYMBOL PLACEMENT (ADR-583 — North arrow)
// ============================================================================
/**
 * ADR-583 — single-click placement of a lightweight annotation symbol (North
 * arrow first). Builds an `AnnotationSymbolEntity` at the click point using the
 * live variant/size from the selection store, then routes through the SAME
 * `completeEntity` SSoT every drawing tool uses (undo + `drawing:complete` +
 * persistence). Returns `true` so the click is consumed (no fall-through to the
 * unified drawing accumulator). Rotation defaults to 0 (authored north / up);
 * interactive re-orient is the Φ2c grip follow-on.
 */
export function handleAnnotationSymbolClick(
  worldPoint: Point2D,
  activeTool: ToolType,
  p: UseCanvasClickHandlerParams,
): boolean {
  const ctx = resolveActiveLevelContext(p);
  if (!ctx) return false;
  const { levelId, setScene } = ctx;

  const { symbolId, sizeMm, rotationDeg } = useAnnotationSymbolSelectionStore.getState();
  // The variant IS the source of truth for its family — derive `kind` from the
  // catalog def, never a per-tool literal (so every kind flows through one path).
  const kind = getAnnotationSymbol(symbolId).kind;
  const entity: AnnotationSymbolEntity = {
    id: generateEntityId(),
    type: 'annotation-symbol',
    layerId: '',
    position: { x: worldPoint.x, y: worldPoint.y },
    kind,
    symbolId,
    sizeMm,
    rotation: rotationDeg,
  };

  completeEntity(entity, {
    tool: activeTool,
    levelId,
    getScene: p.levelManager.getLevelScene,
    setScene,
  });
  dlog('handleAnnotationSymbolClick', `placed ${symbolId} @ (${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)})`);
  return true;
}

// ============================================================================
// HATCH AREA LABEL (ADR-649 — 2 κλικ: pick hatch → place area label)
// ============================================================================
const HATCH_AREA_LABEL_NS = 'dxf-viewer-shell';

/**
 * ΦΑΣΗ 1: διάλεξε τη γραμμοσκίαση κάτω από το κλικ (even-odd `pickTopHatchAt`
 * SSoT), κλείδωσέ την στην FSM + highlight την, και προχώρα σε αναμονή
 * τοποθέτησης. Καμία γραμμοσκίαση → κατανάλωσε το κλικ, μείνε στη φάση 1
 * (forgiving — ξαναδοκιμάζεις).
 */
function armHatchAreaLabelFromClick(
  worldPoint: Point2D,
  entities: readonly Entity[],
  p: UseCanvasClickHandlerParams,
): boolean {
  const hatchId = pickTopHatchAt(worldPoint, entities);
  if (!hatchId) return true;
  armHatchAreaLabelPlacement(hatchId);
  p.universalSelection.replaceEntitySelection([hatchId]);
  toolHintOverrideStore.setOverride(i18n.t('hatchAreaLabel.status.awaitingPlacement', { ns: HATCH_AREA_LABEL_NS }));
  return true;
}

/**
 * ADR-649 — 2-κλικ dispatcher. ΦΑΣΗ 1 → pick γραμμοσκίασης· ΦΑΣΗ 2 → χτίσε το
 * `TextEntity` εμβαδού και commit μέσω `completeEntity` (undo + persistence +
 * `drawing:complete`). Θέση: centroid όταν το 2ο κλικ πέφτει ΜΕΣΑ στην ίδια
 * γραμμοσκίαση, αλλιώς στο σημείο του κλικ (`resolveHatchLabelAnchor`). Μετά το
 * commit επανέρχεται στη φάση 1 (συνεχής χρήση, AutoCAD-style).
 */
export function handleHatchAreaLabelClick(
  worldPoint: Point2D,
  p: UseCanvasClickHandlerParams,
): boolean {
  const ctx = resolveActiveLevelContext(p);
  if (!ctx) return false;
  const { levelId, setScene, scene, entities } = ctx;
  const st = getHatchAreaLabelState();

  if (st.phase === 'awaitingHatch' || !st.hatchId) {
    return armHatchAreaLabelFromClick(worldPoint, entities, p);
  }

  const hatch = entities.find((e) => e.id === st.hatchId);
  if (!scene || !hatch || !isHatchEntity(hatch)) {
    resetHatchAreaLabel();
    toolHintOverrideStore.setOverride(i18n.t('hatchAreaLabel.status.awaitingHatch', { ns: HATCH_AREA_LABEL_NS }));
    return true;
  }
  const entity = buildHatchAreaLabelEntity(hatch, worldPoint);
  completeEntity(entity, { tool: 'hatch-area-label', levelId, getScene: p.levelManager.getLevelScene, setScene });
  resetHatchAreaLabel();
  toolHintOverrideStore.setOverride(i18n.t('hatchAreaLabel.status.awaitingHatch', { ns: HATCH_AREA_LABEL_NS }));
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
