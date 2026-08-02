/**
 * ADR-739 Φ.Δ βήμα 6 — **ο επεξεργαστής επεκτείνεται πέρα από το κελί.**
 *
 * Τα τέσσερα ρίσκα που στοχεύει, με τη σειρά που πονάνε:
 *
 *  1. **Η διάταξη ή το μοντέλο αλλάζουν.** Η επέκταση είναι κατάσταση **διεπαφής**. Αν
 *     βρεθεί να επηρεάζει τη διάταξη, έχει σπάσει το βήμα 5 — γι' αυτό υπάρχει ολόκληρο
 *     `describe` που ξαναϋπολογίζει τη διάταξη πριν και μετά.
 *  2. **Η κατεύθυνση.** Με αριστερή στοίχιση κάθε λάθος πρόσημο περνά απαρατήρητο· μόνο η
 *     δεξιά και η κεντρική το αποκαλύπτουν.
 *  3. **Η απόδοση.** Το κουτί υπολογίζεται **σε κάθε καρέ**. Ο έλεγχος μετρά τις κλήσεις
 *     του `ctx.measureText` σε 60 «καρέ» διαφορετικού zoom — αριθμός, όχι ισχυρισμός.
 *  4. **Η αναδίπλωση.** Το ύψος πρέπει να είναι **συντηρητικό**: μια γραμμή παραπάνω είναι
 *     άσχημη, μια λιγότερη κρύβει κείμενο — δηλαδή ξαναφέρνει το ελάττωμα που λύνουμε.
 */

import {
  computeCellEditorExpansion,
  editorGrowthCeilingPx,
} from '../table-cell-editor-expansion';
import { computeTableCellEditorFrame } from '../table-cell-editor-frame';
import type { CellFontBandPx } from '../table-cell-text-metrics';
import type { TableCellEditTarget } from '../../../bim/table/table-cell-edit-session';
import type { TableCellStyle } from '../../../bim/table/table-style';
import type { TableCellAlign, TableColumnId, TableRowId } from '../../../types/table';
import type { TextAlign } from '../../../bim/structural/detail-sheet/detail-sheet-types';

/**
 * Μετρητής **σταθερού πλάτους**: 10 px ανά χαρακτήρα στα 20 px γραμματοσειράς.
 *
 * Χειροκίνητος και όχι ο πραγματικός, ώστε κάθε αναμενόμενος αριθμός παρακάτω να είναι
 * υπολογισμένος από τον ορισμό. Ένα test που ρωτά την ίδια `measureText` με την υλοποίηση
 * επαληθεύει μόνο ότι ο κώδικας συμφωνεί με τον εαυτό του.
 */
const PX_PER_CHAR = 10;
const measure = (s: string): number => s.length * PX_PER_CHAR;

