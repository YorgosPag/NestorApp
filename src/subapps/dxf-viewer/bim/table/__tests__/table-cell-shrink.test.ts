/**
 * ADR-739 §58 Γ1 — **Shrink to Fit**: το κείμενο σμικραίνει αντί να κοπεί.
 *
 * Ο μετρητής είναι ο **ίδιος ενεθειμένος** με το `table-cell-overflow.test.ts` (`0.6 × ύψος`
 * ανά χαρακτήρα, έντονα διπλάσια) — ίδιος λόγος: ο πραγματικός πέφτει σε άλλη βαθμίδα
 * ανάλογα με το αν υπάρχει γραμματοσειρά/DOM. **Όχι** δεύτερη υλοποίηση μέτρησης (N.18).
 *
 * 🔑 Η κρίσιμη ιδιότητα που κάνει τη μία διαίρεση σωστή — **η γραμμικότητα του μετρητή ως
 * προς το ύψος** — καρφώνεται ρητά στο πρώτο group. Αν πάψει να ισχύει, το `shrinkToFit`
 * γίνεται λάθος **σιωπηλά**, και αυτό είναι το test που θα το πει.
 */

import {
  CELL_CLIP_ELLIPSIS,
  CELL_CLIP_NUMERIC_FILL,
  MIN_PRINTABLE_TEXT_HEIGHT_MM,
  resolveCellOverflow,
  resolveVisibleCellText,
  type VisibleCellText,
} from '../table-cell-overflow';
import { measureTextAdvanceWorld } from '../../../text-engine/fonts/text-advance';
import { styledSpansWidthMm } from '../table-cell-styled-spans';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableCellStyle } from '../table-style';
import type { TableCellTextRun } from '../../../types/table';

const measure: TableTextMeasurer = (text, heightMm, style) =>
  text.length * heightMm * 0.6 * (style.bold === true ? 2 : 1);

const HEIGHT_MM = 10;
const CHAR_MM = HEIGHT_MM * 0.6;

const STYLE: TableCellStyle = {
  textHeightMm: HEIGHT_MM,
  textColorHex: '#111111',
  bold: false,
  italic: false,
  underline: false,
  align: 'ML',
  margins: { hMm: 0, vMm: 0 },
};

function shrink(
  text: string,
  availableWidthMm: number,
  extra?: { readonly numeric?: boolean; readonly runs?: readonly TableCellTextRun[] },
): VisibleCellText {
  return resolveVisibleCellText({
    text,
    availableWidthMm,
    style: STYLE,
    overflow: 'shrink',
    numeric: extra?.numeric ?? false,
    runs: extra?.runs,
    measure,
  });
}

describe('🔑 η προϋπόθεση: ο μετρητής είναι ΓΡΑΜΜΙΚΟΣ ως προς το ύψος', () => {
  it('ο ΠΡΑΓΜΑΤΙΚΟΣ μετρητής (ADR-557) σκαλάρει γραμμικά — αλλιώς η μία διαίρεση είναι λάθος', () => {
    // Αν αυτό σπάσει, το `shrinkToFit` πρέπει να γίνει δυαδική αναζήτηση. Χωρίς αυτή την
    // άγκυρα, η αλλαγή θα περνούσε απαρατήρητη και το κείμενο θα ξεχείλιζε κατά λίγο.
    const text = 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ';
    const at10 = measureTextAdvanceWorld(text, 10, { fontFamily: 'arial' });
    for (const scale of [0.5, 0.25, 0.18, 2, 3.7]) {
      expect(measureTextAdvanceWorld(text, 10 * scale, { fontFamily: 'arial' })).toBeCloseTo(
        at10 * scale,
        6,
      );
    }
  });
});

