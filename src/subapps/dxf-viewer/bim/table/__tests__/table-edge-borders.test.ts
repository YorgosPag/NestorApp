/**
 * ADR-750 Φάση 1 — **η σειρά προτεραιότητας, μετρημένη στη ζωντανή μηχανή**.
 *
 * Κάθε test εδώ περνά από το πραγματικό `layoutTable`, δηλαδή από την ίδια διαδρομή που
 * τροφοδοτεί καμβά / PDF / σκηνή / DXF. Ένα test που καλούσε κατευθείαν το `horizontalSpec`
 * θα απαντούσε «ποιο μολύβι διάλεξε η συνάρτηση», όχι «τι θα δει ο χρήστης» — και ακριβώς η
 * διαφορά των δύο είναι όπου κρύβονται η συγχώνευση, η ένωση τμημάτων και η αόρατη ακμή.
 *
 * Ο μετρητής κειμένου είναι ενεθειμένος και ντετερμινιστικός, για τον λόγο που εξηγεί το
 * `table-layout.test.ts` — **όχι** ως δεύτερη υλοποίηση μέτρησης (N.18).
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import { TABLE_EDGE_END } from '../table-edge-model';
import {
  BUILTIN_TABLE_STYLE_IDS,
  BUILTIN_TABLE_STYLES,
  DETAIL_SHEET_ROW_HEIGHT_MM,
  DETAIL_SHEET_RULE,
  DETAIL_SHEET_RULE_HEX,
} from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableBorderSegment, TableTextMeasurer } from '../table-layout-types';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableBorderSpec, TableEdgeEntry } from '../../../types/table-edges';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);
/** Χωρίς κανένα πλέγμα όσο όλες οι γραμμές είναι ίδιας κλάσης — ιδανική «λευκή σελίδα». */
const DETAIL_SHEET = styleById(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);

const W = 10;
const H = DETAIL_SHEET_ROW_HEIGHT_MM;

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: W }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: W }, valueType: 'text', align: 'left' },
];

function rows(...classes: readonly TableRow['rowClass'][]): TableRow[] {
  return classes.map((rowClass, i) => ({ id: `r${i + 1}`, rowClass, heightMm: H }));
}

const PEN: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 0.7 };
const ERASER: TableBorderSpec = { visible: false, colorHex: '#000000', widthMm: 0 };

function borders(
  style: TableStyle,
  rowList: readonly TableRow[],
  edges: readonly TableEdgeEntry[],
  merges: Parameters<typeof createTableModel>[0]['merges'] = [],
): readonly TableBorderSegment[] {
  const model = createTableModel({ columns: COLUMNS, rows: rowList, edges, merges });
  return layoutTable(model, style, { measureText }).borders;
}

/** Ένα τμήμα ως αναγνώσιμη πρόταση: «από → προς, με τι χρώμα». */
function describeSegments(segments: readonly TableBorderSegment[]): readonly string[] {
  return segments.map((s) => `(${s.a.x},${s.a.y})→(${s.b.x},${s.b.y}) ${s.spec.colorHex}`);
}

// ── Επίπεδο 1 εναντίον καθενός από τα υπόλοιπα τρία ─────────────────────────

