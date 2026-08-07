/**
 * 🔴 ADR-771 Φ.2 — **Η ΑΓΚΥΡΑ ΤΟΥ ΦΥΛΛΟΥ**: ζωγραφίζεται, πότε, πόσες φορές, και με τι σχήμα.
 *
 * ## Γιατί χρειάζεται άγκυρα, και όχι μόνο πύλη
 * Το ίδιο μάθημα με τη **Φ.1** και τη **Φ.3**, τρίτη φορά: όταν άλλαξε η γωνία του σήματος
 * κελιού, **και τα 170** υπάρχοντα tests του φακέλου έμειναν πράσινα, γιατί καμία άγκυρα δεν
 * κλείδωνε **πού** ζωγραφίζεται· όταν προστέθηκε το casing, τα **67** της Φ.3 έμειναν επίσης
 * πράσινα. Ένα πέρασμα ζωγραφικής που κανένα test δεν καταγράφει μπορεί να εμφανιστεί, να
 * εξαφανιστεί ή να αλλάξει σχήμα χωρίς κανένα ίχνος.
 *
 * ## Ο καταγραφέας ΥΠΑΡΧΕΙ ΗΔΗ — δεν γράφεται δεύτερος
 * `table-paint-recorder.ts` καταγράφει **πραγματικές** κλήσεις σχεδίασης, με τις υποδιαδρομές
 * σε **px οθόνης μετά τον ενεργό μετασχηματισμό**. Ένας δεύτερος καταγραφέας θα ήταν sibling
 * clone (CHECK 3.28 / N.18) — και, χειρότερα, δεύτερη απάντηση στο «τι ζωγραφίστηκε;».
 *
 * ## 🔴 ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ: δεν υπολογίζει τίποτα με τη συνάρτηση που κρίνει
 * Το `table-ink.test.ts:128` υπολογίζει τον αναμενόμενο νικητή καλώντας το **ίδιο**
 * `contrastRatio` της υλοποίησης, οπότε μια αλλαγή μεζούρας μετακινεί **και τα δύο σκέλη
 * μαζί** και το test μένει πράσινο πάνω στην αλλαγή που φυλάει. Εδώ κάθε αναμενόμενη τιμή
 * είναι **σταθερά**, μετρημένη μία φορά από την πηγή και γραμμένη κυριολεκτικά.
 *
 * @module rendering/entities/table/__tests__/table-sheet-paint.test
 * @see rendering/entities/table/stamp-table-sheet.ts — ο ζωγράφος
 * @see bim/table/table-ink.ts — `liveTableSurface()`, η απόφαση
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, parseHex } from '../../../../config/color-math';
import {
  DELIVERABLE_PAPER_SURFACE,
  liveTableSurface,
  TABLE_PAPER_HEX,
  TABLE_SHEET_HEX,
  tableSurfaceShowsPaper,
} from '../../../../bim/table/table-ink';
import { maxContrastInk, MIN_ENTITY_CONTRAST } from '../../../../config/adaptive-entity-color';
import {
  clearPrintColorPolicy,
  setPrintColorPolicy,
} from '../../../../config/print-color-policy';
import {
  resetTableSurfaceModeForTest,
  setTableSurfaceMode,
  type TableSurfaceMode,
} from '../../../../systems/table-surface/table-surface-mode';
import { createTableModel } from '../../../../bim/table/table-model-helpers';
import { layoutTable } from '../../../../bim/table/table-layout';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../../../../bim/table/table-style-presets';
import type { TableStyle, TableTextMeasurer } from '../../../../bim/table/table-layout-types';
import type { TableLayout } from '../../../../bim/table/table-layout-types';
import type { Point2D } from '../../../types/Types';
import { stampTableSheet } from '../stamp-table-sheet';
import { createPaintLog, createRc, RECORDER_DARK_SURFACE, type PaintLog } from './table-paint-recorder';

const STANDARD: TableStyle =
  BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD)!;

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

function sampleLayout(surfaceHex: string): TableLayout {
  const model = createTableModel({
    columns: [{ id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r0', rowClass: 'header' }, { id: 'r1', rowClass: 'data' }],
    cells: [
      ['r0', 'c0', { kind: 'text', value: 'Κεφαλίδα' }],
      ['r1', 'c0', { kind: 'text', value: 'Νέστωρ' }],
    ],
  });
  return layoutTable(model, STANDARD, { surfaceHex, measureText });
}

/** Ένα πέρασμα φύλλου — ρητή αποτυχία αν γίνουν δύο ή κανένα. */
function soleSheetFill(log: PaintLog) {
  expect(log.fillPaths).toHaveLength(1);
  return log.fillPaths[0];
}

