/**
 * 🔴 ADR-739 §43 — **ΤΟ ΚΟΥΜΠΙ «ΕΠΙΛΟΓΗ ΟΛΩΝ»**: πού πιάνεται, και τι σχήμα έχει μέσα του.
 *
 * ## Τι φυλάει αυτή η σουίτα, και τι ΔΕΝ φυλάει
 * Φυλάει την **αναλλοίωτη ξενότητα** της γωνίας: ότι δεν τέμνεται με καμία άλλη περιοχή του
 * δείκτη. Είναι ο μόνος λόγος που η σειρά ελέγχου στο `tablePointerHitAtWorld` δεν λύνει
 * διεκδίκηση — και είναι ισχυρισμός **γεωμετρίας**, δηλαδή μπορεί να σπάσει σιωπηλά αν αύριο
 * κάποιος αλλάξει το κενό ή το πάχος ζώνης.
 *
 * **ΔΕΝ** φυλάει ότι το κλικ φτάνει στο `selectAll()` — αυτό είναι το επικίνδυνο μισό και ζει
 * στο `table-select-all-corner-click.test.tsx`, με πραγματικό `mousedown` και πραγματικό store.
 * Ένα πράσινο test εδώ πάνω σε νεκρό καλώδιο θα ήταν ακριβώς το σφάλμα που το ADR-587 §6.1
 * κατέγραψε ονομαστικά.
 *
 * @see bim/table/table-select-all-corner.ts — η κεφαλίδα με ολόκληρο το σκεπτικό
 */

import {
  isTableSelectAllCornerAtFrame,
  tableSelectAllTriangleMm,
} from '../table-select-all-corner';
import {
  tableColumnTickRectMm,
  tableIndicatorBandsMm,
  tableIndicatorCornerRectMm,
  tableIndicatorHitAtFrame,
  tableRowTickRectMm,
} from '../table-indicator-geometry';
import { tableColumnTicks, tableRowTicks } from '../table-cell-reference';
import type { TableLayout, TableRectMm } from '../table-layout-types';

const PX_PER_MM = 10;
const BANDS = tableIndicatorBandsMm(PX_PER_MM);

const COLUMNS = [
  { id: 'c1', xMm: 0, widthMm: 20 },
  { id: 'c2', xMm: 20, widthMm: 30 },
];
const ROWS = [
  { id: 'r1', yMm: 0, heightMm: 8 },
  { id: 'r2', yMm: 8, heightMm: 10 },
];

const LAYOUT = {
  columns: COLUMNS,
  rows: ROWS,
  widthMm: 50,
  heightMm: 18,
} as unknown as TableLayout;

function center(rect: TableRectMm) {
  return { u: rect.x + rect.w / 2, v: rect.y + rect.h / 2 };
}

const CORNER = tableIndicatorCornerRectMm(BANDS);