describe('σειρά προτεραιότητας — η ρητή ακμή νικά ΚΑΘΕ άλλο επίπεδο', () => {
  it('νικά το επίπεδο 4 (`insideH` της κλάσης) — και ΣΠΑΕΙ τη γραμμή ανά στήλη', () => {
    // Αυτό είναι το «περίγραμμα σε μεμονωμένο κελί»: μέχρι τώρα μια οριζόντια ακμή είχε
    // αναγκαστικά το ίδιο μολύβι σε όλο το πλάτος, γιατί η πηγή ήταν πάντα η γραμμή.
    const plain = borders(STANDARD, rows('data', 'data'), []);
    const interiorPlain = plain.filter((s) => s.a.y === H && s.b.y === H);
    expect(describeSegments(interiorPlain)).toEqual([`(0,${H})→(${2 * W},${H}) #666666`]);

    const withEdge = borders(STANDARD, rows('data', 'data'), [['H', 'r2', 'c1', PEN]]);
    const interior = withEdge.filter((s) => s.a.y === H && s.b.y === H);
    expect(describeSegments(interior)).toEqual([
      `(0,${H})→(${W},${H}) #ff00ff`,
      `(${W},${H})→(${2 * W},${H}) #666666`,
    ]);
  });

  it('νικά το επίπεδο 3 (σύνορο κλάσεων: το `bottom` της κεφαλίδας)', () => {
    const rowList = rows('header', 'data');
    const inherited = borders(DETAIL_SHEET, rowList, []);
    expect(inherited).toHaveLength(1);
    expect(inherited[0].spec.colorHex).toBe(DETAIL_SHEET_RULE_HEX);

    const overridden = borders(DETAIL_SHEET, rowList, [
      ['H', 'r2', 'c1', PEN],
      ['H', 'r2', 'c2', PEN],
    ]);
    expect(describeSegments(overridden)).toEqual([`(0,${H})→(${2 * W},${H}) #ff00ff`]);
  });

  it('νικά το επίπεδο 2 (`TableRow.borderTop` — η γραμμή-σύνολο)', () => {
    const rowList: TableRow[] = [
      { id: 'r1', rowClass: 'data', heightMm: H },
      { id: 'r2', rowClass: 'data', heightMm: H, borderTop: DETAIL_SHEET_RULE },
    ];
    expect(borders(DETAIL_SHEET, rowList, [])[0].spec.colorHex).toBe(DETAIL_SHEET_RULE_HEX);

    const overridden = borders(DETAIL_SHEET, rowList, [['H', 'r2', 'c2', PEN]]);
    // Η γραμμή-σύνολο κρατά τη στήλη που δεν παρακάμφθηκε· η ρητή ακμή παίρνει τη δική της.
    expect(describeSegments(overridden)).toEqual([
      `(0,${H})→(${W},${H}) ${DETAIL_SHEET_RULE_HEX}`,
      `(${W},${H})→(${2 * W},${H}) #ff00ff`,
    ]);
  });

  it('η ρητή ακμή που ΣΥΜΦΩΝΕΙ με το κληρονομημένο μολύβι δεν σπάει το τμήμα', () => {
    // Η ένωση κοιτά **τιμή**, όχι προέλευση: αλλιώς κάθε «βάψε ό,τι ήδη υπάρχει» θα
    // διπλασίαζε τα τμήματα που φτάνουν σε PDF/DXF χωρίς καμία οπτική διαφορά.
    const grid: TableBorderSpec = { visible: true, colorHex: '#666666', widthMm: 0.25 };
    const segments = borders(STANDARD, rows('data', 'data'), [['H', 'r2', 'c1', grid]]);
    const interior = segments.filter((s) => s.a.y === H && s.b.y === H);
    expect(interior).toHaveLength(1);
  });
});

// ── Το παράπονο Π3: «το περίγραμμα δεν φεύγει» ─────────────────────────────

describe('«Χωρίς περίγραμμα» — σβήνει, και ΜΕΝΕΙ σβηστό', () => {
  it('αόρατη ρητή ακμή εξαφανίζει τη γραμμή που επέβαλλε η κλάση', () => {
    const rowList = rows('header', 'data');
    expect(borders(DETAIL_SHEET, rowList, [])).toHaveLength(1);

    const erased = borders(DETAIL_SHEET, rowList, [
      ['H', 'r2', 'c1', ERASER],
      ['H', 'r2', 'c2', ERASER],
    ]);
    expect(erased).toHaveLength(0);
  });

  it('αόρατη ακμή δεν φτάνει ποτέ σε backend ως «γραμμή μηδενικού πάχους»', () => {
    const segments = borders(STANDARD, rows('data', 'data'), [['H', 'r2', 'c1', ERASER]]);
    expect(segments.every((s) => s.spec.visible)).toBe(true);
    const interior = segments.filter((s) => s.a.y === H && s.b.y === H);
    expect(describeSegments(interior)).toEqual([`(${W},${H})→(${2 * W},${H}) #666666`]);
  });
});

// ── Περίγραμμα γύρω από ΕΝΑ κελί, πάνω σε λευκή σελίδα ─────────────────────