function paintSheet(options: { surfaceHex: string; surfacePaint: boolean; toScreen?: (u: number, v: number) => Point2D }) {
  const log = createPaintLog();
  const layout = sampleLayout(options.surfaceHex);
  stampTableSheet(createRc(log, options), layout);
  return { log, layout };
}

beforeEach(() => {
  clearPrintColorPolicy();
  resetTableSurfaceModeForTest();
});

afterEach(() => {
  clearPrintColorPolicy();
  resetTableSurfaceModeForTest();
});

// ── Μ0. ΒΑΘΜΟΝΟΜΗΣΗ ──────────────────────────────────────────────────────────

/**
 * 🔴 **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΕΤΥΜΗΓΟΡΙΑ.** Στη Φ.3 το ωμό ζευγάρωμα δύο SSoT με αντίθετες συμβάσεις
 * μονάδων (0..1 vs 0..255) απαντούσε **20,9 για κάθε επιφάνεια** — «όλα εντάξει, πάντα» —
 * και χωρίς αυτόν τον έλεγχο η πύλη θα είχε γεννηθεί μονίμως πράσινη. Αν αυτά τα δύο
 * σπάσουν, **κανένας** αριθμός παρακάτω δεν σημαίνει τίποτα.
 */
describe('Μ0 — βαθμονόμηση της μεζούρας', () => {
  it('λευκό ↔ μαύρο = 21,00 ακριβώς', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 6);
  });

  it('το σύνορο του αυτόματου μελανιού είναι ΑΚΡΙΒΩΣ εκεί που το μέτρησε το ADR-771 §6.2', () => {
    // Σταθερές, όχι υπολογισμοί: αυτές οι δύο τιμές ορίζουν ΤΗ ΜΙΑ εναλλαγή σε όλο τον
    // άξονα του γκρι, και μια αλλαγή μεζούρας τις μετακινεί.
    expect(maxContrastInk('#757575')).toBe('#ffffff');
    expect(maxContrastInk('#767676')).toBe('#000000');
  });
});

// ── Α. Η ΑΠΟΦΑΣΗ: πότε υπάρχει φύλλο ─────────────────────────────────────────

