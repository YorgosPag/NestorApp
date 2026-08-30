/**
 * ADR-833 Φάσεις 3+4 — **η λωρίδα φύλλων ως γεωμετρία**: πού ζωγραφίζεται, τι πιάνεται, ποιος
 * έχει προτεραιότητα στην κάτω ακμή, και **πού κάθεται το ⊕** της προσθήκης.
 *
 * Οι δύο άγκυρες που **δεν** είναι προφανείς, και είναι ολόκληρο το νόημα της σουίτας:
 *
 *  1. **Το χαρτί δεν μεγάλωσε.** Η λωρίδα είναι χρώμιο διεπαφής — αν έμπαινε στο
 *     `layout.heightMm`, θα άλλαζε το **τυπωμένο** αποτύπωμα. Το test το ελέγχει με
 *     **σύγκριση αριθμού** πριν/μετά, όχι με «δεν έσκασε».
 *  2. **Το ίδιο pixel δεν απαντά δύο φορές.** Η λαβή συμπλήρωσης φτάνει 7 px κάτω από την
 *     ακμή· η λωρίδα αρχίζει στα 9 px. Η ανισότητα ελέγχεται **αριθμητικά** — αν κάποιος
 *     αλλάξει την οπή, το test κοκκινίζει πριν προλάβει ο χρήστης να πατήσει λάθος πράγμα.
 *
 * 🔴 **Φάση 4**: το ⊕ **πληρώνεται από την ίδια χωρητικότητα** — άρα κάθε αναλλοίωτη του
 * παραθύρου ξαναμετριέται με τις θέσεις που **περισσεύουν**, όχι με τις ονομαστικές.
 */