describe('«Όλα τα περιγράμματα» σε ένα κελί — οι τέσσερις ακμές του, και τίποτε άλλο', () => {
  it('τέσσερα τμήματα που κλείνουν ακριβώς το κελί (r2, c1)', () => {
    const segments = borders(DETAIL_SHEET, rows('data', 'data', 'data'), [
      ['H', 'r2', 'c1', PEN], // πάνω
      ['H', 'r3', 'c1', PEN], // κάτω = η πάνω του από κάτω, ΕΝΑ όνομα
      ['V', 'r2', 'c1', PEN], // αριστερά
      ['V', 'r2', 'c2', PEN], // δεξιά
    ]);

    expect(describeSegments(segments)).toEqual([
      `(0,${H})→(${W},${H}) #ff00ff`,
      `(0,${2 * H})→(${W},${2 * H}) #ff00ff`,
      `(0,${H})→(0,${2 * H}) #ff00ff`,
      `(${W},${H})→(${W},${2 * H}) #ff00ff`,
    ]);
  });

  it('το sentinel δίνει το κάτω και το δεξί σύνορο του ΠΙΝΑΚΑ', () => {
    const rowList = rows('data', 'data');
    const segments = borders(DETAIL_SHEET, rowList, [
      ['H', TABLE_EDGE_END, 'c2', PEN],
      ['V', 'r1', TABLE_EDGE_END, PEN],
    ]);
    expect(describeSegments(segments)).toEqual([
      `(${W},${2 * H})→(${2 * W},${2 * H}) #ff00ff`,
      `(${2 * W},0)→(${2 * W},${H}) #ff00ff`,
    ]);
  });
});

// ── Η συγχώνευση κερδίζει τη ρητή ακμή ─────────────────────────────────────

describe('⚠️ ρητή ακμή ΜΕΣΑ σε συγχώνευση — δεν ζωγραφίζεται ποτέ', () => {
  it('η κατακόρυφη μέσα σε οριζόντια συγχώνευση παραμένει ανύπαρκτη', () => {
    // Αν το επίπεδο 1 μπορούσε να την επαναφέρει, το πλέγμα θα φαινόταν **μέσα** από το
    // συγχωνευμένο κελί: μια μορφοποίηση θα ακύρωνε μια δομική πράξη.
    const segments = borders(
      DETAIL_SHEET,
      rows('data'),
      [['V', 'r1', 'c2', PEN]],
      [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 2 }],
    );
    expect(segments).toHaveLength(0);
  });

  it('η οριζόντια μέσα σε κατακόρυφη συγχώνευση παραμένει ανύπαρκτη', () => {
    const segments = borders(
      DETAIL_SHEET,
      rows('data', 'data'),
      [['H', 'r2', 'c1', PEN]],
      [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 2, colSpan: 1 }],
    );
    expect(segments).toHaveLength(0);
  });

  it('η ίδια ακμή ΕΞΩ από τη συγχώνευση ζωγραφίζεται κανονικά', () => {
    // Το φράγμα είναι της συγχώνευσης, όχι της ρητής ακμής — αλλιώς θα ήταν αδύνατο να
    // βαφτεί ό,τι βρίσκεται δίπλα σε συγχωνευμένο κελί.
    const segments = borders(
      DETAIL_SHEET,
      rows('data', 'data'),
      [['H', 'r2', 'c2', PEN]],
      [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 2, colSpan: 1 }],
    );
    expect(describeSegments(segments)).toEqual([`(${W},${H})→(${2 * W},${H}) #ff00ff`]);
  });
});

// ── Α24: η διπλή γραμμή αποσυντίθεται ΣΤΗ ΔΙΑΤΑΞΗ, με μετρήσιμη απόσταση ────

