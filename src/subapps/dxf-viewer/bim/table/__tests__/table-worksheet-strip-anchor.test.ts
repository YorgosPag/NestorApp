/**
 * 🔴 ADR-833 Φάση 4 §5.4.11 #3 — **Η ΛΩΡΙΔΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΦΕΥΓΕΙ ΚΑΤΩ ΑΠΟ ΤΟ ΧΕΡΙ.**
 *
 * ## Το περιστατικό που γεννά αυτό το αρχείο
 * Διπλό κλικ σε **μη ενεργή** καρτέλα δεν άνοιγε τίποτα. Το πρώτο κλικ **ενεργοποιούσε** το
 * φύλλο· το νέο φύλλο έχει άλλο πλήθος γραμμών, άρα ο πίνακας άλλαζε ύψος — και η λωρίδα, που
 * κρεμόταν από την **κάτω** ακμή (`y: heightMm + gapMm`), μετακινούνταν **~46 px** μέσα στο
 * ίδιο καρέ. Το δεύτερο κλικ έπεφτε εκεί που η λωρίδα **ήταν**.
 *
 * 🔑 Η κλάση έχει όνομα στη βιομηχανία — **layout instability / missed clicks** — και η
 * καθιερωμένη θεραπεία είναι **μία**: *δέσμευσε τον χώρο ώστε τίποτα να μη μετακινείται*, ποτέ
 * «μάντεψε καλύτερα πού πήγε». Κανένα φύλλο υπολογισμού δεν κρεμά τη λωρίδα του από το
 * περιεχόμενο: Excel/Sheets την αγκυρώνουν στο **παράθυρο**, το Numbers στο **πάνω chrome**.
 * Ο λόγος που εκείνοι μπορούν να τη βάλουν κάτω είναι ακριβώς ο λόγος που εμείς δεν μπορούμε:
 * το «κάτω» τους είναι το παράθυρο· το δικό μας ήταν το **χαρτί**.
 *
 * ## Τι κλειδώνει, και γιατί ΚΑΘΕ σκέλος χρειάζεται βάση
 * Η **πάνω** ακμή του πλαισίου (`v = 0`) είναι αμετάβλητη σε κάθε αλλαγή περιεχομένου: η αρχή
 * του πλαισίου είναι πάνω-αριστερά και το ύψος μεγαλώνει **προς τα κάτω**. Άρα η σταθερότητα
 * δεν είναι λογιστική («κράτα το μέγιστο ύψος του βιβλίου») αλλά **δομική**.
 *
 * ⚠️ Ένα test που έλεγχε μόνο «τα δύο `y` είναι ίσα» θα ήταν **πράσινο σε κενή λωρίδα** και
 * **πράσινο αν τα δύο φύλλα τύχαινε να έχουν το ίδιο ύψος**. Γι' αυτό υπάρχουν δύο βάσεις που
 * αποδεικνύουν ότι το πείραμα έχει νόημα πριν από κάθε ισχυρισμό — το μάθημα «*πράσινο που
 * σημαίνει «κανείς δεν κοίταξε»*» που η ίδια αυτή φάση πλήρωσε ήδη μία φορά.
 *
 * @module subapps/dxf-viewer/bim/table/__tests__/table-worksheet-strip-anchor
 * @see ../table-worksheet-tabs-geometry.ts — η ΜΙΑ διάταξη της λωρίδας
 * @see ../table-insert-control.ts — ο από κάτω ένοικος (`tableInsertControlOuterPx`)
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.4.11
 */

import {
  tableWorksheetStripOuterPx,
  tableWorksheetTabStrip,
} from '../table-worksheet-tabs-geometry';
import { tableInsertControlOuterPx } from '../table-insert-control';
import { computeTableEntityGeometryLive, tablePxPerMm } from '../table-entity-geometry';
import { buildTableEntity, buildTableModel } from '../build-table-entity';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableEntity } from '../../../types/table-entity';

/**
 * ⚠️ **ΟΧΙ 1:1.** Σε προεπιλεγμένη κλίμακα ο πίνακας δεν περνά το LOD
 * (`isTableIndicatorVisible`) και η λωρίδα επιστρέφει **κενή** — κάθε ισχυρισμός παρακάτω θα
 * ήταν πράσινος επειδή δεν υπήρχε τίποτα να μετρηθεί. Ίδιος λόγος, ίδια τιμή, με το
 * `table-worksheet-rename-double-click.test.tsx`.
 */
const SCALE = 40;

const SHORT_SHEET = tableWorksheetId('ws_short');
const TALL_SHEET = tableWorksheetId('ws_tall');

/** Δύο φύλλα με **διαφορετικό** πλήθος γραμμών — ακριβώς το ζεύγος του περιστατικού. */
function twoSheetBook(): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 3 }, 'tbl_strip_anchor', 'lyr_t');
  return {
    ...base,
    worksheets: [
      { id: SHORT_SHEET, model: buildTableModel({ columnCount: 3, dataRowCount: 2 }) },
      { id: TALL_SHEET, model: buildTableModel({ columnCount: 3, dataRowCount: 9 }) },
    ],
    activeWorksheetId: SHORT_SHEET,
  };
}