describe('shrink — η βασική συμπεριφορά', () => {
  it('ό,τι χωρά δεν σμικραίνεται καθόλου', () => {
    const out = shrink('ΑΒΓ', 100);
    expect(out).toMatchObject({ text: 'ΑΒΓ', clipped: false, heightScale: 1 });
  });

  it('🔴 κρατά το κείμενο ΑΚΕΡΑΙΟ — καμία περικοπή, κανένας δείκτης', () => {
    const out = shrink('ΑΒΓΔΕ', 15);
    expect(out.text).toBe('ΑΒΓΔΕ');
    expect(out.clipped).toBe(false);
    expect(out.text).not.toContain(CELL_CLIP_ELLIPSIS);
  });

  it('🏆 το σμικρυμένο κείμενο τελειώνει ΑΚΡΙΒΩΣ στο περιθώριο (μία διαίρεση, μηδέν ανοχή)', () => {
    // 5 χαρακτήρες × 6mm = 30mm σε κελί 15mm ⇒ συντελεστής ακριβώς 0,5.
    const out = shrink('ΑΒΓΔΕ', 15);
    expect(out.heightScale).toBeCloseTo(0.5, 12);
    // Το Excel σμικραίνει σε διακριτά βήματα και αφήνει ορατό κενό· εδώ δεν μένει τίποτα.
    expect(styledSpansWidthMm(out.spans)).toBeCloseTo(15, 12);
  });

  it('τα τμήματα φτάνουν στον ζωγράφο ΗΔΗ κλιμακωμένα (ύψος, θέση, πλάτος)', () => {
    const out = shrink('ΑΒΓΔΕ', 15);
    expect(out.spans).toHaveLength(1);
    expect(out.spans[0].heightMm).toBeCloseTo(HEIGHT_MM * 0.5, 12);
    expect(out.spans[0].offsetMm).toBe(0);
    expect(out.spans[0].advanceMm).toBeCloseTo(5 * CHAR_MM * 0.5, 12);
  });
});

describe('🔴 το όριο αναγνωσιμότητας — ISO 3098-1:2015', () => {
  it('το όριο είναι το κάτω άκρο της σειράς ονομαστικών υψών', () => {
    expect(MIN_PRINTABLE_TEXT_HEIGHT_MM).toBe(1.8);
  });

  it('το όριο ΔΙΑΧΩΡΙΖΕΙ: μόλις από πάνω σμικραίνει, μόλις από κάτω περικόπτει', () => {
    // 5 χαρακτήρες × 6mm = 30mm ⇒ το όριο πέφτει στα 30 × (1,8/10) = 5,4mm.
    //
    // ⚠️ Ελέγχεται ο **διαχωρισμός**, ποτέ η ισότητα στο ίδιο το όριο: το `30 * 0.18` δίνει
    // 5,3999999999999995 σε IEEE-754, οπότε ένα test «ακριβώς στο όριο» θα κατέγραφε ως
    // συμβόλαιο το τελευταίο bit μιας στρογγυλοποίησης — και θα άλλαζε χρώμα με κάθε αθώα
    // αναδιατύπωση της πράξης.
    const above = shrink('ΑΒΓΔΕ', 5.5);
    expect(above.clipped).toBe(false);
    expect(above.spans[0].heightMm).toBeGreaterThanOrEqual(MIN_PRINTABLE_TEXT_HEIGHT_MM);

    expect(shrink('ΑΒΓΔΕ', 5.3).clipped).toBe(true);
  });

  it('🔴 κάτω από το όριο ΠΕΦΤΕΙ ΣΕ ΠΕΡΙΚΟΠΗ — δεν τυπώνει δυσανάγνωστο (vs Excel)', () => {
    // 18 χαρακτήρες × 6mm = 108mm· όριο σμίκρυνσης 108 × 0,18 = 19,44mm.
    const out = shrink('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΩΝ', 18);
    expect(out.clipped).toBe(true);
    expect(out.heightScale).toBe(1);
    expect(out.text).toContain(CELL_CLIP_ELLIPSIS);
  });

  it('αριθμός κάτω από το όριο δίνει «####», όχι κομμένο ψηφίο', () => {
    // Ένας κομμένος αριθμός διαβάζεται ως ΑΛΛΟΣ αριθμός — σφάλμα ΤΙΜΗΣ (ADR-712/713).
    // 6 ψηφία × 6mm = 36mm· όριο σμίκρυνσης 6,48mm ⇒ στα 6,2mm περικόπτεται.
    const out = shrink('123456', 6.2, { numeric: true });
    expect(out.clipped).toBe(true);
    expect(out.text.startsWith(CELL_CLIP_NUMERIC_FILL)).toBe(true);
    expect(out.text).not.toMatch(/[0-9]/u);
  });
});