/**
 * ADR-750 Φ5 (Α24) — **η γεωμετρία της διπλής, μετρημένη σε mm διάταξης**.
 *
 * Το κενό εντοπίστηκε στη ζωντανή επαλήθευση της Φ5 (§19.8 βήμα 4): τα 44 tests της φάσης
 * κάλυπταν **ποιο** `doubleGapMm` παράγει το μολύβι (`table-border-pencil.test.ts`) και **ποια**
 * ακμή το κρατά (`table-range-border-ops.test.ts`) — αλλά **κανένα** δεν ρωτούσε αν το
 * `pushBorder` βγάζει όντως **δύο** τμήματα και **πόσο** απέχουν. Δηλαδή η μοναδική απόφαση
 * που κάνει τη διπλή *διπλή* ήταν αμέτρητη: μια αποσύνθεση που παρήγαγε δύο ταυτόσημα
 * τμήματα θα περνούσε όλη τη σουίτα και θα ζωγράφιζε **μία** γραμμή στην οθόνη.
 */
describe('Α24 — η διπλή βγάζει ΔΥΟ τμήματα, σε απόσταση `doubleGapMm` κέντρο-προς-κέντρο', () => {
  const GAP = 3;
  const DOUBLE: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 1, doubleGapMm: GAP };

  it('οριζόντια ακμή ⇒ δύο τμήματα μετατοπισμένα κατά ±gap/2 στον άξονα y', () => {
    const segments = borders(DETAIL_SHEET, rows('data', 'data'), [['H', 'r2', 'c1', DOUBLE]]);

    expect(segments).toHaveLength(2);
    const ys = segments.map((s) => s.a.y).sort((a, b) => a - b);
    // Και τα δύο τμήματα είναι οριζόντια — η μετατόπιση είναι καθαρά κατά y.
    for (const s of segments) expect(s.a.y).toBeCloseTo(s.b.y, 10);
    expect(ys[0]).toBeCloseTo(H - GAP / 2, 10);
    expect(ys[1]).toBeCloseTo(H + GAP / 2, 10);
    // 🔑 Η μετρήσιμη ιδιότητα: η απόσταση ΕΙΝΑΙ το `doubleGapMm`, όχι κλάσμα ή πολλαπλάσιό του.
    expect(ys[1] - ys[0]).toBeCloseTo(GAP, 10);
  });

  it('κατακόρυφη ακμή ⇒ η μετατόπιση γυρίζει στον άξονα x, με την ίδια απόσταση', () => {
    const segments = borders(DETAIL_SHEET, rows('data', 'data'), [['V', 'r1', 'c1', DOUBLE]]);

    expect(segments).toHaveLength(2);
    for (const s of segments) expect(s.a.x).toBeCloseTo(s.b.x, 10);
    const xs = segments.map((s) => s.a.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo(GAP, 10);
  });

  it('κανένα από τα δύο τμήματα δεν κουβαλά πια το `doubleGapMm` — ο ζωγράφος δεν το μαθαίνει', () => {
    const segments = borders(DETAIL_SHEET, rows('data', 'data'), [['H', 'r2', 'c1', DOUBLE]]);
    for (const s of segments) expect(s.spec.doubleGapMm).toBeUndefined();
    // Ό,τι άλλο κρατούσε το μολύβι επιβιώνει αυτούσιο.
    for (const s of segments) expect(s.spec.widthMm).toBe(1);
  });

  it('χωρίς `doubleGapMm` βγαίνει ΕΝΑ τμήμα — η αποσύνθεση δεν τρέχει «πάντα»', () => {
    const single: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 1 };
    expect(borders(DETAIL_SHEET, rows('data', 'data'), [['H', 'r2', 'c1', single]])).toHaveLength(1);
  });
});

// ── Ουδετερότητα: πίνακας χωρίς ρητές ακμές δεν αλλάζει ούτε κατά ένα τμήμα ─

describe('μηδέν ρητές ακμές ⇒ ΤΑΥΤΟΣΗΜΗ έξοδος με πριν το ADR-750', () => {
  it('το πλήρες πλέγμα του `standard` παραμένει ενωμένο σε όλο το μήκος του', () => {
    const segments = borders(STANDARD, rows('header', 'data', 'data'), []);
    // 4 οριζόντιες (3 γραμμές) + 3 κατακόρυφες (2 στήλες) — η μέτρηση του ADR-739.
    expect(segments).toHaveLength(7);
    for (const s of segments.filter((seg) => seg.a.y === seg.b.y)) {
      expect(s.a.x).toBe(0);
      expect(s.b.x).toBe(2 * W);
    }
  });
});
