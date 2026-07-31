/**
 * ADR-739 Φ.Δ βήμα 2 — `table-cell-cursor-store`: η **κατάσταση** του δρομέα κελιού.
 *
 * Δύο πράγματα δοκιμάζονται εδώ, και κανένα από τα δύο δεν είναι «θέτω και διαβάζω»:
 *
 *  1. **Ο αριθμός συνεδρίας.** Αυξάνεται **μόνο** στην ακύρωση με `Escape` πάνω σε
 *     πρόχειρο. Είναι αυτός που ξαναστήνει το `<input>` — και μαζί του τον φρουρό «μία
 *     φορά» του `use-inline-editor-keys`. Αν έπαυε να αυξάνεται, το επόμενο `Enter` μετά
 *     από `Escape` **δεν θα δέσμευε ποτέ**: σιωπηλή απώλεια πληκτρολόγησης, αόρατη σε
 *     κάθε έλεγχο που κοιτά μόνο «ποιο κελί είναι τρέχον».
 *
 *  2. **Το αίτημα επανασχεδίασης.** Ο δρομέας ζωγραφίζεται στον καμβά, που ζει έξω από
 *     τον React κύκλο: κάθε μεταβολή **οφείλει** να ζητήσει καρέ. Χωρίς αυτό ο δρομέας
 *     μένει ζωγραφισμένος στο **προηγούμενο** κελί — σφάλμα ορατό στην οθόνη αλλά
 *     τελείως αόρατο σε έλεγχο κατάστασης. Γι' αυτό ο φρουρός είναι εδώ, όχι «κάπου».
 */

import {
  __resetTableCellCursorStoreForTests,
  cancelTableCellCursorSession,
  closeTableCellCursor,
  getTableCellCursor,
  setTableCellCursor,
  setTableCellCursorDraft,
  setTableCellCursorMode,
  subscribeTableCellCursor,
} from '../table-cell-cursor-store';
import { markSystemsDirty } from '../../rendering/core/frame-scheduler-api';
import { tableCursorAt } from '../../bim/table/table-cell-navigation';

jest.mock('../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
}));

const repaints = markSystemsDirty as jest.MockedFunction<typeof markSystemsDirty>;

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
  repaints.mockClear();
});

describe('κύκλος ζωής', () => {
  it('ξεκινά χωρίς δρομέα', () => {
    expect(getTableCellCursor()).toBeNull();
  });

  it('τοποθέτηση κρατά ταυτότητα, θέση και κατάσταση', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c2'), 'edit', 'ήδη γραμμένο');

    expect(getTableCellCursor()).toEqual({
      entityId: 'tbl_1',
      position: { rowId: 'r1', colId: 'c2', anchorColId: 'c2' },
      mode: 'edit',
      draft: 'ήδη γραμμένο',
      sessionId: 0,
    });
  });

  it('το κλείσιμο είναι ιδεμποτές', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    closeTableCellCursor();
    closeTableCellCursor();

    expect(getTableCellCursor()).toBeNull();
  });
});

describe('αριθμός συνεδρίας — ο φρουρός της χαμένης πληκτρολόγησης', () => {
  it('η ΜΕΤΑΚΙΝΗΣΗ ΔΕΝ τον αυξάνει (το κελί αλλάζει ούτως ή άλλως το React key)', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c2'), 'nav');

    expect(getTableCellCursor()?.sessionId).toBe(0);
  });

  it('η ΑΚΥΡΩΣΗ γραφής τον αυξάνει και επιστρέφει σε πλοήγηση, ΣΤΟ ΙΔΙΟ κελί', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r2', 'c3'), 'enter', 'μισοτελειωμένο');
    cancelTableCellCursorSession();

    expect(getTableCellCursor()).toEqual({
      entityId: 'tbl_1',
      position: { rowId: 'r2', colId: 'c3', anchorColId: 'c3' },
      mode: 'nav',
      // Η ακύρωση πετά ΚΑΙ το πρόχειρο: «Escape» σημαίνει «ξέχνα ό,τι έγραψα».
      draft: '',
      sessionId: 1,
    });
  });

  it('δεύτερη ακύρωση σε κατάσταση πλοήγησης ΔΕΝ τον αυξάνει — δεν υπάρχει τι να ακυρωθεί', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'edit');
    cancelTableCellCursorSession();
    cancelTableCellCursorSession();

    expect(getTableCellCursor()?.sessionId).toBe(1);
  });

  it('ακύρωση χωρίς δρομέα ⇒ no-op', () => {
    cancelTableCellCursorSession();
    expect(getTableCellCursor()).toBeNull();
  });
});

describe('αλλαγή κατάστασης', () => {
  it('nav → enter (πρώτος χαρακτήρας) χωρίς να πειράξει θέση ή συνεδρία', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    setTableCellCursorMode('enter');

    expect(getTableCellCursor()).toMatchObject({ mode: 'enter', sessionId: 0 });
  });

  it('χωρίς δρομέα ⇒ no-op — ένα πλήκτρο δεν γεννά δρομέα από το πουθενά', () => {
    setTableCellCursorMode('edit');
    expect(getTableCellCursor()).toBeNull();
  });
});

