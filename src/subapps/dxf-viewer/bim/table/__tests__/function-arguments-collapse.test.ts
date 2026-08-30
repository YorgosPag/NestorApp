/**
 * 🔴 ADR-763 Φ2.4 — **ΤΟ `⬆`: μόνιμη σύμπτυξη, ΚΑΙ αυτόματη όσο σέρνει το ποντίκι.**
 *
 * Δύο πράγματα που μοιάζουν ένα και **δεν** είναι. Αν συγχωνευτούν σε μία τιμή:
 *  - το τέλος μιας σύρσης **ανοίγει** κάρτα που ο χρήστης είχε συμπτύξει ρητά· ή
 *  - μια συμπτυγμένη κάρτα **δεν ξανανοίγει ποτέ** μετά τη σύρση.
 * Και τα δύο είναι σιωπηλά: κανένα σφάλμα, μόνο παράθυρο που δεν υπακούει.
 *
 * @see state/function-arguments-dialog-store.ts
 */

import {
  __resetTableCellCursorStoreForTests,
} from '../../../state/table-cell-cursor-store';
import {
  __resetFunctionArgumentsDialogForTests,
  collapsedFunctionArgumentIndex,
  getFunctionArgumentsDialogState,
  openFunctionArgumentsDialog,
  setActiveFunctionArgument,
  setFunctionArgumentPointing,
  setFunctionArgumentValue,
  toggleFunctionArgumentCollapse,
} from '../../../state/function-arguments-dialog-store';
import { setTableCellCursorById } from './make-table-entity';

const POSITION = { rowIndex: 0, columnIndex: 0, anchorColumnIndex: 0 };

function openOnSum(): void {
  setTableCellCursorById('table-1', POSITION, 'edit', '=SUM()', 5);
  openFunctionArgumentsDialog({
    functionName: 'SUM',
    frame: { prefix: '=SUM(', suffix: ')' },
    restore: { kind: 'navigation' },
  });
}

/** Σε ποιο όρισμα είναι μαζεμένη η κάρτα **τώρα** — η μία ερώτηση της όψης. */
function collapsedNow(): number | null {
  return collapsedFunctionArgumentIndex(getFunctionArgumentsDialogState());
}

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
  __resetFunctionArgumentsDialogForTests();
});

describe('Το `⬆` — μόνιμη σύμπτυξη', () => {
  it('ανοίγει ΑΝΑΠΤΥΓΜΕΝΟΣ — η σύμπτυξη απαντά σε ερώτηση που δεν έγινε ακόμη', () => {
    openOnSum();
    expect(collapsedNow()).toBeNull();
  });

  it('συμπτύσσει σε ΣΥΓΚΕΚΡΙΜΕΝΟ όρισμα, και το κάνει ενεργό', () => {
    openOnSum();
    toggleFunctionArgumentCollapse(1);
    expect(collapsedNow()).toBe(1);
    // Αλλιώς η επόμενη υπόδειξη θα έγραφε σε όρισμα που δεν φαίνεται πουθενά στην οθόνη.
    expect(getFunctionArgumentsDialogState().activeIndex).toBe(1);
  });

  it('δεύτερο πάτημα στο ΙΔΙΟ ⇒ ανάπτυξη', () => {
    openOnSum();
    toggleFunctionArgumentCollapse(1);
    toggleFunctionArgumentCollapse(1);
    expect(collapsedNow()).toBeNull();
  });

  it('πάτημα σε ΑΛΛΟ όρισμα ⇒ μετακινεί τη σύμπτυξη, δεν την κλείνει', () => {
    openOnSum();
    toggleFunctionArgumentCollapse(0);
    toggleFunctionArgumentCollapse(2);
    expect(collapsedNow()).toBe(2);
  });

  it('αγνοεί αρνητικό δείκτη και κλειστό διάλογο', () => {
    toggleFunctionArgumentCollapse(0);
    expect(getFunctionArgumentsDialogState().open).toBe(false);
    openOnSum();
    toggleFunctionArgumentCollapse(-1);
    expect(collapsedNow()).toBeNull();
  });
});

describe('Η ΑΥΤΟΜΑΤΗ σύμπτυξη — όσο κρατά η χειρονομία', () => {
  it('η υπόδειξη μαζεύει την κάρτα στο ΕΝΕΡΓΟ όρισμα και το `mouseup` την ανοίγει', () => {
    openOnSum();
    setActiveFunctionArgument(1);
    setFunctionArgumentPointing(true);
    expect(collapsedNow()).toBe(1);
    setFunctionArgumentPointing(false);
    expect(collapsedNow()).toBeNull();
  });

  it('🔴 δεν ΑΝΟΙΓΕΙ κάρτα που ο χρήστης είχε συμπτύξει ρητά', () => {
    openOnSum();
    toggleFunctionArgumentCollapse(0);
    setFunctionArgumentPointing(true);
    setFunctionArgumentPointing(false);
    expect(collapsedNow()).toBe(0);
  });

  it('η μόνιμη σύμπτυξη ΚΕΡΔΙΖΕΙ όσο σέρνει το ποντίκι σε άλλο όρισμα', () => {
    openOnSum();
    toggleFunctionArgumentCollapse(0);
    setActiveFunctionArgument(2);
    setFunctionArgumentPointing(true);
    // Η λωρίδα δείχνει **αυτό που διάλεξε ο χρήστης**, όχι αυτό που τυχαίνει να είναι ενεργό.
    expect(collapsedNow()).toBe(0);
  });

  it('🔑 το `⬆` είναι και η έξοδος διαφυγής από κολλημένη χειρονομία', () => {
    openOnSum();
    // Το `mouseup` χάθηκε (κουμπί αφέθηκε εκτός παραθύρου σε μηχανή που δεν το αναφέρει).
    setFunctionArgumentPointing(true);
    toggleFunctionArgumentCollapse(0);
    expect(getFunctionArgumentsDialogState().pointing).toBe(false);
    toggleFunctionArgumentCollapse(0);
    expect(collapsedNow()).toBeNull();
  });

  it('no-op με κλειστό διάλογο — ο φρουρός εξυπηρετεί ΔΥΟ παραλήπτες', () => {
    // Ο ίδιος φρουρός τρέχει και για την υπόδειξη μέσα σε σκέτο κελί, όπου κάρτα δεν υπάρχει.
    expect(() => setFunctionArgumentPointing(true)).not.toThrow();
    expect(getFunctionArgumentsDialogState().pointing).toBe(false);
  });
});

describe('Ο κύκλος ζωής — τι επιβιώνει και τι όχι', () => {
  it('κάθε άνοιγμα ξεκινά καθαρό', () => {
    openOnSum();
    setFunctionArgumentValue(0, 'A1');
    toggleFunctionArgumentCollapse(1);
    openOnSum();
    expect(collapsedNow()).toBeNull();
    expect(getFunctionArgumentsDialogState().pointing).toBe(false);
  });
});
