/**
 * @fileoverview **«Φέρε το μπροστά στα μάτια του»** — η ΜΙΑ πράξη αποκάλυψης.
 * @related WCAG 2.3.3 · ADR-777 §7 Α3 · ADR-896 §7Α.5 · lib/a11y/reduced-motion.ts · ui/scroll-rail
 * @module lib/a11y/reveal-in-scroll
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΚΑΝΕΝΑ ΑΠΟ ΤΑ 23 ΑΡΧΕΙΑ ΔΕΝ ΕΚΑΝΕ ΟΛΑ ΜΑΖΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-06 — **29 κλήσεις `scrollIntoView`, 23 αρχεία**:
 *
 * | Ερώτηση | Πόσα την έκαναν |
 * |---|---|
 * | σέβεται `prefers-reduced-motion`; | **0 / 29** |
 * | αντέχει το jsdom (`?.` ή guard); | **4 / 29** |
 * | κυλά **μόνο όσο χρειάζεται** (`block:'nearest'`); | 11 / 29 |
 *
 * ⚠️ **Το `block: 'center'` δεν είναι «πιο ευγενικό» — είναι ΠΑΝΤΑ κίνηση.** Κεντράρει
 * ακόμη κι ό,τι είναι **ήδη ολόκληρο ορατό**, δηλαδή κουνά την οθόνη για να μην
 * αλλάξει τίποτα. Είναι ακριβώς το πήδημα που η **Figma μέτρησε και απέρριψε** στο
 * Layers panel (*«disorienting… σαν χάρτης που πηδά σε άλλη τοποθεσία ενώ οδηγείς»*).
 * Γι' αυτό η **προεπιλογή εδώ είναι `'nearest'`**: στη συνήθη περίπτωση — το στοιχείο
 * είναι ήδη ορατό — **δεν κουνιέται τίποτα απολύτως**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΠΕΙΓΟΝΤΑ, ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ ΔΥΟ ΕΙΔΗ ΑΙΤΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * • **`'requested'`** — ο άνθρωπος **ζήτησε** να πάει εκεί (πάτησε κάτι, υπέβαλε φόρμα
 *   με σφάλμα, διάλεξε πινέζα). Η κίνηση είναι **αναμενόμενη**, άρα ομαλή.
 * • **`'incidental'`** — η μετακίνηση είναι **παρενέργεια** (πλοήγηση με βελάκια σε
 *   λίστα, παρακολούθηση εφήμερης εστίασης). Εδώ η ομαλή κύλιση **συσσωρεύεται**: δέκα
 *   πατήματα βέλους δίνουν δέκα επικαλυπτόμενες κινήσεις που καταλήγουν στο λάθος
 *   σημείο. **Ακαριαία, πάντα.**
 *
 * ⛔ **ΜΗΝ γράψεις `scrollIntoView` απευθείας σε νέο κώδικα.** Δεν είναι θέμα τάξης:
 * κάθε νέα κλήση είναι μια ακόμη σιωπηλή απάντηση «όχι» στην ερώτηση της
 * προσβασιμότητας — και η απάντηση **δεν φαίνεται** σε καμία οθόνη ανάπτυξης.
 */

import { motionSafeScrollBehavior } from './reduced-motion';

/**
 * **Γιατί κυλάμε.** Ποτέ «πόσο γρήγορα» — αυτό το αποφασίζει ο μηχανισμός, αφού ρωτήσει
 * τη ρύθμιση προσβασιμότητας.
 */
export type RevealUrgency = 'requested' | 'incidental';

export interface RevealOptions {
  /** Δες {@link RevealUrgency}. Προεπιλογή: `'requested'`. */
  readonly urgency?: RevealUrgency;
  /**
   * Πόσο κάθετα. **Προεπιλογή `'nearest'` — και άλλαξέ την μόνο με λόγο.**
   *
   * `'center'` / `'start'` κουνούν την οθόνη **ακόμη κι όταν το στοιχείο είναι ήδη
   * ορατό**. Δικαιολογούνται όταν το στοιχείο πρέπει να γίνει το **θέμα** της οθόνης
   * (σφάλμα φόρμας, βήμα ξενάγησης), όχι όταν απλώς πρέπει να **φαίνεται**.
   */
  readonly block?: ScrollLogicalPosition;
  readonly inline?: ScrollLogicalPosition;
}

