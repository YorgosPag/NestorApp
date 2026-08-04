/**
 * 🔴 ADR-756 — **ΤΟ ΠΛΕΓΜΑ ΤΟΥ ΠΙΝΑΚΑ ΔΕΝ ΠΑΧΑΙΝΕΙ ΟΤΑΝ ΠΛΗΣΙΑΖΕΙΣ.**
 *
 * ## Γιατί αυτή η σουίτα ζει **εδώ** και όχι δίπλα στον κανόνα
 * Ο κανόνας (`lineweightDisplayPx`) δεν δέχεται πια κλίμακα, οπότε ένα test πάνω του μπορεί
 * μόνο να επιβεβαιώσει ότι η παράμετρος λείπει — δηλαδή να **περιγράψει την υπογραφή**.
 * Το ελάττωμα όμως δεν ζούσε στην υπογραφή· ζούσε στον **ζωγράφο**, όπου το `rc.pxPerMm`
 * είναι πραγματικά διαθέσιμο και όπου γράφτηκε ο πολλαπλασιασμός
 * (`ctx.lineWidth = widthMm * rc.pxPerMm`). Ένα regression θα το ξαναγράψει **εκεί**, γιατί
 * εκεί είναι που φαίνεται προφανές: «ο πίνακας ζει σε sheet-mm, άρα κλιμάκωσε».
 *
 * Το test ζωγραφίζει **το ίδιο** περίγραμμα σε τρεις κλίμακες που διαφέρουν κατά 400× και
 * απαιτεί ταυτόσημο `lineWidth`. Είναι το ελάττωμα του Giorgio (04/08) γραμμένο ως αριθμός.
 *
 * @see config/lineweight-display-px.ts — ο κανόνας, με την πλήρη ιστορία
 * @see rendering/entities/table/stamp-table-borders.ts — ο ζωγράφος υπό δοκιμή
 */

import { stampTableBorders } from '../stamp-table-borders';
import { createPaintLog, createRc, type PaintLog } from './table-paint-recorder';
import { __resetLineweightDisplayForTesting } from '../../../../stores/LineweightDisplayStore';
import type { TableBorderSegment } from '../../../../bim/table/table-layout-types';

/** Η λεπτότερη πένα ISO 128 — ό,τι ζωγραφίζει σήμερα κάθε ακμή (`STANDARD_GRID_MM`). */
const THIN_PEN_MM = 0.13;
/** Χοντρή πένα περιμέτρου — αρκετά πάνω από το hairline ώστε η σύγκριση να έχει νόημα. */
const THICK_PEN_MM = 0.5;

/**
 * Οι τρεις κλίμακες: σμίκρυνση, τυπική εργασία, και η μεγέθυνση του στιγμιότυπου του
 * Giorgio. Με τον παλιό τύπο η τελευταία έδινε **26 px** για πένα 0,13 mm.
 */
const ZOOMS_PX_PER_MM = [0.5, 10, 200];

function border(widthMm: number): TableBorderSegment {
  return { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, spec: { visible: true, colorHex: '#ffffff', widthMm } };
}

/** Τα πάχη που έφτασαν στον καμβά, ένα ανά κλίμακα. */
function widthsAcrossZooms(widthMm: number): number[] {
  return ZOOMS_PX_PER_MM.map((pxPerMm) => {
    const log: PaintLog = createPaintLog();
    stampTableBorders(createRc(log, { pxPerMm }), [border(widthMm)]);
    return log.strokes[0].lineWidth;
  });
}

beforeEach(() => {
  __resetLineweightDisplayForTesting();
});

describe('🔴 ADR-756 — το πάχος του πλέγματος είναι ΑΝΕΞΑΡΤΗΤΟ της κλίμακας', () => {
  it('🔑 ΤΟ ΕΛΑΤΤΩΜΑ ΤΟΥ GIORGIO: 0,5 → 200 px/mm (400×) ⇒ ΤΟ ΙΔΙΟ lineWidth', () => {
    const [atMin, ...rest] = widthsAcrossZooms(THIN_PEN_MM);
    for (const w of rest) expect(w).toBeCloseTo(atMin);
  });

  it('ισχύει και για χοντρή πένα — δεν είναι το δάπεδο που κρύβει την κλιμάκωση', () => {
    // ⚠️ Χωρίς αυτό, μια υλοποίηση που **ακόμα** πολλαπλασιάζει επί `pxPerMm` θα περνούσε το
    // test από πάνω: στα 0,13 mm το αποτέλεσμα πέφτει στο hairline και στις τρεις κλίμακες
    // ούτως ή άλλως. Το δάπεδο δεν είναι απόδειξη — είναι κάλυμμα.
    const [atMin, ...rest] = widthsAcrossZooms(THICK_PEN_MM);
    for (const w of rest) expect(w).toBeCloseTo(atMin);
    expect(atMin).toBeGreaterThan(1);
  });

  it('η ιεραρχία επιβιώνει σε κάθε κλίμακα — χοντρή πένα παχύτερη από λεπτή', () => {
    const thin = widthsAcrossZooms(THIN_PEN_MM);
    const thick = widthsAcrossZooms(THICK_PEN_MM);
    thin.forEach((t, i) => expect(thick[i]).toBeGreaterThan(t));
  });

  it('αόρατο περίγραμμα δεν ζωγραφίζεται καθόλου — καμία hairline «από ευγένεια»', () => {
    const log = createPaintLog();
    stampTableBorders(createRc(log), [
      { ...border(THICK_PEN_MM), spec: { visible: false, colorHex: '#ffffff', widthMm: THICK_PEN_MM } },
    ]);
    expect(log.strokes).toHaveLength(0);
  });
});
