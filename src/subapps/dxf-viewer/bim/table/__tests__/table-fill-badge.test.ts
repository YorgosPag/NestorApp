/**
 * 🔴 ADR-828 **Φ4α** — **ΤΟ ΚΟΥΜΠΙ «ΕΠΙΛΟΓΕΣ ΑΥΤΟΜΑΤΗΣ ΣΥΜΠΛΗΡΩΣΗΣ»**: πού κάθεται, τι πιάνει,
 * και πότε παύει να είναι αληθινό.
 *
 * ## 🔴 ΤΟ ΚΥΡΙΟ ΠΡΑΓΜΑ ΠΟΥ ΚΛΕΙΔΩΝΕΙ ΕΔΩ — Η ΓΩΝΙΑ ΠΟΥ ΤΗ ΔΙΕΚΔΙΚΟΥΝ ΔΥΟ
 * Μετά τη συμπλήρωση, μαρκαρισμένη μένει **ολόκληρη** η γεμισμένη περιοχή (Excel parity), άρα η
 * **λαβή** κάθεται στην ίδια κάτω δεξιά κορυφή που διεκδικεί το **κουμπί**. Η λαβή φτάνει 7 px
 * πιο έξω από την κορυφή (`table-fill-handle.ts` §13.8) και ο έλεγχος του κουμπιού τρέχει
 * **πριν** από τον δικό της. ⇒ **Κάθε pixel που κλέβει το κουμπί είναι pixel όπου η συμπλήρωση
 * σταματά να πιάνεται** — δηλαδή το κουμπί θα έσπαγε ακριβώς την πράξη που το γέννησε.
 *
 * Το φράγμα δοκιμάζεται **δύο φορές, με δύο ανεξάρτητα όργανα**, και αυτό είναι σκόπιμο:
 *  1. ως **ανισότητα σταθερών** — λέει *γιατί* είναι σωστό·
 *  2. ως **εκτελεσμένη σάρωση** κατά μήκος της επίμαχης γραμμής — λέει ότι *όντως ισχύει*.
 *
 * Ένας αριθμός που συμφωνεί με τον εαυτό του δεν είναι απόδειξη. Το ίδιο μάθημα που τεκμηριώνει
 * ήδη το `table-screen-point.ts`: το δεύτερο αντίγραφο της αριθμητικής είναι ακριβώς εκείνο που
 * περνά κάθε test και ψεύδεται στην οθόνη.
 *
 * ⚠️ Πλέγμα **5×5** και διάταξη γραμμένη με το χέρι, όπως κάθε test αυτής της οικογένειας.
 *
 * @see bim/table/table-fill-badge.ts — το υπό δοκιμή
 * @see bim/table/__tests__/table-fill-handle.test.ts — ο γείτονας, ίδιο πλέγμα, ίδιοι αριθμοί
 */

import {
  isOnTableFillBadge,
  resolveTableFillBadgeBounds,
  tableFillBadgeHitAtFrame,
  tableFillBadgeRectMm,
  TABLE_FILL_BADGE_GAP_PX,
  TABLE_FILL_BADGE_PX,
  TABLE_FILL_HANDLE_OUTWARD_REACH_PX,
} from '../table-fill-badge';
import { isOnTableFillHandle, tableFillHandleRectMm } from '../table-fill-handle';
import { tableIndicatorCursorRoleAtFrame } from '../table-indicator-cursor-role';
import { tableIndicatorBandsMm } from '../table-indicator-geometry';
import type { TableCellRangeBounds } from '../table-cell-range';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableLayout } from '../table-layout-types';
import type { TableCellCursorState } from '../../../state/table-cell-cursor-store';
import type { TableFillBadgeState } from '../../../state/table-fill-badge-store';
import type { TableEntity } from '../../../types/table-entity';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

