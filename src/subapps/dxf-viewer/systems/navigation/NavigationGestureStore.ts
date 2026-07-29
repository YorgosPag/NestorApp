/**
 * NAVIGATION GESTURE STORE — «είμαστε τώρα σε χειρονομία πλοήγησης;» (ADR-728 Φ1)
 *
 * Module-level singleton, zero React, ίδιο ιδίωμα με `HoverStore` / `ImmediateTransformStore`.
 * ΕΝΑ ερώτημα, ΕΝΑΣ ιδιοκτήτης — ώστε ο επόμενος καταναλωτής να μη γράψει το δικό του
 * `isPanning` (N.0.2 / N.12).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΣΥΝΑΓΕΤΑΙ ΑΠΟ ΤΟ TRANSFORM ΚΑΙ ΟΧΙ ΑΠΟ ΤΑ INPUT FLAGS
 * ──────────────────────────────────────────────────────────────────────────────
 * Οι διαδρομές πλοήγησης είναι ΟΚΤΩ: drag-pan (mousedown/up/leave), wheel zoom,
 * Shift+wheel οριζόντιο pan, ruler-corner wheel, touch pan, pinch zoom, keyboard pan,
 * fit-to-view / zoom-window finish. Ένα ρητό flag θα απαιτούσε write-site σε καθεμιά —
 * και κάθε ΜΕΛΛΟΝΤΙΚΗ διαδρομή που θα ξεχαστεί είναι σιωπηλή παλινδρόμηση.
 *
 * Και οι οκτώ όμως καταλήγουν σε ΕΝΑ σημείο: `updateImmediateTransform`. Άρα η κατάσταση
 * ΣΥΝΑΓΕΤΑΙ από την παρατηρούμενη αλλαγή του view transform. Το store κάνει `subscribe`
 * στο transform SSoT — δεν το τροποποιεί· η εξάρτηση δείχνει προς τα μέσα, ώστε το
 * ADR-040 cardinal αρχείο να μη μάθει τίποτα για πλοήγηση.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΤΟ ΡΗΤΟ ΚΑΝΑΛΙ ΜΠΟΡΕΙ **ΜΟΝΟ ΝΑ ΤΕΡΜΑΤΙΣΕΙ**
 * ──────────────────────────────────────────────────────────────────────────────
 * Το CesiumJS τεκμηριώνει και τα δύο failure modes:
 *   - explicit-only  → «interaction state is stuck in 'rotating' state after mouse up»
 *                      (CesiumGS/cesium#11889): ένα χαμένο `end` κολλάει την κατάσταση ΜΟΝΙΜΑ.
 *   - inferred-only  → «moveEnd delayed» (CesiumGS/cesium#2950): trailing edge.
 *
 * Η σύνθεση: το ρητό κανάλι επιτρέπεται **μόνο να κόψει νωρίτερα**, ΠΟΤΕ να παρατείνει.
 * Ένα χαμένο `endNavigationGesture()` τότε δεν μπορεί να κολλήσει τίποτα — το χειρότερο
 * είναι ότι η αναστολή λήγει μόνη της μετά το idle παράθυρο, δηλαδή η ασφαλής προεπιλογή.
 * Αυτό ΔΕΝ είναι ευρετικό· είναι **δομική** ιδιότητα του σχήματος.
 *
 * @module systems/navigation/NavigationGestureStore
 * @see ADR-728 §5 Φ1 — «αναστολή κατά τη navigation» (Revit parity)
 * @see systems/cursor/snap-scheduler — ο μοναδικός καταναλωτής σήμερα
 */

import { DXF_TIMING } from '../../config/dxf-timing';
import { subscribeTransform } from '../cursor/ImmediateTransformStore';

/**
 * Πόσο κενό μετά την τελευταία αλλαγή view transform σημαίνει «η χειρονομία τελείωσε».
 *
 * Είναι ΤΟ ΙΔΙΟ φυσικό ερώτημα με το 3D wheel-idle («πότε τελείωσε η ανθρώπινη ριπή
 * ροδέλας»), άρα ΤΟ ΙΔΙΟ key κατά ADR-516 — δύο καταναλωτές, μία σταθερά, καμία νέα.
 * Πρέπει να ξεπερνά άνετα ένα αργό καρέ (μετρημένα ~50-70ms υπό pan), αλλιώς η αναστολή
 * θα «έσπαγε» ενδιάμεσα στη χειρονομία.
 */
