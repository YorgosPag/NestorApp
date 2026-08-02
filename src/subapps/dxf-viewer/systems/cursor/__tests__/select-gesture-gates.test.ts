/**
 * 🔴 ADR-739 §29.10 — **ΤΟ ΛΑΣΟ ΚΑΙ ΤΑ ΣΗΜΑΔΙΑ ΕΛΞΗΣ ΣΩΠΑΙΝΟΥΝ ΟΣΟ Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΑΝΟΙΧΤΟΣ.**
 *
 * Ζητούμενο (ιδιοκτήτης, με στιγμιότυπο): «το λάσο επιλογής όταν είμαι σε edit mode δεν πρέπει
 * να εμφανίζεται, ούτε τα σημάδια έλξης των οντοτήτων που βρίσκονται μέσα στο καμβά».
 *
 * ## Γιατί ο φύλακας του §29 ΔΕΝ τα έπιανε — και δεν είναι κενό του
 * Ο φύλακας κόβει τα συμβάντα **έξω** από τον πίνακα. Και τα δύο αυτά γεννιούνται από
 * χειρονομίες που ο καμβάς βλέπει **νόμιμα**:
 *
 *  - το πάτημα **μέσα** σε κελί περνά **επίτηδες** (ο ακροατής του πίνακα είναι παθητικός,
 *    ώστε να μη σπάσουν λαβές και μετακίνηση οντότητας) ⇒ armάρει λάσο ⇒ η σύρση επιλογής
 *    **κελιών** ζωγράφιζε ταυτόχρονα λάσο πάνω από τον πίνακα·
 *  - τα σημάδια έλξης γεννιούνται από `mousemove`, που ο φύλακας **ποτέ** δεν μπλοκάρει (το
 *    pan ζει πάνω του, §29.5).
 *
 * Δεύτερη κατηγορία, όχι διαρροή: εργασία που ξεκινά από **επιτρεπτό** συμβάν.
 *
 * ## Γιατί δοκιμάζονται εδώ και όχι μέσα στους handlers
 * Και οι δύο συνθήκες ζουν σε hot handlers που δεν στήνονται χωρίς δεκάδες props — δηλαδή μια
 * συνθήκη γραμμένη inline είναι στην πράξη **αδοκίμαστη**, και η μετάλλαξη «ξέχασα τον φύλακα»
 * θα περνούσε αθόρυβα. Ως καθαρές συναρτήσεις ελέγχονται με έναν boolean.
 *
 * @see systems/cursor/select-gesture-gates.ts — οι δύο πύλες
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — ο ΕΝΑΣ ορισμός του κλειδώματος
 */

import { shouldArmSelectDrag, shouldDetectSnap } from '../select-gesture-gates';

/** Η κατάσταση όπου **όλα** επιτρέπονται — κάθε test αλλάζει ΕΝΑ πράγμα. */
const UNLOCKED_PRESS = {
  button: 0,
  isGripDragging: false,
  activeTool: 'select',
  isToolInteractive: false,
  lockedByTableSession: false,
} as const;

const UNLOCKED_MOVE = {
  snapEnabled: true,
  hasResolver: true,
  isGripDragging: false,
  lockedByTableSession: false,
} as const;

describe('🔴 ADR-739 §29.10 — η σύρση επιλογής δεν armάρει όσο ζει η λειτουργία πίνακα', () => {
  it('βάση: αριστερό πάτημα με το εργαλείο επιλογής armάρει κανονικά', () => {
    // Χωρίς αυτό το test, ένα «return false» παντού θα ήταν πράσινο σε όλα τα υπόλοιπα.
    expect(shouldArmSelectDrag(UNLOCKED_PRESS)).toBe(true);
  });

  it('🔴 ΚΛΕΙΔΩΜΕΝΟΣ ΚΑΜΒΑΣ ⇒ κανένα arm — ούτε καν από πάτημα ΜΕΣΑ στον πίνακα', () => {
    // Αυτή είναι ακριβώς η χειρονομία του στιγμιότυπου: σύρση επιλογής κελιών, που ο καμβάς
    // βλέπει νόμιμα και μετέτρεπε σε λάσο.
    expect(shouldArmSelectDrag({ ...UNLOCKED_PRESS, lockedByTableSession: true })).toBe(false);
  });

  it('🔴 το κλείδωμα νικά ΚΑΙ τα εργαλεία marquee, όχι μόνο το «select»', () => {
    // Το `lassoDownRef` τροφοδοτεί τρεις καταναλωτές· ένας φύλακας που ξέχναγε το marquee θα
    // άφηνε το region box να σχηματιστεί πάνω από τον ανοιχτό πίνακα.
    const marquee = { ...UNLOCKED_PRESS, activeTool: 'crop-window' };
    expect(shouldArmSelectDrag(marquee)).toBe(true);
    expect(shouldArmSelectDrag({ ...marquee, lockedByTableSession: true })).toBe(false);
  });

  it('οι υπόλοιποι φύλακες μένουν ακέραιοι — καμία παλινδρόμηση από τη νέα πύλη', () => {
    expect(shouldArmSelectDrag({ ...UNLOCKED_PRESS, button: 1 })).toBe(false);
    expect(shouldArmSelectDrag({ ...UNLOCKED_PRESS, button: 2 })).toBe(false);
    expect(shouldArmSelectDrag({ ...UNLOCKED_PRESS, isGripDragging: true })).toBe(false);
    expect(shouldArmSelectDrag({ ...UNLOCKED_PRESS, isToolInteractive: true })).toBe(false);
    expect(shouldArmSelectDrag({ ...UNLOCKED_PRESS, activeTool: 'line' })).toBe(false);
  });
});

describe('🔴 ADR-739 §29.10 — τα σημάδια έλξης σβήνουν όσο ζει η λειτουργία πίνακα', () => {
  it('βάση: με OSNAP αναμμένο και resolver παρόντα, υπολογίζονται κανονικά', () => {
    expect(shouldDetectSnap(UNLOCKED_MOVE)).toBe(true);
  });

  it('🔴 ΚΛΕΙΔΩΜΕΝΟΣ ΚΑΜΒΑΣ ⇒ κανένας υπολογισμός έλξης', () => {
    expect(shouldDetectSnap({ ...UNLOCKED_MOVE, lockedByTableSession: true })).toBe(false);
  });

  it('οι υπόλοιποι φύλακες μένουν ακέραιοι', () => {
    expect(shouldDetectSnap({ ...UNLOCKED_MOVE, snapEnabled: false })).toBe(false);
    expect(shouldDetectSnap({ ...UNLOCKED_MOVE, hasResolver: false })).toBe(false);
    // Το σύρσιμο λαβής έχει **δικό του**, σύγχρονο snap — χρειάζεται ghost 1:1.
    expect(shouldDetectSnap({ ...UNLOCKED_MOVE, isGripDragging: true })).toBe(false);
  });
});
