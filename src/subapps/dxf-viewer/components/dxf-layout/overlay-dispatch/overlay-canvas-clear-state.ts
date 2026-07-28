/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-726 §Φ2 + ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * Overlay canvas clear-state ledger — η ΜΙΑ πηγή αλήθειας για την ερώτηση
 * «κρατάει αυτός ο καμβάς μελάνι από προηγούμενο καρέ;».
 *
 * ## Γιατί υπάρχει (ADR-726 §4.Γ)
 *
 * Μετρήθηκε ότι **9 overlay καμβάδες έκαναν ΜΟΝΟ `clearRect` (131–148 φορές ο καθένας σε 45s),
 * με μηδέν draw ops**. Ένα `clearRect` σε ήδη-άδειο καμβά **δεν είναι δωρεάν**: στο Blink η
 * `HTMLCanvasElement::DidDraw(rect)` ενώνει άνευ όρων το rect στο `dirty_rect_`, θέτει
 * `canvas_is_clear_ = false` και — στη μετάβαση από κενό σε μη-κενό — καλεί
 * `SetShouldCheckForPaintInvalidation()`. **Δεν συγκρίνει ποτέ pixels.** Άρα ο compositor
 * ξανα-ανεβάζει ολόκληρο το layer για οπτικά ταυτόσημο αποτέλεσμα (μετρημένο: 12,2 megapixel
 * σύνθεσης ανά καρέ για το τίποτα· ανεξάρτητη επιβεβαίωση 16 LoAF entries με μηδέν scripts).
 *
 * Ο μόνος τρόπος να μη πληρωθεί είναι **να μην εκδοθεί η πράξη** — που απαιτεί να θυμόμαστε
 * εμείς αν ο καμβάς είναι ήδη καθαρός, επειδή ο browser δεν μας το λέει.
 *
 * ## Σχεδίαση
 *
 * `WeakSet` = «γνωστά καθαροί καμβάδες». Άγνωστος καμβάς ⇒ **ΟΧΙ** καθαρός (συντηρητικό: το
 * πρώτο καρέ κάθε καμβά καθαρίζει πάντα). Το `WeakSet` δεν κρατά τον καμβά ζωντανό, οπότε δεν
 * χρειάζεται καμία εκκαθάριση στο unmount — δεν υπάρχει διαρροή ούτε νεκρός κώδικας.
 *
 * ## Σύμβαση χρήσης (ΑΠΑΡΑΒΑΤΗ)
 *
 * Το ledger είναι έγκυρο **μόνο** για καμβάδες των οποίων ΚΑΘΕ πράξη ζωγραφικής περνά από το
 * `paintOverlayDispatchFrame`. Αν κάποιος γράψει απευθείας στον καμβά χωρίς να δηλώσει
 * {@link markOverlayCanvasPainted}, το ledger θα πιστεύει «καθαρός» και θα παραλείψει ένα
 * αναγκαίο clear ⇒ **ghost pixels**. Γι' αυτό οι συναρτήσεις εδώ **δεν** εξάγονται προς
 * κατανάλωση από overlays: μοναδικός πελάτης είναι το `overlay-dispatch-frame.ts`.
 */

/**
 * Καμβάδες που ξέρουμε ότι είναι **διαφανείς** (τίποτα δεν ζωγραφίστηκε από το τελευταίο clear).
 * Η απουσία σημαίνει «άγνωστο ⇒ υπέθεσε ότι έχει μελάνι».
 */
const clearCanvases = new WeakSet<HTMLCanvasElement>();

/**
 * `true` μόνο όταν ξέρουμε με βεβαιότητα ότι ο καμβάς είναι άδειος. Άγνωστος καμβάς → `false`,
 * ώστε το πρώτο καρέ να καθαρίζει πάντα (belt-and-suspenders, N.7.2 #4).
 */
export function isOverlayCanvasClear(canvas: HTMLCanvasElement): boolean {
  return clearCanvases.has(canvas);
}

/** Δήλωσε ότι ο καμβάς μόλις καθαρίστηκε ολόκληρος και κανείς δεν ζωγράφισε από πάνω. */
export function markOverlayCanvasCleared(canvas: HTMLCanvasElement): void {
  clearCanvases.add(canvas);
}

/**
 * Δήλωσε ότι ο καμβάς πρόκειται να δεχτεί (ή δέχτηκε) ζωγραφική. Καλείται **πριν** τρέξουν οι
 * painters: αν κάποιος painter πετάξει εξαίρεση, ο καμβάς μένει μερικώς ζωγραφισμένος και το
 * ledger **δεν** επιτρέπεται να τον θεωρεί καθαρό (idempotent — N.7.2 #3).
 */
export function markOverlayCanvasPainted(canvas: HTMLCanvasElement): void {
  clearCanvases.delete(canvas);
}
