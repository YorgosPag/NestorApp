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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { selectWholeTable, selectWholeTableFromCorner } from '../table-select-all-action';
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
    // 🔑 **Η ΙΔΙΑ γραμμή με την παραγωγή** — δες το σχόλιο μέσα στον χειριστή.
    //
    // 🔴 §66 — το πάτημα στη γωνία **οπλίζει και τη μετακίνηση**. Εδώ δεν στήνεται, επίτηδες:
    // αυτό το αρχείο φυλάει ότι το κλικ φτάνει στην **επιλογή**, και η μετακίνηση έχει το δικό
    // της δίχτυ (`table-move-drag`). Ένα harness που έκανε και τα δύο θα άφηνε ασαφές ποιο από
    // τα δύο έσπασε όταν κοκκινίσει.
    onCornerPress: () => {
      // 🔴 §68.9 — **η ίδια γραμμή με την παραγωγή**: το `onCornerPress` του
      // `useTableCellDoubleClickEditor` καλεί ακριβώς αυτό. Ήταν `selectWholeTable` όσο η γωνία
      // κληρονομούσε τον κανόνα του `Ctrl+A`· δες την κεφαλίδα του γραφέα.
      selectWholeTableFromCorner(entity);
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
   * 🔴 **§68.9 (20/08) — Η ΑΓΚΥΡΑ ΑΝΤΙΣΤΡΑΦΗΚΕ: Η ΜΕΤΡΗΣΗ ΗΤΑΝ ΤΟΥ ΛΑΘΟΥΣ ΧΕΙΡΟΝΟΜΙΑΣ.**
   *
   * Έλεγε «*το ΕΝΕΡΓΟ ΚΕΛΙ δεν μετακινείται (Excel: το Name Box μένει στο A9)*», επικαλούμενη
   * μέτρηση της 04/08. Η μέτρηση ήταν **σωστή** — αλλά αφορούσε το **`Ctrl+A`**, και μετά
   * γενικεύτηκε στο πάτημα επειδή οι δύο πόρτες μοιράζονταν γραφέα. Ο ιδιοκτήτης το μέτρησε
   * ξανά στο Excel (20/08, δύο στιγμιότυπα): το πάτημα στο τετραγωνάκι αφήνει το πλαίσιο
   * ονόματος στο **`A1`**.
   *
   * 🔑 Και η απόδειξη ήταν ήδη **μέσα στο σύστημα**: ο διπλανός κλάδος του ίδιου `mousedown`
   * (`selectWholeAxis`) μετακινεί το ενεργό κελί στην αρχή του άξονα, με γραμμένη αιτιολογία
   * «όπως στο Excel». Η γωνία είναι η ίδια κλάση χειρονομίας — απλώς στα δύο άκρα μαζί.
   */
  it('🔴 §68.9 το ΕΝΕΡΓΟ ΚΕΛΙ πάει στο A1 (Excel: το Name Box γράφει A1)', () => {
    // `beforeEach`: ενεργό το κελί (γραμμή 3, στήλη B) — ρητά **όχι** το A1.
    expect(getTableCellCursor()?.position.rowId).not.toBe(entity.model.rows[0].id);

    pressAt(tableIndicatorCornerScreenPoint(entity));

    const position = getTableCellCursor()?.position;
    expect(position?.rowId).toBe(entity.model.rows[0].id);
    expect(position?.colId).toBe(entity.model.columns[0].id);
  });

  /**
   * 🔴 **Η ΑΛΛΗ ΜΙΣΗ ΠΡΟΔΙΑΓΡΑΦΗ, ΚΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΟΙ ΔΥΟ ΓΡΑΦΕΙΣ ΕΙΝΑΙ ΔΥΟ.**
   *
   * Η μέτρηση της 04/08 **δεν ακυρώθηκε** — μετακόμισε εκεί που ισχύει. Το `Ctrl+A` εξακολουθεί
   * να επιλέγει χωρίς να πλοηγεί, και αυτό το φυλάει το `table-select-all-action.test.ts`. Αν
   * κάποιος «απλοποιήσει» τους δύο γραφείς σε έναν, **ένα από τα δύο** θα σπάσει σιωπηλά.
   */
  it('🔴 §68.9 η ΕΝΤΟΛΗ (Ctrl+A) δεν ακολουθεί: ο γραφέας της αφήνει το ενεργό κελί ήσυχο', () => {
    const before = getTableCellCursor()?.position;

    selectWholeTable(resolveTableModel(entity.model));

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
   * 🔴 §68.9 — **τα δύο πλήκτρα δεν επιτρέπεται να διαφωνήσουν πάνω στο ίδιο κουμπί.** Το δεξί
   * περνά από τον **ίδιο** γραφέα χειρονομίας με το αριστερό, άρα το ενεργό κελί πάει κι εδώ
   * στο `A1`. Μια διαφορά εδώ θα σήμαινε ότι το ίδιο pixel κάνει δύο πράγματα ανάλογα με το
   * πλήκτρο — ακριβώς η ασυμφωνία που το §68 ήρθε να καταργήσει.
   */
  it('🔴 §68.9 δεξί κλικ στη γωνία ⇒ το ενεργό κελί πάει ΚΙ ΕΔΩ στο A1', () => {
    pressAt(tableIndicatorCornerScreenPoint(entity), 2);

    const position = getTableCellCursor()?.position;
    expect(position?.rowId).toBe(entity.model.rows[0].id);
    expect(position?.colId).toBe(entity.model.columns[0].id);
  });
});

/**
 * 🔴 ADR-739 §68.9 — **Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ: ΠΟΙΟΣ ΦΥΛΑΕΙ ΤΟΝ ΠΑΡΑΓΩΓΙΚΟ `onCornerPress`;**
 *
 * ## Γιατί υπάρχει: μια μετάλλαξη ΕΠΕΖΗΣΕ
 * Ο harness από πάνω δηλώνει **δικό του** `onCornerPress` — αναγκαστικά, γιατί ο παραγωγικός ζει
 * μέσα στο `useTableCellDoubleClickEditor`, που θέλει `LevelManager`, δίαυλο εντολών και σκηνή.
 * Το σχόλιό του λέει «*η ΙΔΙΑ γραμμή με την παραγωγή*», δηλαδή **σύμβαση που πρέπει να θυμάται
 * κανείς**. Μετρήθηκε (20/08) ότι δεν φυλάσσεται: αποσυνδέοντας τον παραγωγικό χειριστή, **και
 * τα 28** tests των τριών σουιτών έμειναν **πράσινα**.
 *
 * Είναι ακριβώς το «νεκρό καλώδιο» που η κεφαλίδα αυτού του αρχείου υπάρχει για να κυνηγά —
 * ένα επίπεδο πιο πάνω από εκεί που κοίταζε.
 *
 * ## ⚠️ ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ, ΡΗΤΑ
 * Είναι **στατική** άγκυρα: διαβάζει την πηγή, δεν εκτελεί τον χειριστή. Δεν αποδεικνύει ότι ο
 * χειριστής **καλείται** — αυτό το κάνουν τα tests χειρονομίας από πάνω, μέσω του harness.
 * Αποδεικνύει ότι **ποιον γραφέα ονομάζει** ο παραγωγικός κώδικας, που είναι ακριβώς το σημείο
 * όπου η σύμβαση του harness μπορεί να αποκλίνει σιωπηλά.
 *
 * Η εναλλακτική —πλήρες στήσιμο του `useTableCellDoubleClickEditor`— θα δοκίμαζε δέκα άσχετα
 * πράγματα για να απαντήσει ένα, και θα κοκκίνιζε για λόγους που δεν αφορούν τη γωνία.
 */
describe('🔴 §68.9 ο ΠΑΡΑΓΩΓΙΚΟΣ χειριστής της γωνίας δείχνει στον γραφέα ΧΕΙΡΟΝΟΜΙΑΣ', () => {
  /** Το σώμα του `onCornerPress`, από την πραγματική πηγή — ποτέ αντίγραφο. */
  function cornerPressBody(): string {
    const source = readFileSync(
      join(__dirname, '..', 'useTableCellDoubleClickEditor.ts'),
      'utf8',
    );
    const start = source.indexOf('const onCornerPress = useEventCallback(');
    // Το κενό ⇒ σκάει ρητά: ένα «δεν βρέθηκε» που γίνεται κενή συμβολοσειρά θα περνούσε κάθε
    // έλεγχο «δεν περιέχει…» — πράσινο που σημαίνει «δεν κοίταξα».
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf(`
  });`, start);
    expect(end).toBeGreaterThan(start);
    // 🔴 **ΧΩΡΙΣ ΣΧΟΛΙΑ.** Ο χειριστής τεκμηριώνει ρητά ποιον γραφέα **δεν** καλεί πια, οπότε η
    // λέξη `selectAll` υπάρχει εκεί ως **ιστορία**. Χωρίς αυτή τη γραμμή η άγκυρα θα κοκκίνιζε
    // πάνω στο ίδιο το σχόλιο που εξηγεί τη διόρθωση — δηλαδή θα απαγόρευε την τεκμηρίωση.
    // Ίδιο μάθημα με το `Κ7β` του CHECK 3.50: σχόλιο που περιγράφει παλιό λεξιλόγιο δεν
    // μετριέται ως ζωντανό.
    return source
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');
  }

  it('🔴 καλεί το `selectWholeTableFromCorner` — τη ΧΕΙΡΟΝΟΜΙΑ', () => {
    expect(cornerPressBody()).toContain('selectWholeTableFromCorner(liveEntity)');
  });

  /**
   * 🔴 **Ο δεύτερος μισός κανόνας.** Μέχρι το §68.9 ο χειριστής καλούσε `rangeActions.selectAll()`
   * — τον γραφέα της **εντολής** (`Ctrl+A`), που επιλέγει χωρίς να πλοηγεί. Αυτό ήταν όλο το
   * ελάττωμα. Μια επιστροφή εκεί δεν θα φαινόταν σε κανένα test συμπεριφοράς του harness.
   */
  it('🔴 ΔΕΝ καλεί το `selectAll` της εντολής (εκεί ζούσε το ελάττωμα)', () => {
    expect(cornerPressBody()).not.toContain('selectAll');
  });
});