/**
 * Φέρε το στοιχείο στο οπτικό πεδίο — **όσο λιγότερο γίνεται**.
 *
 * ⚠️ Δέχεται `null`/`undefined` επίτηδες: ο συνηθέστερος καλών είναι
 * `document.querySelector(...)` ή ένα `ref.current`, και ο έλεγχος θα γραφόταν 29 φορές.
 *
 * ⚠️ **`scrollIntoView?.()`** — το jsdom **δεν το υλοποιεί**. Χωρίς το `?.`, κάθε δοκιμή
 * που περνά από αυτή τη διαδρομή πέφτει· μετρημένο ήδη ως σύμβαση του repo
 * (`CommentMentionsPicker.tsx:65`).
 */
export function revealInScroll(
  element: Element | null | undefined,
  options: RevealOptions = {}
): void {
  if (!element) return;

  const { urgency = 'requested', block = 'nearest', inline } = options;

  element.scrollIntoView?.({
    behavior: urgency === 'incidental' ? 'auto' : motionSafeScrollBehavior(),
    block,
    ...(inline ? { inline } : {}),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 🎯 ΑΠΟΚΑΛΥΨΗ ΠΟΥ ΕΠΑΛΗΘΕΥΕΙ ΟΤΙ ΕΦΤΑΣΕ (ADR-907 §8.3 Β6)
// ────────────────────────────────────────────────────────────────────────────

/** Πόσα διαδοχικά καρέ χωρίς μετακίνηση σημαίνουν «η κύλιση τελείωσε» (~100ms στα 60Hz). */
const SETTLE_FRAMES = 6;
/** Ταβάνι επαναλήψεων: κάθε πέρασμα ζωγραφίζει ό,τι διέσχισε, άρα το δεύτερο συνήθως φτάνει. */
const MAX_REVEAL_PASSES = 4;
/** Ό,τι σημαίνει «ο άνθρωπος πήρε την κύλιση στα χέρια του» — από εκεί και πέρα δεν τον διορθώνουμε. */
const USER_SCROLL_INTENT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** **Μία αποκάλυψη τη φορά**: δύο βρόχοι πάνω στην ίδια οθόνη θα τραβούσαν ο ένας τον άλλον. */
let cancelActiveReveal: (() => void) | null = null;

/**
 * Το `revealInScroll`, **ώσπου το στοιχείο να είναι πράγματι εκεί που ζητήθηκε**.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — μετρημένο 2026-10-07 στο `/search/results?selected=…`**: οι κάρτες της λίστας έχουν
 * `content-visibility: auto` με **εκτιμώμενο** ύψος 420px, ενώ το πραγματικό είναι 333–341px. Το `scrollIntoView`
 * υπολογίζει τον προορισμό με τις εκτιμήσεις· όσες κάρτες ζωγραφιστούν στη διαδρομή **μικραίνουν**, ο στόχος
 * ανεβαίνει και η κύλιση τον **προσπερνά**: η επιλεγμένη κάρτα έμενε 317px πάνω από το κάδρο στα 1440px
 * (24px ορατά) και 661px στα 320px. Ο προορισμός ενός `scrollIntoView` είναι **στιγμιότυπο**, όχι υπόσχεση.
 *
 * 🔑 **Η θεραπεία δεν μαντεύει ύψη**: περιμένει να ηρεμήσει η θέση, ξαναζητά την **ίδια** αποκάλυψη και σταματά
 * όταν μια αίτηση **δεν μετακινεί τίποτα** — δηλαδή όταν ο browser συμφωνεί ότι το στοιχείο είναι στη θέση του.
 *
 * ⚠️ **Σταματά μόλις ο άνθρωπος αγγίξει την κύλιση** (τροχός, αφή, πλήκτρο, δείκτης): μια διόρθωση που τον
 * γυρίζει πίσω είναι το πήδημα που αυτό το αρχείο υπάρχει για να αποτρέψει.
 * ⚠️ Στοιχείο που **δεν μετριέται** (jsdom, `display: none`) παίρνει **μία** αίτηση και τίποτε άλλο.
 *
 * @returns η ακύρωση — για το `return` ενός `useEffect`.
 */
export function revealInScrollUntilSettled(
  element: Element | null | undefined,
  options: RevealOptions = {}
): () => void {
  cancelActiveReveal?.();
  revealInScroll(element, options);
  if (!element || typeof requestAnimationFrame !== 'function' || !isMeasurable(element)) return () => {};

  let frame = 0;
  let passes = 1;
  let quietFrames = 0;
  let lastTop = Number.NaN;
  let settledTop: number | null = null;

  const stop = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    USER_SCROLL_INTENT.forEach((type) => window.removeEventListener(type, stop, true));
    if (cancelActiveReveal === stop) cancelActiveReveal = null;
  };
  const tick = (): void => {
    frame = 0;
    if (!element.isConnected) return stop();
    const top = Math.round(element.getBoundingClientRect().top);
    quietFrames = top === lastTop ? quietFrames + 1 : 0;
    lastTop = top;
    if (quietFrames >= SETTLE_FRAMES) {
      // Η προηγούμενη αίτηση δεν μετακίνησε τίποτα ⇒ έφτασε. Αλλιώς ξαναζήτα, ως το ταβάνι.
      if (top === settledTop || passes >= MAX_REVEAL_PASSES) return stop();
      settledTop = top;
      passes += 1;
      quietFrames = 0;
      revealInScroll(element, options);
    }
    frame = requestAnimationFrame(tick);
  };

  USER_SCROLL_INTENT.forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }));
  cancelActiveReveal = stop;
  frame = requestAnimationFrame(tick);
  return stop;
}