/** Ίδια διάταξη με τον γείτονα: στήλες 20 mm, γραμμές 8 mm — καμία αριθμητική στο μάτι. */
const LAYOUT: TableLayout = {
  widthMm: 100,
  heightMm: 40,
  columns: COLUMNS.map((column, i) => ({ id: column.id, xMm: i * 20, widthMm: 20 })),
  rows: ROWS.map((row, i) => ({ id: row.id, yMm: i * 8, heightMm: 8 })),
  cells: [],
  borders: [],
};
const PX_PER_MM = 2;

const rect = (firstRow: number, lastRow: number, firstCol: number, lastCol: number) =>
  ({ firstRow, lastRow, firstCol, lastCol }) as TableCellRangeBounds;

/** Το A1 μόνο του. Η κάτω δεξιά κορυφή του είναι στο (20, 8) — η επίμαχη γωνία. */
const FILLED = rect(0, 0, 0, 0);
const CORNER = { u: 20, v: 8 };

describe('🔴 ADR-828 Φ4α — πού κάθεται το κουμπί', () => {
  it('κάτω από την κάτω δεξιά κορυφή, με το κενό της ασφαλείας', () => {
    const badge = tableFillBadgeRectMm(LAYOUT, FILLED, PX_PER_MM)!;
    const sideMm = TABLE_FILL_BADGE_PX / PX_PER_MM;
    const gapMm = TABLE_FILL_BADGE_GAP_PX / PX_PER_MM;
    expect(badge).toEqual({ x: CORNER.u, y: CORNER.v + gapMm, w: sideMm, h: sideMm });
  });

  /**
   * Απλώνεται προς τα **δεξιά**, στο κενό — ποτέ αριστερά, πάνω από τα κελιά που μόλις
   * γέμισαν: εκεί ο άνθρωπος κοιτά για να αποφασίσει αν άλλαξε γνώμη.
   */
  it('δεν σκεπάζει ΠΟΤΕ τη γεμισμένη περιοχή', () => {
    const badge = tableFillBadgeRectMm(LAYOUT, rect(0, 2, 0, 2), PX_PER_MM)!;
    // Η περιοχή A1:C3 τελειώνει στο (60, 24). Το κουμπί ξεκινά εκεί και πάει δεξιά/κάτω.
    expect(badge.x).toBeCloseTo(60);
    expect(badge.y).toBeGreaterThan(24);
  });

  it('ακολουθεί τη ΓΕΜΙΣΜΕΝΗ περιοχή, όχι την πηγή', () => {
    const small = tableFillBadgeRectMm(LAYOUT, FILLED, PX_PER_MM)!;
    const big = tableFillBadgeRectMm(LAYOUT, rect(0, 3, 0, 0), PX_PER_MM)!;
    expect(big.y).toBeCloseTo(small.y + 24);
  });

  it('σιωπά όταν η περιοχή δεν τέμνει τη διάταξη (μπαγιάτικα όρια μετά από undo)', () => {
    expect(tableFillBadgeRectMm(LAYOUT, rect(90, 95, 90, 95), PX_PER_MM)).toBeNull();
    expect(tableFillBadgeHitAtFrame(LAYOUT, CORNER, PX_PER_MM, null)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴🔴 ΤΟ ΦΡΑΓΜΑ: ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΚΛΕΒΕΙ ΟΥΤΕ ΕΝΑ PIXEL ΑΠΟ ΤΗ ΛΑΒΗ
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴🔴 Φ4α — η γωνία που τη διεκδικούν δύο', () => {
  const HANDLE = tableFillHandleRectMm(LAYOUT, FILLED, PX_PER_MM)!;
  const BADGE = tableFillBadgeRectMm(LAYOUT, FILLED, PX_PER_MM)!;
  const onHandle = (u: number, v: number) => isOnTableFillHandle({ u, v }, HANDLE, PX_PER_MM);
  const onBadge = (u: number, v: number) => isOnTableFillBadge({ u, v }, BADGE);

  /**
   * ΟΡΓΑΝΟ 1 — η **ανισότητα**. Γνησίως μεγαλύτερο, ποτέ ίσο: το όριο της
   * `isOnTableFillHandle` είναι **κλειστό** (`<=`), οπότε στην ισότητα η γραμμή `v = 7 px`
   * θα ανήκε **και στα δύο** — και ο έλεγχος του κουμπιού, που τρέχει πρώτος, θα την έπαιρνε.
   */
  it('🔑 ΟΡΓΑΝΟ 1: το κενό ξεπερνά ΓΝΗΣΙΩΣ την εξωτερική εμβέλεια της λαβής', () => {
    expect(TABLE_FILL_HANDLE_OUTWARD_REACH_PX).toBe(7);
    expect(TABLE_FILL_BADGE_GAP_PX).toBeGreaterThan(TABLE_FILL_HANDLE_OUTWARD_REACH_PX);
  });

  /**
   * ΟΡΓΑΝΟ 2 — **εκτελεσμένη σάρωση**. Κατεβαίνει κατά μήκος της κατακόρυφης γραμμής της
   * κορυφής, δηλαδή ακριβώς εκεί όπου τα δύο χειριστήρια θα συναντιόνταν, και απαιτεί ότι
   * **κανένα σημείο δεν ανήκει και στα δύο**. Αυτό είναι το ουσιώδες: η ανισότητα από πάνω
   * μπορεί να μείνει αληθής ενώ κάποιος αλλάζει το **σχήμα** μιας από τις δύο ζώνες.
   */
  it('🔑🔑 ΟΡΓΑΝΟ 2: ΚΑΝΕΝΑ σημείο της γωνίας δεν ανήκει και στα δύο', () => {
    const overlaps: number[] = [];
    for (let step = 0; step <= 400; step++) {
      const v = CORNER.v - 2 + step * 0.02;
      if (onHandle(CORNER.u, v) && onBadge(CORNER.u, v)) overlaps.push(v);
    }
    expect(overlaps).toEqual([]);
  });

  it('🔴 η λαβή κρατά ΟΛΟΚΛΗΡΗ την οπή της — το κουμπί αρχίζει πιο κάτω', () => {
    const reachMm = TABLE_FILL_HANDLE_OUTWARD_REACH_PX / PX_PER_MM;
    // Το εξώτατο pixel της λαβής ανήκει ακόμη στη λαβή, και σε τίποτα άλλο.
    expect(onHandle(CORNER.u, CORNER.v + reachMm)).toBe(true);
    expect(onBadge(CORNER.u, CORNER.v + reachMm)).toBe(false);
    // Και η κορυφή του κουμπιού δεν ανήκει στη λαβή.
    expect(onHandle(BADGE.x, BADGE.y)).toBe(false);
    expect(onBadge(BADGE.x, BADGE.y)).toBe(true);
  });

  /**
   * 🔴 **Ο ΔΕΙΚΤΗΣ ΔΕΝ ΨΕΥΔΕΤΑΙ** (ADR-739 §31): η ίδια σειρά που τρέχει το πάτημα
   * (`use-table-cell-pointer`: κουμπί πριν από λαβή) οφείλει να ισχύει και εδώ. Δύο
   * διαφορετικές σειρές θα σήμαιναν pixel όπου ο δείκτης υπόσχεται μενού και το κλικ σέρνει.
   */
  it('🔴 ο ρόλος δείκτη συμφωνεί με το πάτημα, στα ΙΔΙΑ σημεία', () => {
    const bands = tableIndicatorBandsMm(PX_PER_MM);
    const roleAt = (u: number, v: number, filled: TableCellRangeBounds | null) =>
      tableIndicatorCursorRoleAtFrame(
        LAYOUT,
        { u, v },
        bands,
        null,
        undefined,
        null,
        'table-mode',
        null,
        // Η λαβή απαντά για την ίδια περιοχή — έτσι τα δύο διεκδικούν πραγματικά.
        { rectMm: HANDLE },
        tableFillBadgeHitAtFrame(LAYOUT, { u, v }, PX_PER_MM, filled),
      );

    // Πάνω στο κουμπί: το κουμπί κερδίζει, παρότι η λαβή απαντά κι εκείνη.
    expect(roleAt(BADGE.x + BADGE.w / 2, BADGE.y + BADGE.h / 2, FILLED)).toBe('fill-badge');
    // Χωρίς κουμπί (καμία συμπλήρωση σε ισχύ) το ίδιο σημείο επιστρέφει στη λαβή.
    expect(roleAt(BADGE.x + BADGE.w / 2, BADGE.y + BADGE.h / 2, null)).toBe('fill-handle');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 Η ΚΡΙΣΗ: ΕΙΝΑΙ ΤΟ ΚΟΥΜΠΙ ΑΚΟΜΗ ΑΛΗΘΙΝΟ;
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 Φ4α — οι τρεις σιωπές της κρίσης', () => {
  const MODEL = { marker: 'v1' } as unknown as TableEntity['model'];
  const OTHER_MODEL = { marker: 'v2' } as unknown as TableEntity['model'];

  const entity = (model: TableEntity['model'] = MODEL) =>
    ({ id: 'table-1', model }) as TableEntity;

  const cursorOn = (entityId: string, mode: TableCellCursorState['mode'] = 'nav') =>
    ({ entityId, mode }) as TableCellCursorState;

  const badge = (entityId = 'table-1', modelRef = MODEL): TableFillBadgeState =>
    ({
      entityId,
      source: FILLED,
      target: { bounds: rect(1, 1, 0, 0), direction: 'down' },
      filled: rect(0, 1, 0, 0),
      modelRef,
    });

  it('ζωντανό: ίδιος πίνακας, πλοήγηση, φρέσκια σφραγίδα', () => {
    expect(resolveTableFillBadgeBounds(entity(), cursorOn('table-1'), badge()))
      .toEqual(rect(0, 1, 0, 0));
  });

  it('σιωπή #1 — το κουμπί ανήκει σε ΑΛΛΟΝ πίνακα', () => {
    expect(resolveTableFillBadgeBounds(entity(), cursorOn('table-1'), badge('table-2'))).toBeNull();
  });

  it('σιωπή #2 — ο άνθρωπος ΓΡΑΦΕΙ (ίδιος φρουρός με τη λαβή, §13.5)', () => {
    expect(resolveTableFillBadgeBounds(entity(), cursorOn('table-1', 'edit'), badge())).toBeNull();
    expect(resolveTableFillBadgeBounds(entity(), cursorOn('table-1', 'enter'), badge())).toBeNull();
  });

  it('σιωπή #2β — κανένας δρομέας, ή δρομέας σε άλλον πίνακα', () => {
    expect(resolveTableFillBadgeBounds(entity(), null, badge())).toBeNull();
    expect(resolveTableFillBadgeBounds(entity(), cursorOn('table-9'), badge())).toBeNull();
  });

  /**
   * 🔑 **Η σιωπή που αντικαθιστά τέσσερις ακυρωτές.** «Επόμενη αναιρέσιμη πράξη», «Undo» και
   * «πληκτρολόγησες και δέσμευσες» είναι **το ίδιο γεγονός**: το μοντέλο δεν είναι πια αυτό
   * που ήταν. Μία σύγκριση δείκτη, καμία γραμμή σε καμία διαδρομή εγγραφής.
   */
  it('🔑 σιωπή #3 — ΜΠΑΓΙΑΤΙΚΗ ΣΦΡΑΓΙΔΑ ΕΚΔΟΣΗΣ: κάτι άλλαξε μετά τη συμπλήρωση', () => {
    expect(resolveTableFillBadgeBounds(entity(OTHER_MODEL), cursorOn('table-1'), badge()))
      .toBeNull();
  });

  it('κανένα κουμπί καθόλου', () => {
    expect(resolveTableFillBadgeBounds(entity(), cursorOn('table-1'), null)).toBeNull();
  });
});