describe('isTableSelectAllCornerAtFrame', () => {
  it('🔴 το κέντρο του τετραγώνου ΕΙΝΑΙ το κουμπί', () => {
    expect(isTableSelectAllCornerAtFrame(center(CORNER), BANDS)).toBe(true);
  });

  it('και οι τέσσερις γωνίες του κουτιού μετράνε (κλειστά διαστήματα)', () => {
    const { x, y, w, h } = CORNER;
    for (const point of [
      { u: x, v: y },
      { u: x + w, v: y },
      { u: x, v: y + h },
      { u: x + w, v: y + h },
    ]) {
      expect(isTableSelectAllCornerAtFrame(point, BANDS)).toBe(true);
    }
  });

  it('μέσα στο πλέγμα ⇒ όχι (εκεί απαντά το `tableCellAtFrame`)', () => {
    expect(isTableSelectAllCornerAtFrame({ u: 20, v: 5 }, BANDS)).toBe(false);
  });

  it('πιο έξω από το κουτί, και στους δύο άξονες ⇒ όχι', () => {
    expect(isTableSelectAllCornerAtFrame({ u: CORNER.x - 0.1, v: center(CORNER).v }, BANDS)).toBe(false);
    expect(isTableSelectAllCornerAtFrame({ u: center(CORNER).u, v: CORNER.y - 0.1 }, BANDS)).toBe(false);
  });

  /**
   * 🔴 **Η ΑΝΑΛΛΟΙΩΤΗ ΤΟΥ §43**: η γωνία δεν διεκδικεί ούτε ένα pixel από τις ζώνες, και οι
   * ζώνες κανένα από τη γωνία. Αν σπάσει, η σειρά ελέγχου του `tablePointerHitAtWorld`
   * σταματά να είναι αδιάφορη — και το σύμπτωμα θα ήταν «κλικ στο `A` που μαρκάρει τα πάντα».
   */
  it('🔴 ΞΕΝΗ προς κάθε υποδιαίρεση ζώνης — και προς τις δύο κατευθύνσεις', () => {
    for (const tick of tableColumnTicks(COLUMNS, new Set())) {
      const point = center(tableColumnTickRectMm(tick, BANDS));
      expect(isTableSelectAllCornerAtFrame(point, BANDS)).toBe(false);
    }
    for (const tick of tableRowTicks(ROWS, new Set(), 0, ROWS.length)) {
      const point = center(tableRowTickRectMm(tick, BANDS));
      expect(isTableSelectAllCornerAtFrame(point, BANDS)).toBe(false);
    }
    // …και το κάτοπτρο: πάνω στη γωνία, καμία υποδιαίρεση άξονα.
    expect(tableIndicatorHitAtFrame(LAYOUT, center(CORNER), BANDS)).toBeNull();
  });
});

describe('tableSelectAllTriangleMm', () => {
  const [left, right, top] = tableSelectAllTriangleMm(BANDS);

  it('🔴 ορθή γωνία ΚΑΤΩ-ΔΕΞΙΑ (◢), όπως το Excel', () => {
    // Οι δύο κάθετες πλευρές μοιράζονται την κορυφή `right`: μία οριζόντια, μία κατακόρυφη.
    expect(left.v).toBeCloseTo(right.v);
    expect(top.u).toBeCloseTo(right.u);
    // Και η ορθή γωνία είναι η **κάτω-δεξιά** του κουτιού, όχι κάποια άλλη.
    expect(right.u).toBeGreaterThan(left.u);
    expect(right.v).toBeGreaterThan(top.v);
  });

  it('ισοσκελές — οι δύο κάθετες πλευρές είναι ίσες (μετρημένο στο Excel)', () => {
    expect(right.u - left.u).toBeCloseTo(right.v - top.v);
  });

  it('🔴 ΟΛΟΚΛΗΡΟ μέσα στο κουτί της γωνίας — καμία κορυφή δεν δραπετεύει', () => {
    for (const point of [left, right, top]) {
      expect(isTableSelectAllCornerAtFrame(point, BANDS)).toBe(true);
    }
  });

  it('αφήνει ορατή εσοχή από τις ακμές — δεν κολλά στο περίγραμμα', () => {
    const inset = CORNER.x + CORNER.w - right.u;
    expect(inset).toBeGreaterThan(0);
    // Η ίδια εσοχή και στους δύο άξονες: το κουτί είναι τετράγωνο, το τρίγωνο κεντραρισμένο.
    expect(CORNER.y + CORNER.h - right.v).toBeCloseTo(inset);
  });

  /**
   * Το κουτί ζει σε **px οθόνης** (`TABLE_INDICATOR`), άρα το τρίγωνο σε sheet-mm οφείλει να
   * μεγαλώνει όταν το `pxPerMm` μικραίνει — αλλιώς θα φαινόταν να συρρικνώνεται με το zoom,
   * δηλαδή θα έπαυε να είναι στοιχείο διεπαφής.
   */
  it('η πλευρά είναι ΣΤΑΘΕΡΗ σε px, όχι σε mm', () => {
    const coarse = tableSelectAllTriangleMm(tableIndicatorBandsMm(PX_PER_MM / 2));
    const legMm = right.u - left.u;
    const coarseLegMm = coarse[1].u - coarse[0].u;
    expect(coarseLegMm).toBeCloseTo(legMm * 2);
  });
});
