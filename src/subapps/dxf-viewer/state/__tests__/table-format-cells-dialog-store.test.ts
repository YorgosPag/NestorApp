/**
 * 🔴 ADR-739 §61 — **Η ΚΑΤΑΣΤΑΣΗ του διαλόγου «Μορφοποίηση κελιών»** (ήταν: η ιδιοκτησία του).
 *
 * ## Τι κλειδώνεται εδώ, και γιατί άλλαξε το ερώτημα
 * Το §60 κλείδωνε **αποκλειστικότητα**: ποιος από τους τρεις εκκινητές κρατά τον διάλογο. Η ίδια
 * απάντηση παραμένει (ένας διάλογος, ο τελευταίος), αλλά την επιβάλλει πλέον η **δομή**: υπάρχει
 * ένα αίτημα, άρα δεν *γίνεται* να είναι δύο. Οι άγκυρες μετακινήθηκαν σε ό,τι μπορεί ακόμη να
 * σπάσει σιωπηλά:
 *
 *  · **Το `id`** — αν πάψει να αλλάζει ανά άνοιγμα, ο ένας ξενιστής θα κρατά το ΠΑΛΙΟ προσχέδιο
 *    και το «ΟΚ» θα γράφει μοντέλο που ο χρήστης δεν βλέπει. Μέχρι το §60 την εγγύηση την έδινε
 *    δωρεάν το ξεμοντάρισμα κάθε εκκινητή· τώρα την κρατά **αυτός ο αριθμός και τίποτε άλλο**.
 *  · **Η τελευταία καρτέλα** — συμπεριφορά του Excel, μετρημένη (Exceljet, «Format (almost)
 *    anything»: *«displays the Format Cells dialog box with the "last tab used" selected»*).
 *  · **Το `null` target** — ο μόνος δρόμος να μην ανοίξει ο διάλογος (undo ανάμεσα στο άνοιγμα
 *    του μενού και το πάτημα του item).
 */

import {
  __resetTableFormatCellsDialogForTests,
  closeTableFormatCellsDialog,
  getTableFormatCellsRequest,
  openTableFormatCellsDialog,
  setTableFormatCellsTab,
  subscribeTableFormatCellsDialog,
} from '../table-format-cells-dialog-store';
import type { FormatTarget } from '../../ui/table-cell-editor/table-format-snapshot';
import type { PersistedTableModel } from '../../types/table';

// Module-level store ⇒ **υποχρεωτικό** reset ανάμεσα στα tests (η παγίδα #8 του handoff).
beforeEach(() => {
  __resetTableFormatCellsDialogForTests();
});

/**
 * Ένας στόχος με **αναγνωρίσιμη ταυτότητα μοντέλου**: τα tests συγκρίνουν by-reference, γιατί
 * αυτό ακριβώς κάνει και το προσχέδιο του διαλόγου.
 */
function target(tag: string): FormatTarget {
  return {
    model: { tag } as unknown as PersistedTableModel,
    style: {} as FormatTarget['style'],
    scope: { kind: 'range', bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } },
    layerColors: [],
  };
}

describe('§61 — η κατάσταση του διαλόγου', () => {
  it('κλειστός στην αρχή', () => {
    expect(getTableFormatCellsRequest()).toBeNull();
  });

  it('🔴 `null` στόχος ⇒ ΔΕΝ ανοίγει — ποτέ διάλογος πάνω σε πίνακα που δεν υπάρχει πια', () => {
    openTableFormatCellsDialog({ target: null, tab: 'number' });
    expect(getTableFormatCellsRequest()).toBeNull();
  });

  it('ανοίγει με τον στόχο και την καρτέλα που ζητήθηκαν', () => {
    const t = target('a');
    openTableFormatCellsDialog({ target: t, tab: 'alignment' });
    expect(getTableFormatCellsRequest()).toMatchObject({ target: t, tab: 'alignment' });
  });

  it('🔴 δεύτερο άνοιγμα ⇒ ΕΝΑ αίτημα, το τελευταίο — ένας διάλογος, δομικά', () => {
    openTableFormatCellsDialog({ target: target('a'), tab: 'number' });
    const second = target('b');
    openTableFormatCellsDialog({ target: second, tab: 'border' });
    expect(getTableFormatCellsRequest()?.target).toBe(second);
  });

  it('κλείσιμο ⇒ κανένα αίτημα', () => {
    openTableFormatCellsDialog({ target: target('a') });
    closeTableFormatCellsDialog();
    expect(getTableFormatCellsRequest()).toBeNull();
  });

  it('ειδοποιεί τους συνδρομητές σε κάθε αλλαγή', () => {
    const seen: (string | null)[] = [];
    const unsubscribe = subscribeTableFormatCellsDialog(() => {
      seen.push(getTableFormatCellsRequest()?.tab ?? null);
    });
    openTableFormatCellsDialog({ target: target('a'), tab: 'number' });
    setTableFormatCellsTab('border');
    closeTableFormatCellsDialog();
    unsubscribe();
    expect(seen).toEqual(['number', 'border', null]);
  });
});