/** Η γεωμετρία **με αυτό** το φύλλο ενεργό — δηλαδή ό,τι βλέπει ο ζωγράφος εκείνη τη στιγμή. */
function frameOf(activeWorksheetId: typeof SHORT_SHEET) {
  const entity = { ...twoSheetBook(), activeWorksheetId };
  const geometry = computeTableEntityGeometryLive(entity);
  const pxPerMm = tablePxPerMm(geometry.mmToWorld, SCALE);
  return {
    entity,
    pxPerMm,
    widthMm: geometry.layout.widthMm,
    heightMm: geometry.layout.heightMm,
    strip: tableWorksheetTabStrip(
      entity.worksheets,
      activeWorksheetId,
      geometry.layout.widthMm,
      geometry.layout.heightMm,
      pxPerMm,
    ),
  };
}

describe('🔴 ADR-833 Φ4 #3 — Η ΑΓΚΥΡΑ ΤΗΣ ΛΩΡΙΔΑΣ ΕΙΝΑΙ ΑΜΕΤΑΒΛΗΤΗ', () => {
  it('ΒΑΣΗ — και στα δύο φύλλα η λωρίδα ΥΠΑΡΧΕΙ (καρτέλες και ⊕)', () => {
    // Χωρίς αυτό, «ίδιο y» θα ήταν πράσινο επειδή δεν υπήρχε λωρίδα να μετακινηθεί.
    for (const id of [SHORT_SHEET, TALL_SHEET]) {
      const { strip } = frameOf(id);
      expect(strip.tabs.length).toBeGreaterThan(0);
      expect(strip.add).not.toBeNull();
    }
  });

  it('ΒΑΣΗ — τα δύο φύλλα έχουν ΟΝΤΩΣ διαφορετικό ύψος πίνακα', () => {
    // Αλλιώς η σταθερότητα θα ήταν πράσινη επειδή δεν άλλαξε τίποτα να την απειλήσει.
    expect(frameOf(TALL_SHEET).heightMm).toBeGreaterThan(frameOf(SHORT_SHEET).heightMm);
  });

  it('🔑 Η ΡΙΖΑ — αλλαγή ενεργού φύλλου ΔΕΝ μετακινεί καμία καρτέλα ούτε το ⊕', () => {
    const shortFrame = frameOf(SHORT_SHEET);
    const tallFrame = frameOf(TALL_SHEET);

    const seatYs = (f: typeof shortFrame) => f.strip.tabs.map((tab) => tab.rectMm.y);
    expect(seatYs(tallFrame)).toEqual(seatYs(shortFrame));
    expect(tallFrame.strip.add?.y).toBe(shortFrame.strip.add?.y);
  });

  it('η λωρίδα κάθεται ΕΞΩ από το πλέγμα, προς τα ΠΑΝΩ', () => {
    // «Σταθερή» χωρίς αυτό θα μπορούσε να σημαίνει «καρφωμένη σε λάθος σταθερά».
    const { strip } = frameOf(SHORT_SHEET);
    for (const tab of strip.tabs) expect(tab.rectMm.y + tab.rectMm.h).toBeLessThanOrEqual(0);
  });

  it('🔴 §27.13 — ΔΕΝ ακουμπά τον από κάτω ένοικο (το ⊕ της εισαγωγής)', () => {
    // Το περιστατικό §27.13/§40 δύο φορές: κάποιος ξαναμέτρησε «ζώνη + κενό» αντί να ρωτήσει
    // τον από κάτω του, και σκέπασε ό,τι εκείνος είχε ήδη πιάσει.
    const { strip, pxPerMm } = frameOf(SHORT_SHEET);
    const belowMm = -tableInsertControlOuterPx('table-mode').top / pxPerMm;
    for (const tab of strip.tabs) {
      expect(tab.rectMm.y + tab.rectMm.h).toBeLessThanOrEqual(belowMm);
    }
  });

  it('🔑 η ΔΗΛΩΣΗ συμφωνεί με τη ΔΙΑΤΑΞΗ — δύο λεξιλόγια της ίδιας ποσότητας', () => {
    // Ο ακριβής φύλακας που έλειπε στο §27.13: εκεί η δήλωση («…Px») και η διάταξη («…Mm»)
    // απέκλιναν σιωπηλά, και κάθε test με γνήσια ανισότητα παρέμενε αληθές.
    const { strip, pxPerMm } = frameOf(SHORT_SHEET);
    const topMm = Math.min(...strip.tabs.map((tab) => tab.rectMm.y));
    expect(-topMm * pxPerMm).toBeCloseTo(tableWorksheetStripOuterPx(), 6);
  });

  it('η δηλωμένη επιφάνεια περιλαμβάνει ΟΛΟΝ τον από κάτω ένοικο', () => {
    expect(tableWorksheetStripOuterPx())
      .toBeGreaterThan(tableInsertControlOuterPx('table-mode').top);
  });
});
