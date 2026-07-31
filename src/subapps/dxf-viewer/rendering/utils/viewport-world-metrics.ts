'use client';

/**
 * ADR-736 §6 — «τι δείχνει αυτή τη στιγμή η προβολή», σε συντεταγμένες κόσμου.
 *
 * Δύο ερωτήσεις που μοιάζουν άσχετες αλλά έχουν ΤΗΝ ΙΔΙΑ πηγή (το ζεύγος canvas rect +
 * transform) και γι' αυτό απαντώνται μαζί, με **μία** ανάγνωση DOM:
 *   · **πόσο πλατύ κομμάτι κόσμου φαίνεται** → πόσο μεγάλη μπαίνει μια νέα εικόνα
 *     (`IMAGE_PLACEMENT_VIEWPORT_FRACTION`)·
 *   · **ποιο σημείο του κόσμου είναι στο κέντρο** → πού προσγειώνεται όταν ο χρήστης πατά
 *     Enter αντί να κάνει κλικ.
 *
 * 🔑 **Καμία δική του φόρμουλα.** Και τα δύο βγαίνουν από το `CoordinateTransforms.screenToWorld`
 * — το SSoT που ήδη ξέρει για τα περιθώρια των χαράκων και για την αντιστροφή του άξονα Y.
 * Το «πλάτος» δεν υπολογίζεται ως `width / scale` αλλά ως **η διαφορά δύο πραγματικών γωνιών**:
 * έτσι δεν υπάρχει δεύτερη εκδοχή του «πού αρχίζει ο καμβάς» που θα μπορούσε να αποκλίνει αν
 * αλλάξουν κάποτε τα περιθώρια (`COORDINATE_LAYOUT.MARGINS`).
 *
 * Event-time ανάγνωση (getter, ποτέ snapshot) — ADR-040: καλείται τη στιγμή που ο χρήστης
 * διαλέγει αρχείο ή πατά Enter, ποτέ σε render ή σε βρόχο.
 *
 * @see ../core/CoordinateTransforms.ts — η μία μετατροπή οθόνη ↔ κόσμος
 * @see ../../systems/cursor/ImmediateTransformStore.ts — το transform SSoT
 */

import type { Point2D } from '../types/Types';
import { CoordinateTransforms } from '../core/CoordinateTransforms';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getMainDxfCanvas } from './main-canvas-element';

/** Ό,τι μπορεί να πει η τρέχουσα προβολή για τον κόσμο που δείχνει. */
export interface ViewportWorldMetrics {
  /** Το σημείο του κόσμου στο οπτικό κέντρο του καμβά. */
  readonly center: Point2D;
  /** Το πλάτος (σε μονάδες σχεδίου) του κόσμου που χωρά στον καμβά. Πάντα θετικό. */
  readonly visibleWorldWidth: number;
}

/**
 * Διαβάζει τις μετρήσεις της ζωντανής προβολής, ή `null` όταν ο καμβάς δεν έχει ακόμη διαστάσεις.
 *
 * `null` σημαίνει **«δεν ξέρω»**, και ο καλών οφείλει να ματαιώσει: μια εικόνα τοποθετημένη με
 * βάση ένα 0×0 viewport θα έμπαινε με μηδενικό ή άπειρο μέγεθος κάπου έξω από το σχέδιο —
 * αόρατη, και πρακτικά αδύνατο να βρεθεί και να διαγραφεί.
 */
export function readViewportWorldMetrics(): ViewportWorldMetrics | null {
  const canvas = getMainDxfCanvas();
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const viewport = { width: rect.width, height: rect.height };
  if (!(viewport.width > 0) || !(viewport.height > 0)) return null;

  const transform = getImmediateTransform();
  const toWorld = (x: number, y: number): Point2D =>
    CoordinateTransforms.screenToWorld({ x, y }, transform, viewport);

  const left = toWorld(0, viewport.height / 2);
  const right = toWorld(viewport.width, viewport.height / 2);
  const visibleWorldWidth = Math.abs(right.x - left.x);
  if (!Number.isFinite(visibleWorldWidth) || visibleWorldWidth <= 0) return null;

  return {
    center: toWorld(viewport.width / 2, viewport.height / 2),
    visibleWorldWidth,
  };
}