// 🔑 **ΜΟΝΟ Η ΔΗΜΟΣΙΑ ΕΙΣΟΔΟΣ.** Τα εσωτερικά (χωρητικότητα, παράθυρο, μεγέθη σε mm) είναι
// ιδιωτικά επίτηδες — δες την αντίστοιχη σημείωση στο module. Και οι τρεις είσοδοι του
// παραθύρου είναι ήδη ορίσματα εδώ: **πλήθος** = τα φύλλα, **ενεργός** = το `activeWorksheetId`,
// **χωρητικότητα** = `widthMm × pxPerMm`. Άρα τίποτα δεν χάνεται σε κάλυψη, και κάθε αναλλοίωτη
// ελέγχεται στην αλυσίδα που τρέχει πραγματικά.
import {
  TABLE_WORKSHEET_TAB_LABEL_PADDING_PX,
  tableWorksheetStripAtFrame,
  tableWorksheetTabStrip,
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

/** Οι καρτέλες μόνο — η συχνότερη ερώτηση των αγκυρών της Φάσης 3. */
function tabsOf(
  count: number,
  activeId = FIRST_TABLE_WORKSHEET_ID,
  widthMm = WIDTH_MM,
  heightMm = HEIGHT_MM,
  pxPerMm = PX_PER_MM,
) {
  return tableWorksheetTabStrip(sheets(count), activeId, widthMm, heightMm, pxPerMm).tabs;
}

/**
 * Το πλάτος καρτέλας **και** του ⊕ σε px, **μετρημένα από τη διάταξη** αντί για εισαγόμενες
 * σταθερές.
 *
 * Δεν είναι φορμαλισμός: μια εισαγόμενη σταθερά θα έκανε τα tests να συμφωνούν με τον **αριθμό**
 * και όχι με τη **συμπεριφορά** — δηλαδή θα έμεναν πράσινα ακόμη κι αν η διάταξη έπαυε να τον
 * χρησιμοποιεί. Εδώ ρωτιέται ό,τι ζωγραφίζεται.
 */
let measured: { tab: number; add: number } | null = null;
function widths(): { tab: number; add: number } {
  if (!measured) {
    const strip = tableWorksheetTabStrip(sheets(2), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM);
    measured = { tab: strip.tabs[0].rectMm.w * PX_PER_MM, add: strip.add!.w * PX_PER_MM };
  }
  return measured;
}
const tabWidthPx = () => widths().tab;

/**
 * Πίνακας φτιαγμένος ώστε να περισσεύουν **ακριβώς** `seats` θέσεις καρτέλας **μετά** το ⊕.
 *
 * 🔴 Το «μετά το ⊕» είναι η αλλαγή της Φάσης 4 και δεν είναι λεπτομέρεια του δείγματος: το
 * κουμπί πληρώνεται από την **ίδια** χωρητικότητα, οπότε κάθε αναλλοίωτη του παραθύρου πρέπει
 * να μετρηθεί με τις θέσεις που πραγματικά μένουν.
 */
function stripForSeats(count: number, activeIndex: number, seats: number) {
  return tableWorksheetTabStrip(
    sheets(count),
    tableWorksheetId(`ws${activeIndex}`),
    seats * tabWidthPx() + widths().add,
    60,
    1,
  );
}

describe('ADR-833 Φ3 — μεγέθη και το κενό της κάτω ακμής', () => {
  it('το ύψος της λωρίδας είναι Η ΙΔΙΑ σταθερά με τις ζώνες δείκτη (κανένας νέος αριθμός)', () => {
    const [tab] = tabsOf(2);
    expect(tab.rectMm.h * PX_PER_MM).toBeCloseTo(TABLE_INDICATOR.columnBandPx);
  });

  it('🔴 το κενό είναι Ο ΠΕΜΠΤΟΣ ΚΑΤΑΝΑΛΩΤΗΣ του `TABLE_INDICATOR_GRIP_CLEARANCE_PX`', () => {
    const [tab] = tabsOf(2);
    expect((tab.rectMm.y - HEIGHT_MM) * PX_PER_MM).toBeCloseTo(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });

  it('τα μεγέθη είναι σε px ΟΘΟΝΗΣ: διπλό zoom ⇒ μισά mm, ίδια px', () => {
    const [tab] = tabsOf(2, FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM * 2);
    expect(tab.rectMm.w * (PX_PER_MM * 2)).toBeCloseTo(tabWidthPx());
    expect((tab.rectMm.y - HEIGHT_MM) * (PX_PER_MM * 2)).toBeCloseTo(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
    expect(tab.rectMm.h * (PX_PER_MM * 2)).toBeCloseTo(TABLE_INDICATOR.columnBandPx);
  });

  it('το περιθώριο ετικέτας ζει στο ΙΔΙΟ σπίτι με το πλάτος που το παρήγαγε', () => {
    expect(TABLE_WORKSHEET_TAB_LABEL_PADDING_PX * 2).toBeLessThan(tabWidthPx());
  });

  it('🔴 Η ΛΑΒΗ ΣΥΜΠΛΗΡΩΣΗΣ ΤΕΛΕΙΩΝΕΙ ΠΡΙΝ ΑΡΧΙΣΕΙ Η ΚΑΡΤΕΛΑ — αριθμητικά, όχι κατά σύμπτωση', () => {
    const handleOuterReachPx = TABLE_FILL_HANDLE_PX / 2 + TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX;
    expect(handleOuterReachPx).toBeLessThanOrEqual(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });
});

describe('ADR-833 Φ3 — η λωρίδα ζει ΚΑΤΩ από το πλέγμα, σε θετικό v', () => {
  const strip = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM);
  const slots = strip.tabs;

  it('κάθε καρτέλα αρχίζει μετά το `heightMm` συν το κενό', () => {
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot.rectMm.y).toBeCloseTo(HEIGHT_MM + TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM);
    }
  });

  it('οι καρτέλες είναι συνεχόμενες από την αριστερή ακμή του πλέγματος', () => {
    slots.forEach((slot, seat) => {
      expect(slot.rectMm.x).toBeCloseTo((seat * tabWidthPx()) / PX_PER_MM);
    });
  });

  it('🔑 το ΚΕΝΤΡΟ του ζωγραφισμένου ορθογωνίου πέφτει στην ΙΔΙΑ καρτέλα (ζωγράφος ≡ hit-test)', () => {
    for (const slot of slots) {
      const centre = {
        u: slot.rectMm.x + slot.rectMm.w / 2,
        v: slot.rectMm.y + slot.rectMm.h / 2,
      };
      const hit = tableWorksheetStripAtFrame(strip, centre);
      expect(hit?.kind).toBe('tab');
      expect(hit?.kind === 'tab' ? hit.tab.id : null).toBe(slot.id);
    }
  });

  it('🔴 το κενό ΔΕΝ πιάνεται: το μισό του διαστήματος ανήκει στις λαβές', () => {
    const gapMm = TABLE_INDICATOR_GRIP_CLEARANCE_PX / PX_PER_MM;
    expect(tableWorksheetStripAtFrame(strip, { u: 10, v: HEIGHT_MM + gapMm / 2 })).toBeNull();
    // Και η ίδια η ακμή του κενού: **γνήσια** ανισότητα προς το πλέγμα.
    expect(tableWorksheetStripAtFrame(strip, { u: 10, v: HEIGHT_MM + gapMm })).toBeNull();
  });

  it('μέσα στο πλέγμα και κάτω από τη λωρίδα: τίποτα', () => {
    expect(tableWorksheetStripAtFrame(strip, { u: 10, v: HEIGHT_MM / 2 })).toBeNull();
    expect(tableWorksheetStripAtFrame(strip, { u: 10, v: HEIGHT_MM + 100 })).toBeNull();
    // Δεξιά από το ⊕ — η λωρίδα δεν είναι όλο το πλάτος του πίνακα.
    expect(tableWorksheetStripAtFrame(strip, { u: WIDTH_MM - 1, v: slots[0].rectMm.y + 0.5 })).toBeNull();
  });
});

describe('🔴 ADR-833 Φ4 — ΤΟ ⊕ ΤΗΣ ΠΡΟΣΘΗΚΗΣ', () => {
  it('κάθεται ΑΜΕΣΩΣ ΜΕΤΑ την τελευταία ορατή καρτέλα, στην ίδια γραμμή', () => {
    const strip = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM);
    const last = strip.tabs[strip.tabs.length - 1];
    expect(strip.add).not.toBeNull();
    expect(strip.add!.x).toBeCloseTo(last.rectMm.x + last.rectMm.w);
    expect(strip.add!.y).toBeCloseTo(last.rectMm.y);
    expect(strip.add!.h).toBeCloseTo(last.rectMm.h);
  });

  it('είναι ΣΤΕΝΟΤΕΡΟ από καρτέλα — κουβαλά σύμβολο, όχι ετικέτα', () => {
    expect(widths().add).toBeLessThan(widths().tab);
  });

  it('🔑 ό,τι ζωγραφίζεται πιάνεται: το κέντρο του ⊕ απαντά «add», όχι καρτέλα', () => {
    const strip = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM);
    const centre = {
      u: strip.add!.x + strip.add!.w / 2,
      v: strip.add!.y + strip.add!.h / 2,
    };
    expect(tableWorksheetStripAtFrame(strip, centre)).toEqual({ kind: 'add' });
  });

  it('🔴 ΜΕ ΕΝΑ ΦΥΛΛΟ Η ΛΩΡΙΔΑ ΥΠΑΡΧΕΙ — γιατί το ⊕ έχει δουλειά (η αλλαγή της Φάσης 4)', () => {
    const strip = tableWorksheetTabStrip(sheets(1), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, PX_PER_MM);
    expect(strip.tabs).toHaveLength(1);
    expect(strip.add).not.toBeNull();
  });

  it('🔴 ΕΝΑ ΦΥΛΛΟ ΚΑΙ ΔΕΝ ΧΩΡΑ ΤΟ ⊕ ⇒ ΚΑΜΙΑ ΛΩΡΙΔΑ (χειριστήριο χωρίς δουλειά)', () => {
    // Πλάτος ακριβώς μιας καρτέλας: το ⊕ δεν χωρά, και με ένα φύλλο δεν υπάρχει τι να διαλέξεις.
    const strip = tableWorksheetTabStrip(sheets(1), FIRST_TABLE_WORKSHEET_ID, tabWidthPx(), 60, 1);
    expect(strip.add).toBeNull();
    expect(strip.tabs).toEqual([]);
  });

  it('δύο φύλλα και δεν χωρά το ⊕ ⇒ η λωρίδα μένει, γιατί η καρτέλα ΔΡΑ', () => {
    const strip = tableWorksheetTabStrip(sheets(2), FIRST_TABLE_WORKSHEET_ID, tabWidthPx(), 60, 1);
    expect(strip.add).toBeNull();
    expect(strip.tabs).toHaveLength(1);
  });

  it('🔴 το ⊕ ΔΕΝ κλέβει τη μοναδική θέση καρτέλας', () => {
    // Πλάτος που θα χωρούσε το ⊕ αν το πλήρωνε πρώτο και άφηνε 0 καρτέλες.
    const strip = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, tabWidthPx() + widths().add, 60, 1);
    expect(strip.tabs).toHaveLength(1);
    expect(strip.add).not.toBeNull();
  });
});

