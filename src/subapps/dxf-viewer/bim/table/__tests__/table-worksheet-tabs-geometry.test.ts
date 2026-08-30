/**
 * ADR-833 Φάση 3 — **η λωρίδα καρτελών ως γεωμετρία**: πού ζωγραφίζεται, τι πιάνεται, και
 * ποιος έχει προτεραιότητα στην κάτω ακμή.
 *
 * Οι δύο άγκυρες που **δεν** είναι προφανείς, και είναι ολόκληρο το νόημα της σουίτας:
 *
 *  1. **Το χαρτί δεν μεγάλωσε.** Η λωρίδα είναι χρώμιο διεπαφής — αν έμπαινε στο
 *     `layout.heightMm`, θα άλλαζε το **τυπωμένο** αποτύπωμα. Το test το ελέγχει με
 *     **σύγκριση αριθμού** πριν/μετά, όχι με «δεν έσκασε».
 *  2. **Το ίδιο pixel δεν απαντά δύο φορές.** Η λαβή συμπλήρωσης φτάνει 7 px κάτω από την
 *     ακμή· η λωρίδα αρχίζει στα 9 px. Η ανισότητα ελέγχεται **αριθμητικά** — αν κάποιος
 *     αλλάξει την οπή, το test κοκκινίζει πριν προλάβει ο χρήστης να πατήσει λάθος πράγμα.
 */

import {
  MIN_TABLE_WORKSHEET_TAB_COUNT,
  TABLE_WORKSHEET_TAB_WIDTH_PX,
  tableWorksheetTabAtFrame,
  tableWorksheetTabCapacity,
  tableWorksheetTabLayout,
  tableWorksheetTabWindow,
  tableWorksheetTabsMm,
} from '../table-worksheet-tabs-geometry';
// 🔴 Η πηγή του κενού και του LOD — οι δύο σταθερές που η λωρίδα **καταναλώνει** αντί να τις
// ξαναγράψει. Τα tests τις ρωτούν από εκεί, ώστε μια αλλαγή τους να μη «διορθωθεί» εδώ σιωπηλά.
import { TABLE_INDICATOR_GRIP_CLEARANCE_PX } from '../table-indicator-geometry';
import {
  TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX,
  TABLE_FILL_HANDLE_PX,
  tableFillHandleRectMm,
} from '../table-fill-handle';
import { TABLE_INDICATOR } from '../../../config/color-config';
import { buildTableEntity } from '../build-table-entity';
import { computeTableEntityGeometryLive } from '../table-entity-geometry';
import { calculateTableBounds, hitTestTable } from '../table-entity-hit';
import { FIRST_TABLE_WORKSHEET_ID, tableWorksheetId } from '../../../types/table-worksheet';
import type { TableWorksheet } from '../../../types/table-worksheet';
import type { TableLayout } from '../table-layout-types';

const PX_PER_MM = 10;
const WIDTH_MM = 120;
const HEIGHT_MM = 40;

/** Ένα ελάχιστο persisted μοντέλο — τα κελιά δεν παίζουν ρόλο σε καθαρή γεωμετρία λωρίδας. */
const EMPTY_MODEL = { columns: [], rows: [], cells: [], merges: [] };

function sheets(count: number): readonly TableWorksheet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: tableWorksheetId(`ws${i}`),
    model: EMPTY_MODEL,
  }));
}

