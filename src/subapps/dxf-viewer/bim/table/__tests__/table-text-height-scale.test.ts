/**
 * ADR-739 Φ.Ε βήμα 5 — η σκάλα ύψους κειμένου πίσω από τα `A↑` / `A↓` του mini toolbar.
 *
 * Μιμείται το ύφος του `table-axis-style-ops.test.ts`: ελληνικά ονόματα test, σχόλια που
 * εξηγούν ΓΙΑΤΙ αντί να επαναλαμβάνουν τι κάνει το assert, helper για κατασκευή μοντέλου.
 *
 * @see ../table-text-height-scale.ts
 */

import {
  TABLE_TEXT_HEIGHT_SCALE_MM,
  nextTextHeightStepMm,
  stepAxisTextHeight,
} from '../table-text-height-scale';
import { resolveAxisNumericRange, setAxisStyleField } from '../table-axis-style-ops';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { PersistedTableModel } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}
const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

/**
 * Τίτλος (4mm, έντονος) + κεφαλίδα (3mm, έντονη) + δεδομένα (2.8mm) × δύο στήλες.
 *
 * Αυτή είναι η ΣΥΝΗΘΗΣ σειρά, όχι ειδική περίπτωση: κάθε στήλη ενός πίνακα προεπιλογής
 * περνά και από τις τρεις κλάσεις γραμμής, άρα το ύψος κειμένου είναι μεικτό σχεδόν πάντα.
 */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'title' },
      { id: 'r1', rowClass: 'header' },
      { id: 'r2', rowClass: 'data' },
    ],
    cells: [],
    merges: [],
  };
}

// ── Η σκάλα ─────────────────────────────────────────────────────────────────

describe('TABLE_TEXT_HEIGHT_SCALE_MM — η σκάλα', () => {
  it('είναι ΑΥΣΤΗΡΑ αύξουσα — η σειρά είναι ο μηχανισμός, μια ανακατεμένη λίστα θα έδινε βήμα ανάποδα σιωπηλά', () => {
    for (let i = 1; i < TABLE_TEXT_HEIGHT_SCALE_MM.length; i += 1) {
      expect(TABLE_TEXT_HEIGHT_SCALE_MM[i]).toBeGreaterThan(TABLE_TEXT_HEIGHT_SCALE_MM[i - 1]);
    }
  });

  it('🔴 περιέχει και τις 3 προεπιλογές των κλάσεων γραμμής (2.8/3/4) ΚΑΙ τις 6 τιμές του ribbon (1/2.5/3.5/5/7/10) — αυτός είναι ο λόγος ύπαρξης της σκάλας', () => {
    // Χωρίς το σύνολο #1 (ribbon), πίνακας και κείμενο θα μιλούσαν διαφορετική γλώσσα για το
    // ίδιο μέγεθος. Χωρίς το σύνολο #2 (κλάσεις γραμμής), το πρώτο A↑ πάνω σε πίνακα
    // προεπιλογής θα πηδούσε 2.8 → 3.5 (+25%) αντί να περάσει πρώτα από το 3.
    const rowClassDefaults = [2.8, 3, 4];
    const ribbonValues = [1, 2.5, 3.5, 5, 7, 10];
    for (const value of [...rowClassDefaults, ...ribbonValues]) {
      expect(TABLE_TEXT_HEIGHT_SCALE_MM).toContain(value);
    }
  });
});

// ── Ένα σκαλί ───────────────────────────────────────────────────────────────

describe('nextTextHeightStepMm — ένα σκαλί προς μια κατεύθυνση', () => {
  it('ανεβαίνει στο επόμενο σκαλί', () => {
    expect(nextTextHeightStepMm(2.8, 1)).toBe(3);
  });

  it('κατεβαίνει στο προηγούμενο σκαλί', () => {
    expect(nextTextHeightStepMm(3, -1)).toBe(2.8);
  });

  it('στο ΠΑΝΩ άκρο, ανεβαίνοντας, επιστρέφει την ΙΔΙΑ τιμή (no-op)', () => {
    const top = TABLE_TEXT_HEIGHT_SCALE_MM[TABLE_TEXT_HEIGHT_SCALE_MM.length - 1];
    expect(nextTextHeightStepMm(top, 1)).toBe(top);
  });

  it('στο ΚΑΤΩ άκρο, κατεβαίνοντας, επιστρέφει την ΙΔΙΑ τιμή (no-op)', () => {
    const bottom = TABLE_TEXT_HEIGHT_SCALE_MM[0];
    expect(nextTextHeightStepMm(bottom, -1)).toBe(bottom);
  });

  it('τιμή ΕΚΤΟΣ σκάλας (2.9, π.χ. από παλιό αρχείο) προσγειώνεται στο πλησιέστερο σκαλί ΠΡΟΣ ΤΑ ΠΑΝΩ', () => {
    expect(nextTextHeightStepMm(2.9, 1)).toBe(3);
  });

  it('η ίδια τιμή εκτός σκάλας (2.9) προσγειώνεται στο πλησιέστερο σκαλί ΠΡΟΣ ΤΑ ΚΑΤΩ', () => {
    expect(nextTextHeightStepMm(2.9, -1)).toBe(2.8);
  });

  it('μη-πεπερασμένη τιμή (NaN) επιστρέφεται ως έχει', () => {
    expect(nextTextHeightStepMm(NaN, 1)).toBe(NaN);
  });

  it('μη-πεπερασμένη τιμή (Infinity) επιστρέφεται ως έχει', () => {
    expect(nextTextHeightStepMm(Infinity, -1)).toBe(Infinity);
  });
});

