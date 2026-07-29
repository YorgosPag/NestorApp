/**
 * ADR-374 — ZOOM Window ολοκλήρωση στο mouseup: οθονικό ορθογώνιο → world bounds →
 * fit-to-view μέσω EventBus.
 *
 * Εξήχθη αυτούσιο από το `mouse-handler-up` (N.7.1 — ο handler ξεπέρασε τις 500 γραμμές·
 * εξαγωγή, όχι ψαλίδισμα). Η μετατροπή γίνεται ΕΔΩ, τη στιγμή του finish, με το ΙΔΙΟ
 * pointer snapshot που βλέπει ο handler — όχι στον listener του event, ώστε τα world
 * bounds να αντιστοιχούν στο transform της στιγμής της χειρονομίας.
 *
 * @module systems/zoom-window/finish-zoom-window
 * @see systems/zoom-window/ZoomWindowStore — το state της χειρονομίας (single-writer)
 */

import { ZoomWindowStore } from './ZoomWindowStore';
import {
  getPointerSnapshotFromElement,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { EventBus } from '../events/EventBus';
import type { ViewTransform } from '../../rendering/types/Types';

/**
 * Ολοκληρώνει το zoom-window drag αν είναι ενεργό. Επιστρέφει `true` όταν κατανάλωσε το
 * mouseup (ο καλών κάνει return), `false` όταν δεν έτρεχε τέτοια χειρονομία.
 */
export function finishZoomWindowOnMouseUp(
  target: HTMLElement,
  transform: ViewTransform,
): boolean {
  if (!ZoomWindowStore.isActive()) return false;
  const screenRect = ZoomWindowStore.finish();
  if (screenRect) {
    const upSnap = getPointerSnapshotFromElement(target);
    if (upSnap) {
      const w1 = screenToWorldWithSnapshot(
        { x: screenRect.x, y: screenRect.y },
        transform,
        upSnap,
      );
      const w2 = screenToWorldWithSnapshot(
        { x: screenRect.x + screenRect.width, y: screenRect.y + screenRect.height },
        transform,
        upSnap,
      );
      EventBus.emit('zoom-window:apply', {
        worldBounds: {
          min: { x: Math.min(w1.x, w2.x), y: Math.min(w1.y, w2.y) },
          max: { x: Math.max(w1.x, w2.x), y: Math.max(w1.y, w2.y) },
        },
        viewport: upSnap.viewport,
      });
    }
  }
  return true;
}