const IDLE_MS = DXF_TIMING.gesture.WHEEL_IDLE;

/** `-Infinity` ⇒ «καμία πλοήγηση» — και παραμένει σωστό σε κάθε αριθμητική σύγκριση. */
let lastActivityMs = -Infinity;
/** Το unsubscribe της εγγραφής· `null` ⇒ δεν έχουμε εγγραφεί. Κρατιέται ώστε η εγγραφή
 *  να είναι ΑΝΑΙΡΕΣΙΜΗ — αλλιώς ένα reset θα άφηνε ορφανό listener να γράφει το timestamp. */
let unsubscribe: (() => void) | null = null;

/**
 * Lazy εγγραφή — ίδιο ιδίωμα με το `ensureRegistered()` του `snap-scheduler`.
 * Κρίσιμο για την υγιεινή των tests/SSR: σκέτη εισαγωγή του module ΔΕΝ πρέπει να
 * προσθέτει μόνιμο listener στο `ImmediateTransformStore`.
 */
function ensureSubscribed(): void {
  if (unsubscribe) return;
  // Το `subscribeTransform` ειδοποιεί ΜΟΝΟ σε πραγματική αλλαγή scale/offset
  // (ImmediateTransformStore: early-return στο diff) ⇒ μηδέν ψευδή σήματα.
  unsubscribe = subscribeTransform(() => { lastActivityMs = performance.now(); });
}

/**
 * True όσο ο χρήστης μετακινεί την οθόνη (pan / zoom / ό,τι αλλάζει το view transform).
 *
 * Οι καταναλωτές το ρωτούν για να ΜΗΝ ΥΠΟΛΟΓΙΣΟΥΝ δουλειά που δεν φαίνεται κατά τη
 * χειρονομία. ⚠️ «Μην υπολογίζεις τώρα» ΔΕΝ σημαίνει «σβήσε ό,τι υπολογίστηκε»: τα
 * αποτελέσματα ζουν σε ΚΟΣΜΙΚΕΣ συντεταγμένες και δεν γίνονται λάθος επειδή κινήθηκε
 * η κάμερα. Βλ. ADR-728 §8.7 για το τι σπάει αν καθαριστούν.
 */
export function isNavigationGesture(): boolean {
  ensureSubscribed();
  return performance.now() - lastActivityMs < IDLE_MS;
}

/**
 * Τερματίζει τη χειρονομία ΑΜΕΣΩΣ — το μόνο ρητό κανάλι.
 *
 * Καλείται εκεί όπου το τέλος είναι ΓΝΩΣΤΟ (mouseup / mouseleave του pan), ώστε η
 * αναστολή να μην κρατάει άσκοπα ολόκληρο το idle παράθυρο μετά την άφεση.
 *
 * ⚠️ ΣΕΙΡΑ: πρέπει να κληθεί **ΜΕΤΑ** από κάθε τελευταία εγγραφή transform του ίδιου
 * χειριστή (π.χ. το `onTransformChange(pendingTransform)` του pan cleanup) — αλλιώς
 * εκείνη η εγγραφή ξαναοπλίζει την αναστολή για ολόκληρο το `IDLE_MS`.
 *
 * ⚠️ ΔΕΝ υπάρχει `beginNavigationGesture()`, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΣΚΟΠΙΜΟ: ένα κανάλι που
 * μπορεί μόνο να τερματίζει δεν μπορεί να κολλήσει την κατάσταση σε «ενεργή».
 */
export function endNavigationGesture(): void {
  lastActivityMs = -Infinity;
}

/**
 * Μόνο για δοκιμές — επαναφέρει το module state (δεν υπάρχει άλλος τρόπος: singleton).
 * Αναιρεί ΚΑΙ την εγγραφή: χωρίς αυτό ο listener του προηγούμενου test επιβιώνει και
 * συνεχίζει να γράφει το timestamp, δηλητηριάζοντας το επόμενο.
 */
export function __resetNavigationGestureForTest(): void {
  unsubscribe?.();
  unsubscribe = null;
  lastActivityMs = -Infinity;
}