describe('ADR-833 Φ3 — οι τρεις πύλες: LOD, χωρητικότητα, πλήθος', () => {
  it('🔴 κάτω από το LOD του δείκτη ⇒ καμία λωρίδα, ΑΚΟΜΗ ΚΑΙ ΟΤΑΝ ΧΩΡΑΝΕ ΚΑΡΤΕΛΕΣ', () => {
    // Ο διακρίνων είναι το **ΥΨΟΣ**, και μόνο αυτός: η χωρητικότητα ρωτά μόνο το πλάτος
    // (≥64 px), άρα καλύπτει από μόνη της κάθε στενό πίνακα — το κατώφλι των 48 px στο πλάτος
    // είναι ήδη μέσα της. Ένας πίνακας **πλατύς και χαμηλός** (200 mm × 2 mm σε 1 px/mm) περνά
    // τη χωρητικότητα με 3 καρτέλες και κόβεται **μόνο** από το LOD.
    //
    // ⚠️ Γραμμένο έτσι επειδή η πρώτη εκδοχή του (0,1 px/mm) **έμεινε πράσινη σε μετάλλαξη**
    // που έσβηνε την πύλη LOD: την έκοβε ήδη η χωρητικότητα. Ήταν σχόλιο, όχι άγκυρα.
    expect(stripForSeats(3, 0, 3).tabs).toHaveLength(3); // το ίδιο πλάτος, με ύψος πάνω από το LOD
    const low = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, 200, 2, 1);
    expect(low.tabs).toEqual([]);
    expect(low.add).toBeNull();
    // Και ο ίδιος πίνακας με ύψος πάνω από το κατώφλι ⇒ λωρίδα. Χωρίς αυτό, το test θα περνούσε
    // και με «επιστρέφει πάντα κενό».
    expect(tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, 200, 60, 1).tabs.length)
      .toBeGreaterThan(0);
  });

  it('δεν χωρά ούτε μία καρτέλα ⇒ ούτε ζωγραφίζεται ούτε πιάνεται (τα δύο ΜΑΖΙ)', () => {
    // Πίνακας 60 mm × 1 px/mm = 60 px πλάτος: περνά το LOD (≥48), δεν χωρά καρτέλα (64 px).
    expect(tabWidthPx()).toBeGreaterThan(60);
    const strip = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, 60, 60, 1);
    expect(strip.tabs).toEqual([]);
    expect(strip.add).toBeNull();
    expect(tableWorksheetStripAtFrame(strip, { u: 1, v: 61 })).toBeNull();
  });

  it('εκφυλισμένη προβολή (μη θετικό pxPerMm) ⇒ κενό, ποτέ NaN', () => {
    for (const pxPerMm of [0, NaN]) {
      const strip = tableWorksheetTabStrip(sheets(3), FIRST_TABLE_WORKSHEET_ID, WIDTH_MM, HEIGHT_MM, pxPerMm);
      expect(strip.tabs).toEqual([]);
      expect(strip.add).toBeNull();
    }
  });
});