describe('🔴 κάθε μεταβολή ζητά καρέ — αλλιώς ο δρομέας μένει στο προηγούμενο κελί', () => {
  it.each([
    ['τοποθέτηση', (): void => setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav')],
    ['μετακίνηση', (): void => setTableCellCursor('tbl_1', tableCursorAt('r1', 'c2'), 'nav')],
    ['αλλαγή κατάστασης', (): void => setTableCellCursorMode('enter')],
    ['ακύρωση συνεδρίας', (): void => cancelTableCellCursorSession()],
    ['κλείσιμο', (): void => closeTableCellCursor()],
  ])('%s ⇒ markSystemsDirty(dxf-canvas)', (_label, act) => {
    // Οι πράξεις τρέχουν σωρευτικά μέσα σε κάθε περίπτωση: χωρίς ενεργό δρομέα οι
    // μεταβολές είναι no-op, άρα η προϋπόθεση στήνεται πρώτη.
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'edit');
    repaints.mockClear();
    act();

    expect(repaints).toHaveBeenCalledWith(['dxf-canvas']);
  });
});

describe('συνδρομή', () => {
  it('ειδοποιεί τους συνδρομητές σε αλλαγή και σταματά μετά την αποδέσμευση', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTableCellCursor(listener);

    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c2'), 'nav');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

/**
 * 🔴 Η ΔΙΟΡΘΩΣΗ ΤΗΣ ΧΑΜΕΝΗΣ ΠΛΗΚΤΡΟΛΟΓΗΣΗΣ (μετρημένο ζωντανά, 2026-08-01)
 *
 * Το πρόχειρο ήταν `useState` μέσα στον επεξεργαστή. Probe στα συμβάντα του DOM έδειξε
 * `input value="7"` → `focusout value="7"` → και το επόμενο `Tab` να φτάνει σε `<input>`
 * με `value=""`: ο επεξεργαστής ξαναστηνόταν ανάμεσα στον χαρακτήρα και το Tab (ασύγχρονη
 * ανανέωση σκηνής), και το commit έγραφε το ΠΑΛΙΟ κείμενο — «τίποτα δεν άλλαξε».
 *
 * Με το πρόχειρο στον δρομέα, το ξαναστήσιμο είναι **αβλαβές εξ ορισμού**. Αυτό το
 * describe είναι ο φύλακας ώστε να μην ξαναγυρίσει το πρόχειρο σε τοπικό state.
 */
describe('🔴 πρόχειρο — επιβιώνει του ξαναστησίματος του επεξεργαστή', () => {
  it('η πληκτρολόγηση σε πλοήγηση ΑΝΟΙΓΕΙ συνεδρία γραφής (type-to-replace)', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    setTableCellCursorDraft('7');

    expect(getTableCellCursor()).toMatchObject({ mode: 'enter', draft: '7' });
  });

  it('η πληκτρολόγηση σε γραφή ΔΕΝ αλλάζει κατάσταση — μόνο το πρόχειρο', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'edit', 'παλιό');
    setTableCellCursorDraft('παλιό+νέο');

    expect(getTableCellCursor()).toMatchObject({ mode: 'edit', draft: 'παλιό+νέο' });
  });

  it('το πρόχειρο ζει ΕΞΩ από το component — μια νέα ανάγνωση το βρίσκει ακέραιο', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    setTableCellCursorDraft('99');
    // Αυτό ακριβώς κάνει ένα ξαναστήσιμο: νέο component, νέα ανάγνωση του store.
    expect(getTableCellCursor()?.draft).toBe('99');
  });

  it('χωρίς δρομέα ⇒ no-op', () => {
    setTableCellCursorDraft('ορφανό');
    expect(getTableCellCursor()).toBeNull();
  });

  it('η ΜΕΤΑΚΙΝΗΣΗ καθαρίζει το πρόχειρο — το νέο κελί ξεκινά άδειο (πλοήγηση)', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    setTableCellCursorDraft('γράφτηκε');
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c2'), 'nav');

    expect(getTableCellCursor()).toMatchObject({ mode: 'nav', draft: '' });
  });

  it('F2 από πλοήγηση σπέρνει το πρόχειρο με το ΔΕΣΜΕΥΜΕΝΟ κείμενο του κελιού', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'nav');
    setTableCellCursorMode('edit', 'Σκυρόδεμα');

    expect(getTableCellCursor()).toMatchObject({ mode: 'edit', draft: 'Σκυρόδεμα' });
  });

  it('F2 μεταξύ enter ⇄ edit ΔΕΝ πειράζει το πρόχειρο — αλλάζει μόνο ποιος έχει τα βέλη', () => {
    setTableCellCursor('tbl_1', tableCursorAt('r1', 'c1'), 'enter', 'μισό');
    setTableCellCursorMode('edit');

    expect(getTableCellCursor()).toMatchObject({ mode: 'edit', draft: 'μισό' });
  });
});
