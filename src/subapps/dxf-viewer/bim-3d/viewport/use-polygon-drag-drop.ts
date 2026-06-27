/**
 * use-polygon-drag-drop — ADR-539 Φ2. HTML5 drop target για το Cinema 4D «Polygon Mode»
 * drag-drop υλικού πάνω σε όψη. Επιστρέφει `onDragOver`/`onDrop` που μπαίνουν στο root div
 * του `BimViewport3D` (κρατά το component κάτω από το 500-line SRP όριο — N.7.1).
 *
 * - `onDragOver`: μόνο σε Polygon Mode → `preventDefault` (επιτρέπει το drop) + live yellow
 *   face-highlight κάτω από τον κέρσορα (Cinema 4D «το υλικό κουμπώνει στην όψη»).
 * - `onDrop`: parse το `application/x-bim-material` payload → `raycastBimFace` → εφαρμογή
 *   μέσω του shared `applyFaceAppearance` SSoT (ίδιο command με το click-to-apply panel).
 *
 * Το drag ξεκινά ΕΚΤΟΣ canvas (στο `PolygonMaterialPanel`) → καμία σύγκρουση με OrbitControls.
 *
 * @see ../ui/apply-face-appearance.ts — apply SSoT
 * @see ../ui/polygon-material-dnd.ts — MIME + parse SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useCallback } from 'react';
import type { DragEvent as ReactDragEvent, RefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { applyFaceAppearance } from '../ui/apply-face-appearance';
import { parseFaceAppearanceDrag } from '../ui/polygon-material-dnd';

interface PolygonDragDropHandlers {
  readonly onDragOver: (e: ReactDragEvent) => void;
  readonly onDrop: (e: ReactDragEvent) => void;
}

export function usePolygonDragDrop(
  managerRef: RefObject<ThreeJsSceneManager | null>,
): PolygonDragDropHandlers {
  const levels = useLevelsOptional();

  const onDragOver = useCallback((e: ReactDragEvent) => {
    if (!usePolygonMode3DStore.getState().active) return;
    // preventDefault marks this a valid drop target; dropEffect shows the copy cursor.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const manager = managerRef.current;
    if (!manager) return;
    const hit = manager.raycastBimFace(e.clientX, e.clientY);
    manager.setHoveredFace(hit?.bimId ?? null, hit?.faceKey ?? null);
  }, [managerRef]);

  const onDrop = useCallback((e: ReactDragEvent) => {
    if (!usePolygonMode3DStore.getState().active) return;
    const value = parseFaceAppearanceDrag(e.dataTransfer);
    if (!value) return;
    e.preventDefault();
    const manager = managerRef.current;
    if (!manager) return;
    const hit = manager.raycastBimFace(e.clientX, e.clientY);
    manager.setHoveredFace(null, null); // clear the drag-hover preview
    if (!hit?.bimId || !hit.faceKey) return;
    // Anchor the selection highlight on the dropped face too (panel stays on this solid).
    usePolygonMode3DStore.getState().selectFace({ bimId: hit.bimId, faceKey: hit.faceKey });
    manager.setSelectedFace(hit.bimId, hit.faceKey);
    applyFaceAppearance(levels, hit.bimId, hit.faceKey, value);
  }, [managerRef, levels]);

  return { onDragOver, onDrop };
}
