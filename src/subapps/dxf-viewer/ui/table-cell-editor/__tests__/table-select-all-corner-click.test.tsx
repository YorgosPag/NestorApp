/**
 * 🔴 ADR-739 §43 — **ΤΟ ΚΛΙΚ ΣΤΗ ΓΩΝΙΑ ΦΤΑΝΕΙ ΟΝΤΩΣ ΣΤΗΝ ΕΠΙΛΟΓΗ.**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο και δεν αρκούν τα anchors γεωμετρίας
 * Το `table-select-all-corner.test.ts` αποδεικνύει ότι το hit-test **απαντά** στη γωνία. Αυτό
 * είναι το ασφαλές μισό — και είναι ακριβώς ο τύπος πράσινου test που μπορεί να κάθεται πάνω
 * σε **νεκρό καλώδιο**: ένα `where: 'select-all-corner'` που κανείς δεν δρομολογεί, ή ένας
 * `onSelectAll` που κάποιος συνέδεσε σε no-op, θα άφηναν κάθε test γεωμετρίας πράσινο ενώ ο
 * χρήστης πατά και δεν γίνεται τίποτα. Αυτό ακριβώς ήταν το ελάττωμα που γέννησε το §43.
 *
 * Εδώ λοιπόν τρέχει η **ολόκληρη αλυσίδα**: πραγματικό `mousedown` σε pixel οθόνης →
 * `tablePointerHitAtWorld` → `use-table-cell-pointer` → `selectWholeTable` → **πραγματικό
 * store**. Η επαλήθευση γίνεται στο store, όχι στον χειριστή: ένα `toHaveBeenCalled()` πάνω σε
 * mock θα ξαναπερνούσε ακόμα κι αν η επιλογή που γράφεται ήταν λάθος.
 *
 * ⚠️ Το `onSelectAll` του harness είναι **η ίδια γραμμή** που εκτελεί η παραγωγή
 * (`useTableRangeActions.selectAll`), όχι δεύτερη υλοποίηση — δες το σχόλιό του.
 *
 * @see bim/table/table-select-all-corner.ts — η γεωμετρία του κουμπιού
 * @see ui/table-cell-editor/table-select-all-action.ts — ο ΕΝΑΣ γραφέας
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  TABLE_TEST_VIEW,
  tableBandScreenPoint,
  tableCellScreenPoint,
  tableIndicatorCornerScreenPoint,
} from './table-screen-point';
import { tableCursorAt } from '../../../bim/table/table-cell-navigation';
import {
  __resetTableCellCursorStoreForTests,
  getTableCellCursor,
  setTableCellCursor,
  useTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import { useTableCellPointer } from '../use-table-cell-pointer';
import { selectWholeTable } from '../table-select-all-action';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import {
  isTableWholeGridRange,
  resolveTableSelectionBounds,
} from '../../../bim/table/table-cell-range';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

const { transform: TRANSFORM, viewport: VIEWPORT } = TABLE_TEST_VIEW;

function CornerHarness({ entity }: { readonly entity: TableEntity }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);
  const cursor = useTableCellCursor();

  useTableCellPointer({
    cursor,
    entity,
    containerRef,
    transformRef,
    onSelectTo: jest.fn(),
    // 🔑 **Η ΙΔΙΑ γραμμή με την παραγωγή.** Το `useTableRangeActions.selectAll` κάνει ακριβώς
    // αυτό (μετά τον φύλακα «υπάρχει δρομέας;», που εδώ ισχύει εξ ορισμού). Δεν είναι δεύτερη
    // υλοποίηση: ο ΕΝΑΣ γραφέας είναι το `selectWholeTable` και τον καλούν και οι δύο.
    //
    // 🔴 §66 — το πάτημα στη γωνία **οπλίζει και τη μετακίνηση**. Εδώ δεν στήνεται, επίτηδες:
    // αυτό το αρχείο φυλάει ότι το κλικ φτάνει στην **επιλογή**, και η μετακίνηση έχει το δικό
    // της δίχτυ (`table-move-drag`). Ένα harness που έκανε και τα δύο θα άφηνε ασαφές ποιο από
    // τα δύο έσπασε όταν κοκκινίσει.
    onCornerPress: () => {
      selectWholeTable(resolveTableModel(entity.model));
    },
    onCommitPending: jest.fn(),
  });

  return <div ref={containerRef} data-testid="canvas" />;
}

/** Τα όρια της τρέχουσας επιλογής, όπως τα διαβάζει ο ζωγράφος — ποτέ ωμό `selection`. */
function currentBounds(entity: TableEntity) {
  const selection = getTableCellCursor()?.selection;
  return selection ? resolveTableSelectionBounds(resolveTableModel(entity.model), selection) : null;
}