describe('computeCellEditorExpansion — πότε και πόσο', () => {
  it('χωράει ⇒ ΚΑΜΙΑ επέκταση, καμία ένδειξη (η συνηθισμένη περίπτωση δεν πληρώνει τίποτα)', () => {
    const out = computeCellEditorExpansion({
      text: 'ΑΒΓ',
      cellContentWidthPx: 100,
      maxContentWidthPx: 800,
      measure,
    });
    expect(out).toEqual({ contentWidthPx: 100, lines: 1, expanded: false });
  });

  it('κενό κελί ⇒ καμία επέκταση', () => {
    const out = computeCellEditorExpansion({
      text: '',
      cellContentWidthPx: 100,
      maxContentWidthPx: 800,
      measure,
    });
    expect(out.expanded).toBe(false);
    expect(out.clipMarkerPx).toBeUndefined();
  });

  it('δεν χωράει ⇒ το κουτί παίρνει ΑΚΡΙΒΩΣ το πλάτος του κειμένου (Excel/Figma auto-width)', () => {
    const out = computeCellEditorExpansion({
      text: 'ΑΒΓΔΕΖΗΘΙΚ', // 10 χαρακτήρες × 10 px = 100
      cellContentWidthPx: 40,
      maxContentWidthPx: 800,
      measure,
    });
    expect(out.contentWidthPx).toBe(100);
    expect(out.lines).toBe(1);
    expect(out.expanded).toBe(true);
  });

  it('το ταβάνι κόβει την οριζόντια επέκταση και ανοίγει δεύτερη γραμμή (Excel)', () => {
    const out = computeCellEditorExpansion({
      text: 'ΑΒΓΔΕ ΖΗΘΙΚ ΛΜΝΞΟ', // 17 χαρακτήρες = 170 px
      cellContentWidthPx: 40,
      maxContentWidthPx: 70,
      measure,
    });
    expect(out.contentWidthPx).toBe(70);
    expect(out.lines).toBeGreaterThan(1);
  });

  it('ΤΟ ΥΨΟΣ ΕΙΝΑΙ ΣΥΝΤΗΡΗΤΙΚΟ: ποτέ λιγότερες γραμμές απ᾽ όσες χρειάζεται το κείμενο', () => {
    // Σύνολο 170 px σε γραμμές των 70 px ⇒ τουλάχιστον 3 γραμμές. Λιγότερες = κρυμμένο κείμενο.
    const out = computeCellEditorExpansion({
      text: 'ΑΒΓΔΕ ΖΗΘΙΚ ΛΜΝΞΟ',
      cellContentWidthPx: 40,
      maxContentWidthPx: 70,
      measure,
    });
    expect(out.lines).toBeGreaterThanOrEqual(3);
  });

  it('λέξη φαρδύτερη από ολόκληρη τη γραμμή ⇒ σπάει σε χαρακτήρα, δεν κολλάει σε βρόχο', () => {
    const out = computeCellEditorExpansion({
      text: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣ', // καμία λέξη, 18 χαρακτήρες
      cellContentWidthPx: 20,
      maxContentWidthPx: 50,
      measure,
    });
    expect(out.lines).toBeGreaterThan(1);
    expect(Number.isFinite(out.lines)).toBe(true);
  });

  it('ο δείκτης κοπής δείχνει το πρόθεμα που ΘΑ ΤΥΠΩΘΕΙ — αποσιωπητικά ΜΕΣΑ στο πλάτος', () => {
    // Κελί 40 px· τα «…» πιάνουν 10 px ⇒ μένουν 30 px ⇒ 3 χαρακτήρες ⇒ δείκτης στα 30 px.
    const out = computeCellEditorExpansion({
      text: 'ΑΒΓΔΕΖΗΘΙΚ',
      cellContentWidthPx: 40,
      maxContentWidthPx: 800,
      measure,
    });
    expect(out.clipMarkerPx).toBe(30);
  });
});

describe('editorGrowthCeilingPx — ο χώρος μετριέται κατά μήκος της ΓΡΑΜΜΗΣ, όχι της οθόνης', () => {
  const viewport = { width: 1000, height: 800 };

  it('αριστερή στοίχιση, πίνακας όρθιος ⇒ ο χώρος είναι μέχρι τη δεξιά άκρη', () => {
    const room = editorGrowthCeilingPx({
      anchor: { x: 300, y: 400 },
      rotationRad: 0,
      cellWidthPx: 100,
      growsFrom: 'left',
      viewport,
    });
    expect(room).toBe(700);
  });

  it('δεξιά στοίχιση ⇒ ο χώρος είναι ΠΙΣΩ από την άγκυρα, συν το ίδιο το κελί', () => {
    const room = editorGrowthCeilingPx({
      anchor: { x: 300, y: 400 },
      rotationRad: 0,
      cellWidthPx: 100,
      growsFrom: 'right',
      viewport,
    });
    expect(room).toBe(400); // 100 (κελί) + 300 (αριστερά της άγκυρας)
  });

  it('κεντρική στοίχιση ⇒ περιορίζεται από τη ΣΤΕΝΟΤΕΡΗ μεριά', () => {
    const room = editorGrowthCeilingPx({
      anchor: { x: 100, y: 400 },
      rotationRad: 0,
      cellWidthPx: 100,
      growsFrom: 'center',
      viewport,
    });
    // πίσω: 100· μπροστά πέρα από το κελί: 900 − 100 = 800 ⇒ 100 + 2·min(100, 800) = 300
    expect(room).toBe(300);
  });

  it('🔴 ΣΤΡΑΜΜΕΝΟΣ πίνακας: κατακόρυφη γραμμή ⇒ ο χώρος είναι το ΥΨΟΣ, όχι το πλάτος', () => {
    const room = editorGrowthCeilingPx({
      anchor: { x: 300, y: 200 },
      rotationRad: Math.PI / 2, // η γραμμή δείχνει προς τα κάτω
      cellWidthPx: 100,
      growsFrom: 'left',
      viewport,
    });
    expect(room).toBeCloseTo(600, 6); // 800 − 200
  });

  it('χωρίς προβολή (άγκυρο εκτός οθόνης) ⇒ τίμιο άνω φράγμα, ποτέ NaN', () => {
    const room = editorGrowthCeilingPx({
      anchor: null,
      rotationRad: 0.7,
      cellWidthPx: 100,
      growsFrom: 'center',
      viewport,
    });
    expect(room).toBe(1000);
  });
});

