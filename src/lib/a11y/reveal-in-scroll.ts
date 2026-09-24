/**
 * @fileoverview **«Φέρε το μπροστά στα μάτια του»** — η ΜΙΑ πράξη αποκάλυψης.
 * @related WCAG 2.3.3 · ADR-777 §7 Α3 · lib/a11y/reduced-motion.ts
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
