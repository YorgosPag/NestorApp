/**
 * ADR-739 Φ.Δ βήμα 9 — **η ζώνη δείκτη ως γεωμετρία**: πού ζωγραφίζεται και τι πιάνεται.
 *
 * Το ουσιώδες test αυτής της σουίτας δεν είναι κανένα από τα προφανή: είναι το
 * «το κέντρο του **ζωγραφισμένου** ορθογωνίου πέφτει στην ίδια υποδιαίρεση». Αυτό είναι που
 * κάνει το module SSoT και όχι δεύτερο αντίγραφο — αν οι δύο εκφράσεις αποκλίνουν έστω κατά
 * έναν παράγοντα, το κουτί που πατάς δεν είναι το κουτί που βλέπεις.
 */

import {
  isTableIndicatorVisible,
  tableColumnTickRectMm,
  tableIndicatorBandsMm,
  tableIndicatorCornerRectMm,
  tableIndicatorHitAtFrame,
  tableRowTickRectMm,
  TABLE_INDICATOR_GRIP_CLEARANCE_PX,
  TABLE_INDICATOR_OUTER_PX,
} from '../table-indicator-geometry';
import { tableIndicatorCursorRoleAtFrame } from '../table-indicator-cursor-role';
import { TABLE_COLUMN_KIND } from '../table-entity-grips';
import { tableColumnTicks, tableRowTicks } from '../table-cell-reference';
import { TABLE_INDICATOR } from '../../../config/color-config';
import { TOLERANCE_CONFIG } from '../../../config/tolerance-config';
// ADR-739 §27.16 Ε4 — η ΜΙΑ συνάρτηση της οπής λαβής, και η προεπιλογή που την τροφοδοτεί.
import { gripAperturePx } from '../../../config/grip-aperture';
import { GRIP_SIZE_DEFAULT } from '../../../config/grip-size-default';
import { getTableGrips } from '../table-entity-grips';
import { buildTableEntity } from '../build-table-entity';
import { computeTableEntityGeometryLive, tableWorldToFrame } from '../table-entity-geometry';
import type { TableLayout, TableRectMm } from '../table-layout-types';

const COLUMNS = [
  { id: 'c0', xMm: 0, widthMm: 40 },
  { id: 'c1', xMm: 40, widthMm: 40 },
  { id: 'c2', xMm: 80, widthMm: 40 },
];
const ROWS = [
  { id: 'r0', yMm: 0, heightMm: 12 },
  { id: 'r1', yMm: 12, heightMm: 8 },
  { id: 'r2', yMm: 20, heightMm: 8 },
];

const LAYOUT: TableLayout = {
  widthMm: 120,
  heightMm: 28,
  columns: COLUMNS,
  rows: ROWS,
  cells: [],
  borders: [],
};

/** 4 px ανά mm — ο πίνακας είναι 480×112 px, δηλαδή άνετα πάνω από το κατώφλι LOD. */
const PX_PER_MM = 4;
const BANDS = tableIndicatorBandsMm(PX_PER_MM);

const center = (rect: TableRectMm) => ({ u: rect.x + rect.w / 2, v: rect.y + rect.h / 2 });