describe('Α — `liveTableSurface()`: τρεις καταστάσεις, και η εκτύπωση από πάνω τους', () => {
  it('ΚΑΜΒΑΣ (προεπιλογή) ⇒ ΔΕΝ ζωγραφίζεται φύλλο — η ιστορική συμπεριφορά ακέραιη', () => {
    expect(liveTableSurface().paint).toBe(false);
  });

  it('ΦΥΛΛΟ ⇒ ζωγραφίζεται, με το χρώμα του φύλλου', () => {
    setTableSurfaceMode('sheet');
    expect(liveTableSurface()).toEqual({ hex: TABLE_SHEET_HEX, paint: true });
  });

  it('ΧΑΡΤΙ ως ΘΕΑΣΗ ⇒ ζωγραφίζεται: εκεί δεν υπάρχει χαρτί από κάτω, υπάρχει καμβάς', () => {
    setTableSurfaceMode('paper');
    expect(liveTableSurface()).toEqual({ hex: TABLE_PAPER_HEX, paint: true });
  });

  /**
   * 🔴 **Η ΓΡΑΜΜΗ ΠΟΥ ΠΡΟΣΤΑΤΕΥΕΙ ΤΟ ΠΑΡΑΔΟΤΕΟ.** Στην πραγματική εκτύπωση τη λευκή σελίδα
   * την παρέχει το **μέσο**· ένα αδιαφανές λευκό ορθογώνιο θα έκρυβε τις γραμμές του σχεδίου
   * κάτω από τον πίνακα, δηλαδή θα άλλαζε το ίδιο το παραδοτέο. Ίδιο `hex`, **αντίθετο**
   * `paint` — γι' αυτό το `paint` δεν είναι και δεν μπορεί να γίνει παράγωγο του χρώματος.
   */
  it('🔴 ΠΡΑΓΜΑΤΙΚΗ ΕΚΤΥΠΩΣΗ ⇒ χαρτί ΧΩΡΙΣ ζωγραφική — ίδιο hex, αντίθετο paint', () => {
    setPrintColorPolicy({ style: 'colour', dpi: 300 });
    expect(liveTableSurface()).toEqual({ hex: TABLE_PAPER_HEX, paint: false });
  });

  it('🔴 η εκτύπωση ΝΙΚΑ την προτίμηση θέασης — αλλιώς λευκά γράμματα σε λευκό χαρτί', () => {
    for (const mode of ['canvas', 'sheet', 'paper'] satisfies TableSurfaceMode[]) {
      setTableSurfaceMode(mode);
      setPrintColorPolicy({ style: 'colour', dpi: 300 });
      expect(liveTableSurface()).toEqual({ hex: TABLE_PAPER_HEX, paint: false });
      clearPrintColorPolicy();
    }
  });

  it('κάθε παραδοτέο (εξαγωγή · 3Δ · tests) παίρνει χαρτί ΧΩΡΙΣ ζωγραφική', () => {
    expect(DELIVERABLE_PAPER_SURFACE).toEqual({ hex: TABLE_PAPER_HEX, paint: false });
  });
});

// ── Β. Η ΕΝΟΠΟΙΗΜΕΝΗ ΕΡΩΤΗΣΗ «είμαι πάνω σε χαρτί;» ──────────────────────────

/**
 * Το `table-bound-state-paper-isolation.test.ts` απαγορεύει ρητά **δεύτερη σημαία** για αυτή
 * την ερώτηση. Η Φ.2 δεν πρόσθεσε δεύτερη — **διεύρυνε** την υπάρχουσα, ώστε η παλιά να
 * περιέχεται. Αυτά τα tests κλειδώνουν τον εγκλεισμό και προς τις δύο κατευθύνσεις.
 */
describe('Β — `tableSurfaceShowsPaper()`: υπερσύνολο, όχι δεύτερη σημαία', () => {
  it('ΚΑΜΒΑΣ και ΦΥΛΛΟ ⇒ όχι χαρτί: τα βοηθήματα οθόνης παραμένουν', () => {
    expect(tableSurfaceShowsPaper()).toBe(false);
    setTableSurfaceMode('sheet');
    expect(tableSurfaceShowsPaper()).toBe(false);
  });

  it('ΧΑΡΤΙ ως θέαση ⇒ ναι — η προεπισκόπηση δεν επιτρέπεται να δείχνει ό,τι δεν τυπώνεται', () => {
    setTableSurfaceMode('paper');
    expect(tableSurfaceShowsPaper()).toBe(true);
  });

  it('🔴 η ΠΑΛΙΑ ερώτηση περιέχεται: εκτύπωση ⇒ ναι, από ΚΑΘΕ κατάσταση θέασης', () => {
    for (const mode of ['canvas', 'sheet', 'paper'] satisfies TableSurfaceMode[]) {
      setTableSurfaceMode(mode);
      setPrintColorPolicy({ style: 'monochrome', dpi: 300 });
      expect(tableSurfaceShowsPaper()).toBe(true);
      clearPrintColorPolicy();
    }
  });
});

// ── Γ. ΤΙ ΖΩΓΡΑΦΙΖΕΤΑΙ ΠΡΑΓΜΑΤΙΚΑ ────────────────────────────────────────────

