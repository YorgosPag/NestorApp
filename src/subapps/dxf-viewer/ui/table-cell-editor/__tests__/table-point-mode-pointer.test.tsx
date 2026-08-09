/**
 * 🔴 ADR-754 §3 — **ΓΡΑΦΩ `=`, ΚΑΝΩ ΚΛΙΚ ΣΕ ΑΛΛΟ ΚΕΛΙ, ΚΑΙ Η ΔΙΕΥΘΥΝΣΗ ΤΟΥ ΜΠΑΙΝΕΙ ΣΤΟΝ ΤΥΠΟ.**
 *
 * ## Γιατί ο έλεγχος τρέχει τον ΖΩΝΤΑΝΟ χειριστή και όχι τις καθαρές συναρτήσεις
 * Οι δύο καθαροί πυρήνες (`resolveFormulaPointState`, `applyPointedReference`) έχουν ήδη 47
 * δικά τους tests και ήταν **πράσινοι πριν υπάρξει καμία σύνδεση με το UI** — δηλαδή πράσινοι
 * ενώ στην οθόνη δεν δούλευε τίποτα. Είναι ακριβώς το σχήμα που αυτό το έργο έχει πληρώσει
 * τρεις φορές (§26.15, §27.16 Ε6, §29.15): **το σφάλμα ζει στη συνάντηση των κομματιών**, όχι
 * μέσα τους. Άρα εδώ στήνεται ο πραγματικός ακροατής, πάνω σε πραγματική οντότητα, με
 * πραγματικό εστιασμένο `<textarea>` που φέρει το σημάδι της συνεδρίας.
 *
 * ## 🔴 Η προεπιλεγμένη ενέργεια γράφεται ΟΝΟΜΑΣΤΙΚΑ, και είναι μέρος της μέτρησης
 * Η μεταφορά εστίασης είναι η **προεπιλεγμένη ενέργεια** του `mousedown` και το jsdom δεν την
 * υλοποιεί. Ο βοηθός {@link pressOn} την εκτελεί με το χέρι — **αλλά μόνο όταν το συμβάν δεν
 * αναιρέθηκε**. Έτσι το `preventDefault` του §3.2 δεν είναι λεπτομέρεια υλοποίησης που
 * ελέγχεται με `expect`: είναι η **αιτία** που η συνεδρία επιβιώνει σε κάθε test παρακάτω.
 *
 * ## Το πλέγμα είναι 5×5, και δεν είναι διακοσμητικό
 * Ο ιδιοκτήτης ζήτησε ρητά το στιγμιότυπο με το `E4`. Σε πίνακα 3 στηλών **δεν υπάρχει στήλη
 * E**, οπότε κάθε περίπτωση θα έβγαινε `off` — όχι επειδή η λογική το αποφάσισε, αλλά επειδή
 * το κελί δεν υπήρχε. Πράσινο test που δεν δοκιμάζει τίποτα (§1.3).
 *
 * @see ui/table-cell-editor/table-point-mode-pointer.ts — η λογική που ελέγχεται
 * @see ui/table-cell-editor/__tests__/table-cell-pointer-session-survival.test.tsx — το
 *   κάτοπτρο **εκτός** υπόδειξης: εκεί το κλικ οφείλει να δεσμεύει και να μετακινεί
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  TABLE_TEST_VIEW,
  tableBandScreenPoint,
  tableCellScreenPoint,
} from './table-screen-point';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
  useTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import {
  __resetTableCellSessionFocusForTests,
  TABLE_CELL_SESSION_MARKER,
} from '../table-cell-session-focus';
import { useTableCellCaret } from '../use-table-cell-caret';
import { useTableCellPointer } from '../use-table-cell-pointer';
import type { TableCellRef } from '../../../bim/table/table-cell-range';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

interface HarnessProps {
  readonly entity: TableEntity;
  readonly onSelectTo: (cell: TableCellRef) => void;
  readonly onCommitPending: () => void;
}

/**
 * Ο ελάχιστος πιστός κόσμος: το δοχείο του καμβά με τον **πραγματικό** ακροατή, και από πάνω
 * του το πεδίο της συνεδρίας με την **πραγματική** τοποθέτηση κέρσορα.
 *
 * Το `key` και το `autoFocus` αντιγράφουν τον παραγωγικό επεξεργαστή: χωρίς τον αριθμό
 * συνεδρίας μέσα στο κλειδί, ένα ξαναστήσιμο δεν θα συνέβαινε ποτέ και ο έλεγχος θα έλεγε
 * «η εστίαση κρατήθηκε» για λάθος λόγο.
 */
