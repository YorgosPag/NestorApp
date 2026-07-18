/**
 * ADR-513 §grip-parity — DISPLACEMENT (Model A) typed-length lock για λαβή **ΑΛΛΑΓΗΣ ΜΕΓΕΘΟΥΣ**
 * (γωνιακή ή μεσοπλευρική/διάστασης) ΟΠΟΙΑΣΔΗΠΟΤΕ οντότητας — το 6ο σκαλί της σκάλας κλειδωμάτων.
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (Giorgio 2026-07-18, Φάση Δ): η Φάση Γ έκανε ΟΛΕΣ τις λαβές resize
 * click-armed (+40 γραμμές στο `HOT_GRIP_OP_REGISTRY`), αλλά **καμία** από τις 5 προϋπάρχουσες
 * βαθμίδες δεν τις έπιανε: το `vertex-reshape-lock` δέχεται ΜΟΝΟ `arc | polyline | lwpolyline |
 * rectangle` (βλ. `isVertexReshapeGrip`), οπότε μια `column-width` / `stair-width` / `wall-thickness`
 * λαβή έπεφτε έξω από ΟΛΗ τη σκάλα. Άρα «κλικ στη λαβή → πληκτρολογώ 500 → Enter» ήταν νεκρό
 * ακριβώς στις λαβές που μόλις είχαν οπλιστεί.
 *
 * ΣΗΜΑΣΙΟΛΟΓΙΑ — ΜΕΤΑΤΟΠΙΣΗ, ΟΧΙ ΑΠΟΛΥΤΗ ΔΙΑΣΤΑΣΗ (ρητή απόφαση Giorgio 2026-07-18):
 * κολόνα 300 πλάτος, πιάνω τη λαβή παρειάς, γράφω 500 → **πλάτος 800** (η λαβή μετακινήθηκε 500),
 * ΟΧΙ πλάτος 500. Γιατί:
 *   1. **Ομοιομορφία.** Είναι η ΙΔΙΑ σημασιολογία με ΚΑΙ ΤΑ 5 προηγούμενα σκαλιά — λαβή παρειάς
 *      κουφώματος, κορυφή πολυγραμμής, άκρο τόξου, λαβή μετακίνησης, εντολή «Μετακίνηση» του Ribbon.
 *      Ο χρήστης μαθαίνει ΕΝΑ νοητικό μοντέλο: «η τιμή είναι πόσο θα κουνηθεί η λαβή».
 *   2. **Το engine ΔΕΝ είναι ενιαίο.** Η σχέση λαβής→διάστασης διαφέρει ανά οικογένεια: ορθογώνια
 *      κολόνα/πέδιλο/τοίχος = 1:1 με την απέναντι πλευρά σταθερή (`rect-grip-engine`), πολυγωνική
 *      κολόνα = 2:1 συμμετρικά γύρω από το κέντρο (`column-grips` legacy resize). Απόλυτη διάσταση
 *      θα απαιτούσε μητρώο «λαβή → παράμετρος → αναλογία» ανά τύπο — νέο υποσύστημα με 30+ εγγραφές
 *      που μπορούν να αποκλίνουν σιωπηλά από το engine. Η μετατόπιση δουλεύει ΑΝΕΞΑΡΤΗΤΑ αναλογίας.
 *
 * ΤΟ ΕΥΡΟΣ ΟΡΙΖΕΤΑΙ ΑΠΟ ΤΟ ΥΠΑΡΧΟΝ ΜΗΤΡΩΟ, ΟΧΙ ΑΠΟ ΝΕΑ ΛΙΣΤΑ: επιλέξιμη είναι ΚΑΘΕ λαβή που το
 * `HOT_GRIP_OP_REGISTRY` χαρακτηρίζει `'corner'` — δηλαδή ακριβώς «η ίδια η λαβή είναι η άγκυρα,
 * το tracking είναι τερματικό» = αλλαγή μεγέθους. Οι λαβές `'move'`/`'rotate'` έχουν δικά τους
 * σκαλιά, και το `'endpoint-stretch'` (άκρο γραμμής/τόξου/κορυφή) σερβίρεται από τα σκαλιά 2-4.
 * Άρα ΜΗΔΕΝ επικάλυψη και ΜΗΔΕΝ δεύτερη λίστα να συντηρηθεί: νέα λαβή resize μπαίνει στο μητρώο
 * ΜΙΑ φορά και κληρονομεί αυτόματα το typed value.
 *
 * Ο πυρήνας των μαθηματικών είναι ΚΟΙΝΟΣ με τα `vertex-reshape-lock` / `move-displacement-lock`
 * (`displacement-lock-core.ts`)· εδώ ζει ΜΟΝΟ το eligibility. Καλείται από ΚΑΙ ΤΑ ΔΥΟ seams
 * (ghost `grip-ghost-locked-delta` + commit `grip-mouseup-handler`) → preview ≡ commit εξ ορισμού.
 *
 * @see ./displacement-lock-core.ts — ο κοινός πυρήνας ORTHO/POLAR → typed length
 * @see ./vertex-reshape-lock.ts — αδελφός καταναλωτής (κορυφή/πλευρά πολυγραμμής)
 * @see ./move-displacement-lock.ts — αδελφός καταναλωτής (ολόκληρη οντότητα)
 * @see ../../hooks/grips/wall-hot-grip-fsm.ts — `HOT_GRIP_OP_REGISTRY` (η ΜΙΑ πηγή του εύρους)
 */