/** Το jsdom και το `display: none` δίνουν μηδενικό ορθογώνιο — εκεί «ηρέμησε» δεν σημαίνει τίποτα. */
function isMeasurable(element: Element): boolean {
  if (typeof element.getBoundingClientRect !== 'function') return false;
  const { width, height } = element.getBoundingClientRect();
  return width > 0 || height > 0;
}

/**
 * **Πού βρίσκεται το στοιχείο σε σχέση με ό,τι βλέπει ο άνθρωπος τώρα.**
 *
 * 🔑 Είναι η ερώτηση που κάνει δυνατή την **εναλλακτική της κύλισης**: αν ξέρεις ότι
 * κάτι είναι «πιο πάνω», μπορείς να **το πεις** αντί να πηδήξεις εκεί. Η οθόνη 2 το
 * χρησιμοποιεί για τον δείκτη άκρης — την απάντηση στο δίλημμα που η Figma έλυσε
 * αφαιρώντας το χαρακτηριστικό.
 *
 * ⚠️ **Μερική ορατότητα μετρά ως `'visible'`.** Ένα στοιχείο κομμένο στη μέση **το
 * βλέπει** ο άνθρωπος· να τον σπρώξουμε για να το «τελειοποιήσουμε» είναι κίνηση χωρίς
 * κέρδος. Η αυστηρή εκδοχή θα έκανε τον δείκτη άκρης να αναβοσβήνει σε κάθε ξύσιμο
 * του τροχού.
 */
export type ScrollVisibility = 'visible' | 'above' | 'below' | 'unknown';

/**
 * **Το κάδρο που βλέπει ο άνθρωπος**: ένα δοχείο κύλισης (η λίστα της οθόνης 2) ή το
 * **παράθυρο** (`'viewport'` — σελίδα που κυλά ολόκληρη, όπως το χαρτοφυλάκιο, ADR-777 §8.77).
 */
export type ScrollFrame = Element | 'viewport';

interface FrameEdges {
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
}

/**
 * ⚠️ **`clientHeight` του `<html>`, ΟΧΙ `innerHeight`**: το `innerHeight` μετρά και την οριζόντια
 * μπάρα κύλισης, δηλαδή λωρίδα που **δεν** δείχνει περιεχόμενο. Και στο jsdom το `clientHeight` είναι
 * 0 ⇒ `'unknown'` — η ίδια ειλικρίνεια με τα μηδενικά ορθογώνια του δοχείου (το `innerHeight` του
 * jsdom είναι 768 και θα έλεγε «ορατό» για κάτι που κανείς δεν μέτρησε).
 */
function frameEdges(frame: ScrollFrame): FrameEdges {
  if (frame !== 'viewport') return frame.getBoundingClientRect();
  const height = document.documentElement.clientHeight;
  return { top: 0, bottom: height, height };
}

export function visibilityWithinScroller(
  element: Element | null | undefined,
  scroller: ScrollFrame | null | undefined
): ScrollVisibility {
  if (!element || !scroller) return 'unknown';
  // Το jsdom επιστρέφει παντού μηδενικά ορθογώνια. Ένας «ειλικρινής» υπολογισμός εκεί θα
  // έλεγε πάντα `'visible'` — απάντηση που *μοιάζει* σωστή και δεν κοίταξε ποτέ.
  if (typeof element.getBoundingClientRect !== 'function') return 'unknown';

  const item = element.getBoundingClientRect();
  const frame = frameEdges(scroller);
  if (frame.height === 0) return 'unknown';

  if (item.bottom <= frame.top) return 'above';
  if (item.top >= frame.bottom) return 'below';
  return 'visible';
}