describe('§61 — 🔴 το `id`: η εγγύηση «φρέσκο προσχέδιο ανά άνοιγμα»', () => {
  it('κάθε άνοιγμα δίνει ΝΕΟ `id` — ακόμη και με τον ίδιο ακριβώς στόχο', () => {
    const t = target('a');
    openTableFormatCellsDialog({ target: t });
    const first = getTableFormatCellsRequest()?.id;
    closeTableFormatCellsDialog();
    openTableFormatCellsDialog({ target: t });
    // Ο ίδιος στόχος **by-reference**, και όμως νέο `id`: ο χρήστης έκλεισε και ξαναρώτησε, άρα
    // δεν επιτρέπεται να δει το προσχέδιο που νόμιζε ότι ακύρωσε. Μια σύγκριση στόχου εδώ θα
    // απαντούσε «ίδια ερώτηση» — και θα ήταν λάθος.
    expect(getTableFormatCellsRequest()?.id).not.toBe(first);
  });

  it('🔴 η αλλαγή ΚΑΡΤΕΛΑΣ ΔΕΝ αλλάζει το `id` — αλλιώς κάθε καρτέλα πετά το προσχέδιο', () => {
    openTableFormatCellsDialog({ target: target('a'), tab: 'number' });
    const id = getTableFormatCellsRequest()?.id;
    setTableFormatCellsTab('alignment');
    expect(getTableFormatCellsRequest()).toMatchObject({ id, tab: 'alignment' });
  });
});

describe('§61 — 🏆 η ΤΕΛΕΥΤΑΙΑ καρτέλα (Excel parity, μετρημένο)', () => {
  it('χωρίς δηλωμένη καρτέλα ανοίγει στην προεπιλογή την πρώτη φορά', () => {
    openTableFormatCellsDialog({ target: target('a') });
    expect(getTableFormatCellsRequest()?.tab).toBe('number');
  });

  it('🔴 θυμάται την καρτέλα που ΔΗΛΩΣΕ η προηγούμενη υποδοχή', () => {
    openTableFormatCellsDialog({ target: target('a'), tab: 'border' });
    closeTableFormatCellsDialog();
    // Αυτή είναι η διαδρομή του `Ctrl+1` και του δεξιού κλικ: **δεν** δηλώνουν καρτέλα.
    openTableFormatCellsDialog({ target: target('b') });
    expect(getTableFormatCellsRequest()?.tab).toBe('border');
  });

  it('🔴 θυμάται την καρτέλα που διάλεξε ο ΧΡΗΣΤΗΣ μέσα στον διάλογο', () => {
    openTableFormatCellsDialog({ target: target('a'), tab: 'number' });
    setTableFormatCellsTab('alignment');
    closeTableFormatCellsDialog();
    openTableFormatCellsDialog({ target: target('b') });
    // Το κρίσιμο: η μνήμη **δεν** είναι «η τελευταία που ζητήθηκε από υποδοχή» αλλά «η τελευταία
    // που είδε ο χρήστης». Αν η καρτέλα ζούσε σε `useState` του διαλόγου, αυτό θα ήταν αδύνατο
    // να γνωρίζει κανείς — και ακριβώς γι' αυτό ανέβηκε στο store.
    expect(getTableFormatCellsRequest()?.tab).toBe('alignment');
  });

  it('ρητή καρτέλα από υποδοχή ΝΙΚΑ τη μνήμη — το βελάκι ξέρει τι υποσχέθηκε', () => {
    openTableFormatCellsDialog({ target: target('a'), tab: 'alignment' });
    closeTableFormatCellsDialog();
    openTableFormatCellsDialog({ target: target('b'), tab: 'border' });
    expect(getTableFormatCellsRequest()?.tab).toBe('border');
  });

  it('η αλλαγή καρτέλας με ΚΛΕΙΣΤΟ διάλογο δεν κάνει τίποτα — καρτέλα χωρίς στόχο δεν υπάρχει', () => {
    setTableFormatCellsTab('border');
    expect(getTableFormatCellsRequest()).toBeNull();
    openTableFormatCellsDialog({ target: target('a') });
    expect(getTableFormatCellsRequest()?.tab).toBe('number');
  });
});