function PointModeHarness(props: HarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const cursor = useTableCellCursor();

  useTableCellPointer({
    cursor,
    entity: props.entity,
    liveTable: () => props.entity,
    containerRef,
    transformRef,
    onSelectTo: props.onSelectTo,
    // ADR-739 §43/§66 — το πάτημα στη γωνία· αυτά τα harness δεν το αφορούν.
    onCornerPress: jest.fn(),
    onCommitPending: props.onCommitPending,
    onPreviewModel: () => undefined,
    onCommitModel: () => undefined,
  });

  useTableCellCaret(fieldRef, cursor?.caretIndex, cursor?.caretRevision ?? 0, cursor?.mode !== 'nav');

  return (
    <div ref={containerRef} data-testid="canvas">
      {cursor ? (
        <textarea
          key={`${cursor.entityId}:${cursor.position.rowId}:${cursor.position.colId}:${cursor.sessionId}`}
          ref={fieldRef}
          autoFocus
          value={cursor.draft}
          onChange={() => undefined}
          {...TABLE_CELL_SESSION_MARKER}
        />
      ) : null}
    </div>
  );
}

describe('🔴 ADR-754 — υπόδειξη κελιού με το ποντίκι μέσα σε τύπο', () => {
  let entity: TableEntity;
  let onSelectTo: jest.Mock;
  let onCommitPending: jest.Mock;
  let canvas: HTMLElement;

  /** Το πεδίο της συνεδρίας — υπάρχει πάντα όσο υπάρχει δρομέας. */
  function field(): HTMLTextAreaElement {
    return document.querySelector('[data-table-cell-cursor="true"]') as HTMLTextAreaElement;
  }

  /**
   * Ο χρήστης γράφει τύπο στο **A1** και αφήνει τον κέρσορα σε συγκεκριμένο χαρακτήρα.
   *
   * Ο κέρσορας μπαίνει **στο πραγματικό πεδίο**, όχι σε μεταβλητή: η υπόδειξη τον διαβάζει
   * από το `document.activeElement` τη στιγμή του συμβάντος, και ένα test που τον «δήλωνε»
   * αλλού θα δοκίμαζε άλλη διαδρομή από αυτήν που τρέχει στην οθόνη.
   */
  function writeFormula(draft: string, caretIndex = draft.length): void {
    act(() => {
      setTableCellCursor(
        entity.id,
        tableCursorAt(entity.model.rows[0].id, entity.model.columns[0].id),
        'edit',
        draft,
      );
    });
    act(() => {
      field().setSelectionRange(caretIndex, caretIndex);
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
    onSelectTo = jest.fn();
    onCommitPending = jest.fn();
    // 5 στήλες × (1 title + 1 header + 3 data) = 5×5 ⇒ το `E4` του στιγμιότυπου υπάρχει.
    entity = buildTableEntity({ x: 0, y: 0 }, { columnCount: 5, dataRowCount: 3 }, 'table-1', 'layer-0');
    const view = render(
      <PointModeHarness entity={entity} onSelectTo={onSelectTo} onCommitPending={onCommitPending} />,
    );
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetTableCellCursorStoreForTests();
    __resetTableCellSessionFocusForTests();
  });

  /**
   * Πάτημα, **και μετά η προεπιλεγμένη ενέργεια του browser** — μόνο αν δεν αναιρέθηκε.
   * Δες την κεφαλίδα: αυτή η γραμμή είναι ο λόγος που οι έλεγχοι παρακάτω μετρούν κάτι.
   */
  function pressOn(point: { readonly x: number; readonly y: number }, shiftKey = false): void {
    const event = new MouseEvent('mousedown', {
      button: 0,
      clientX: point.x,
      clientY: point.y,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      canvas.dispatchEvent(event);
    });
    if (!event.defaultPrevented) {
      act(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
    }
  }

  function dragOver(point: { readonly x: number; readonly y: number }): void {
    act(() => {
      document.dispatchEvent(
        new MouseEvent('mousemove', { buttons: 1, bubbles: true, clientX: point.x, clientY: point.y }),
      );
    });
  }

  function releaseDrag(): void {
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  }

  /** Το κελί `E4` του στιγμιότυπου: στήλη E = δείκτης 4, γραμμή 4 = δείκτης 3. */
  const E4 = () => tableCellScreenPoint(entity, 3, 4);

  describe('το αίτημα του ιδιοκτήτη, αυτούσιο', () => {
    it('🔴 `=` + κλικ στο E4 ⇒ πρόχειρο `=E4`, ο δρομέας ΔΕΝ κουνήθηκε, ΤΙΠΟΤΑ δεν δεσμεύτηκε', () => {
      writeFormula('=');
      pressOn(E4());

      expect(getTableCellCursor()?.draft).toBe('=E4');
      // 🔴 Το ουσιώδες: αν ο δρομέας μετακινηθεί, ο χρήστης χάνει το κελί που γράφει — και
      // το `setTableCellCursor` **σβήνει το πρόχειρο** περνώντας από πάνω του.
      expect(getTableCellCursor()?.position.colId).toBe(entity.model.columns[0].id);
      expect(getTableCellCursor()?.position.rowId).toBe(entity.model.rows[0].id);
      expect(onCommitPending).not.toHaveBeenCalled();
      expect(onSelectTo).not.toHaveBeenCalled();
    });

    it('🔴 η εστίαση ΜΕΝΕΙ στο πεδίο — αλλιώς ο επόμενος χαρακτήρας πάει στο πουθενά', () => {
      writeFormula('=');
      pressOn(E4());

      expect(document.activeElement).toBe(field());
    });

    it('αλυσίδα κλικ χωρίς τελεστή ⇒ ΑΝΤΙΚΑΤΑΣΤΑΣΗ, όχι συσσώρευση `=E4E3`', () => {
      writeFormula('=');
      pressOn(E4());
      pressOn(tableCellScreenPoint(entity, 2, 2));

      expect(getTableCellCursor()?.draft).toBe('=C3');
    });

    it('κλικ ΜΕΤΑ από τελεστή ⇒ ΕΙΣΑΓΩΓΗ δεύτερου τελεστέου', () => {
      writeFormula('=');
      pressOn(E4());
      // Ο χρήστης πληκτρολογεί `+` — η γραφή περνά από τον κανονικό δρόμο του πεδίου.
      writeFormula('=E4+');
      pressOn(tableCellScreenPoint(entity, 2, 2));

      expect(getTableCellCursor()?.draft).toBe('=E4+C3');
    });
  });

  describe('🔴 ο κέρσορας — η αναφορά μπαίνει ΣΤΗ ΜΕΣΗ και ο κέρσορας ακολουθεί', () => {
    it('`=|+1` + κλικ ⇒ `=E4+1` με τον κέρσορα ΜΕΤΑ την αναφορά', () => {
      // Χωρίς τοποθέτηση κέρσορα ο browser θα τον πήγαινε στο **τέλος** (`=E4+1|`), και ο
      // επόμενος χαρακτήρας θα γραφόταν έξω από τον τελεστέο που μόλις δείχτηκε.
      writeFormula('=+1', 1);
      pressOn(E4());

      expect(getTableCellCursor()?.draft).toBe('=E4+1');
      expect(getTableCellCursor()?.caretIndex).toBe(3);
      expect(field().selectionStart).toBe(3);
    });

    it('δύο υποδείξεις στο ΙΔΙΟ κελί ξαναβάζουν τον κέρσορα — η αφορμή δεν είναι η θέση', () => {
      // Ίδιο πρόχειρο, ίδιος δείκτης ⇒ το `equals` του store θα απέρριπτε την εγγραφή αν δεν
      // υπήρχε ο αύξων αριθμός (§4). Ο έλεγχος μετρά **τον αριθμό**, όχι το κείμενο.
      writeFormula('=');
      pressOn(E4());
      const first = getTableCellCursor()?.caretRevision ?? 0;
      pressOn(E4());

      expect(getTableCellCursor()?.caretRevision).toBe(first + 1);
    });
  });

  describe('🔴 ζώνες δείκτη — κλικ στο γράμμα στήλης', () => {
    it('🔴 κλικ στο «E» ⇒ ΟΛΟΚΛΗΡΗ η στήλη ως `E1:E5`, χωρίς δέσμευση και χωρίς μετακίνηση', () => {
      // Excel: `E:E`. Ο πίνακας έχει **τέλος**, άρα το φράσσουμε στις υπαρκτές γραμμές —
      // δες την κεφαλίδα του `table-point-mode-pointer` για το γιατί είναι ακριβέστερο.
      writeFormula('=');
      pressOn(tableBandScreenPoint(entity, 'column', 4));

      expect(getTableCellCursor()?.draft).toBe('=E1:E5');
      expect(getTableCellCursor()?.position.colId).toBe(entity.model.columns[0].id);
      expect(onCommitPending).not.toHaveBeenCalled();
    });

    it('κλικ στον αριθμό «4» ⇒ ΟΛΟΚΛΗΡΗ η γραμμή ως `A4:E4`', () => {
      writeFormula('=');
      pressOn(tableBandScreenPoint(entity, 'row', 3));

      expect(getTableCellCursor()?.draft).toBe('=A4:E4');
    });
  });

  describe('🔴 σύρσιμο — μία χειρονομία, ένας κύκλος ζωής (ADR-754 §5)', () => {
    it('🔴 σύρσιμο από C3 ως E5 ⇒ `=SUM(C3:E5`, χωρίς να συσσωρευτούν άκρα', () => {
      // Η βάση είναι **παγωμένη**: με ζωντανή ανάγνωση, η δεύτερη κίνηση θα έδινε
      // `=SUM(C3:C3:E5` — το ακριβές ελάττωμα που έπιασε το test της αλυσίδας (§1.3).
      writeFormula('=SUM(');
      pressOn(tableCellScreenPoint(entity, 2, 2));
      dragOver(tableCellScreenPoint(entity, 3, 3));
      dragOver(tableCellScreenPoint(entity, 4, 4));
      releaseDrag();

      expect(getTableCellCursor()?.draft).toBe('=SUM(C3:E5');
    });

    it('🔴 η ΕΠΙΛΟΓΗ του δρομέα ΔΕΝ γράφεται — η υπόδειξη δεν μαρκάρει κελιά', () => {
      // Αλλιώς θα φωτίζονταν κελιά που ο χρήστης δεν διάλεξε, και το επόμενο `Ctrl+C` θα
      // αντέγραφε άλλη περιοχή από αυτήν που δείχνει η οθόνη.
      writeFormula('=SUM(');
      pressOn(tableCellScreenPoint(entity, 2, 2));
      dragOver(tableCellScreenPoint(entity, 4, 4));
      releaseDrag();

      expect(getTableCellCursor()?.selection).toBeNull();
    });

    it('σύρσιμο που δεν βγήκε από το κελί μένει σκέτη αναφορά, χωρίς `:`', () => {
      writeFormula('=');
      pressOn(E4());
      releaseDrag();

      expect(getTableCellCursor()?.draft).toBe('=E4');
    });
  });

  describe('🔴 `Shift+κλικ` — ΕΠΕΚΤΑΣΗ της ζωντανής αναφοράς', () => {
    it('`=E4` + `Shift+κλικ` στο C3 ⇒ `=C3:E4` (η αναφορά μεγαλώνει, δεν αντικαθίσταται)', () => {
      writeFormula('=');
      pressOn(E4());
      pressOn(tableCellScreenPoint(entity, 2, 2), true);

      expect(getTableCellCursor()?.draft).toBe('=C3:E4');
    });

    it('🔴 ΧΩΡΙΣ ζωντανή αναφορά το `Shift+κλικ` γίνεται σκέτο κλικ — καμία εφεύρεση', () => {
      // Ίδια στάση με το `extendWholeAxis` (§27.16 Ε2): όταν δεν υπάρχει άγκυρα να
      // επεκταθεί, το πάτημα πέφτει στη συμπεριφορά του σκέτου κλικ.
      writeFormula('=');
      pressOn(E4(), true);

      expect(getTableCellCursor()?.draft).toBe('=E4');
    });
  });

  describe('🔴 ΟΙ ΑΡΝΗΣΕΙΣ — πότε το κλικ σημαίνει ό,τι σήμαινε πάντα', () => {
    it('🔴 πρόχειρο ΧΩΡΙΣ `=` ⇒ κανονικός δρόμος: δέσμευση + μετακίνηση δρομέα', () => {
      // Η μη-παλινδρόμηση. Ένας φρουρός που κρατά το κλικ σε **κάθε** γραφή θα έκανε τον
      // πίνακα ανώφελο: δεν θα μπορούσες πια να αλλάξεις κελί με το ποντίκι.
      writeFormula('777');
      pressOn(E4());

      expect(onCommitPending).toHaveBeenCalledTimes(1);
      expect(getTableCellCursor()?.position.colId).toBe(entity.model.columns[4].id);
    });

    it('🔴 τύπος αλλά ΚΑΝΕΝΑ εστιασμένο πεδίο ⇒ κανονικός δρόμος', () => {
      // Δομική ιδιότητα, όχι φύλακας: ο κέρσορας διαβάζεται από το εστιασμένο πεδίο, οπότε
      // «κανείς δεν γράφει» δίνει `null` και η υπόδειξη δεν μπορεί καν να ξεκινήσει.
      writeFormula('=');
      act(() => {
        field().blur();
      });
      pressOn(E4());

      expect(getTableCellCursor()?.draft).toBe('');
      expect(onCommitPending).toHaveBeenCalledTimes(1);
    });

    it('ο δρομέας ΜΕΣΑ σε μονάδα που πληκτρολογείται (`=A1|2`) ⇒ κανονικός δρόμος', () => {
      // Το κλικ δεν έχει δικαίωμα να σβήσει μισή λέξη που γράφεται ακόμη (`continuesLexeme`).
      writeFormula('=A12', 3);
      pressOn(E4());

      expect(getTableCellCursor()?.position.colId).toBe(entity.model.columns[4].id);
    });
  });
});