describe('Γ — ο ζωγράφος: μηδέν ή ένα πέρασμα, ποτέ δύο', () => {
  it('🔴 ΚΑΜΒΑΣ ⇒ ΜΗΔΕΝ κλήση σχεδίασης: ό,τι είναι κάτω από τον πίνακα φαίνεται', () => {
    const { log } = paintSheet({ surfaceHex: RECORDER_DARK_SURFACE, surfacePaint: false });
    expect(log.fillPaths).toHaveLength(0);
    expect(log.fills).toHaveLength(0);
    expect(log.rects).toHaveLength(0);
    expect(log.strokes).toHaveLength(0);
  });

  it('ΦΥΛΛΟ ⇒ ΑΚΡΙΒΩΣ ένα γεμισμένο πέρασμα', () => {
    const { log } = paintSheet({ surfaceHex: TABLE_SHEET_HEX, surfacePaint: true });
    expect(soleSheetFill(log).subpaths).toHaveLength(1);
  });

  /**
   * 🔴 **Ο ζωγράφος δεν επιλέγει χρώμα.** Ζωγραφίζει το `surfaceHex` πάνω στο οποίο η διάταξη
   * μόλις υπολόγισε κάθε μελάνι. Δεύτερη πηγή θα σήμαινε πίνακα που στρώνει φύλλο διαφορετικό
   * από αυτό που υπέθεσε όταν διάλεγε λευκά ή μαύρα γράμματα.
   */
  it('🔴 το χρώμα είναι ΤΟ ΙΔΙΟ `surfaceHex`, ποτέ δεύτερη πηγή', () => {
    for (const hex of [TABLE_SHEET_HEX, TABLE_PAPER_HEX, '#123456']) {
      const { log } = paintSheet({ surfaceHex: hex, surfacePaint: true });
      expect(soleSheetFill(log).color).toBe(hex);
    }
  });

  /**
   * 🔴 **ΤΕΣΣΕΡΙΣ ΚΟΡΥΦΕΣ, ΟΧΙ `fillRect`.** Ο πίνακας περιστρέφεται· ένα ορθογώνιο σε px
   * οθόνης θα έμενε ίσιο μέσα σε γερμένο πλαίσιο. Το `rects` του καταγραφέα είναι **κενό**
   * επίτηδες: αν κάποιος αντικαταστήσει τη διαδρομή με `fillRect`, αυτή η γραμμή πέφτει.
   */
  it('🔴 πολύγωνο τεσσάρων κορυφών — ΠΟΤΕ `fillRect`', () => {
    const { log } = paintSheet({ surfaceHex: TABLE_SHEET_HEX, surfacePaint: true });
    expect(log.rects).toHaveLength(0);
    expect(soleSheetFill(log).subpaths[0]).toHaveLength(4);
  });

  it('καλύπτει ΟΛΟΚΛΗΡΟ το πλαίσιο, όχι το ορατό παράθυρο', () => {
    const { log, layout } = paintSheet({ surfaceHex: TABLE_SHEET_HEX, surfacePaint: true });
    // Ταυτοτική προβολή ⇒ px οθόνης === sheet-mm, οπότε οι κορυφές είναι το πλαίσιο αυτούσιο.
    expect(soleSheetFill(log).subpaths[0]).toEqual([
      { x: 0, y: 0 },
      { x: layout.widthMm, y: 0 },
      { x: layout.widthMm, y: layout.heightMm },
      { x: 0, y: layout.heightMm },
    ]);
  });
});

// ── Δ. Η ΣΤΡΟΦΗ — το σημείο όπου το `fillRect` θα φαινόταν σωστό ─────────────

/**
 * 🔴 Η **μόνη** δοκιμασία που ξεχωρίζει το σωστό από το εύκολο. Κάθε πίνακας με `angleRad = 0`
 * — δηλαδή κάθε πίνακας που δοκιμάζει κανείς πρώτο — φαίνεται σωστός και με `fillRect`.
 */
