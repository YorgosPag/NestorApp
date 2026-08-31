/**
 * ADR-833 §5.7.3 — άγκυρες των **μονάδων του φύλλου Excel**.
 *
 * 🔑 Οι δύο πρώτες δεν είναι «ελέγχει ότι πολλαπλασιάζει σωστά»: ελέγχουν τον τύπο απέναντι σε
 * **γνωστά νούμερα του ίδιου του Excel** (προεπιλεγμένο πλάτος στήλης `8,43` χαρακτήρες ⇒ 64 px
 * ⇒ 1,69 cm, όπως το δηλώνει ο διάλογος *Column Width*). Ένας τύπος που «μοιάζει σωστός» και δεν
 * βγάζει αυτά τα νούμερα είναι λάθος, όσο καθαρός κι αν είναι.
 *
 * @see lib/spreadsheet/excel-sheet-units.ts
 */

import {
  CALIBRI_11_MAX_DIGIT_WIDTH_PX,
  excelCharsToMm,
  excelColumnPaddingPx,
  excelPointsToMm,
  mmToExcelChars,
  mmToExcelPoints,
} from '../excel-sheet-units';

describe('ADR-833 §5.7.3 — πλάτος στήλης: χαρακτήρες ⇄ mm', () => {
  it('🔴 το ΠΡΟΕΠΙΛΕΓΜΕΝΟ πλάτος του Excel βγάζει το νούμερο που δηλώνει το ίδιο το Excel', () => {
    // 8,43 χαρ. × 7 px + 5 px = 64,01 px ⇒ × 25,4 / 96 = 16,936 mm ⇒ **1,69 cm**, ακριβώς ό,τι
    // δείχνει ο διάλογος *Column Width*.
    expect(excelCharsToMm(8.43)).toBeCloseTo(16.936, 3);
    expect(Number((excelCharsToMm(8.43) / 10).toFixed(2))).toBe(1.69);
  });

  it('⚠️ η απόκλιση από τα ΑΚΕΡΑΙΑ εικονοστοιχεία του Excel είναι δηλωμένη και αμελητέα', () => {
    // Το Excel αποδίδει σε **ακέραια** px (64 αντί 64,01). Ο τύπος εδώ μένει **συνεχής**
    // επίτηδες: η στρογγυλοποίηση θα τον έκανε **μη αντιστρέψιμο**, δηλαδή θα σκότωνε την
    // ιδιότητα round-trip για κέρδος **3 μικρών** — 0,003 mm, που δεν εκφράζεται σε σχέδιο.
    const smooth = excelCharsToMm(8.43);
    const wholePixels = (Math.trunc(8.43 * 7 + 5) * 25.4) / 96;
    expect(Math.abs(smooth - wholePixels)).toBeLessThan(0.01);
  });

  it('🔴 το γέμισμα ΠΑΡΑΓΕΤΑΙ από το MDW, δεν είναι σκληρό «5»', () => {
    expect(excelColumnPaddingPx(CALIBRI_11_MAX_DIGIT_WIDTH_PX)).toBe(5);
    // MDW 12 ⇒ 2×ceil(12/4)+1 = 7. Ένα καρφωμένο `5` θα έδινε λάθος πλάτος σε κάθε άλλη όψη.
    expect(excelColumnPaddingPx(12)).toBe(7);
  });

  it('🔴 οι δύο κατευθύνσεις είναι ΑΝΤΙΣΤΡΟΦΕΣ — σε όλο το εύρος, όχι σε δείγμα', () => {
    for (const chars of [1, 8.43, 20, 55, 120]) {
      expect(mmToExcelChars(excelCharsToMm(chars))).toBeCloseTo(chars, 6);
    }
    for (const mm of [5, 16.93, 40, 100, 250]) {
      expect(excelCharsToMm(mmToExcelChars(mm))).toBeCloseTo(mm, 6);
    }
  });

  it('🔴 το MDW είναι ΠΑΡΑΜΕΤΡΟΣ: άλλη γραμματοσειρά ⇒ άλλα χιλιοστά για τον ίδιο αριθμό', () => {
    expect(excelCharsToMm(10, 7)).not.toBeCloseTo(excelCharsToMm(10, 12), 3);
  });

  it('μη πεπερασμένο ή μη θετικό ⇒ 0, ποτέ NaN που δηλητηριάζει γεωμετρία', () => {
    expect(excelCharsToMm(Number.NaN)).toBe(0);
    expect(excelCharsToMm(-3)).toBe(0);
    expect(mmToExcelChars(Number.POSITIVE_INFINITY)).toBe(0);
    // Πλάτος μικρότερο από το ίδιο το γέμισμα δεν είναι αρνητική στήλη — είναι μηδέν.
    expect(mmToExcelChars(1)).toBe(0);
  });
});

describe('ADR-833 §5.7.3 — ύψος γραμμής: στιγμές ⇄ mm, ΧΩΡΙΣ γραμματοσειρά', () => {
  it('🔴 μία στιγμή είναι 1/72 της ίντσας — ο ορισμός, όχι προσέγγιση', () => {
    expect(excelPointsToMm(72)).toBeCloseTo(25.4, 9);
  });

  it('🔴 αντίστροφες, και ΔΕΝ αγγίζονται από το MDW', () => {
    for (const pt of [7.5, 15, 22.68, 60]) {
      expect(mmToExcelPoints(excelPointsToMm(pt))).toBeCloseTo(pt, 9);
    }
  });

  it('μη πεπερασμένο ή μη θετικό ⇒ 0', () => {
    expect(excelPointsToMm(Number.NaN)).toBe(0);
    expect(mmToExcelPoints(-1)).toBe(0);
  });
});
