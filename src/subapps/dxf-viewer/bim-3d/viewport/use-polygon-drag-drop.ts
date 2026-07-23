/**
 * use-polygon-drag-drop — ADR-539 Φ2 + Giorgio 2026-07-22. HTML5 drop target για το Cinema 4D
 * drag-drop υλικού πάνω στον 3D κάμβα. Επιστρέφει `onDragOver`/`onDrop` που μπαίνουν στο root div
 * του `BimViewport3D` (κρατά το component κάτω από το 500-line SRP όριο — N.7.1).
 *
 * Ο στόχος εξαρτάται από το ενεργό mode του `PolygonMaterialPanel` (πάντα ορατό):
 *   - **ΣΩΜΑ** (`body`)   → entity raycast· drop βάφει ΟΛΟ το σώμα (`entireElementFaceMap`, base `'*'`).
 *   - **ΣΟΒΑΣ** (`finish`)→ entity raycast· drop βάφει τον σοβά σε ΟΛΕΣ τις κάθετες όψεις.
 *   - **ΠΟΛΥΓΩΝΑ** (`polygon`, `active`) → face raycast· drop βάφει τη ΜΕΜΟΝΩΜΕΝΗ όψη (per-face).
 *
 * Το `onDragOver` δείχνει live preview κάτω από τον κέρσορα (Cinema 4D «το υλικό κουμπώνει»):
 * entity silhouette στα ΣΩΜΑ/ΣΟΒΑΣ, per-face highlight στο ΠΟΛΥΓΩΝΑ. Το drag ξεκινά ΕΚΤΟΣ
 * canvas (στο panel) → καμία σύγκρουση με OrbitControls.
 *
 * @see ../ui/apply-face-appearance.ts — per-face apply SSoT
 * @see ../ui/apply-entity-face-appearance-map.ts — «όλο το σώμα» apply SSoT
 * @see ../ui/apply-finish-face-override.ts — «όλος ο σοβάς» apply SSoT
 * @see ../ui/polygon-material-dnd.ts — MIME + parse SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useCallback } from 'react';
import type { DragEvent as ReactDragEvent, RefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { applyFaceAppearance } from '../ui/apply-face-appearance';
import { applyWholeElementBodyAppearance } from '../ui/apply-entity-face-appearance-map';
// ADR-539 Φ7 — drop σε υποενότητα σκάλας (πάτημα/ρίχτι/πλατύσκαλο/πλάκα) → stair params appearance.
import { applyStairSubElementAppearance } from '../ui/apply-stair-sub-element-appearance';
import { useStairSubElementSelectionStore, isStairSubPart } from '../../bim/stairs/stair-sub-element-selection-store';
import { applyFinishToWholeElement, faceAppearanceToFinishOverride } from '../ui/apply-finish-face-override';
import { applyBimHover } from '../scene/scene-manager-actions';
import { BIM_MATERIAL_MIME, parseFaceAppearanceDrag } from '../ui/polygon-material-dnd';

interface PolygonDragDropHandlers {
  readonly onDragOver: (e: ReactDragEvent) => void;
  readonly onDrop: (e: ReactDragEvent) => void;
}

/** Καθαρίζει κάθε drag preview (per-face + entity silhouette). */
function clearDragPreview(manager: ThreeJsSceneManager): void {
  manager.setHoveredFace(null, null);
  applyBimHover(manager.hoverHighlighter, null);
  manager.markSceneDirty();
}

export function usePolygonDragDrop(
  managerRef: RefObject<ThreeJsSceneManager | null>,
): PolygonDragDropHandlers {
  const levels = useLevelsOptional();

  const onDragOver = useCallback((e: ReactDragEvent) => {
    const manager = managerRef.current;
    if (!manager) return;
    // Το panel είναι πάντα ορατό → φίλτραρε: μόνο swatch drags (BIM material MIME) είναι valid drop
    // target· τυχαία drags (π.χ. αρχεία) περνούν στο default browser behavior.
    if (!e.dataTransfer.types.includes(BIM_MATERIAL_MIME)) return;
    // preventDefault marks this a valid drop target; dropEffect shows the copy cursor.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (usePolygonMode3DStore.getState().active) {
      // ΠΟΛΥΓΩΝΑ — per-face highlight κάτω από τον κέρσορα.
      const hit = manager.raycastBimFace(e.clientX, e.clientY);
      manager.setHoveredFace(hit?.bimId ?? null, hit?.faceKey ?? null);
    } else {
      // ΣΩΜΑ/ΣΟΒΑΣ — entity silhouette («φωτίζεται» ΟΛΗ η οντότητα, Giorgio 2026-07-22).
      const hit = manager.raycastBimEntities(e.clientX, e.clientY);
      applyBimHover(manager.hoverHighlighter, hit?.bimId ?? null);
      manager.markSceneDirty();
    }
  }, [managerRef]);

  const onDrop = useCallback((e: ReactDragEvent) => {
    const value = parseFaceAppearanceDrag(e.dataTransfer);
    if (!value) return;
    e.preventDefault();
    const manager = managerRef.current;
    if (!manager) return;
    const store = usePolygonMode3DStore.getState();

    if (store.active) {
      // ΠΟΛΥΓΩΝΑ — βάψε τη μεμονωμένη όψη κάτω από τον κέρσορα.
      const hit = manager.raycastBimFace(e.clientX, e.clientY);
      clearDragPreview(manager);
      if (hit?.bimId && hit.faceKey) {
        // Faced solid — anchor the selection highlight on the dropped face (panel stays on this solid).
        store.selectFace({ bimId: hit.bimId, faceKey: hit.faceKey });
        manager.setSelectedFace(hit.bimId, hit.faceKey);
        applyFaceAppearance(levels, hit.bimId, hit.faceKey, value);
        return;
      }
      // ADR-539 Φ7 — παραμετρική σκάλα (χωρίς faceKey): drop σε πάτημα/ρίχτι/πλατύσκαλο/πλάκα →
      // γράψε το appearance στα stair params + άγκυρωσε την επιλογή στο ίδιο sub-element.
      if (hit?.bimId && hit.bimType === 'stair' && isStairSubPart(hit.stairPart) && hit.stairSubIndex !== undefined) {
        store.clearFaces();
        manager.setSelectedFaces([]);
        useStairSubElementSelectionStore.getState().selectSub({
          stairId: hit.bimId, part: hit.stairPart, index: hit.stairSubIndex,
        });
        applyStairSubElementAppearance(levels, hit.bimId, hit.stairPart, hit.stairSubIndex, value);
      }
      return;
    }

    // ΣΩΜΑ/ΣΟΒΑΣ — βάψε ΟΛΗ την οντότητα κάτω από τον κέρσορα (entity raycast, χωρίς προ-επιλογή).
    const hit = manager.raycastBimEntities(e.clientX, e.clientY);
    clearDragPreview(manager);
    if (!hit?.bimId) return;
    if (store.targetLayer === 'finish') {
      applyFinishToWholeElement(levels, hit.bimId, faceAppearanceToFinishOverride(value));
    } else {
      // ΣΩΜΑ — Φ7 stair-aware: solid → base `'*'`· σκάλα → `params.materials.appearance`.
      applyWholeElementBodyAppearance(levels, hit.bimId, value);
    }
  }, [managerRef, levels]);

  return { onDragOver, onDrop };
}
