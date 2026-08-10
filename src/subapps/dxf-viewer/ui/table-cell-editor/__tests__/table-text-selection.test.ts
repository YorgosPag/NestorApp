/**
 * 🔴 ADR-753 Φ4 — **η παγωμένη επιλογή χαρακτήρων.**
 *
 * Το ερώτημα εδώ είναι ένα και δεν το απαντά κανένα άλλο test: *μπορεί να μαθευτεί ότι οι
 * δείκτες έπαψαν να δείχνουν στα ίδια γράμματα;* Χωρίς αυτό, η μορφοποίηση βάφει **σιωπηλά**
 * λάθος τμήμα — και το λάθος εμφανίζεται μία κίνηση μακριά από την αιτία του.
 *
 * @see ui/table-cell-editor/table-text-selection.ts
 */

import {
  hasTableTextSelection,
  isStaleTableTextSelection,
  readTableTextSelection,
  restoreTableTextSelection,
} from '../table-text-selection';

/** Ένα πραγματικό `textarea` στο DOM — ποτέ στημένο αντικείμενο με δύο αριθμούς. */
function fieldWith(value: string, start: number, end: number): HTMLTextAreaElement {
  const field = document.createElement('textarea');
  field.value = value;
  document.body.appendChild(field);
  field.setSelectionRange(start, end);
  return field;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('readTableTextSelection — τι μάρκαρε ο χρήστης', () => {
  it('τα άκρα σε σειρά, με το κείμενο δίπλα τους', () => {
    expect(readTableTextSelection(fieldWith('ΝΕΣΤΩΡ', 2, 4)))
      .toEqual({ start: 2, end: 4, text: 'ΝΕΣΤΩΡ' });
  });

  it('🔴 ΑΝΑΠΟΔΗ σύρση δίνει το ίδιο εύρος — η μορφοποίηση δεν έχει φορά', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 0, 0);
    // Το DOM κρατά `selectionStart <= selectionEnd` και ξεχωριστά τη φορά· ο τύπος μας δεν την
    // ξέρει καν, και αυτό είναι το ζητούμενο: ένας καταναλωτής λιγότερο που πρέπει να θυμηθεί.
    field.setSelectionRange(2, 4, 'backward');
    expect(readTableTextSelection(field)).toEqual({ start: 2, end: 4, text: 'ΝΕΣΤΩΡ' });
  });

  it('σκέτος δρομέας ⇒ κενό εύρος, και το λέει', () => {
    const selection = readTableTextSelection(fieldWith('ΝΕΣΤΩΡ', 3, 3));
    expect(hasTableTextSelection(selection)).toBe(false);
  });

  it('έστω ένας χαρακτήρας ⇒ επιλογή', () => {
    expect(hasTableTextSelection(readTableTextSelection(fieldWith('ΝΕΣΤΩΡ', 3, 4)))).toBe(true);
  });
});

describe('🔴 isStaleTableTextSelection — η ΜΟΝΗ άμυνα απέναντι σε δείκτες που δείχνουν αλλού', () => {
  it('ίδιο κείμενο ⇒ φρέσκια, όσες φορές κι αν ρωτηθεί', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 2, 4);
    const frozen = readTableTextSelection(field);
    expect(isStaleTableTextSelection(frozen, field)).toBe(false);
    expect(isStaleTableTextSelection(frozen, field)).toBe(false);
  });

  it('🔴 πληκτρολόγηση στην ΑΡΧΗ ⇒ μπαγιάτικη, παρότι τα όρια είναι ακόμη «έγκυρα»', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 2, 4);
    const frozen = readTableTextSelection(field);
    field.value = 'ΧΝΕΣΤΩΡ';
    // Τα `[2,4)` χωράνε μια χαρά στο νέο κείμενο — και δείχνουν σε **άλλα** γράμματα. Ένας
    // έλεγχος ορίων θα έλεγε «εντάξει» ακριβώς εδώ.
    expect(frozen.end).toBeLessThanOrEqual(field.value.length);
    expect(isStaleTableTextSelection(frozen, field)).toBe(true);
  });

  it('ίδιο μήκος αλλά άλλο περιεχόμενο ⇒ μπαγιάτικη', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 2, 4);
    const frozen = readTableTextSelection(field);
    field.value = 'ΠΑΓΩΝΗ';
    expect(isStaleTableTextSelection(frozen, field)).toBe(true);
  });
});

describe('🔴 restoreTableTextSelection — belt-and-suspenders, με δύο φρουρούς', () => {
  it('ξαναδηλώνει το μαρκάρισμα σε πεδίο που έχασε την εστίαση', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 2, 4);
    const frozen = readTableTextSelection(field);
    field.setSelectionRange(0, 0);

    restoreTableTextSelection(field, frozen);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 4]);
  });

  it('🔴 ΕΣΤΙΑΣΜΕΝΟ πεδίο ⇒ σιωπή: ο χρήστης το ξαναπήρε, δεν παλεύουμε μαζί του', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 2, 4);
    const frozen = readTableTextSelection(field);
    field.focus();
    field.setSelectionRange(0, 1);

    restoreTableTextSelection(field, frozen);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 1]);
  });

  it('🔴 ΜΠΑΓΙΑΤΙΚΗ ⇒ σιωπή: δείκτες πάνω σε άλλο κείμενο δεν είναι «σχεδόν σωστοί»', () => {
    const field = fieldWith('ΝΕΣΤΩΡ', 2, 4);
    const frozen = readTableTextSelection(field);
    field.value = 'ΧΝΕΣΤΩΡ';
    field.setSelectionRange(0, 0);

    restoreTableTextSelection(field, frozen);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 0]);
  });
});
