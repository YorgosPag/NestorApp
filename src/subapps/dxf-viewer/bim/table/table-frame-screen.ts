/**
 * 🔴 ADR-828 **Φ4α** — **Η ΜΙΑ αλυσίδα «σημείο του πίνακα → pixel»**: πλαίσιο → κόσμος → οθόνη.
 *
 * ## 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ ΣΕ ΠΑΡΑΓΩΓΗ, ΕΝΩ ΖΟΥΣΕ ΗΔΗ ΣΕ TEST HELPER
 * Η αλυσίδα υπήρχε **μόνο** στο `ui/table-cell-editor/__tests__/table-screen-point.ts`, και η
 * ίδια η κεφαλίδα εκείνου του αρχείου καταγράφει ότι πριν από αυτό ήταν **τρία** αντίγραφα με
 * τρία διαφορετικά ονόματα — πιασμένα ως sibling clones από το CHECK 3.28 (jscpd, N.18).
 *
 * Το ουσιώδες δεν ήταν οι γραμμές, και είναι γραμμένο εκεί: **η περιστροφή** είναι το σημείο
 * όπου τα αντίγραφα αποκλίνουν σιωπηλά. Ένα λάθος πρόσημο στη γωνιακή διαδρομή είναι αόρατο σε
 * `cos 0 = 1, sin 0 = 0` και σφάλλει **γραμμικά με τη γωνία** — δηλαδή περνά κάθε test που
 * ξεχνά να στρίψει τον πίνακα.
 *
 * Όταν η Φ4α χρειάστηκε προβολή σε pixel για τη **διαδρομή πληκτρολογίου** (το `Alt+↓` οφείλει
 * να ανοίξει το μενού **στη θέση του κουμπιού**, όχι στο τυχαίο σημείο όπου έτυχε να είναι ο
 * δείκτης), οι δύο επιλογές ήταν «τέταρτο αντίγραφο» ή «εξαγωγή». Η εξαγωγή, με τον **test
 * helper να γίνεται καταναλωτής** — αλλιώς το test θα προβάλλει με άλλη μηχανή από την
 * εφαρμογή, δηλαδή θα μπορεί να συμφωνήσει με τον εαυτό του πάνω σε λάθος γεωμετρία (N.0.2).
 *
 * ## Η περιστροφή ζει **μέσα** στο `tableFrameToWorld`, και δεν αντιγράφεται εδώ
 * Εκείνο κατέχει **και** την αναστροφή του `y` **και** την περιστροφή γύρω από την άγκυρα,
 * οπότε ένας στραμμένος πίνακας δεν χρειάζεται τίποτα επιπλέον. Και το
 * `CoordinateTransforms.worldToScreen` κατέχει τους **χάρακες** (`drawing-area.ts`): η αρχή
 * του κόσμου δεν κάθεται στη γωνία του container αλλά της περιοχής σχεδίασης — το ίδιο
 * μάθημα που κόστισε ήδη ≈30 px στο in-place text editor (ADR-739 Φ.Δ βήμα 3).
 *
 * @module subapps/dxf-viewer/bim/table/table-frame-screen
 * @see bim/table/table-entity-geometry.ts — `tableFrameToWorld` (η **μία** περιστροφή)
 * @see rendering/core/CoordinateTransforms.ts — το **ένα** `worldToScreen` (με τους χάρακες)
 * @see ui/text-toolbar/text-editor-anchor-2d.ts — ο αδελφός που κάνει το ίδιο βήμα «τοπικό → client»
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { tableFrameToWorld } from './table-entity-geometry';
import type { TableEntity } from '../../types/table-entity';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/**
 * Σημείο πλαισίου `(u, v)` σε sheet-mm → pixel **του viewport που δόθηκε**.
 *
 * Το `mmToWorld` έρχεται ως όρισμα και δεν υπολογίζεται εδώ: κάθε καλών έχει ήδη τη γεωμετρία
 * στο χέρι του (τη χρειάζεται ούτως ή άλλως για τη διάταξη), και μια δεύτερη
 * `computeTableEntityGeometryLive` μέσα σε αυτή τη συνάρτηση θα ήταν δεύτερος υπολογισμός
 * διάταξης ανά κλήση — για μηδέν επιπλέον πληροφορία.
 */
export function tableFrameScreenPoint(
  entity: TableEntity,
  u: number,
  v: number,
  mmToWorld: number,
  transform: ViewTransform,
  viewport: Viewport,
): Point2D {
  return CoordinateTransforms.worldToScreen(
    tableFrameToWorld(entity, u, v, mmToWorld),
    transform,
    viewport,
  );
}

/**
 * Το ίδιο σημείο σε συντεταγμένες **παραθύρου** (`clientX` / `clientY`) — ό,τι δέχονται τα
 * αγκυρωμένα μενού και κάθε `position: fixed` επιφάνεια.
 *
 * ⚠️ Το viewport είναι **ολόκληρος** ο container, ποτέ σμικρυμένο κατά τους χάρακες: το inset
 * ζει ήδη **μέσα** στο `worldToScreen`, και μια δεύτερη αφαίρεσή του εδώ θα ανέβαζε όλο το
 * σχέδιο κατά έναν χάρακα. Ρητή προειδοποίηση του `drawing-area.ts`, τηρημένη ήδη στον αδελφό
 * αυτής της γραμμής (`text-editor-anchor-2d.ts`).
 *
 * Η πρόσθεση του `rect.left/top` είναι ακριβώς η **αντίστροφη** πράξη από το
 * `event.clientX - rect.left` που κάνει κάθε χειριστής ποντικιού του καμβά — γι' αυτό ο
 * δείκτης και το πληκτρολόγιο καταλήγουν στο **ίδιο** σύστημα συντεταγμένων, χωρίς κανείς να
 * χρειάζεται να το θυμάται.
 */
export function tableFrameClientPoint(
  entity: TableEntity,
  u: number,
  v: number,
  mmToWorld: number,
  container: HTMLElement,
  transform: ViewTransform,
): Point2D {
  const rect = container.getBoundingClientRect();
  const local = tableFrameScreenPoint(entity, u, v, mmToWorld, transform, {
    width: rect.width,
    height: rect.height,
  });
  return { x: rect.left + local.x, y: rect.top + local.y };
}
