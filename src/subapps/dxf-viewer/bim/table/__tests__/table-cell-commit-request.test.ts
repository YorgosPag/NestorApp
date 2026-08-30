/**
 * 🔴 ADR-763 Φ2.4.1 — **ΤΟ «OK» ΕΙΝΑΙ `Enter`: δεσμεύει ΚΑΙ βγαίνει από τη γραφή.**
 *
 * Το ελάττωμα που το γέννησε (Giorgio 06/08): «κλείνει το παράθυρο διαλόγου αλλά το κελί D3
 * παραμένει σε edit mode· η Excel βγαίνει». Ο διάλογος έκανε `restartTableCellCursorSession()`
 * — που είναι το **αντίθετο**: ξαναστήνει το `<textarea autoFocus>`.
 *
 * Τα δύο πράγματα που ελέγχονται εδώ σπάνε **σιωπηλά**:
 *  1. **η σειρά** — αν το κλείσιμο προηγηθεί, το πρόχειρο έχει ήδη σβηστεί και το «OK»
 *     **αδειάζει** το κελί που μόλις γέμισε·
 *  2. **η ιδεμποτία** — ο εξυπηρετητής είναι `useEffect`· χωρίς μνήμη του τι εξυπηρέτησε, ένα
 *     ξαναστήσιμο θα δέσμευε δεύτερη φορά, δηλαδή **δεύτερο βήμα αναίρεσης για μία ενέργεια**.
 *
 * @see ui/table-cell-editor/use-table-cell-commit-request.ts
 */

import { renderHook } from '@testing-library/react';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  requestTableCellCursorCommit,
  setTableCellCursor,
  setTableCellCursorDraftAt,
} from '../../../state/table-cell-cursor-store';
import { useTableCellCommitRequest } from '../../../ui/table-cell-editor/use-table-cell-commit-request';
import { setTableCellCursorById } from './make-table-entity';

const POSITION = { rowIndex: 2, columnIndex: 3, anchorColumnIndex: 3 };

/**
 * Στήνει τον εξυπηρετητή πάνω σε **ζωντανό** δρομέα, ξαναδιαβασμένο σε κάθε render — όπως
 * ακριβώς τον δίνει το `useTableCellCursor()` στον πραγματικό οδηγό.
 */
function mountServer(committed: string[]) {
  return renderHook(() =>
    useTableCellCommitRequest(getTableCellCursor(), (text) => { committed.push(text); }),
  );
}

beforeEach(() => {
  __resetTableCellCursorStoreForTests();
});

describe('«Δέσμευσε και βγες» — η σειρά ΕΙΝΑΙ το συμβόλαιο', () => {
  it('🔴 δεσμεύει το ΠΡΟΧΕΙΡΟ και μετά κλείνει τη γραφή', () => {
    const committed: string[] = [];
    setTableCellCursorById('table-1', POSITION, 'edit', '=SUM(D1;D2)', 11);
    const view = mountServer(committed);

    requestTableCellCursorCommit();
    view.rerender();

    // Αν το κλείσιμο προηγούνταν, εδώ θα ήταν `''` — δηλαδή το «OK» θα άδειαζε το κελί.
    expect(committed).toEqual(['=SUM(D1;D2)']);
  });

  it('🔴 το κελί ΒΓΑΙΝΕΙ από τη γραφή, στο ίδιο κελί', () => {
    setTableCellCursorById('table-1', POSITION, 'edit', '=SUM(D1;D2)', 11);
    const view = mountServer([]);

    requestTableCellCursorCommit();
    view.rerender();

    const cursor = getTableCellCursor();
    expect(cursor?.mode).toBe('nav');
    expect(cursor?.draft).toBe('');
    // Ο δρομέας μένει εκεί που ήταν — το «OK» δεν είναι πλοήγηση.
    expect(cursor?.position).toEqual(POSITION);
  });

  it('νέο `sessionId` ⇒ το `<textarea>` ξεφορτώνεται πραγματικά', () => {
    setTableCellCursorById('table-1', POSITION, 'edit', '=SUM(D1)', 8);
    const before = getTableCellCursor()?.sessionId ?? 0;
    const view = mountServer([]);

    requestTableCellCursorCommit();
    view.rerender();

    expect(getTableCellCursor()?.sessionId).toBe(before + 1);
  });
});

describe('Η ΙΔΕΜΠΟΤΙΑ — ένα «OK», ένα βήμα αναίρεσης', () => {
  it('🔴 ένα αίτημα ⇒ ΜΙΑ δέσμευση, όσα render κι αν ακολουθήσουν', () => {
    const committed: string[] = [];
    setTableCellCursorById('table-1', POSITION, 'edit', '=SUM(D1)', 8);
    const view = mountServer(committed);

    requestTableCellCursorCommit();
    view.rerender();
    view.rerender();
    view.rerender();

    expect(committed).toHaveLength(1);
  });

  it('🔴 δρομέας που ΚΟΥΒΑΛΑ αίτημα προηγούμενης συνεδρίας ΔΕΝ ξαναδεσμεύεται στο μοντάρισμα', () => {
    const first: string[] = [];
    setTableCellCursorById('table-1', POSITION, 'edit', '=SUM(D1)', 8);
    const served = mountServer(first);
    requestTableCellCursorCommit();
    served.rerender();
    served.unmount();
    expect(first).toHaveLength(1);

    // Ο μετρητής **δεν** μηδενίζεται (αύξων για όλη τη ζωή του store). Ένας νέος
    // εξυπηρετητής —ξαναστήσιμο πίνακα, αλλαγή ορόφου— θα έβλεπε τιμή > 0 και, με αφετηρία
    // `0`, θα δέσμευε κελί που **κανείς δεν ζήτησε**.
    setTableCellCursorById('table-1', POSITION, 'edit', 'Σκυρόδεμα C20/25', 16);
    const second: string[] = [];
    const fresh = mountServer(second);
    fresh.rerender();
    expect(second).toEqual([]);
    expect(getTableCellCursor()?.mode).toBe('edit');
  });
});

describe('ΟΙ ΑΡΝΗΣΕΙΣ — αίτημα που κανείς δεν θα εξυπηρετούσε δεν γεννιέται', () => {
  it('σε πλοήγηση δεν γράφεται αίτημα', () => {
    setTableCellCursorById('table-1', POSITION, 'nav');
    const before = getTableCellCursor();
    requestTableCellCursorCommit();
    expect(getTableCellCursor()).toEqual(before);
  });

  it('χωρίς δρομέα είναι no-op', () => {
    expect(() => requestTableCellCursorCommit()).not.toThrow();
    expect(getTableCellCursor()).toBeNull();
  });

  it('η ζωντανή εγγραφή του διαλόγου ΔΕΝ πυροδοτεί δέσμευση', () => {
    const committed: string[] = [];
    setTableCellCursorById('table-1', POSITION, 'edit', '=SUM()', 5);
    const view = mountServer(committed);

    // Κάθε πληκτρολόγηση/υπόδειξη γράφει πρόχειρο — καμία δεν είναι «OK».
    setTableCellCursorDraftAt('=SUM(D1)', 8);
    view.rerender();
    setTableCellCursorDraftAt('=SUM(D1;D2)', 11);
    view.rerender();

    expect(committed).toEqual([]);
    expect(getTableCellCursor()?.mode).toBe('edit');
  });
});