describe('🔴 ADR-739 §43 — το τετραγωνάκι της γωνίας επιλέγει ΟΛΟΚΛΗΡΟ τον πίνακα', () => {
  let entity: TableEntity;
  let canvas: HTMLElement;

  beforeEach(() => {
    __resetTableCellCursorStoreForTests();
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
    // Ο χρήστης είναι ήδη **μέσα** στον πίνακα, με ενεργό κελί που **δεν** είναι το A1 —
    // αυτό είναι η μισή προδιαγραφή (δες το test του ενεργού κελιού παρακάτω).
    setTableCellCursor(
      entity.id,
      tableCursorAt(entity.model.rows[2].id, entity.model.columns[1].id),
      'nav',
    );
    const view = render(<CornerHarness entity={entity} />);
    canvas = view.getByTestId('canvas');
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: VIEWPORT.width, height: VIEWPORT.height }) as DOMRect;
  });

  function pressAt(point: { x: number; y: number }, button = 0): void {
    act(() => {
      canvas.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          button,
          clientX: point.x,
          clientY: point.y,
        }),
      );
    });
  }

  it('🔴 ΤΟ ΚΑΛΩΔΙΟ ΕΙΝΑΙ ΖΩΝΤΑΝΟ: αριστερό κλικ ⇒ η επιλογή καλύπτει όλο το πλέγμα', () => {
    expect(getTableCellCursor()?.selection).toBeFalsy();

    pressAt(tableIndicatorCornerScreenPoint(entity));

    const bounds = currentBounds(entity);
    expect(bounds).not.toBeNull();
    expect(isTableWholeGridRange(resolveTableModel(entity.model), bounds!)).toBe(true);
  });

  /**
   * 🔴 Η **μισή προδιαγραφή**, μετρημένη στο Excel (04/08): με ενεργό το `A9`, μετά την
   * «επιλογή όλων» το πλαίσιο ονόματος εξακολουθεί να γράφει **`A9`**. Το `Ctrl+A` επιλέγει,
   * δεν πλοηγεί — και η γωνία είναι η ίδια εντολή, άρα οφείλει την ίδια συμπεριφορά.
   */
  it('🔴 το ΕΝΕΡΓΟ ΚΕΛΙ δεν μετακινείται (Excel: το Name Box μένει στο A9)', () => {
    const before = getTableCellCursor()?.position;

    pressAt(tableIndicatorCornerScreenPoint(entity));

    expect(getTableCellCursor()?.position).toEqual(before);
  });

  it('η επιλογή είναι ΠΕΡΙΟΧΗ — κανένα τέταρτο είδος «όλα»', () => {
    pressAt(tableIndicatorCornerScreenPoint(entity));
    expect(getTableCellCursor()?.selection?.kind).toBe('range');
  });

  /**
   * Ο δείκτης δεν επιτρέπεται να ψεύδεται (§31), αλλά ούτε το κουμπί να διεκδικεί ξένα pixel:
   * το γράμμα στήλης δίπλα του πρέπει να συνεχίσει να επιλέγει **μία** στήλη.
   */
  it('🔴 δεν κλέβει τα διπλανά pixel: κλικ στο γράμμα στήλης ⇒ ΜΙΑ στήλη, όχι όλα', () => {
    pressAt(tableBandScreenPoint(entity, 'column', 1));

    const bounds = currentBounds(entity);
    expect(bounds).not.toBeNull();
    expect(isTableWholeGridRange(resolveTableModel(entity.model), bounds!)).toBe(false);
  });

  it('κλικ μέσα σε κελί ⇒ καμία «επιλογή όλων» (ο κλάδος του κελιού μένει ανέπαφος)', () => {
    pressAt(tableCellScreenPoint(entity, 1, 1));

    const bounds = currentBounds(entity);
    if (bounds) {
      expect(isTableWholeGridRange(resolveTableModel(entity.model), bounds)).toBe(false);
    }
  });

  /**
   * 🔴 **§68 (20/08) — Η ΑΓΚΥΡΑ ΑΝΤΙΣΤΡΑΦΗΚΕ, ΚΑΙ ΕΙΝΑΙ ΤΩΡΑ ΙΣΧΥΡΟΤΕΡΗ.**
   *
   * Έλεγε «*ΑΥΤΟΣ ο ακροατής δεν γράφει επιλογή*», με σωστό τότε επιχείρημα: την έγραφε ο
   * δρομολογητής του `contextmenu`, και μια δεύτερη γραφή εδώ θα ήταν **διπλή**. Το §68
   * μετακίνησε τη γραφή **εδώ** και άφησε τη θύρα του μενού να **διαβάζει** — ώστε και οι τρεις
   * διαδρομές δεξιού κλικ (κελί · ζώνη · γωνία) να γράφουν στο ίδιο στρώμα. Ο κίνδυνος της
   * διπλής γραφής δεν χαλάρωσε· **έπαψε να υπάρχει**, γιατί ο γραφέας έμεινε ένας.
   *
   * ⚠️ Ισχυρότερη επειδή ελέγχει **παραγωγικό** κώδικα: το `onCornerPress` του harness τρέχει
   * μόνο στο αριστερό πλήκτρο, άρα ό,τι μετριέται εδώ το έγραψε το ίδιο το
   * `installTableCornerMenuSelection` μέσα στο hook — όχι το στήσιμο του test.
   */
  it('🔴 §68 δεξί κλικ στη γωνία ⇒ Ο ΙΔΙΟΣ ο ακροατής μαρκάρει ΟΛΟ το πλέγμα (Excel parity)', () => {
    pressAt(tableIndicatorCornerScreenPoint(entity), 2);

    const bounds = currentBounds(entity);
    expect(bounds).not.toBeNull();
    expect(isTableWholeGridRange(resolveTableModel(entity.model), bounds!)).toBe(true);
  });

  /**
   * 🔴 §43 — **η μισή προδιαγραφή ισχύει και για το δεξί**: η «επιλογή όλων» δεν πλοηγεί. Το
   * ενεργό κελί μένει εκεί που ήταν (`beforeEach`: γραμμή 3, στήλη B), όπως ακριβώς μετρήθηκε
   * στο Excel για το `Ctrl+A`. Χωρίς αυτό, η γωνία θα ήταν η μόνη διαδρομή που μετακινεί
   * **και** το ενεργό κελί, δηλαδή θα διαφωνούσε με το ίδιο της το πλήκτρο.
   */
  it('🔴 §68 δεξί κλικ στη γωνία ⇒ το ενεργό κελί ΔΕΝ μετακινείται', () => {
    const before = getTableCellCursor()?.position;
    pressAt(tableIndicatorCornerScreenPoint(entity), 2);
    expect(getTableCellCursor()?.position).toEqual(before);
  });
});