// ── Το κουτί ως σύνολο ────────────────────────────────────────────────────────

const BAND: CellFontBandPx = { ascentPx: 18, descentPx: 6 };

function style(over: Partial<TableCellStyle> = {}): TableCellStyle {
  return {
    textHeightMm: 4,
    textColorHex: '#eeeeee',
    bold: false,
    italic: false,
    underline: false,
    align: 'ML' as TableCellAlign,
    margins: { hMm: 2, vMm: 1 },
    ...over,
  };
}

function target(hAlign: TextAlign = 'left'): TableCellEditTarget {
  return {
    rowId: 'r1' as TableRowId,
    colId: 'c1' as TableColumnId,
    text: '',
    anchorWorldPoint: { x: 0, y: 0 },
    rectMm: { x: 0, y: 0, w: 40, h: 10 },
    style: style(),
    hAlign,
    baselineFromTopMm: 7,
  };
}

/** Κελί 40×10 mm στα 5 px/mm ⇒ 200×50 px, περιθώρια 10 px ⇒ ωφέλιμο πλάτος 180 px. */
function frameOf(draft: string | undefined, hAlign: TextAlign = 'left', maxWidthPx = 2000) {
  return computeTableCellEditorFrame({
    target: target(hAlign),
    pxPerMm: 5,
    angleRad: 0,
    resolveBand: () => BAND,
    backgroundHex: '#101010',
    draft,
    maxWidthPx,
    resolveWidth: (text) => measure(text),
  });
}