import type { Point2D } from '../../rendering/types/Types';
import { hotGripOpForKind } from '../../hooks/grips/wall-hot-grip-fsm';
import { resolveDisplacementLockedDelta } from './displacement-lock-core';

/** Ελάχιστη όψη λαβής που χρειάζεται ο resolver — δίνεται από το ghost (`dp`) και το commit (`grip`). */
export interface ResizeGripLike {
  /** Το tagged grip kind ΧΩΡΙΣ tag (`gripKind?.kind`) — entity-agnostic, όπως το `hotGripKindOf`. */
  readonly gripKind: string | null | undefined;
  /** `true` ⇒ η λαβή μετακινεί ΟΛΗ την οντότητα → δικό της σκαλί (5ο), όχι αυτό. */
  readonly movesEntity?: boolean;
  /** `true` ⇒ περιστροφή σε εξέλιξη — η ρητή είσοδος είναι γωνία, όχι μήκος. */
  readonly isRotation: boolean;
}

/**
 * Είναι το `kind` λαβή ΑΛΛΑΓΗΣ ΜΕΓΕΘΟΥΣ (γωνία ή μεσοπλευρική/διάσταση); Καθαρό predicate πάνω στο
 * ΥΠΑΡΧΟΝ μητρώο hot-grip — μοιράζεται με το `GripDragStore.isResizeGripDragInfo` (mount του
 * δαχτυλιδιού) ώστε «ποια λαβή δείχνει δαχτυλίδι» και «ποια λαβή δέχεται τιμή» να μην αποκλίνουν.
 */
export function isResizeGripKind(kind: string | null | undefined): boolean {
  return hotGripOpForKind(kind) === 'corner';
}

/**
 * Το κλειδωμένο delta μετατόπισης για λαβή αλλαγής μεγέθους, ΣΧΕΤΙΚΑ με την αρχική θέση της λαβής
 * (`anchorPos` = `grip.position`). `null` όταν δεν υπάρχει ενεργό κλείδωμα ή η λαβή δεν είναι
 * resize → ο καλών κρατά το δικό του ORTHO/βήμα-constrained delta (μηδέν regression).
 */
export function resolveResizeGripLockedDelta(
  grip: ResizeGripLike,
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  if (grip.movesEntity === true || grip.isRotation) return null;
  if (!isResizeGripKind(grip.gripKind)) return null;
  return resolveDisplacementLockedDelta(anchorPos, cursorWorld);
}