describe('ADR-833 Φ3 — το παράθυρο υπερχείλισης είναι ΠΑΡΑΓΩΓΟ', () => {
  /** Ποιες θέσεις του βιβλίου είναι ορατές — διαβασμένες από τα ίδια τα slots. */
  const visible = (count: number, active: number, seats: number): number[] =>
    stripForSeats(count, active, seats).tabs.map((slot) => slot.index);

  it('όλα χωρούν ⇒ όλα ορατά, από την αρχή', () => {
    expect(visible(3, 0, 10)).toEqual([0, 1, 2]);
  });

  it('🔑 Η ΕΝΕΡΓΗ ΚΑΡΤΕΛΑ ΕΙΝΑΙ ΠΑΝΤΑ ΟΡΑΤΗ — για κάθε θέση, σε κάθε χωρητικότητα', () => {
    for (let count = 2; count <= 14; count++) {
      for (let active = 0; active < count; active++) {
        for (let seats = 1; seats <= 6; seats++) {
          const slots = stripForSeats(count, active, seats).tabs;
          expect(slots.map((s) => s.index)).toContain(active);
          // …και είναι **η** ενεργή, όχι απλώς παρούσα.
          expect(slots.find((s) => s.active)?.index).toBe(active);
        }
      }
    }
  });

  it('το παράθυρο μένει ΜΕΣΑ στα όρια, είναι ΣΥΝΕΧΟΜΕΝΟ και έχει το σωστό μήκος', () => {
    for (let count = 2; count <= 14; count++) {
      for (let active = 0; active < count; active++) {
        for (let seats = 1; seats <= 6; seats++) {
          const seen = visible(count, active, seats);
          expect(seen).toHaveLength(Math.min(count, seats));
          expect(seen[0]).toBeGreaterThanOrEqual(0);
          expect(seen[seen.length - 1]).toBeLessThan(count);
          seen.forEach((index, seat) => expect(index).toBe(seen[0] + seat));
        }
      }
    }
  });

  it('🔑 ΚΑΘΕ ΦΥΛΛΟ ΕΙΝΑΙ ΠΡΟΣΒΑΣΙΜΟ: πατώντας την ακριανή ορατή καρτέλα, το παράθυρο προχωρά', () => {
    const count = 12;
    const seats = 3;
    let active = 0;
    const seen = new Set<number>([active]);
    for (let step = 0; step < 40 && seen.size < count; step++) {
      const window = visible(count, active, seats);
      window.forEach((index) => seen.add(index));
      const next = window[window.length - 1];
      if (next === active) break;
      active = next;
    }
    expect(seen.size).toBe(count);
  });

  it('υπερχείλιση: το παράθυρο κόβεται στα άκρα χωρίς κενές θέσεις', () => {
    expect(visible(10, 9, 4)).toEqual([6, 7, 8, 9]);
    expect(visible(10, 0, 4)).toEqual([0, 1, 2, 3]);
  });

  it('🔴 το ⊕ ακολουθεί το ΠΑΡΑΘΥΡΟ, όχι τη δεξιά ακμή του πίνακα', () => {
    // Δύο φύλλα σε λωρίδα που χωρά τέσσερα: το ⊕ κάθεται μετά το **δεύτερο**, όχι στο τέρμα.
    const strip = stripForSeats(2, 0, 4);
    expect(strip.tabs).toHaveLength(2);
    expect(strip.add!.x).toBeCloseTo(2 * tabWidthPx());
  });

  it('το `index` του slot είναι η θέση στο ΒΙΒΛΙΟ, όχι στη λωρίδα (τα ονόματα δεν κυλούν)', () => {
    const slots = stripForSeats(8, 5, 3).tabs;
    expect(slots.map((s) => s.index)).toEqual([4, 5, 6]);
    // Οι θέσεις **στη λωρίδα** ξαναρχίζουν από το μηδέν — η ταυτότητα όχι.
    slots.forEach((slot, seat) => expect(slot.rectMm.x).toBeCloseTo(seat * tabWidthPx()));
    expect(slots.find((s) => s.active)?.index).toBe(5);
  });

  it('άγνωστο `activeWorksheetId` ⇒ πέφτει στο πρώτο φύλλο (ίδια ανοχή με το `activeWorksheet`)', () => {
    const slots = tabsOf(3, tableWorksheetId('wsX'));
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
    const slots = tableWorksheetTabStrip(
      multi.worksheets,
      multi.activeWorksheetId,
      layout.widthMm,
      layout.heightMm,
      PX_PER_MM,
    ).tabs;
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

    // Η κορυφή της λωρίδας διαβάζεται **από τη διάταξη** — καμία δεύτερη έκφραση του κενού.
    const twoSheets = { ...entity, worksheets: [entity.worksheets[0], { ...entity.worksheets[0], id: tableWorksheetId('ws1') }] };
    const [tab] = tableWorksheetTabStrip(
      twoSheets.worksheets, twoSheets.activeWorksheetId, layout.widthMm, layout.heightMm, PX_PER_MM,
    ).tabs;
    const stripTopMm = tab.rectMm.y;
    const handleOutwardMm = TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX / PX_PER_MM;
    // Η **εξωτερική εμβέλεια** της λαβής (ορθογώνιο + οπή προς τα έξω) μένει πάνω από τη λωρίδα.
    expect(handle!.y + handle!.h + handleOutwardMm).toBeLessThanOrEqual(stripTopMm);
  });
});