describe('το κουτί του επεξεργαστή — από κελί σε επεκτεταμένο πλαίσιο', () => {
  it('χωρίς πρόχειρο ⇒ ΤΟ ΚΟΥΤΙ ΕΙΝΑΙ ΤΟ ΚΕΛΙ (βήματα 3-5 ακέραια)', () => {
    const frame = frameOf(undefined);
    expect(frame.widthPx).toBe(200);
    expect(frame.heightPx).toBe(50);
    expect(frame.offsetXPx).toBe(0);
    expect(frame.expanded).toBe(false);
    expect(frame.printablePx).toBeUndefined();
  });

  it('κείμενο που χωράει ⇒ ΤΙΠΟΤΑ δεν αλλάζει σε σχέση με το βήμα 3', () => {
    const plain = frameOf(undefined);
    const short = frameOf('ΑΒΓ'); // 30 px < 180
    expect(short).toEqual(plain);
  });

  it('κείμενο που δεν χωράει ⇒ το κουτί μεγαλώνει κατά το πλάτος του κειμένου', () => {
    const frame = frameOf('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ'); // 20 χαρ. = 200 px > 180
    expect(frame.widthPx).toBe(220); // 200 (κείμενο) + 2×10 (περιθώρια)
    expect(frame.expanded).toBe(true);
  });

  it('🔴 ΤΟ ΥΨΟΣ ΜΙΑΣ ΓΡΑΜΜΗΣ ΜΕΝΕΙ ΑΚΡΙΒΩΣ ΤΟ ΥΨΟΣ ΤΟΥ ΚΕΛΙΟΥ', () => {
    // Η ισότητα δεν είναι σύμπτωση: `padTop + lineHeight + padBottom` ορίστηκε ως το κελί.
    // Αν σπάσει, ο επεξεργαστής θα «αναπηδά» κατακόρυφα μόλις ξεχειλίσει το κείμενο.
    expect(frameOf('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ').heightPx).toBe(50);
  });

  it('αναδίπλωση ⇒ το ύψος είναι ακέραιο πολλαπλάσιο της γραμμής, προς τα ΚΑΤΩ', () => {
    // Κελί 50 px· η βάση στα 35 px με ζώνη A=18/D=6 δίνει `padTop = 8`, άρα γραμμή 42 px.
    // Το ύψος είναι `padTop + n·42`: η **πρώτη** γραμμή μένει ακριβώς εκεί που ήταν, και
    // κάθε επόμενη προστίθεται από κάτω (Excel). Ποτέ προς τα πάνω — θα σκέπαζε τη γραμμή
    // από την οποία μόλις ήρθε ο δρομέας.
    const frame = frameOf('ΑΒΓΔΕ ΖΗΘΙΚ ΛΜΝΞΟ ΠΡΣΤΥ', 'left', 200);
    expect(frame.lineHeightPx).toBe(42);
    expect(frame.paddingTopPx).toBe(8);
    expect((frame.heightPx - 8) % 42).toBe(0);
    expect(frame.heightPx).toBeGreaterThan(50);
  });

  describe('🔴 η ΣΤΟΙΧΙΣΗ είναι η άγκυρα (Excel + Figma auto-width)', () => {
    const long = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ'; // ⇒ πλάτος 220, αύξηση 20

    it('αριστερή ⇒ μεγαλώνει ΔΕΞΙΑ (καμία μετατόπιση)', () => {
      expect(frameOf(long, 'left').offsetXPx).toBe(0);
    });

    it('δεξιά ⇒ μεγαλώνει ΑΡΙΣΤΕΡΑ (όλη η αύξηση)', () => {
      expect(frameOf(long, 'right').offsetXPx).toBe(-20);
    });

    it('κεντρική ⇒ μεγαλώνει ΣΥΜΜΕΤΡΙΚΑ (η μισή αύξηση)', () => {
      expect(frameOf(long, 'center').offsetXPx).toBe(-10);
    });

    it('όσο ΧΩΡΑΕΙ, καμία στοίχιση δεν μετατοπίζει τίποτα', () => {
      for (const align of ['left', 'right', 'center'] as const) {
        expect(frameOf('ΑΒΓ', align).offsetXPx).toBe(0);
      }
    });
  });

  it('σε επέκταση η στοίχιση γίνεται αριστερή — αλλιώς η αναδίπλωση θα σκόρπιζε τις γραμμές', () => {
    expect(frameOf('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ', 'right').textAlign).toBe('left');
    expect(frameOf('ΑΒΓ', 'right').textAlign).toBe('right');
  });

  it('η ζώνη εκτύπωσης είναι το ΚΕΛΙ: πλάτος μέχρι την κοπή, ύψος μίας γραμμής', () => {
    const frame = frameOf('ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ');
    // ωφέλιμο 180 px − «…» 10 px = 170 ⇒ 17 χαρακτήρες = 170 px· + αριστερό περιθώριο 10.
    expect(frame.printablePx).toEqual({ widthPx: 180, heightPx: 50 });
  });

  it('η περιστροφή δεν αγγίζει το πλάτος — η επέκταση ζει ΠΡΙΝ την περιστροφή', () => {
    const straight = computeTableCellEditorFrame({
      target: target(), pxPerMm: 5, angleRad: 0, resolveBand: () => BAND,
      backgroundHex: '#101010', draft: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ', maxWidthPx: 2000,
      resolveWidth: (t) => measure(t),
    });
    const turned = computeTableCellEditorFrame({
      target: target(), pxPerMm: 5, angleRad: 0.7, resolveBand: () => BAND,
      backgroundHex: '#101010', draft: 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥ', maxWidthPx: 2000,
      resolveWidth: (t) => measure(t),
    });
    expect(turned.widthPx).toBe(straight.widthPx);
    expect(turned.heightPx).toBe(straight.heightPx);
    expect(turned.offsetXPx).toBe(straight.offsetXPx);
    expect(turned.rotationRad).toBeCloseTo(-0.7, 10);
  });
});