describe('Δ — το φύλλο ΑΚΟΛΟΥΘΕΙ τη στροφή του πίνακα', () => {
  /** Στροφή 90° δεξιόστροφα στους άξονες οθόνης: (u, v) → (−v, u). */
  const rotated90 = (u: number, v: number): Point2D => ({ x: -v, y: u });

  it('οι τέσσερις κορυφές είναι ΠΡΟΒΕΒΛΗΜΕΝΕΣ, όχι ευθυγραμμισμένες στους άξονες', () => {
    const { log, layout } = paintSheet({
      surfaceHex: TABLE_SHEET_HEX,
      surfacePaint: true,
      toScreen: rotated90,
    });
    expect(soleSheetFill(log).subpaths[0]).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: layout.widthMm },
      { x: -layout.heightMm, y: layout.widthMm },
      { x: -layout.heightMm, y: 0 },
    ]);
  });

  it('🔴 ένα `fillRect` ΔΕΝ θα μπορούσε να δώσει αυτό το σχήμα', () => {
    const { log } = paintSheet({
      surfaceHex: TABLE_SHEET_HEX,
      surfacePaint: true,
      toScreen: rotated90,
    });
    const [tl, tr] = soleSheetFill(log).subpaths[0];
    // Σε ορθογώνιο ευθυγραμμισμένο στους άξονες, η πάνω ακμή έχει σταθερό y. Εδώ δεν έχει —
    // και αυτή είναι όλη η διαφορά ανάμεσα σε πολύγωνο και σε `fillRect`.
    expect(tr.y).not.toBeCloseTo(tl.y, 6);
  });
});

// ── Ε. Η ΤΙΜΗ ΤΟΥ ΦΥΛΛΟΥ — σταθερές, μετρημένες από την πηγή ─────────────────

/**
 * ⚠️ Κάθε αριθμός εδώ είναι **σταθερά**, όχι υπολογισμός από τη συνάρτηση που κρίνεται. Το
 * `5.27` και το `1.09` μετρήθηκαν μία φορά με το `lib/contrast/wcag-contrast` και γράφτηκαν
 * κυριολεκτικά· αν κάποιος αλλάξει τη μεζούρα, αυτά τα tests **πέφτουν** — που είναι ακριβώς
 * η δουλειά τους.
 */