describe('ADR-833 Φ3 — μεγέθη και το κενό της κάτω ακμής', () => {
  it('το ύψος της λωρίδας είναι Η ΙΔΙΑ σταθερά με τις ζώνες δείκτη (κανένας νέος αριθμός)', () => {
    const tabs = tableWorksheetTabsMm(PX_PER_MM);
    expect(tabs.tabHeightMm * PX_PER_MM).toBeCloseTo(TABLE_INDICATOR.columnBandPx);
    expect(tabs.tabWidthMm * PX_PER_MM).toBeCloseTo(TABLE_WORKSHEET_TAB_WIDTH_PX);
  });

  it('🔴 το κενό είναι Ο ΠΕΜΠΤΟΣ ΚΑΤΑΝΑΛΩΤΗΣ του `TABLE_INDICATOR_GRIP_CLEARANCE_PX`', () => {
    expect(tableWorksheetTabsMm(PX_PER_MM).gapMm * PX_PER_MM)
      .toBeCloseTo(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });

  it('τα μεγέθη είναι σε px ΟΘΟΝΗΣ: διπλό zoom ⇒ μισά mm, ίδια px', () => {
    const zoomed = tableWorksheetTabsMm(PX_PER_MM * 2);
    expect(zoomed.tabWidthMm * (PX_PER_MM * 2)).toBeCloseTo(TABLE_WORKSHEET_TAB_WIDTH_PX);
    expect(zoomed.gapMm * (PX_PER_MM * 2)).toBeCloseTo(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });

  it('🔴 Η ΛΑΒΗ ΣΥΜΠΛΗΡΩΣΗΣ ΤΕΛΕΙΩΝΕΙ ΠΡΙΝ ΑΡΧΙΣΕΙ Η ΚΑΡΤΕΛΑ — αριθμητικά, όχι κατά σύμπτωση', () => {
    const handleOuterReachPx = TABLE_FILL_HANDLE_PX / 2 + TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX;
    expect(handleOuterReachPx).toBeLessThanOrEqual(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });
});

describe('ADR-833 Φ3 — η λωρίδα ζει ΚΑΤΩ από το πλέγμα, σε θετικό v', () => {
  const slots = tableWorksheetTabLayout(
    sheets(3),
    FIRST_TABLE_WORKSHEET_ID,
    WIDTH_MM,
    HEIGHT_MM,
    PX_PER_MM,
  );

  it('κάθε καρτέλα αρχίζει μετά το `heightMm` συν το κενό', () => {
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot.rectMm.y).toBeCloseTo(HEIGHT_MM + TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM);
    }
  });

  it('οι καρτέλες είναι συνεχόμενες από την αριστερή ακμή του πλέγματος', () => {
    slots.forEach((slot, seat) => {
      expect(slot.rectMm.x).toBeCloseTo((seat * TABLE_WORKSHEET_TAB_WIDTH_PX) / PX_PER_MM);
    });
  });

  it('🔑 το ΚΕΝΤΡΟ του ζωγραφισμένου ορθογωνίου πέφτει στην ΙΔΙΑ καρτέλα (ζωγράφος ≡ hit-test)', () => {
    for (const slot of slots) {
      const centre = {
        u: slot.rectMm.x + slot.rectMm.w / 2,
        v: slot.rectMm.y + slot.rectMm.h / 2,
      };
      expect(tableWorksheetTabAtFrame(slots, centre)?.id).toBe(slot.id);
    }
  });

  it('🔴 το κενό ΔΕΝ πιάνεται: το μισό του διαστήματος ανήκει στις λαβές', () => {
    const gapMm = TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM;
    expect(tableWorksheetTabAtFrame(slots, { u: 10, v: HEIGHT_MM + gapMm / 2 })).toBeNull();
    // Και η ίδια η ακμή του κενού: **γνήσια** ανισότητα προς το πλέγμα.
    expect(tableWorksheetTabAtFrame(slots, { u: 10, v: HEIGHT_MM + gapMm })).toBeNull();
  });

  it('μέσα στο πλέγμα και κάτω από τη λωρίδα: καμία καρτέλα', () => {
    expect(tableWorksheetTabAtFrame(slots, { u: 10, v: HEIGHT_MM / 2 })).toBeNull();
    expect(tableWorksheetTabAtFrame(slots, { u: 10, v: HEIGHT_MM + 100 })).toBeNull();
    // Δεξιά από την τελευταία καρτέλα — η λωρίδα δεν είναι όλο το πλάτος του πίνακα.
    expect(tableWorksheetTabAtFrame(slots, { u: WIDTH_MM - 1, v: slots[0].rectMm.y + 0.5 })).toBeNull();
  });
});

describe('ADR-833 Φ3 — οι τρεις πύλες: πλήθος, LOD, χωρητικότητα', () => {
  it('ένα φύλλο ⇒ καμία λωρίδα (χειριστήριο χωρίς τίποτα να ελέγξει)', () => {
    expect(MIN_TABLE_WORKSHEET_TAB_COUNT).toBe(2);
    expect(tableWorksheetTabLayout(sheets(1), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM))
      .toEqual([]);
  });

  it('🔴 κάτω από το LOD του δείκτη ⇒ καμία λωρίδα, ΑΚΟΜΗ ΚΑΙ ΟΤΑΝ ΧΩΡΑΝΕ ΚΑΡΤΕΛΕΣ', () => {
    // Ο διακρίνων είναι το **ΥΨΟΣ**, και μόνο αυτός: η χωρητικότητα ρωτά μόνο το πλάτος
    // (≥64 px), άρα καλύπτει από μόνη της κάθε στενό πίνακα — το κατώφλι των 48 px στο πλάτος
    // είναι ήδη μέσα της. Ένας πίνακας **πλατύς και χαμηλός** (200 mm × 2 mm σε 1 px/mm) περνά
    // τη χωρητικότητα με 3 καρτέλες και κόβεται **μόνο** από το LOD.
    //
    // ⚠️ Γραμμένο έτσι επειδή η πρώτη εκδοχή του (0,1 px/mm) **έμεινε πράσινη σε μετάλλαξη**
    // που έσβηνε την πύλη LOD: την έκοβε ήδη η χωρητικότητα. Ήταν σχόλιο, όχι άγκυρα.
    expect(tableWorksheetTabCapacity(200, 1)).toBeGreaterThan(0);
    expect(tableWorksheetTabLayout(sheets(3), FIRST_TABLE_WORKSHEET_ID, 200, 2, 1)).toEqual([]);
    // Και ο ίδιος πίνακας με ύψος πάνω από το κατώφλι ⇒ λωρίδα. Χωρίς αυτό, το test θα περνούσε
    // και με «επιστρέφει πάντα κενό».
    expect(tableWorksheetTabLayout(sheets(3), FIRST_TABLE_WORKSHEET_ID, 200, 60, 1)).toHaveLength(3);
  });

  it('δεν χωρά ούτε μία καρτέλα ⇒ ούτε ζωγραφίζεται ούτε πιάνεται (τα δύο ΜΑΖΙ)', () => {
    // Πίνακας 60 mm × 1 px/mm = 60 px πλάτος: περνά το LOD (≥48), δεν χωρά καρτέλα (64 px).
    expect(tableWorksheetTabCapacity(60, 1)).toBe(0);
    expect(tableWorksheetTabLayout(sheets(3), FIRST_TABLE_WORKSHEET_ID, 60, 60, 1)).toEqual([]);
  });

  it('εκφυλισμένη προβολή (μη θετικό pxPerMm) ⇒ κενό, ποτέ NaN', () => {
    expect(tableWorksheetTabCapacity(WIDTH_MM, 0)).toBe(0);
    expect(tableWorksheetTabLayout(sheets(3), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, 0))
      .toEqual([]);
  });
});

describe('ADR-833 Φ3 — το παράθυρο υπερχείλισης είναι ΠΑΡΑΓΩΓΟ', () => {
  it('όλα χωρούν ⇒ όλα ορατά, από την αρχή', () => {
    expect(tableWorksheetTabWindow(3, 0, 10)).toEqual({ start: 0, length: 3 });
  });

  it('🔑 Η ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ΕΙΝΑΙ ΠΑΝΤΑ ΟΡΑΤΗ — για κάθε θέση, σε κάθε χωρητικότητα', () => {
    for (let count = 1; count <= 20; count++) {
      for (let active = 0; active < count; active++) {
        for (let capacity = 1; capacity <= 8; capacity++) {
          const view = tableWorksheetTabWindow(count, active, capacity);
          expect(active).toBeGreaterThanOrEqual(view.start);
          expect(active).toBeLessThan(view.start + view.length);
        }
      }
    }
  });

  it('το παράθυρο μένει ΜΕΣΑ στα όρια και έχει το σωστό μήκος', () => {
    for (let count = 1; count <= 20; count++) {
      for (let active = 0; active < count; active++) {
        for (let capacity = 1; capacity <= 8; capacity++) {
          const view = tableWorksheetTabWindow(count, active, capacity);
          expect(view.length).toBe(Math.min(count, capacity));
          expect(view.start).toBeGreaterThanOrEqual(0);
          expect(view.start + view.length).toBeLessThanOrEqual(count);
        }
      }
    }
  });

  it('🔑 ΚΑΘΕ ΦΥΛΛΟ ΕΙΝΑΙ ΠΡΟΣΒΑΣΙΜΟ: πατώντας την ακριανή ορατή καρτέλα, το παράθυρο προχωρά', () => {
    const count = 12;
    const capacity = 3;
    let active = 0;
    const seen = new Set<number>([active]);
    // Περπάτημα προς τα δεξιά: κάθε φορά πατάμε τη δεξιότερη ορατή.
    for (let step = 0; step < 40 && seen.size < count; step++) {
      const view = tableWorksheetTabWindow(count, active, capacity);
      for (let i = view.start; i < view.start + view.length; i++) seen.add(i);
      const next = view.start + view.length - 1;
      if (next === active) break;
      active = next;
    }
    expect(seen.size).toBe(count);
  });

  it('υπερχείλιση: το παράθυρο κόβεται στο ΔΕΞΙ άκρο χωρίς κενές θέσεις', () => {
    expect(tableWorksheetTabWindow(10, 9, 4)).toEqual({ start: 6, length: 4 });
    expect(tableWorksheetTabWindow(10, 0, 4)).toEqual({ start: 0, length: 4 });
  });

  it('το `index` του slot είναι η θέση στο ΒΙΒΛΙΟ, όχι στη λωρίδα (τα ονόματα δεν κυλούν)', () => {
    // 3 καρτέλες χωρητικότητα (64×3 = 192 px ≤ 200 px), 8 φύλλα, ενεργό το 5ο.
    const slots = tableWorksheetTabLayout(sheets(8), tableWorksheetId('ws5'), 20, 20, 10);
    expect(slots.map((s) => s.index)).toEqual([4, 5, 6]);
    expect(slots.map((s) => s.rectMm.x)).toEqual([0, 6.4, 12.8]);
    expect(slots.find((s) => s.active)?.index).toBe(5);
  });

  it('άγνωστο `activeWorksheetId` ⇒ πέφτει στο πρώτο φύλλο (ίδια ανοχή με το `activeWorksheet`)', () => {
    const slots = tableWorksheetTabLayout(sheets(3), tableWorksheetId('wsX'), WIDTH_MM, HEIGHT_MM, PX_PER_MM);
    expect(slots.find((s) => s.active)?.index).toBe(0);
  });
});

describe('🔴 ADR-833 Φ3 — ΤΟ ΧΑΡΤΙ ΔΕΝ ΜΕΓΑΛΩΣΕ', () => {
  const entity = buildTableEntity({ x: 0, y: 0 }, {}, 'tbl_tabs', 'lyr_test');
  const multi = {
    ...entity,
    worksheets: [
      entity.worksheets[0],
      { id: tableWorksheetId('ws1'), model: entity.worksheets[0].model },
      { id: tableWorksheetId('ws2'), model: entity.worksheets[0].model },
    ],
  };

  it('`layout.heightMm` είναι ΤΑΥΤΟΣΗΜΟ με και χωρίς λωρίδα', () => {
    const one = computeTableEntityGeometryLive(entity).layout as TableLayout;
    const many = computeTableEntityGeometryLive(multi).layout as TableLayout;
    expect(many.heightMm).toBe(one.heightMm);
    expect(many.widthMm).toBe(one.widthMm);
  });

  it('`calculateTableBounds` και `bbox` ΤΑΥΤΟΣΗΜΑ', () => {
    expect(calculateTableBounds(multi)).toEqual(calculateTableBounds(entity));
    expect(computeTableEntityGeometryLive(multi).bbox)
      .toEqual(computeTableEntityGeometryLive(entity).bbox);
  });

  it('🔴 `hitTestTable` ΔΕΝ βλέπει τη λωρίδα: σημείο μέσα στην καρτέλα ⇒ έξω από τον πίνακα', () => {
    const geometry = computeTableEntityGeometryLive(multi);
    const layout = geometry.layout;
    const slots = tableWorksheetTabLayout(
      multi.worksheets,
      multi.activeWorksheetId,
      layout.widthMm,
      layout.heightMm,
      PX_PER_MM,
    );
    expect(slots.length).toBeGreaterThan(0);
    // Το κέντρο της πρώτης καρτέλας, σε συντεταγμένες κόσμου.
    const centreV = slots[0].rectMm.y + slots[0].rectMm.h / 2;
    const world = {
      x: multi.position.x + (slots[0].rectMm.x + slots[0].rectMm.w / 2) * geometry.mmToWorld,
      y: multi.position.y - centreV * geometry.mmToWorld,
    };
    expect(hitTestTable(multi, world, 0, 'mm')).toBe(false);
  });
});

describe('ADR-833 Φ3 — η λαβή συμπλήρωσης και η καρτέλα δεν τέμνονται ΠΟΤΕ', () => {
  it('🔴 επιλογή που αγγίζει την τελευταία γραμμή: η λαβή μένει ΠΑΝΩ από τη λωρίδα', () => {
    const entity = buildTableEntity({ x: 0, y: 0 }, {}, 'tbl_tabs', 'lyr_test');
    const layout = computeTableEntityGeometryLive(entity).layout;
    const handle = tableFillHandleRectMm(
      layout,
      {
        firstRow: layout.rows.length - 1,
        lastRow: layout.rows.length - 1,
        firstCol: layout.columns.length - 1,
        lastCol: layout.columns.length - 1,
      },
      PX_PER_MM,
    );
    expect(handle).not.toBeNull();

    const tabs = tableWorksheetTabsMm(PX_PER_MM);
    const stripTopMm = layout.heightMm + tabs.gapMm;
    const handleOutwardMm = TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX / PX_PER_MM;
    // Η **εξωτερική εμβέλεια** της λαβής (ορθογώνιο + οπή προς τα έξω) μένει πάνω από τη λωρίδα.
    expect(handle!.y + handle!.h + handleOutwardMm).toBeLessThanOrEqual(stripTopMm);
  });
});