describe('🔴 μορφοποίηση ανά χαρακτήρα (ADR-753) — το ΜΙΚΡΟΤΕΡΟ τμήμα κρίνει', () => {
  /** Οι δύο πρώτοι χαρακτήρες σε μισό ύψος — π.χ. εκθέτης «m³». */
  const runs: readonly TableCellTextRun[] = [{ start: 0, end: 2, style: { textHeightMm: 5 } }];

  it('όλα τα τμήματα σμικραίνονται αναλογικά, και τα ρητά ύψη των runs', () => {
    // Ομοιογενές: 5 × 10 × 0,6 = 30mm ⇒ σε 12mm ο συντελεστής είναι 0,4.
    const out = shrink('ΑΒΓΔΕ', 12);
    expect(out.heightScale).toBeCloseTo(0.4, 12);
    expect(styledSpansWidthMm(out.spans)).toBeCloseTo(12, 12);

    // Ετερογενές: span0 = 2 × 5 × 0,6 = 6mm · span1 = 3 × 10 × 0,6 = 18mm · σύνολο 24mm
    // ⇒ σε 12mm ο συντελεστής είναι 0,5.
    const styled = shrink('ΑΒΓΔΕ', 12, { runs });
    expect(styled.heightScale).toBeCloseTo(0.5, 12);
    expect(styled.spans).toHaveLength(2);
    // Ένα scaling που άγγιζε μόνο το στυλ ΚΕΛΙΟΥ θα άφηνε αυτό το τμήμα στα 5mm.
    expect(styled.spans[0].heightMm).toBeCloseTo(2.5, 12);
    expect(styled.spans[1].heightMm).toBeCloseTo(5, 12);
    expect(styledSpansWidthMm(styled.spans)).toBeCloseTo(12, 12);
  });

  it('🔴 το όριο κρίνεται από το ΜΙΚΡΟΤΕΡΟ τμήμα, όχι από το στυλ του κελιού', () => {
    // Σύνολο 24mm. Όριο του μικρού τμήματος (5mm): συντελεστής 1,8/5 = 0,36 ⇒ 8,64mm.
    expect(shrink('ΑΒΓΔΕ', 8.64, { runs }).clipped).toBe(false);
    // Με κριτήριο το στυλ κελιού (10mm) το όριο θα ήταν 4,32mm — και στα 8,5mm θα σμίκρυνε,
    // αφήνοντας τον εκθέτη στα 1,77mm: κάτω από κάθε νόμιμο ύψος τεχνικού σχεδίου.
    expect(shrink('ΑΒΓΔΕ', 8.5, { runs }).clipped).toBe(true);
  });
});

describe('resolveCellOverflow — το «shrink» είναι πλέον ΕΚΤΕΛΕΣΙΜΟ', () => {
  it('επιστρέφεται αυτούσιο από κελί και από στήλη', () => {
    expect(resolveCellOverflow('shrink', undefined)).toBe('shrink');
    expect(resolveCellOverflow(undefined, 'shrink')).toBe('shrink');
    expect(resolveCellOverflow('clip', 'shrink')).toBe('clip');
  });

  it('άγνωστη μελλοντική τιμή πέφτει στην προεπιλογή, ποτέ κατάρρευση', () => {
    // Ένας πίνακας αποθηκευμένος από μελλοντική έκδοση πρέπει να **ανοίγει**, όχι να ρίχνει
    // τη σκηνή: το `PersistedTableModel` περνά από `JSON.parse` και δεν έχει καμία εγγύηση
    // τύπου στην άλλη άκρη — μόνο αυτή τη δήλωση.
    expect(resolveCellOverflow('justify' as never, undefined)).toBe('clip');
  });
});