describe('Ε — η τιμή `TABLE_SHEET_HEX`, μετρημένη', () => {
  it('είναι πραγματικό χρώμα, και ΔΕΝ είναι το χαρτί', () => {
    expect(parseHex(TABLE_SHEET_HEX)).not.toBeNull();
    expect(TABLE_SHEET_HEX).not.toBe(TABLE_PAPER_HEX);
  });

  it('το αυτόματο μελάνι πάνω του είναι ΜΑΥΡΟ', () => {
    expect(maxContrastInk(TABLE_SHEET_HEX)).toBe('#000000');
  });

  it('το πλέγμα #666666 μένει αναγνώσιμο: 5,27:1 ≥ 3,0', () => {
    expect(contrastRatio('#666666', TABLE_SHEET_HEX)).toBeCloseTo(5.27, 2);
    expect(contrastRatio('#666666', TABLE_SHEET_HEX)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
  });

  /**
   * 🔴 **ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΟΡΙΣΕ ΤΟΝ ΣΧΕΔΙΑΣΜΟ, ΚΛΕΙΔΩΜΕΝΟ ΩΣ ΓΕΓΟΝΟΣ.**
   *
   * Φύλλο και χαρτί απέχουν **1,09:1** — οπτικά αδιάκριτα. Δεν είναι ελάττωμα αυτής της
   * τιμής· είναι ιδιότητα του άξονα του ουδέτερου ανοιχτού γκρι. Γι' αυτό ο φορέας της
   * διάκρισης «Φύλλο vs Χαρτί» είναι ο **μόνιμα ορατός δείκτης κατάστασης** και όχι η
   * απόχρωση (WCAG 1.4.1 — το ίδιο μάθημα με τη Φ.1).
   *
   * Αν κάποιος αύριο «διορθώσει» την τιμή για να ξεχωρίζει, αυτό το test πέφτει και τον
   * στέλνει εδώ: **η διάκριση δεν κερδίζεται με χρώμα.**
   */
  it('🔴 απέχει μόλις 1,09:1 από το χαρτί — γι΄ αυτό ο δείκτης, όχι το χρώμα, κάνει τη διάκριση', () => {
    expect(contrastRatio(TABLE_SHEET_HEX, TABLE_PAPER_HEX)).toBeCloseTo(1.09, 2);
  });
});

// ── ΣΤ. Z-ORDER — το κενό που άφηναν όλα τα παραπάνω ─────────────────────────

/**
 * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΒΡΕΘΗΚΕ ΜΕ ΜΕΤΑΛΛΑΞΗ, ΜΕΣΑ ΣΕ ΑΥΤΗ ΤΗΝ ΙΔΙΑ ΣΟΥΙΤΑ.**
 *
 * Οι ομάδες Α–Ε δοκιμάζουν τον ζωγράφο **απομονωμένα**, και είναι όλες πράσινες ακόμα κι αν
 * κάποιος μετακινήσει την κλήση `stampTableSheet` **μετά** το `stampTableText`. Τότε ένα
 * αδιαφανές ορθογώνιο θα ζωγραφιζόταν πάνω από όλα και ο πίνακας θα ήταν **κενό λευκό
 * πλαίσιο** — με 22/22 πράσινα. Είναι το ίδιο σχήμα που πλήρωσαν οι 170 άγκυρες της Φ.1 και
 * οι 67 της Φ.3: *το test επιβεβαιώνει ότι ο κώδικας συμφωνεί με τον εαυτό του.*
 *
 * ⚠️ Ο έλεγχος είναι **στατικός επίτηδες**. Μια εκτέλεση των ζωγράφων στη σειρά που γράφει το
 * ίδιο το test θα ήταν ταυτολογία — θα επιβεβαίωνε τη σειρά που **εγώ** επέλεξα εδώ, όχι τη
 * σειρά που εκτελεί ο `TableRenderer`. Η μόνη πηγή αλήθειας για το z-order είναι το αρχείο.
 */
describe('ΣΤ — το φύλλο είναι ΠΡΩΤΟ στη σειρά του `TableRenderer`', () => {
  const RENDERER = readFileSync(
    join(__dirname, '..', '..', 'TableRenderer.ts').split('\\').join('/'),
    'utf-8',
  );

  /** Η θέση της **κλήσης** (όχι του import) — `\n    ` σημαίνει «εντολή μέσα σε μέθοδο». */
  function callIndex(name: string): number {
    const at = RENDERER.indexOf(`\n    ${name}(`);
    // ⚠️ Σκάει αντί να επιστρέψει −1: ένα «δεν βρέθηκε» που περνά ως «πρώτο» θα ήταν
    // πράσινο test πάνω σε ζωγράφο που δεν καλείται καθόλου (μάθημα Windows/`gitShow`).
    expect(at).toBeGreaterThan(-1);
    return at;
  }

  it('🔴 `stampTableSheet` καλείται ΠΡΙΝ από τα γεμίσματα, την επιλογή, το πλέγμα και το κείμενο', () => {
    const sheet = callIndex('stampTableSheet');
    for (const later of ['stampTableFills', 'stampTableBorders', 'stampTableText']) {
      expect(sheet).toBeLessThan(callIndex(later));
    }
  });

  it('καλείται ΧΩΡΙΣ συνθήκη — ο φρουρός ζει μέσα στον ζωγράφο, όχι στον καλούντα', () => {
    // Ένα `if (…) stampTableSheet(` στον καλούντα θα ήταν δεύτερο σημείο απόφασης, που
    // μπορεί να αποκλίνει από το `surfacePaint` της γεωμετρίας.
    expect(RENDERER).toContain('\n    stampTableSheet(rc, layout);');
  });
});