// ────────────────────────────────────────────────────────────────────────────
// ↔ ΟΡΙΖΟΝΤΙΑ ΑΠΟΚΑΛΥΨΗ ΜΕΣΑ ΣΕ ΛΩΡΙΔΑ (ADR-896 §7Α.5)
// ────────────────────────────────────────────────────────────────────────────

/**
 * **Θέση ενός στοιχείου στον άξονα κύλισης του δοχείου** — σε συντεταγμένες *περιεχομένου*
 * (ανεξάρτητες από το πόσο έχει κυλήσει). LTR: τα locale του έργου είναι el/en.
 */
export interface InlineSpan {
  readonly start: number;
  readonly end: number;
}

/** Το κάδρο μιας οριζόντιας λωρίδας, όπως το δίνει ο browser. */
export interface InlineView {
  readonly scrollLeft: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
}

export function inlineViewOf(scroller: Element): InlineView {
  return { scrollLeft: scroller.scrollLeft, clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth };
}

export function inlineSpanWithin(scroller: Element, element: Element): InlineSpan {
  const frame = scroller.getBoundingClientRect();
  const item = element.getBoundingClientRect();
  const offset = scroller.scrollLeft - frame.left;
  return { start: item.left + offset, end: item.right + offset };
}

/** Το επιτρεπτό εύρος του `scrollLeft` — καμία πράξη δεν ζητά κύλιση πέρα από τις άκρες. */
export function clampInlineScroll(left: number, view: InlineView): number {
  return Math.min(Math.max(0, left), Math.max(0, view.scrollWidth - view.clientWidth));
}

/**
 * **Πού πρέπει να κυλήσει η λωρίδα ώστε το στοιχείο να φαίνεται ΕΞΩ από τη μάσκα της άκρης;**
 *
 * 🔑 `null` = **καμία κίνηση** — η ίδια σημασία με το `'nearest'`: ό,τι ήδη φαίνεται δεν σπρώχνεται.
 * Το `inset` είναι η ζώνη σβησίματος (`scroll-padding-inline` του δοχείου)· τσιπ κάτω από τη
 * μάσκα **δεν** φαίνεται, άρα μετρά ως κρυμμένο. Κάδρο πλάτους 0 (jsdom, `display:none`) ⇒ `null`:
 * ό,τι δεν μετρήθηκε δεν κινεί τίποτα.
 */
export function revealInlineTargetOf(span: InlineSpan, view: InlineView, inset = 0): number | null {
  if (view.clientWidth <= 0) return null;
  let target: number;
  if (span.start < view.scrollLeft + inset) target = span.start - inset;
  else if (span.end > view.scrollLeft + view.clientWidth - inset) target = span.end + inset - view.clientWidth;
  else return null;
  const clamped = clampInlineScroll(target, view);
  return Math.abs(clamped - view.scrollLeft) < 1 ? null : clamped;
}

/**
 * Φέρε το στοιχείο σε θέα **κυλώντας ΜΟΝΟ τη λωρίδα** — ποτέ τη σελίδα.
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `revealInScroll`**: το `scrollIntoView` κυλά **κάθε** πρόγονο, άρα και το
 * παράθυρο· στην πρώτη απόδοση αυτό είναι πήδημα σελίδας που ο άνθρωπος δεν ζήτησε. Και δεν
 * ξέρει τη μάσκα της άκρης: αφήνει το στοιχείο **κάτω** από το σβήσιμο.
 */
export function revealInlineWithin(
  scroller: Element | null | undefined,
  element: Element | null | undefined,
  options: { readonly inset?: number; readonly urgency?: RevealUrgency } = {}
): void {
  if (!scroller || !element || typeof scroller.scrollTo !== 'function') return;
  const target = revealInlineTargetOf(inlineSpanWithin(scroller, element), inlineViewOf(scroller), options.inset);
  if (target === null) return;
  const behavior = options.urgency === 'incidental' ? 'auto' : motionSafeScrollBehavior();
  scroller.scrollTo({ left: target, behavior });
}