describe('tableIndicatorBandsMm', () => {
  it('μεταφράζει τα px της διεπαφής σε sheet-mm της τρέχουσας κλίμακας', () => {
    expect(BANDS.columnBandMm).toBeCloseTo(TABLE_INDICATOR.columnBandPx / PX_PER_MM);
    expect(BANDS.rowBandMm).toBeCloseTo(TABLE_INDICATOR.rowBandPx / PX_PER_MM);
  });

  it('🔴 §27.13 ΕΝΑ πάχος, δύο ζώνες — η γωνία ένωσης είναι ΤΕΤΡΑΓΩΝΟ', () => {
    // Giorgio 2026-08-02: το ύψος της πάνω ζώνης = το πλάτος της αριστερής. Οδηγός μένει η
    // αριστερή (χωρά τετραψήφιο αριθμό γραμμής) — η πάνω απλώς τη διαβάζει, ώστε να μην
    // μπορούν ποτέ να ξαναποκλίνουν σιωπηλά.
    expect(BANDS.columnBandMm).toBeCloseTo(BANDS.rowBandMm);
    const corner = tableIndicatorCornerRectMm(BANDS);
    expect(corner.w).toBeCloseTo(corner.h);
  });

  it('🔴 §27.11 το κενό ΕΙΝΑΙ η οπή της λαβής — δεν είναι ανεξάρτητο νούμερο', () => {
    // Αν αύριο αλλάξει η οπή, το κενό ακολουθεί. Αυτό το test υπάρχει για να μη γεννηθεί
    // ποτέ δεύτερη σταθερά «κενό ζώνης» δίπλα στην πρώτη.
    // 🔴 §27.16 Ε4 — ΔΕΝ είναι πια η σταθερά `GRIP_APERTURE` (8): είναι η ΙΔΙΑ συνάρτηση που
    // ανοίγει τη ζωντανή οπή, αποτιμημένη στις προεπιλογές ⇒ **9 px**. Ήταν 8 ενώ η λαβή
    // έπιανε 9 — 1 px επικάλυψη που το §27.11 είχε καταγράψει ρητά ως εκκρεμές.
    expect(TABLE_INDICATOR_GRIP_CLEARANCE_PX).toBe(gripAperturePx({ gripSize: GRIP_SIZE_DEFAULT }));
    expect(TABLE_INDICATOR_GRIP_CLEARANCE_PX).toBeGreaterThan(TOLERANCE_CONFIG.GRIP_APERTURE);
    expect(BANDS.gapMm).toBeCloseTo(TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM);
  });

  it('το κενό συρρικνώνεται με το zoom όπως και οι ζώνες — μένει σταθερό σε px', () => {
    const zoomed = tableIndicatorBandsMm(PX_PER_MM * 10);
    expect(zoomed.gapMm * (PX_PER_MM * 10)).toBeCloseTo(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });
});

describe('🔴 §27.13 TABLE_INDICATOR_OUTER_PX — το ΕΝΑ εξωτερικό όριο', () => {
  /**
   * Γεννήθηκε από σφάλμα: η γραμμή τύπων πρόσθετε μόνη της «ζώνη + κενό» και σκέπασε τα
   * γράμματα μόλις μπήκε το κενό. Εδώ κλειδώνεται ότι το άθροισμα ζει σε **ένα** σημείο.
   */
  it('είναι ΑΚΡΙΒΩΣ κενό + ζώνη, ανά άξονα', () => {
    expect(TABLE_INDICATOR_OUTER_PX.top)
      .toBe(TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_INDICATOR.columnBandPx);
    expect(TABLE_INDICATOR_OUTER_PX.left)
      .toBe(TABLE_INDICATOR_GRIP_CLEARANCE_PX + TABLE_INDICATOR.rowBandPx);
  });

  it('🔴 συμφωνεί με το ΖΩΓΡΑΦΙΣΜΕΝΟ κουτί — αλλιώς είναι δεύτερη απάντηση', () => {
    // Η εξωτερική ακμή της ζώνης, όπως προκύπτει από τα ίδια τα ορθογώνια.
    const columnRect = tableColumnTickRectMm(tableColumnTicks(COLUMNS, new Set())[0], BANDS);
    const rowRect = tableRowTickRectMm(tableRowTicks(ROWS, new Set(), 0, ROWS.length)[0], BANDS);
    expect(-columnRect.y * PX_PER_MM).toBeCloseTo(TABLE_INDICATOR_OUTER_PX.top);
    expect(-rowRect.x * PX_PER_MM).toBeCloseTo(TABLE_INDICATOR_OUTER_PX.left);
  });
});

describe('isTableIndicatorVisible', () => {
  it('πίνακας-κουκκίδα ⇒ καμία ζώνη (το ΙΔΙΟ κατώφλι με τον ζωγράφο)', () => {
    expect(isTableIndicatorVisible(120, 28, 0.2)).toBe(false);
    expect(isTableIndicatorVisible(120, 28, PX_PER_MM)).toBe(true);
  });

  it('αρκεί ΜΙΑ διάσταση κάτω από το κατώφλι', () => {
    expect(isTableIndicatorVisible(120, 2, PX_PER_MM)).toBe(false);
  });
});

describe('tableIndicatorHitAtFrame', () => {
  it('🔴 το κέντρο του ΖΩΓΡΑΦΙΣΜΕΝΟΥ ορθογωνίου πέφτει στην ίδια στήλη', () => {
    const ticks = tableColumnTicks(COLUMNS, new Set());
    ticks.forEach((tick, index) => {
      const hit = tableIndicatorHitAtFrame(LAYOUT, center(tableColumnTickRectMm(tick, BANDS)), BANDS);
      expect(hit).toEqual({ axis: 'column', colId: COLUMNS[index].id, index });
    });
  });

  it('🔴 το ίδιο για κάθε αριθμό γραμμής', () => {
    const ticks = tableRowTicks(ROWS, new Set(), 0, ROWS.length);
    ticks.forEach((tick, index) => {
      const hit = tableIndicatorHitAtFrame(LAYOUT, center(tableRowTickRectMm(tick, BANDS)), BANDS);
      expect(hit).toEqual({ axis: 'row', rowId: ROWS[index].id, index });
    });
  });

  it('η γωνία δεν είναι εντολή — ο ζωγράφος την αφήνει κενή, το κλικ επιστρέφει null', () => {
    expect(tableIndicatorHitAtFrame(LAYOUT, center(tableIndicatorCornerRectMm(BANDS)), BANDS)).toBeNull();
  });

  it('μέσα στο πλέγμα δεν είναι ζώνη — εκεί απαντά το `tableCellAtFrame`', () => {
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 20, v: 5 }, BANDS)).toBeNull();
  });

  it('πάνω από τη ζώνη, δεξιά του πίνακα, κάτω από τον πίνακα ⇒ null', () => {
    const aboveBand = -(BANDS.gapMm + BANDS.columnBandMm) - 1;
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 20, v: aboveBand }, BANDS)).toBeNull();
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 200, v: -BANDS.gapMm - 1 }, BANDS)).toBeNull();
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: -BANDS.gapMm - 1, v: 200 }, BANDS)).toBeNull();
  });

  it('η ζώνη γραμμών δεν διεκδικεί το πλάτος της ζώνης στηλών και αντίστροφα', () => {
    // Σημείο αριστερά του πλέγματος (πέρα από το κενό), στο ύψος της πρώτης γραμμής
    // ⇒ γραμμή, όχι στήλη.
    const hit = tableIndicatorHitAtFrame(LAYOUT, { u: -BANDS.gapMm - 1, v: 6 }, BANDS);
    expect(hit).toEqual({ axis: 'row', rowId: 'r0', index: 0 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ADR-739 §27.11 — ΤΟ ΚΕΝΟ: η ζώνη δεν ακουμπά τις λαβές
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §27.11 — η ζώνη δεν διεκδικεί ούτε ένα pixel της λαβής', () => {
  /**
   * Το ουσιώδες test της αλλαγής. Δεν ρωτά «υπάρχει κενό;» (αυτό είναι σταθερά) αλλά
   * «**πιάνει** η ζώνη εκεί που πιάνει η λαβή;» — δηλαδή ακριβώς την ερώτηση που έβγαζε
   * δύο απαντήσεις για το ίδιο pixel.
   */
  // 🔴 §27.16 Ε4 — αντλείται από το SSoT του κενού, ΟΧΙ από τη σταθερά .
  // Ήταν το δεύτερο, και έδειχνε 8 px ενώ η ζωντανή οπή είναι 9: το test θα έβαφε πράσινη
  // ακριβώς την 1-px επικάλυψη που μετρά — «δύο λεξιλόγια της ίδιας ποσότητας» (§27.13).
  const apertureMm = TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM;

  it('κάθε σημείο μέσα στην οπή, πάνω από ΚΑΘΕ όριο στήλης, ΔΕΝ είναι ζώνη', () => {
    // Τα εσωτερικά όρια στηλών είναι εκεί ακριβώς όπου κάθονται οι λαβές πλάτους.
    const columnEdgesMm = COLUMNS.map((c) => c.xMm).concat(LAYOUT.widthMm / 2, 0);
    for (const u of columnEdgesMm) {
      for (const dv of [0, apertureMm / 2, apertureMm]) {
        expect(tableIndicatorHitAtFrame(LAYOUT, { u, v: -dv }, BANDS)).toBeNull();
      }
    }
  });

  it('ένα μόλις pixel έξω από την οπή, η ζώνη ξαναπιάνει κανονικά', () => {
    const justOutside = -(apertureMm + 1 / PX_PER_MM);
    const hit = tableIndicatorHitAtFrame(LAYOUT, { u: 20, v: justOutside }, BANDS);
    expect(hit).toEqual({ axis: 'column', colId: 'c0', index: 0 });
  });

  it('το ίδιο και στην αριστερή ζώνη — η λαβή MOVE κάθεται στην άγκυρα (0,0)', () => {
    for (const du of [0, apertureMm / 2, apertureMm]) {
      expect(tableIndicatorHitAtFrame(LAYOUT, { u: -du, v: 6 }, BANDS)).toBeNull();
    }
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: -(apertureMm + 1 / PX_PER_MM), v: 6 }, BANDS))
      .toEqual({ axis: 'row', rowId: 'r0', index: 0 });
  });

  it('🔴 Η ΥΠΟΘΕΣΗ ΠΟΥ ΚΡΑΤΑ ΤΑ ΠΑΝΩ: καμία λαβή δεν μπαίνει στον χώρο των ζωνών', () => {
    // Χωρίς αυτό, όλα τα προηγούμενα είναι αριθμητική γύρω από μια υπόθεση που κανείς δεν
    // ελέγχει. Αν κάποιος μετακινήσει τις λαβές του πίνακα, αυτό εδώ κοκκινίζει και δείχνει
    // ότι το κενό πρέπει να ξανασχεδιαστεί — δεν αρκεί να μεγαλώσει.
    //
    // ⚠️ Η διατύπωση **αυστηροποιήθηκε** στις 03/08, όταν ο πίνακας απέκτησε τις 8
    // περιμετρικές λαβές (ADR-739 Φ.Γ, Giorgio «οι λαβές όπως σου τις δείχνω»). Έλεγε
    // «όλες οι λαβές κάθονται στο v = 0» — που έπαψε να ισχύει: η κάτω ακμή και τα πλαϊνά
    // μέσα ζουν σε θετικό v. Η ιδιότητα που **πράγματι** προστατεύει το κενό δεν ήταν ποτέ
    // «όλες στο μηδέν» αλλά «**καμία σε αρνητικό**»: οι ζώνες ζουν αποκλειστικά εκεί
    // (`v < 0` τα γράμματα, `u < 0` οι αριθμοί) και μια λαβή σε αρνητικό u/v θα
    // ζωγραφιζόταν ΜΕΣΑ τους — το ίδιο pixel σε δύο ερωτήσεις, το ελάττωμα του §27.11.
    //
    // 🔴 Αυτή ΕΙΝΑΙ η δοκιμασία που έπρεπε να γίνει: το test κοκκίνισε, κοιτάχτηκε, και
    // αποδείχθηκε ότι το κενό ΔΕΝ χρειάζεται ξανασχεδιασμό — αλλάζει μόνο η διατύπωση.
    const entity = buildTableEntity({ x: 0, y: 0 }, {}, 'tbl_clearance', 'lyr_test');
    const { mmToWorld } = computeTableEntityGeometryLive(entity);
    const frames = getTableGrips(entity).map((g) =>
      tableWorldToFrame(entity, g.position, mmToWorld),
    );

    expect(frames.length).toBeGreaterThan(1);
    for (const { u, v } of frames) {
      expect(u).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
    }
    // Και οι λαβές που **είναι** πάνω στην πάνω ακμή εξακολουθούν να υπάρχουν — αλλιώς ο
    // βρόχος από πάνω θα ήταν αληθής και για πίνακα χωρίς καμία λαβή στη ζώνη κινδύνου.
    expect(frames.filter(({ v }) => Math.abs(v) < 1e-9).length).toBeGreaterThan(1);
  });

  it('🔴 ΤΟ ΖΩΓΡΑΦΙΣΜΕΝΟ κουτί αρχίζει ΕΞΩ από την οπή — όχι μόνο το hit-test', () => {
    // Χωρίς αυτό, το κενό θα ήταν αόρατο: το μάτι θα έβλεπε ακόμα τη ζώνη κολλητά στη
    // λαβή και θα στόχευε λάθος, ακόμα κι αν το κλικ απαντούσε σωστά.
    const columnRect = tableColumnTickRectMm(tableColumnTicks(COLUMNS, new Set())[0], BANDS);
    const rowRect = tableRowTickRectMm(tableRowTicks(ROWS, new Set(), 0, ROWS.length)[0], BANDS);
    const cornerRect = tableIndicatorCornerRectMm(BANDS);

    expect(columnRect.y + columnRect.h).toBeCloseTo(-apertureMm);
    expect(rowRect.x + rowRect.w).toBeCloseTo(-apertureMm);
    // Η γωνία ευθυγραμμίζεται και με τις δύο ζώνες — αλλιώς φαίνεται σκαλοπάτι.
    expect(cornerRect.x + cornerRect.w).toBeCloseTo(rowRect.x + rowRect.w);
    expect(cornerRect.y + cornerRect.h).toBeCloseTo(columnRect.y + columnRect.h);
  });
});

