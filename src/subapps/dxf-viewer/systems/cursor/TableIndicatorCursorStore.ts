/**
 * ADR-739 §31 — **ΠΟΙΟ ΣΧΗΜΑ ΟΦΕΙΛΕΙ Ο ΔΕΙΚΤΗΣ ΤΟΥ ΟΣ** αυτή τη στιγμή (zero-React SSoT).
 *
 * Ο Giorgio το ζήτησε ως «όπως στο Excel, που δηλώνει στον χρήστη ότι μπορεί να σύρει τη
 * διαχωριστική γραμμή». Η ουσία του αιτήματος δεν είναι το εικονίδιο — είναι ότι το feedback
 * φτάνει **πριν** την ενέργεια. Ο φωτισμός του §30 λέει «εδώ δείχνεις»· ο δείκτης λέει «αυτό
 * θα γίνει αν πατήσεις».
 *
 * ## 🔴 ΓΙΑΤΙ STORE ΚΑΙ ΟΧΙ ΑΠΕΥΘΕΙΑΣ ΕΓΓΡΑΦΗ ΣΤΟ `style.cursor`
 * Ο δείκτης του καμβά έχει **έναν** γραφέα: το `useCrosshairCursor` (ADR-549 Φ8), που
 * ξαναγράφει το `element.style.cursor` σε **κάθε** αλλαγή ρυθμίσεων, DPR ή οπής. Ένας δεύτερος
 * γραφέας που έβαζε `col-resize` απευθείας θα δούλευε — μέχρι το πρώτο re-apply, που θα το
 * έσβηνε **σιωπηλά** (και αντίστροφα: το σταυρόνημα θα εξαφανιζόταν όποτε ο πίνακας πρόλαβε να
 * γράψει τελευταίος). Δεν είναι υποθετικό: αυτός ακριβώς είναι ο λόγος που το ADR-513 έφτιαξε
 * το `CrosshairSuppressionStore` αντί να γράψει το NavWheel κατευθείαν στο element.
 *
 * Άρα ίδιο σχήμα, ίδιος λόγος: ο πίνακας **δηλώνει πρόθεση** εδώ, και το `useCrosshairCursor`
 * τη ρωτά μέσα στο δικό του `apply()`. Ένας γραφέας του `style.cursor`, για πάντα.
 *
 * ## Η σειρά προτεραιότητας ζει στον αναγνώστη, όχι εδώ
 * Το NavWheel (§ADR-513) νικά αυτό εδώ: το δαχτυλίδι είναι **πάνω** από τον καμβά, οπότε όταν
 * ο κέρσορας κάθεται στα πλήκτρα του, ό,τι λέει ο πίνακας από κάτω είναι άσχετο. Η απόφαση
 * γράφεται **μία** φορά, στο `apply()` του `useCrosshairCursor` — όχι σε κάθε γραφέα.
 *
 * @module subapps/dxf-viewer/systems/cursor/TableIndicatorCursorStore
 * @see bim/table/table-indicator-geometry.ts — ΠΟΙΟΣ ρόλος οφείλεται πού (και γιατί λείπει το `row-resize`)
 * @see systems/cursor/table-indicator-cursor-image.ts — ΠΩΣ ζωγραφίζονται τα δύο παχιά βέλη
 * @see systems/cursor/useCrosshairCursor.ts — ο ΕΝΑΣ αναγνώστης/γραφέας του `style.cursor`
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §31
 */

import { createExternalStore } from '../../stores/createExternalStore';
import type { TableIndicatorCursorRole } from '../../bim/table/table-indicator-cursor-role';

// `equals: Object.is` — ο ρόλος είναι string ένωση, οπότε η ταυτότητα **είναι** η ισότητα. Ο
// γραφέας τρέχει σε κάθε `mousemove`· χωρίς αυτό, κάθε pixel θα ξανα-ρασταροποιούσε PNG δείκτη.
const store = createExternalStore<TableIndicatorCursorRole | null>(null, { equals: Object.is });

/** Ο ρόλος που δηλώνει η λειτουργία πίνακα· `null` = καμία απαίτηση (μένει το σταυρόνημα). */
export function getTableIndicatorCursor(): TableIndicatorCursorRole | null {
  return store.get();
}

/** Writer — ο **ένας** ακροατής `mousemove` της λειτουργίας πίνακα. No-op αν δεν αλλάζει. */
export function setTableIndicatorCursor(next: TableIndicatorCursorRole | null): void {
  store.set(next);
}

/**
 * Καμία απαίτηση δείκτη. Ιδεμποτής — και γι' αυτό μπορεί να δοθεί απευθείας ως ακροατής
 * `mouseleave` ή ως καθαρισμός αποπροσάρτησης, χωρίς περιτύλιγμα που θα άλλαζε ταυτότητα.
 */
export function clearTableIndicatorCursor(): void {
  store.set(null);
}

/**
 * Subscribe — ώστε ο δείκτης να ξανα-εφαρμοστεί **χωρίς** να κουνηθεί το ποντίκι.
 *
 * Δεν είναι θεωρητικό: το ποντίκι στέκεται πάνω στο γράμμα και ο χρήστης κλείνει τον πίνακα με
 * `Esc`. Χωρίς την ειδοποίηση, το παχύ βέλος θα έμενε στην οθόνη ως το επόμενο συμβάν που
 * τυχαίνει να προκαλεί `apply()` — δηλαδή, πρακτικά, μέχρι να κουνηθεί το χέρι.
 */
export function subscribeTableIndicatorCursor(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableIndicatorCursorForTests(): void {
  store.reset(null);
}
