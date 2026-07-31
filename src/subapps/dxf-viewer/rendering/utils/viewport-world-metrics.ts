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
 * αλλάξουν κάποτε τα περιθώρια.
 *
 * 🔴 **ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΔΙΟΡΘΩΘΗΚΕ (σύμπτωμα Β, μετρημένο 2026-07-31).** Και οι δύο μετρήσεις
 * έπαιρναν το ορθογώνιο **ΟΛΟΚΛΗΡΟΥ του `<canvas>`**, του οποίου τα 30 px αριστερά και τα 30 px
 * κάτω **τα σκεπάζουν οι χάρακες**. Άρα:
 *
 * | Μέτρηση | Πριν | Σφάλμα |
 * |---|---|---|
 * | «κέντρο» | `toWorld(W/2, H/2)` | **σταθερά (−15, +15) CSS px** από το κέντρο της ΟΡΑΤΗΣ περιοχής |
 * | «ορατό πλάτος» | `toWorld(W) − toWorld(0)` | **+30 px** ⇒ η εικόνα έμπαινε ~2,4% μεγαλύτερη |
 *
 * Η μετατόπιση είναι **ακριβώς `(−leftRulerWidth/2, +bottomRulerHeight/2)`** και **ανεξάρτητη**
 * από zoom, pan και μέγεθος καμβά — γι' αυτό δεν χρειάστηκε ζωντανή μέτρηση για να αποδειχθεί:
 * είναι αριθμητική ταυτότητα, όχι παρατήρηση. Σε μονάδες κόσμου γίνεται `15/scale`, δηλαδή στο
 * ζωντανό zoom του σχεδίου (`scale = 0,001607`) **~9,3 m** — «οπτικά ασήμαντο» μόνο στην οθόνη.
 *
 * ⚠️ Η τοποθέτηση **δεν** ήταν εκτός κέντρου: προσγειωνόταν ακριβώς στο κέντρο του καμβά, όπως
 * ήταν γραμμένη. Το ελάττωμα ήταν ότι **το κέντρο του καμβά δεν είναι το κέντρο της περιοχής
 * σχεδίασης** — ορισμού, όχι τοποθέτησης. (Η προηγούμενη παρατήρηση «~25 px πιο πάνω» ήταν
 * άκυρη: το transform είχε αλλάξει μεταξύ μέτρησης και screenshot.)
 *
 * Event-time ανάγνωση (getter, ποτέ snapshot) — ADR-040: καλείται τη στιγμή που ο χρήστης
 * διαλέγει αρχείο ή πατά Enter, ποτέ σε render ή σε βρόχο.
 *
 * @see ../core/CoordinateTransforms.ts — η μία μετατροπή οθόνη ↔ κόσμος
 * @see ../../systems/cursor/ImmediateTransformStore.ts — το transform SSoT
 */

import type { Point2D } from '../types/Types';
import { CoordinateTransforms } from '../core/CoordinateTransforms';
import { getDrawingAreaRect } from '../core/drawing-area';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getMainDxfCanvas } from './main-canvas-element';

/** Ό,τι μπορεί να πει η τρέχουσα προβολή για τον κόσμο που δείχνει. */
export interface ViewportWorldMetrics {
  /** Το σημείο του κόσμου στο οπτικό κέντρο της **περιοχής σχεδίασης** (όχι του καμβά). */
  readonly center: Point2D;
  /**
   * Το πλάτος (σε μονάδες σχεδίου) του κόσμου που χωρά στην **περιοχή σχεδίασης**. Πάντα θετικό.
   */
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

  // Η ΟΡΑΤΗ περιοχή — όχι όλος ο καμβάς. Τα 30 px αριστερά και τα 30 px κάτω ανήκουν στους
  // χάρακες· μια εικόνα κεντραρισμένη ή διαστασιολογημένη πάνω τους είναι κατά γράμμα λάθος.
  const area = getDrawingAreaRect(viewport);
  if (!(area.width > 0) || !(area.height > 0)) return null;

  const transform = getImmediateTransform();
  const toWorld = (x: number, y: number): Point2D =>
    CoordinateTransforms.screenToWorld({ x, y }, transform, viewport);

  const left = toWorld(area.x, area.centerY);
  const right = toWorld(area.right, area.centerY);
  const visibleWorldWidth = Math.abs(right.x - left.x);
  if (!Number.isFinite(visibleWorldWidth) || visibleWorldWidth <= 0) return null;

  return {
    center: toWorld(area.centerX, area.centerY),
    visibleWorldWidth,
  };
}