describe('🔴 §31 tableIndicatorCursorRoleAtFrame — ο δείκτης δεν επιτρέπεται να ΨΕΥΔΕΤΑΙ', () => {
  const apertureMm = TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM;
  const role = (u: number, v: number) => tableIndicatorCursorRoleAtFrame(LAYOUT, { u, v }, BANDS);

  /**
   * 🔴 ΤΟ ΟΥΣΙΩΔΕΣ TEST ΤΟΥ §31.
   *
   * Όλα τα υπόλοιπα είναι αριθμητική γύρω από μια υπόθεση· **αυτό** είναι η υπόθεση. Ο δείκτης
   * υπόσχεται «εδώ σέρνεις» — αν η υπόσχεση δεν πέφτει πάνω στη ζωντανή λαβή, η διεπαφή λέει
   * ψέματα και ο χρήστης το διαβάζει ως **σφάλμα της εφαρμογής**, όχι ως δικό του αστόχημα.
   * Τρέχει τις **πραγματικές** λαβές, όχι στημένους αριθμούς.
   */
  it('🔴 ΚΑΘΕ ζωντανή λαβή ορίου στήλης ανακοινώνεται ως `column-resize`', () => {
    const entity = buildTableEntity({ x: 0, y: 0 }, {}, 'tbl_cursor', 'lyr_test');
    const { mmToWorld, layout } = computeTableEntityGeometryLive(entity);
    const edges = getTableGrips(entity).filter((g) => g.gripKind?.kind === TABLE_COLUMN_KIND);

    // Αν ο πίνακας πάψει να έχει λαβές ορίου, το test από κάτω θα ήταν κενός βρόχος = πράσινο.
    expect(edges.length).toBeGreaterThan(0);
    for (const grip of edges) {
      const frame = tableWorldToFrame(entity, grip.position, mmToWorld);
      expect(tableIndicatorCursorRoleAtFrame(layout, frame, BANDS)).toBe('column-resize');
    }
  });

  it('η υπόσχεση σβήνει ακριβώς εκεί που σταματά να πιάνεται η λαβή', () => {
    // Μέσα στην οπή (κλειστός δίσκος) ⇒ ναι· ένα pixel έξω ⇒ όχι πια σύρσιμο.
    expect(role(40, 0)).toBe('column-resize');
    expect(role(40, apertureMm)).toBe('column-resize');
    expect(role(40 + apertureMm, 0)).toBe('column-resize');
    expect(role(40, apertureMm + 1 / PX_PER_MM)).not.toBe('column-resize');
    expect(role(40 + apertureMm + 1 / PX_PER_MM, 0)).not.toBe('column-resize');
  });

  it('🔴 §31.9 ΤΟ ΔΙΑΧΩΡΙΣΤΙΚΟ ΠΙΑΝΕΤΑΙ ΣΕ ΟΛΟ ΤΟ ΥΨΟΣ ΤΗΣ ΛΩΡΙΔΑΣ — εκεί το ψάχνει το χέρι', () => {
    // 🔴 Αυτό το test ΑΝΤΙΣΤΡΕΦΕΙ την προηγούμενη προδιαγραφή, και η αντιστροφή είναι το θέμα:
    // η πρώτη εκδοχή έδινε `col-resize` ΜΟΝΟ πάνω στη λαβή (`v ≈ 0`), με σωστό επιχείρημα
    // («μέσα στη λωρίδα το πάτημα επιλέγει στήλη») και **ανεύρετο** αποτέλεσμα — ο ιδιοκτήτης
    // δεν το βρήκε δύο φορές. Η λύση δεν ήταν να κρυφτεί ο δείκτης, αλλά να **πάψει να είναι
    // ψέμα**: η ζώνη επιλογής παραιτείται εδώ και τη σύρση την αναλαμβάνει ο πίνακας (§31.9).
    const topOfBand = -(apertureMm + BANDS.columnBandMm);
    for (const v of [topOfBand, topOfBand + BANDS.columnBandMm / 2, -apertureMm, 0, apertureMm]) {
      expect(role(40, v)).toBe('column-resize');
    }
    // Πάνω από την κορυφή της λωρίδας και βαθιά μέσα στο πλέγμα: τέλος.
    expect(role(40, topOfBand - 1 / PX_PER_MM)).not.toBe('column-resize');
    expect(role(40, apertureMm + 1 / PX_PER_MM)).not.toBe('column-resize');
  });

  it('🔴 ΤΟ ΣΩΜΑ του γράμματος παραμένει επιλογή — το διαχωριστικό δεν κατάπιε τη λωρίδα', () => {
    // Ο αντίποδας του προηγούμενου: αν η ζώνη ανοχής ήταν πολύ πλατιά, η επιλογή στήλης θα
    // γινόταν απλησίαστη. Στο **μέσο** κάθε στήλης η απάντηση πρέπει να μένει «επιλογή».
    const insideBand = -(apertureMm + BANDS.columnBandMm / 2);
    for (const column of COLUMNS) {
      expect(role(column.xMm + column.widthMm / 2, insideBand)).toBe('column-select');
    }
  });

  it('🔴 §31.9 ΕΝΑ pixel, ΜΙΑ ερώτηση: όπου υπόσχεται σύρσιμο, η ζώνη ΠΑΡΑΙΤΕΙΤΑΙ', () => {
    // Η αρχή του §27.11 εφαρμοσμένη στη νέα ζώνη. Χωρίς αυτό, μια σύρση διαχωριστικού θα
    // άφηνε πίσω της ΚΑΙ επιλεγμένη στήλη — δύο αποτελέσματα από μία χειρονομία.
    const insideBand = -(apertureMm + BANDS.columnBandMm / 2);
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 40, v: insideBand }, BANDS)).toBeNull();
    // Και το συμπλήρωμα: μακριά από το όριο η ζώνη απαντά κανονικά.
    expect(tableIndicatorHitAtFrame(LAYOUT, { u: 20, v: insideBand }, BANDS))
      .toEqual({ axis: 'column', colId: 'c0', index: 0 });
  });

  it('🔴 η λωρίδα των αριθμών: ΜΕΣΑ στη γραμμή επιλογή, ΠΑΝΩ στο όριο σύρσιμο ύψους', () => {
    // ⚠️ ΑΥΤΟ ΤΟ TEST ΕΛΕΓΕ ΤΟ ΑΝΤΙΘΕΤΟ («δεν υπόσχεται ΠΟΤΕ σύρσιμο — δεν υπάρχει λαβή
    // ύψους»), και ήταν σωστό τότε: δείκτης «⇕» χωρίς λαβή από πίσω θα υποσχόταν ενέργεια που
    // δεν εκτελείται. Ο Giorgio ζήτησε τις λαβές ύψους (2026-08-04), το `table-entity-grips`
    // τις έχει, άρα ο δείκτης **έπαψε να ψεύδεται** — δεν χαλάρωσε ο κανόνας, ικανοποιήθηκε
    // η προϋπόθεσή του. Ο ίδιος ο κανόνας ελέγχεται τώρα ΠΙΟ αυστηρά, γιατί ξεχωρίζει τα δύο.
    const insideBand = -(apertureMm + BANDS.rowBandMm / 2);

    // ΜΕΣΑ στο σώμα της γραμμής (μακριά από τα όρια) ⇒ επιλογή, όπως πάντα.
    for (const row of ROWS) {
      expect(role(insideBand, row.yMm + row.heightMm / 2)).toBe('row-select');
    }

    // ΠΑΝΩ ΑΚΡΙΒΩΣ στα **εσωτερικά** όρια ⇒ σύρσιμο ύψους. Το πρώτο (`ROWS[0].yMm` = η πάνω
    // ακμή του πίνακα) ΔΕΝ είναι εσωτερικό όριο — δεν έχει λαβή, άρα μένει επιλογή.
    expect(role(insideBand, ROWS[0].yMm)).toBe('row-select');
    for (const row of ROWS.slice(1)) {
      expect(role(insideBand, row.yMm)).toBe('row-resize');
    }
  });

  it('η άγκυρα και το δεξί πέρας ΔΕΝ είναι όρια στηλών — δεν έχουν λαβή, άρα ούτε υπόσχεση', () => {
    // Το `getTableGrips` ξεκινά από `c = 1`: το αριστερό όριο το κινεί το MOVE και το δεξί
    // **προκύπτει** από τα πλάτη. Αν ο δείκτης τα ανακοίνωνε, θα υποσχόταν δύο ανύπαρκτες λαβές.
    //
    // ⚠️ §36 — η αξίωση είναι «**δεν** υπόσχεται σύρσιμο πλάτους», όχι «δεν υπόσχεται τίποτα».
    // Εδώ έγραφε `toBeNull()`, που ήταν αληθές **κατά σύμπτωση**: τότε το εσωτερικό του
    // πλέγματος δεν είχε κανέναν ρόλο. Τώρα έχει (`cell-select`), και η διατύπωση ακριβώς
    // αυτού που το test **εννοούσε** το κάνει ανθεκτικό στην επόμενη επέκταση.
    expect(role(0, 0)).not.toBe('column-resize');
    expect(role(LAYOUT.widthMm, 0)).not.toBe('column-resize');
  });

  it('🔴 §36 ΜΕΣΑ ΣΤΟ ΠΛΕΓΜΑ Ο ΔΕΙΚΤΗΣ ΕΙΝΑΙ ΣΤΑΥΡΟΣ ΚΕΛΙΟΥ — η προδιαγραφή ΑΝΤΙΣΤΡΑΦΗΚΕ', () => {
    // 🔴 ΑΥΤΟ ΤΟ TEST ΕΛΕΓΕ ΤΟ ΑΝΤΙΘΕΤΟ, ΚΑΙ ΗΤΑΝ ΣΩΣΤΟ ΤΟΤΕ. Ο τίτλος του ήταν «μέσα στο
    // πλέγμα […] ⇒ κανένας ρόλος (μένει το σταυρόνημα)» — η ρητή απόφαση του §31, όπου ο
    // δείκτης αφορούσε **μόνο** τις λωρίδες και το εσωτερικό ανήκε στο σχεδιαστικό σταυρόνημα.
    //
    // Ο ιδιοκτήτης το άλλαξε (§36): «*στο Excel, μέσα σε κελί ο κέρσορας γίνεται σταυρός*».
    // Δεν είναι διόρθωση σφάλματος — είναι **νέα εντολή**, και καταγράφεται ως τέτοια ώστε
    // κανείς να μη νομίσει αργότερα ότι το παλιό ήταν παράλειψη.
    expect(role(20, 6)).toBe('cell-select');
  });

  it('§36 το ΕΞΩ από το πλέγμα μένει ακέραιο — η γωνία και ο έξω χώρος δεν απέκτησαν ρόλο', () => {
    // Ο αντίποδας του προηγούμενου, και ο φύλακας του §27.11: το `cell-select` **δεν**
    // επιτρέπεται να διαρρεύσει σε αρνητικά mm, όπου ζουν οι ζώνες και οι λαβές.
    expect(role(-(apertureMm + BANDS.rowBandMm / 2), -(apertureMm + BANDS.columnBandMm / 2)))
      .toBeNull();
    expect(role(LAYOUT.widthMm + 10, -(apertureMm + BANDS.columnBandMm / 2))).toBeNull();
    // Και καθαρά δεξιά/κάτω από το πλέγμα, μακριά από κάθε ζώνη.
    expect(role(LAYOUT.widthMm + 10, 6)).toBeNull();
    expect(role(20, LAYOUT.heightMm + 10)).toBeNull();
  });

  it('🔴 συμφωνεί με το §30: όπου φωτίζεται υποδιαίρεση, υπάρχει και ρόλος επιλογής', () => {
    // Τα δύο κανάλια γράφονται από τον ΙΔΙΟ ακροατή με μία σάρωση· αν αποκλίνουν, ο χρήστης
    // βλέπει φωτισμένο γράμμα με σταυρόνημα από πάνω (ή το αντίστροφο) — δηλαδή τη μισή
    // απάντηση. Η ζώνη της λαβής εξαιρείται: εκεί δεν φωτίζεται τίποτα, και σωστά.
    for (const rect of [
      tableColumnTickRectMm(tableColumnTicks(COLUMNS, new Set())[1], BANDS),
      tableRowTickRectMm(tableRowTicks(ROWS, new Set(), 0, ROWS.length)[1], BANDS),
    ]) {
      const point = center(rect);
      expect(tableIndicatorHitAtFrame(LAYOUT, point, BANDS)).not.toBeNull();
      expect(tableIndicatorCursorRoleAtFrame(LAYOUT, point, BANDS)).not.toBeNull();
    }
  });
});
