/**
 * ADR-717 — ο κανόνας «πότε μιλά το selection highlight» στο 3D.
 *
 * Γιατί έχει δικά του anchors: αυτή η μία απόφαση άλλαξε ΤΡΕΙΣ φορές μέσα σε μία συνεδρία, και
 * ΚΑΘΕ λάθος εκδοχή ήταν άμεσα ορατή στον χρήστη ως **αλλοιωμένο χρώμα οντότητας** — δηλαδή ως
 * απώλεια πληροφορίας (το χρώμα DXF layer είναι δεδομένο: επίπεδο, υλικό, σύμβαση σχεδίου):
 *
 *   v1 «πάντα αναμμένο»            → κάθε επιλεγμένη οντότητα βαφόταν μπλε·
 *   v2 «πρόβλεψη του GRIPOBJLIMIT» → λαβές ΚΑΙ μπλε βαφή ΤΑΥΤΟΧΡΟΝΑ (δύο συστήματα υπολόγιζαν
 *                                    ανεξάρτητα το ίδιο πράγμα και απέκλιναν)·
 *   v3 «κατάσταση των λαβών»       → ό,τι κλειδώνουν τα tests παρακάτω.
 *
 * Το κεντρικό συμβόλαιο, σε μία πρόταση: **όταν μιλούν οι λαβές, το highlight σωπαίνει** — ώστε η
 * οντότητα να κρατά το χρώμα της, ταυτόσημα με το 2D.
 */

import { shouldShowSelectionHighlight, selectionSignature } from '../use-selection-glow-pass';

describe('shouldShowSelectionHighlight (ADR-717 v3)', () => {
  it('ΚΑΜΙΑ επιλογή ⇒ σβηστό', () => {
    expect(shouldShowSelectionHighlight(0, 0, 0)).toBe(false);
  });

  it('ΜΙΑ επιλεγμένη ΜΕ λαβές ⇒ ΣΒΗΣΤΟ — η οντότητα κρατά το χρώμα της (ισοτιμία με το 2D)', () => {
    expect(shouldShowSelectionHighlight(1, 0, 1)).toBe(false);
  });

  it('ΠΟΛΛΕΣ επιλεγμένες ΜΕ λαβές ⇒ ΣΒΗΣΤΟ — το ακριβές σφάλμα της v2 (λαβές + μπλε μαζί)', () => {
    expect(shouldShowSelectionHighlight(250, 0, 250)).toBe(false);
  });

  it('επιλεγμένες ΧΩΡΙΣ λαβές ⇒ ΑΝΑΜΜΕΝΟ — αλλιώς ο χρήστης δεν βλέπει ΤΙΠΟΤΑ', () => {
    // Το κενό του AutoCAD: πάνω από το GRIPOBJLIMIT οι λαβές σβήνουν και μένει σιωπή.
    expect(shouldShowSelectionHighlight(5000, 0, 0)).toBe(true);
  });

  it('BIM επιλογή ⇒ ΣΒΗΣΤΟ ακόμη κι αν λείπουν λαβές (εκείνη έχει WebGL silhouette)', () => {
    // Δύο highlight ταυτόχρονα θα διάβαζαν ως ένα ασαφές.
    expect(shouldShowSelectionHighlight(3, 1, 0)).toBe(false);
  });

  it('ΜΕΡΙΚΕΣ λαβές (μεικτή επιλογή) ⇒ ΣΒΗΣΤΟ — οι λαβές ήδη μιλούν, δεν διπλο-σηματοδοτούμε', () => {
    expect(shouldShowSelectionHighlight(10, 0, 4)).toBe(false);
  });
});

describe('selectionSignature — invalidation του cache περιγραμμάτων', () => {
  it('ΑΛΛΗ ΣΕΙΡΑ = ΑΛΛΗ ταυτότητα (η σειρά καθορίζει το primary id, ADR-543)', () => {
    expect(selectionSignature(['a', 'b'])).not.toBe(selectionSignature(['b', 'a']));
  });

  it('ίδια ids ⇒ ίδια ταυτότητα ⇒ το cache επιβιώνει (καμία re-tessellation ανά frame)', () => {
    expect(selectionSignature(['a', 'b'])).toBe(selectionSignature(['a', 'b']));
  });

  it('προσθήκη/αφαίρεση αλλάζει την ταυτότητα ⇒ το cache πέφτει', () => {
    expect(selectionSignature(['a'])).not.toBe(selectionSignature(['a', 'b']));
    expect(selectionSignature([])).not.toBe(selectionSignature(['a']));
  });
});
