/**
 * use-polygon-clipboard-shortcuts — ADR-539 Φ4a. Keyboard copy/paste εμφάνισης όψης για
 * το Cinema 4D «Polygon Mode». Window-level keydown leaf (mirror του `usePolygonDragDrop`:
 * `useLevelsOptional` + store `getState` — μηδέν React re-render, ADR-040 leaf).
 *
 * Ενεργό ΜΟΝΟ όταν Polygon Mode active + υπάρχει επιλεγμένη όψη (`selectedFace` anchor):
 *   - Ctrl/Cmd+C        → copy ΜΙΑΣ όψης (anchor)        → `FaceContextMenuStore.clipboard`
 *   - Ctrl/Cmd+V        → paste σε ΟΛΕΣ τις όψεις (Φ4b)  → `applyFaceAppearanceToFaces` (ΕΝΑ undo)
 *   - Ctrl/Cmd+Shift+C  → copy ΟΛΗΣ entity (anchor)      → `FaceContextMenuStore.entityClipboard`
 *   - Ctrl/Cmd+Shift+V  → paste ΟΛΗΣ entity (anchor)     → `applyEntityFaceAppearanceMap` (ένα undo)
 *
 * Τα clipboards είναι cross-entity (global) → αντιγραφή από entity A, επικόλληση σε B.
 * `preventDefault` ΜΟΝΟ όταν όντως χειρίζεται (αλλιώς ο browser copy/paste μένει ανέγγιχτος).
 *
 * @see ../ui/apply-face-appearance.ts / ../ui/apply-entity-face-appearance-map.ts — write SSoT
 * @see ../ui/read-face-appearance.ts — read SSoT
 * @see ./use-polygon-drag-drop.ts — το πρότυπο leaf (levels + getState)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useEffect } from 'react';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import { useFaceContextMenuStore } from '../stores/FaceContextMenuStore';
import { isTypingInFormField } from '../ui/is-typing-in-form-field';
import { readFaceAppearance, readEntityFaceAppearanceMap } from '../ui/read-face-appearance';
import { applyFaceAppearanceToFaces } from '../ui/apply-face-appearance';
import { applyEntityFaceAppearanceMap } from '../ui/apply-entity-face-appearance-map';
import { classifyFaceClipboardKey } from './polygon-clipboard-key';

/**
 * Registers a window-level keydown listener για το Polygon-Mode clipboard. Σταθερό
 * (depends μόνο σε `levels`) — διαβάζει stores lazily στο keydown ώστε να μην
 * re-subscribe-άρει ανά render.
 */
export function usePolygonClipboardShortcuts(): void {
  const levels = useLevelsOptional();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!usePolygonMode3DStore.getState().active) return;
      if (isTypingInFormField(document.activeElement)) return;
      const action = classifyFaceClipboardKey(event);
      if (!action) return;
      const face = usePolygonMode3DStore.getState().selectedFace;
      if (!face) return;

      const store = useFaceContextMenuStore.getState();
      let handled = false;
      switch (action) {
        case 'copy-face':
          store.setClipboard(readFaceAppearance(levels, face.bimId, face.faceKey));
          handled = true;
          break;
        case 'paste-face':
          if (store.clipboard) {
            // Φ4b — paste σε ΟΛΕΣ τις επιλεγμένες όψεις με ΕΝΑ undo (όχι μόνο στην anchor).
            applyFaceAppearanceToFaces(
              levels, usePolygonMode3DStore.getState().selectedFaces, store.clipboard,
            );
            handled = true;
          }
          break;
        case 'copy-entity':
          store.setEntityClipboard(readEntityFaceAppearanceMap(levels, face.bimId) ?? {});
          handled = true;
          break;
        case 'paste-entity':
          if (store.entityClipboard) {
            applyEntityFaceAppearanceMap(levels, face.bimId, store.entityClipboard);
            handled = true;
          }
          break;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Capture phase — claim before other viewport listeners (mirror use3DShortcuts).
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [levels]);
}