// ── Ολόκληρος ο άξονας — 🔴 το κρίσιμο ──────────────────────────────────────

describe('stepAxisTextHeight — 🔴 από ποια τιμή ξεκινά σε μεικτή σειρά', () => {
  it('«μεγάλωσε» σε στήλη τίτλου(4)/κεφαλίδας(3)/δεδομένων(2.8) ξεκινά από το ΜΕΓΙΣΤΟ (4 → 5), όχι από το 2.8', () => {
    const next = stepAxisTextHeight(model(), STANDARD, 'column', 'c0', 1);
    expect(next.columns[0].styleOverride).toEqual({ textHeightMm: 5 });
  });

  it('«μίκρυνε» στην ΙΔΙΑ στήλη ξεκινά από το ΕΛΑΧΙΣΤΟ (2.8 → 2.5), όχι από το 4', () => {
    const next = stepAxisTextHeight(model(), STANDARD, 'column', 'c0', -1);
    expect(next.columns[0].styleOverride).toEqual({ textHeightMm: 2.5 });
  });

  it('🔴 το «μεγάλωσε» ΔΕΝ μικραίνει ΚΑΝΕΝΑ κελί της σειράς — νικά ακόμα και τον τίτλο, το ήδη μεγαλύτερο κελί', () => {
    const beforeTitle = STANDARD.rowClasses.title.textHeightMm; // 4 — το ήδη μεγαλύτερο κελί
    const beforeHeader = STANDARD.rowClasses.header.textHeightMm; // 3
    const beforeData = STANDARD.rowClasses.data.textHeightMm; // 2.8
    const next = stepAxisTextHeight(model(), STANDARD, 'column', 'c0', 1);
    const after = next.columns[0].styleOverride?.textHeightMm as number;
    // Η αντίθετη επιλογή (ξεκίνα πάντα από το ελάχιστο) θα έδινε 2.8 → 3.5, δηλαδή θα
    // ΣΥΡΡΙΚΝΩΝΕ τον τίτλο από 4mm σε 3.5mm — το κουμπί «μεγάλωσε» να μικραίνει κελί.
    expect(after).toBeGreaterThanOrEqual(beforeTitle);
    expect(after).toBeGreaterThanOrEqual(beforeHeader);
    expect(after).toBeGreaterThanOrEqual(beforeData);
  });

  it('🔴 το «μίκρυνε» ΔΕΝ μεγαλώνει ΚΑΝΕΝΑ κελί της σειράς — νικά ακόμα και τα δεδομένα, το ήδη μικρότερο κελί', () => {
    const beforeTitle = STANDARD.rowClasses.title.textHeightMm; // 4
    const beforeHeader = STANDARD.rowClasses.header.textHeightMm; // 3
    const beforeData = STANDARD.rowClasses.data.textHeightMm; // 2.8 — το ήδη μικρότερο κελί
    const next = stepAxisTextHeight(model(), STANDARD, 'column', 'c0', -1);
    const after = next.columns[0].styleOverride?.textHeightMm as number;
    expect(after).toBeLessThanOrEqual(beforeTitle);
    expect(after).toBeLessThanOrEqual(beforeHeader);
    expect(after).toBeLessThanOrEqual(beforeData);
  });

  it('ομοιόμορφη σειρά στο ΠΑΝΩ άκρο ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const top = TABLE_TEXT_HEIGHT_SCALE_MM[TABLE_TEXT_HEIGHT_SCALE_MM.length - 1];
    // Η παράκαμψη στήλης ισοπεδώνει ΟΛΗ τη στήλη στο `top` ⇒ min === max === top.
    const atTop = setAxisStyleField(model(), 'column', 'c0', 'textHeightMm', top);
    expect(resolveAxisNumericRange(atTop, STANDARD, 'column', 'c0', 'textHeightMm'))
      .toEqual({ min: top, max: top });
    expect(stepAxisTextHeight(atTop, STANDARD, 'column', 'c0', 1)).toBe(atTop);
  });

  it('ομοιόμορφη σειρά στο ΚΑΤΩ άκρο ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const bottom = TABLE_TEXT_HEIGHT_SCALE_MM[0];
    const atBottom = setAxisStyleField(model(), 'column', 'c0', 'textHeightMm', bottom);
    expect(stepAxisTextHeight(atBottom, STANDARD, 'column', 'c0', -1)).toBe(atBottom);
  });

  it('άγνωστη ταυτότητα ⇒ ΤΟ ΙΔΙΟ μοντέλο, καμία εντολή', () => {
    const start = model();
    expect(stepAxisTextHeight(start, STANDARD, 'column', 'ΔΕΝ_ΥΠΑΡΧΕΙ', 1)).toBe(start);
  });
});
