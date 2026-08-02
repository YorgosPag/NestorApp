/**
 * ADR-739 Φ.Ε · Φ2 ΒΗΜΑ 4 — 🔴 **ΤΟ ΔΕΙΓΜΑΤΟΛΟΓΙΟ ΤΥΠΟΓΡΑΦΙΑΣ: ΕΝΑ ΑΡΧΕΙΟ, ΔΥΟ ΧΡΗΣΕΙΣ.**
 *
 * ## Γιατί υπάρχει — ο κανόνας §28.9.8
 * Η Φ1 είχε **2.642 tests πράσινα** και παρήγαγε αρχείο όπου **τίποτα δεν φαινόταν**. Ένα
 * test που ελέγχει *τι γράφτηκε* δεν ελέγχει *τι αποδίδεται*, άρα κανένα βήμα δεν κλείνει
 * χωρίς άνοιγμα του παραγόμενου `.dxf` σε **AutoCAD 2021**.
 *
 * Το βήμα 4 όμως δεν επαληθεύεται από τη διεπαφή: το χειριστήριο που βάζει πλάγια /
 * υπογράμμιση / γραμματοσειρά είναι το **βήμα 5** και **δεν υπάρχει ακόμα** (απόφαση Α1 —
 * «η εξαγωγή ΠΡΙΝ τα κουμπιά»). Ο ζωντανός πίνακας του χρήστη είναι ολόκληρος κανονικός·
 * εξαγωγή του αποδεικνύει **μηδέν παλινδρόμηση** στη Φ1 και **τίποτα** για τα νέα πεδία.
 * Άρα η επαλήθευση παρακάμπτει **τη διεπαφή**, ποτέ **τη διαδρομή εξαγωγής**: η σκηνή
 * στήνεται εδώ, ο δρόμος προς το αρχείο είναι ο πραγματικός.
 *
 * ## Δύο χρήσεις, ένα αρχείο
 * 1. **Μόνιμο anchor** (πάντα): οι έξι TrueType περιπτώσεις + η SHX δοκτρίνα ελέγχονται
 *    *in memory* πάνω στα **ίδια bytes** που θα γράφονταν στον δίσκο. Μηδέν σκουπίδια.
 * 2. **Γεννήτρια** (μόνο με `DXF_SPECIMEN_DIR`): γράφει το `.dxf` **εκτός repo**, για τα
 *    μάτια του μηχανικού. Ίδιο ιδίωμα με το `DXF_R2018_DUMP_DIR` του ADR-644 και το
 *    `DXF_REAL_SAMPLE` του ADR-736 — env var ως διακόπτης **και** ως τοποθεσία.
 *
 * ```
 * DXF_SPECIMEN_DIR="C:/Users/user/Desktop" npx jest table-typography-specimen
 * ```
 *
 * ## 🔴 Η παγίδα που ΔΕΝ μπορεί πλέον να συμβεί
 * Ο `writeDxfAscii` γράφει την ενότητα `TABLES` — άρα τα STYLE records **και το XDATA
 * 1071** — **μόνο** στο επαγγελματικό μονοπάτι (`acadVer`/`insunits`/`codepage`/…). Ένα
 * σενάριο που έστηνε τις επιλογές με το χέρι και ξεχνούσε μία θα έβγαζε αρχείο **χωρίς
 * κανένα STYLE**, και θα έμοιαζε με σφάλμα του βήματος 4 ενώ ο κώδικας είναι σωστός.
 * Γι' αυτό εδώ **δεν στήνεται καμία επιλογή writer**: καλείται ο ίδιος ο adapter
 * (`buildDxfExportRequest` → `renderDxfPayload`) που καλεί και το κουμπί της εξαγωγής.
 *
 * ⚠️ Η **υπογράμμιση είναι `LINE`, όχι `%%u`** — σχεδιασμένο (§28.11.1), όχι έλλειψη.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28.11
 * @see export/core/__tests__/table-export-parity.test.ts — το ίδιο σενάριο σε επίπεδο οντότητας
 * @see export/core/__tests__/dxf-table-style-fidelity.test.ts — τα group codes ένα προς ένα
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildDxfExportRequest, renderDxfPayload } from '../dxf-export-adapter';
import { layoutTable } from '../../../bim/table/table-layout';
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import { TEXT_OBLIQUE_ITALIC_DEG } from '../../../config/text-rendering-config';
import type { TableStyle } from '../../../bim/table/table-style';
import type { TableCell, TableCellStyleOverride, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { SceneLayer, SceneModel } from '../../../types/scene-types';

// ──────────────────────────────────────────────────────────────────────────────
// Το δειγματολόγιο — επτά γραμμές, επτά ερωτήματα
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Κάθε γραμμή είναι **μία** ερώτηση προς το AutoCAD. Το ίδιο το κείμενο του δείγματος
 * ονομάζει την περίπτωσή του, ώστε μια γραμμή που απέτυχε να παραμένει αναγνωρίσιμη ακόμα
 * κι όταν η όψη της είναι λάθος — και η στήλη `Α/Α` (πάντα κανονική) την κρατά αναγνωρίσιμη
 * ακόμα κι αν η γραμματοσειρά της υποκατασταθεί ολόκληρη.
 *
 * ⚠️ Η **7η** είναι σκόπιμα ASCII: η SHX δοκτρίνα ελέγχει τη **γωνία κλίσης**, όχι την
 * κάλυψη ελληνικών γλυφών του `romans.shx` — ένα «?» εκεί θα απαντούσε σε άλλη ερώτηση.
 */
interface SpecimenRow {
  readonly no: string;
  readonly sample: string;
  readonly override: TableCellStyleOverride;
  /** Το όνομα του STYLE record που ΠΡΕΠΕΙ να γεννήσει (group 7 της οντότητας κειμένου). */
  readonly styleName: string;
}

const SPECIMENS: readonly SpecimenRow[] = [
  { no: '1', sample: 'Κανονικό Nestor abc 123', override: {}, styleName: 'Arial' },
  { no: '2', sample: 'Έντονο Nestor abc 123', override: { bold: true }, styleName: 'Arial-Bold' },
  { no: '3', sample: 'Πλάγιο Nestor abc 123', override: { italic: true }, styleName: 'Arial-Italic' },
  {
    no: '4', sample: 'Έντονο πλάγιο Nestor abc',
    override: { bold: true, italic: true }, styleName: 'Arial-BoldItalic',
  },
  {
    no: '5', sample: 'Υπογράμμιση Nestor abc',
    override: { underline: true }, styleName: 'Arial',
  },
  {
    no: '6', sample: 'Calibri Nestor abc 123',
    override: { fontFamily: 'Calibri' }, styleName: 'Calibri',
  },
  {
    no: '7', sample: 'romans.shx oblique abc',
    override: { fontFamily: 'romans.shx', italic: true }, styleName: 'romans.shx-Italic',
  },
];

/** Ο δείκτης της υπογραμμισμένης γραμμής — μία, και το test το επιβεβαιώνει πριν τη χρήσει. */
const UNDERLINED_INDEX = 4;

const HEADER_SAMPLE = 'ΔΕΙΓΜΑ ΤΥΠΟΓΡΑΦΙΑΣ — ADR-739 Φ2/4';

/** Πλατιά αρκετά ώστε **καμία** γραμμή να μην περικοπεί: περικοπή θα ήταν σύγχυση, όχι εύρημα. */
const COLUMNS: TableColumn[] = [
  { id: 'c_no', sizing: { kind: 'fixed', widthMm: 14 }, valueType: 'text', align: 'left' },
  { id: 'c_spec', sizing: { kind: 'fixed', widthMm: 90 }, valueType: 'text', align: 'left' },
];

const text = (value: string): TableCell => ({ kind: 'text', value });

function specimenModel(rows: readonly SpecimenRow[]): ReturnType<typeof createTableModel> {
  return createTableModel({
    columns: COLUMNS,
    rows: [
      { id: 'r_head', rowClass: 'header' },
      ...rows.map((s): TableRow => ({ id: `r_${s.no}`, rowClass: 'data' })),
    ],
    // Η τυπογραφία δηλώνεται σε **επίπεδο κελιού** (επίπεδο 1 της §28.4, νικά τα πάντα) και
    // **μόνο** στη στήλη του δείγματος: έτσι η στήλη `Α/Α` μένει κανονική και χρησιμεύει ως
    // σταθερή αναφορά δίπλα σε κάθε δείγμα — η κλασική διάταξη φύλλου δείγματος.
    cells: [
      ['r_head', 'c_no', text('Α/Α')],
      ['r_head', 'c_spec', text(HEADER_SAMPLE)],
      ...rows.flatMap((s): Array<[string, string, TableCell]> => [
        [`r_${s.no}`, 'c_no', text(s.no)],
        [`r_${s.no}`, 'c_spec', { kind: 'text', value: s.sample, styleOverride: s.override }],
      ]),
    ],
  });
}

function standardStyle(): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('λείπει το preset `standard`');
  return style;
}

// ──────────────────────────────────────────────────────────────────────────────
// Η σκηνή και η ΠΡΑΓΜΑΤΙΚΗ διαδρομή εξαγωγής
// ──────────────────────────────────────────────────────────────────────────────

const LAYER: SceneLayer = {
  id: 'lyr_specimen', name: 'PINAKAS', color: '#FFFFFF', colorAci: 7, visible: true,
} as SceneLayer;

/**
 * **1:1** — το δειγματολόγιο είναι φύλλο χαρτιού, όχι κάτοψη: με μονάδες σκηνής `mm`, έξοδο
 * σε `millimeters` και κλίμακα 1, ένα sheet-mm της διάταξης γίνεται **ένα** χιλιοστό του
 * αρχείου. Ο πίνακας ανοίγει σε φυσικό μέγεθος και το `$EXTMIN/$EXTMAX` τον κεντράρει.
 */
const SPECIMEN_DRAWING_SCALE = 1;

/** Τα ΙΔΙΑ bytes που θα κατέβαζε το κουμπί «Εξαγωγή DXF» — καμία επιλογή writer με το χέρι. */
function specimenDxf(rows: readonly SpecimenRow[]): string {
  const entity: TableEntity = {
    id: 'ent_specimen',
    type: 'table',
    layerId: LAYER.id,
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(specimenModel(rows)),
  } as TableEntity;
  const scene: SceneModel = {
    entities: [entity],
    layersById: { [LAYER.id]: LAYER },
    bounds: { min: { x: 0, y: -100 }, max: { x: 120, y: 0 } },
    units: 'mm',
  } as SceneModel;
  const { request } = buildDxfExportRequest(scene, {
    entityScope: 'both',
    version: 'AC1032',       // R2018 ⇒ UTF-8 ⇒ τα ελληνικά ταξιδεύουν αυτούσια
    unit: 'millimeters',
    drawingScale: SPECIMEN_DRAWING_SCALE,
  });
  const payload = renderDxfPayload(request);
  if (typeof payload !== 'string') throw new Error('το R2018 μονοπάτι οφείλει να είναι UTF-8 string');
  return payload;
}

const DXF = specimenDxf(SPECIMENS);
const LAYOUT = layoutTable(specimenModel(SPECIMENS), standardStyle());

// ──────────────────────────────────────────────────────────────────────────────
// Ανάγνωση του παραγόμενου αρχείου — ό,τι ρωτά και το AutoCAD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ένα record του αρχείου: το είδος του (η τιμή του group `0`) και τα ζεύγη που το ακολουθούν.
 *
 * ⚠️ **Ο διαχωρισμός γίνεται σε ζεύγη, ΠΟΤΕ με `split('\\n0\\n')`**: στο DXF το `0` είναι και
 * νόμιμη **τιμή** (`70 0`, `50 0`, `62 0`), οπότε ένας κειμενικός διαχωρισμός κόβει records
 * στη μέση — και μάλιστα **σιωπηλά**, αφήνοντας το υπόλοιπο του record αόρατο στους ελέγχους.
 */
interface DxfRecord {
  readonly kind: string;
  readonly pairs: ReadonlyArray<readonly [string, string]>;
}

function parseRecords(dxf: string): readonly DxfRecord[] {
  const tokens = dxf.split('\n');
  const out: DxfRecord[] = [];
  let kind = '';
  let pairs: Array<readonly [string, string]> | null = null;
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const [code, value] = [tokens[i], tokens[i + 1]];
    if (code === '0') {
      if (pairs) out.push({ kind, pairs });
      kind = value;
      pairs = [];
      continue;
    }
    pairs?.push([code, value]);
  }
  if (pairs) out.push({ kind, pairs });
  return out;
}

const RECORDS = parseRecords(DXF);

/** Το ΕΝΑ record του STYLE table που ονομάζεται έτσι — και τίποτε από τα γειτονικά του. */
function styleRecord(name: string): DxfRecord {
  const found = RECORDS.find(
    (r) => r.kind === 'STYLE' && r.pairs.some(([c, v]) => c === '2' && v === name),
  );
  if (!found) throw new Error(`δεν γράφτηκε STYLE record «${name}»`);
  return found;
}

/** Το record της οντότητας κειμένου ενός δείγματος, βρεθέν από το ίδιο του το περιεχόμενο. */
function textRecord(sample: string): DxfRecord {
  const found = RECORDS.find((r) => r.pairs.some(([c, v]) => c === '1' && v === sample));
  if (!found) throw new Error(`δεν εξήχθη κείμενο «${sample}»`);
  return found;
}

function values(record: DxfRecord, code: number): readonly string[] {
  return record.pairs.filter(([c]) => c === String(code)).map(([, v]) => v);
}

function hasCode(record: DxfRecord, code: number): boolean {
  return values(record, code).length > 0;
}

/** Η τιμή ενός group code μέσα σε ένα record (η πρώτη — τα σημεία/σημαίες είναι μοναδικά). */
function group(record: DxfRecord, code: number): number {
  const [first] = values(record, code);
  if (first === undefined) throw new Error(`το record «${record.kind}» δεν έχει group ${code}`);
  return Number(first);
}

function groupText(record: DxfRecord, code: number): string {
  const [first] = values(record, code);
  if (first === undefined) throw new Error(`το record «${record.kind}» δεν έχει group ${code}`);
  return first;
}

interface FileLine { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }

function fileLines(dxf: string): readonly FileLine[] {
  return parseRecords(dxf)
    .filter((r) => r.kind === 'LINE')
    .map((r) => ({ x1: group(r, 10), y1: group(r, 20), x2: group(r, 11), y2: group(r, 21) }));
}

/** Ταυτότητα γραμμής για σύγκριση συνόλων — η γεωμετρία της, στρογγυλεμένη σε 1 nm. */
const lineKey = (l: FileLine): string =>
  [l.x1, l.y1, l.x2, l.y2].map((n) => n.toFixed(9)).join(',');

// ──────────────────────────────────────────────────────────────────────────────
// 0. Η ΠΡΟΫΠΟΘΕΣΗ — αλλιώς το δειγματολόγιο δεν ελέγχει τίποτα
// ──────────────────────────────────────────────────────────────────────────────

describe('ADR-739 Φ2/4 — το σενάριο ΟΝΤΩΣ δηλώνει επτά διαφορετικές τυπογραφίες', () => {
  const specCell = (no: string) =>
    LAYOUT.cells.find((c) => c.rowId === `r_${no}` && c.colId === 'c_spec');

  it('η διάταξη επιλύει κάθε παράκαμψη κελιού σε διαφορετικό run', () => {
    for (const s of SPECIMENS) {
      const run = specCell(s.no)?.text;
      if (!run) throw new Error(`η διάταξη δεν έβγαλε κείμενο για τη γραμμή ${s.no}`);
      expect(run.bold).toBe(s.override.bold ?? false);
      expect(run.italic).toBe(s.override.italic ?? false);
      expect(run.underline).toBe(s.override.underline ?? false);
      if (s.override.fontFamily) expect(run.fontFamily).toBe(s.override.fontFamily);
    }
  });

  it('🔴 η στήλη Α/Α μένει ΚΑΝΟΝΙΚΗ — είναι η σταθερή αναφορά δίπλα σε κάθε δείγμα', () => {
    for (const s of SPECIMENS) {
      const run = LAYOUT.cells.find((c) => c.rowId === `r_${s.no}` && c.colId === 'c_no')?.text;
      expect(run?.bold).toBe(false);
      expect(run?.italic).toBe(false);
      expect(run?.underline).toBe(false);
    }
  });

  it('καμία γραμμή δεν περικόπτεται — μια περικοπή θα διαβαζόταν ως αποτυχία', () => {
    for (const s of SPECIMENS) {
      expect(specCell(s.no)?.text?.text).toBe(s.sample);
      expect(specCell(s.no)?.text?.clipped).toBeFalsy();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 1. ΤΟ ΕΠΑΓΓΕΛΜΑΤΙΚΟ ΜΟΝΟΠΑΤΙ — χωρίς αυτό δεν υπάρχει ούτε ένα STYLE
// ──────────────────────────────────────────────────────────────────────────────

describe('ADR-739 Φ2/4 — το αρχείο γράφτηκε στο ΕΠΑΓΓΕΛΜΑΤΙΚΟ μονοπάτι', () => {
  it('🔴 έχει HEADER + πίνακα STYLE — αλλιώς κάθε επόμενος έλεγχος θα ήταν ψευδώς κόκκινος', () => {
    // Η πιο εύκολη λάθος διάγνωση αυτού του βήματος: `writeDxfAscii` χωρίς
    // `acadVer`/`insunits`/`codepage` **δεν γράφει καθόλου ενότητα TABLES**.
    expect(DXF).toContain('9\n$ACADVER\n1\nAC1032\n');
    expect(DXF).toContain('TABLE\n2\nSTYLE\n');
    expect(DXF.trimEnd().endsWith('EOF')).toBe(true);
  });

  it('και τα επτά δείγματα υπάρχουν ως κείμενο μέσα στο αρχείο', () => {
    for (const s of SPECIMENS) expect(DXF).toContain(s.sample);
    expect(DXF).toContain(HEADER_SAMPLE);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. ΟΙ ΤΕΣΣΕΡΙΣ TrueType ΠΑΡΑΛΛΑΓΕΣ — η δοκτρίνα του XDATA
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Οι **μετρημένοι** ακέραιοι, γραμμένοι ως κυριολεξίες **επίτηδες**.
 *
 * Δεν καλείται εδώ το `extendedFontFlags`: θα ήταν **ο ίδιος τύπος με τον κώδικα**, δηλαδή
 * ακριβώς το λάθος που πλήρωσε το βήμα 3 (§28.11.4 — «ένα test που αντιγράφει τον τύπο
 * κλειδώνει τη συμπεριφορά αντί να τη διασταυρώνει»). Μετρήθηκε ζωντανά: αντιμετάθεση των
 * δύο σημαιών μέσα στο `extendedFontFlags` **δεν έκανε κόκκινο** αυτό το αρχείο όσο το
 * μαντείο ήταν η ίδια συνάρτηση.
 *
 * Πηγή: ezdxf, σχόλιο-μέτρηση από πραγματικά αρχεία AutoCAD — μετά το `0e6a7532`
 * («fix #776 swapped bold and italic flags», 2022-11-11). **Μια πηγή πριν το 2022 δίνει
 * πλάγιο εκεί που θέλουμε έντονο.** Η διασταύρωση κυριολεξίας ⇄ συνάρτησης ζει στο
 * `dxf-table-style-fidelity.test.ts`· εδώ ελέγχεται τι **έφτασε στο αρχείο**.
 */
const XDATA_FLAGS = {
  'Arial': 34,
  'Arial-Bold': 33554466,
  'Arial-Italic': 16777250,
  'Arial-BoldItalic': 50331682,
} as const;

const ARIAL_VARIANTS = Object.keys(XDATA_FLAGS) as ReadonlyArray<keyof typeof XDATA_FLAGS>;

describe('ADR-739 Φ2/4 — τέσσερα Arial STYLE records με τις τέσσερις σημαίες 1071', () => {
  it('🔴 και οι τέσσερις παραλλαγές γεννήθηκαν — το suffix scheme άντεξε 4 συνδυασμούς', () => {
    for (const name of ARIAL_VARIANTS) expect(() => styleRecord(name)).not.toThrow();
  });

  it('🔴 κάθε παραλλαγή κουβαλά ΤΗ ΔΙΚΗ ΤΗΣ σημαία — ποτέ τη σημαία της διπλανής', () => {
    // Οι ακέραιοι δεν είναι δικοί μας: μετρημένοι από την ezdxf πάνω σε πραγματικά αρχεία
    // AutoCAD. ⚠️ Η ezdxf τα είχε **ανάποδα** μέχρι το `0e6a7532` (2022) — μια πηγή πριν το
    // 2022 θα έδινε πλάγιο εκεί που θέλουμε έντονο, με το test πράσινο.
    for (const name of ARIAL_VARIANTS) {
      expect(group(styleRecord(name), 1071)).toBe(XDATA_FLAGS[name]);
    }
  });

  it('🔴 και οι τέσσερις σημαίες είναι ΔΙΑΦΟΡΕΤΙΚΕΣ μεταξύ τους μέσα στο αρχείο', () => {
    // Χωρίς αυτό, ένα «όλα γράφουν 34» θα περνούσε αν κάποιος ισοπέδωνε τις παραλλαγές.
    const flags = ARIAL_VARIANTS.map((n) => group(styleRecord(n), 1071));
    expect(new Set(flags).size).toBe(ARIAL_VARIANTS.length);
  });

  it('🔴 καμία TrueType παραλλαγή δεν παίρνει γεωμετρική κλίση (group 50 = 0)', () => {
    // Oblique σε TTF: λάθος σχήματα (`Arial Italic` ≠ `Arial` γερμένο) **και** χαλάει την
    // εξαγωγή κειμένου-ως-κείμενο σε PDF από το ίδιο το AutoCAD.
    for (const name of ARIAL_VARIANTS) expect(group(styleRecord(name), 50)).toBe(0);
  });

  it('κάθε δείγμα δείχνει στο ΔΙΚΟ του style μέσω group 7 — αλλιώς το XDATA είναι ορφανό', () => {
    for (const s of SPECIMENS) expect(groupText(textRecord(s.sample), 7)).toBe(s.styleName);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. ΤΟ ΧΡΕΟΣ Α3 ΤΗΣ Φ1 — γυμνή οικογένεια ≠ αρχείο γραμματοσειράς
// ──────────────────────────────────────────────────────────────────────────────

describe('ADR-739 Φ2/4 — το group 3 δείχνει σε ΥΠΑΡΚΤΟ αρχείο, όχι σε ανύπαρκτο .shx', () => {
  it('🔴 το Calibri παίρνει επέκταση — γυμνό «Calibri» θα ζητούσε Calibri.shx', () => {
    // Ακριβώς το ελάττωμα που έκανε το αρχείο της Φ1 αόρατο, για κάθε **άλλη** οικογένεια
    // πέρα από το Arial που η Φ1 μπάλωσε ονομαστικά.
    expect(groupText(styleRecord('Calibri'), 3)).toBe('Calibri.ttf');
  });

  it('🔴 και το τυπογραφικό όνομα (1000) — η σανίδα σωτηρίας όταν το αρχείο αστοχήσει', () => {
    // Το `<οικογένεια>.ttf` είναι **εικασία**: `Times New Roman` → `times.ttf` στα Windows.
    // Το 1000 είναι το όνομα **όψης**, που το AutoCAD αναγνωρίζει ανεξάρτητα από τον δίσκο.
    expect(groupText(styleRecord('Calibri'), 1000)).toBe('Calibri');
    expect(groupText(styleRecord('Arial-Bold'), 1000)).toBe('Arial');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Η ΑΛΛΗ ΔΟΚΤΡΙΝΑ — SHX: γωνία κλίσης, ποτέ XDATA
// ──────────────────────────────────────────────────────────────────────────────

describe('ADR-739 Φ2/4 — τα πλάγια SHX είναι ΓΕΩΜΕΤΡΙΑ, όχι σημαία', () => {
  it(`🔴 το romans.shx παίρνει κλίση ${TEXT_OBLIQUE_ITALIC_DEG}° (ISO 3098) στο group 50`, () => {
    const rec = styleRecord('romans.shx-Italic');
    expect(groupText(rec, 3)).toBe('romans.shx');
    expect(group(rec, 50)).toBe(TEXT_OBLIQUE_ITALIC_DEG);
  });

  it('🔴 και ΚΑΝΕΝΑ XDATA — η παρουσία extended font data σημαίνει «TrueType»', () => {
    const rec = styleRecord('romans.shx-Italic');
    expect(hasCode(rec, 1071)).toBe(false);
    expect(hasCode(rec, 1000)).toBe(false);
    expect(hasCode(rec, 1001)).toBe(false);
  });

  it('🔴🔴 Η ΚΛΙΣΗ ΖΕΙ ΚΑΙ ΣΤΗΝ ΟΝΤΟΤΗΤΑ (group 51) — το style ΔΕΝ αρκεί', () => {
    // ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΒΡΗΚΕ ΜΟΝΟ ΤΟ ΑΝΟΙΓΜΑ ΤΟΥ ΑΡΧΕΙΟΥ (AutoCAD 2021, 02/08): η γραμμή 7
    // βγήκε **όρθια**, ενώ το STYLE record έλεγε `50 = 15`. Τεκμηριωμένο από την Autodesk:
    // «Changing … oblique angle does **not** change existing text but does change subsequently
    // created text objects» ⇒ η κλίση είναι ιδιότητα ΤΗΣ ΟΝΤΟΤΗΤΑΣ· το style δίνει μόνο την
    // αρχική τιμή για **νέο** κείμενο. Και η ezdxf: group 51 «default value is 0».
    //
    // Το βήμα 4 ήταν πράσινο σε 2.115 + 19 tests γιατί όλα ρωτούσαν το **STYLE**. Κανένα δεν
    // ρωτούσε την οντότητα — και ακριβώς εκεί κοιτάει το AutoCAD.
    expect(group(textRecord(SPECIMENS[6].sample), 51)).toBe(TEXT_OBLIQUE_ITALIC_DEG);
  });

  it('🔴 καμία TrueType οντότητα δεν παίρνει group 51 — ούτε καν μηδενικό', () => {
    // Zero regression: ένα ρητό `51 0` θα άλλαζε bytes σε **κάθε** υπάρχον αρχείο χωρίς καμία
    // οπτική διαφορά — το ίδιο σχήμα με το `italic: false` που μετακίνησε 5 snapshots (§28.11.6).
    for (const s of SPECIMENS.slice(0, 6)) expect(hasCode(textRecord(s.sample), 51)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Η ΥΠΟΓΡΑΜΜΙΣΗ — γραμμή, και ΚΑΤΩ από τη βάση (§28.11.4)
// ──────────────────────────────────────────────────────────────────────────────

describe('ADR-739 Φ2/4 — η υπογράμμιση ταξιδεύει ως LINE, κάτω από τα γράμματα', () => {
  const UNDERLINED = SPECIMENS[UNDERLINED_INDEX];
  /** Το ΙΔΙΟ δειγματολόγιο χωρίς την υπογράμμιση: η διαφορά ΕΙΝΑΙ η υπογράμμιση. */
  const withoutUnderline = () =>
    SPECIMENS.map((s, i) => (i === UNDERLINED_INDEX ? { ...s, override: {} } : s));

  it('η υπογραμμισμένη γραμμή είναι όντως μία και μόνη — αλλιώς η διαφορά δεν είναι ερμηνεύσιμη', () => {
    expect(UNDERLINED.override.underline).toBe(true);
    expect(SPECIMENS.filter((s) => s.override.underline).length).toBe(1);
  });

  it('🔴 ΚΑΝΕΝΑΣ κωδικός ελέγχου στο αρχείο — ο δικός μας importer δεν αποκωδικοποιεί %%u', () => {
    // Η Autodesk περιορίζει το `%%u` σε SHX/PostScript· τα κελιά είναι TrueType. Ένα `%%u`
    // θα ξαναδιαβαζόταν από **την ίδια μας την εφαρμογή** ως κυριολεκτικό «%%uΥπογράμμιση».
    expect(DXF).not.toContain('%%');
  });

  it('🔴 γεννά ΑΚΡΙΒΩΣ μία επιπλέον LINE — η υπογράμμιση είναι γεωμετρία, όχι ιδιότητα', () => {
    expect(fileLines(DXF).length - fileLines(specimenDxf(withoutUnderline())).length).toBe(1);
  });

  it('🔴 και πέφτει ΚΑΤΩ από τη γραμμή βάσης — το ελάττωμα των 0,2·em (§28.11.4)', () => {
    // Ο ζωγράφος του βήματος 3 έβγαζε τη γραμμή στο **−0,10·em** (μέσα στα γράμματα) αντί για
    // **+0,10·em**. Η ερώτηση τίθεται στο ίδιο το αρχείο, όπως θα την έθετε το AutoCAD:
    // ο κόσμος έχει +y **πάνω**, άρα «κάτω από τη βάση» = μικρότερο y από το ίδιο το κείμενο.
    const rec = textRecord(UNDERLINED.sample);
    const baselineY = group(rec, 20);
    const heightMm = group(rec, 40);   // ύψος κεφαλαίου· κλίμακα 1:1 ⇒ mm = μονάδες αρχείου
    const before = new Set(fileLines(specimenDxf(withoutUnderline())).map(lineKey));
    const extra = fileLines(DXF).filter((l) => !before.has(lineKey(l)));
    expect(extra).toHaveLength(1);
    const [underline] = extra;
    expect(underline.y1).toBeCloseTo(underline.y2, 9);          // οριζόντια
    expect(underline.y1).toBeLessThan(baselineY);               // ΚΑΤΩ από τη βάση
    expect(baselineY - underline.y1).toBeLessThan(heightMm);    // …και όχι στην επόμενη γραμμή
    expect(Math.abs(underline.x2 - underline.x1)).toBeGreaterThan(0); // έχει μετρημένο πλάτος
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Η ΓΕΝΝΗΤΡΙΑ — μόνο με env var, ΕΚΤΟΣ repo
// ──────────────────────────────────────────────────────────────────────────────

describe('ADR-739 Φ2/4 — παραγωγή του αρχείου για τη ζωντανή επαλήθευση', () => {
  it('γράφει το δειγματολόγιο όταν (και μόνο όταν) δοθεί DXF_SPECIMEN_DIR', () => {
    const dir = process.env.DXF_SPECIMEN_DIR;
    if (!dir) {
      // Χωρίς env var το test παραμένει ο μόνιμος έλεγχος ακεραιότητας των bytes.
      expect(DXF.length).toBeGreaterThan(0);
      return;
    }
    // Ο φάκελος δημιουργείται αν λείπει: σιωπηλό no-op σε λάθος διαδρομή θα σήμαινε
    // «πράσινο test, κανένα αρχείο» — ακριβώς το σχήμα σιωπηλής απώλειας που κυνηγάμε.
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'nestor_adr739_typography_specimen.dxf');
    try {
      fs.writeFileSync(file, DXF, 'utf-8');
    } catch (err) {
      // ⚠️ Το AutoCAD **κλειδώνει** το ανοιχτό σχέδιο (`EBUSY`). Συμβαίνει σε **κάθε** γύρο
      // επαλήθευσης, γιατί ο φυσικός ρυθμός είναι «άνοιξε → βρες ελάττωμα → διόρθωσε →
      // ξαναπαρήγαγε». Ένα ωμό `EBUSY` θα διαβαζόταν ως σφάλμα του βήματος· είναι οδηγία.
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM') {
        throw new Error(
          `Το «${file}» είναι ΑΝΟΙΧΤΟ σε άλλο πρόγραμμα (AutoCAD· κωδικός ${code}). `
          + 'Κλείσε το σχέδιο και ξανατρέξε την ίδια εντολή — το αρχείο ΔΕΝ ενημερώθηκε.',
        );
      }
      throw err;
    }
    expect(fs.statSync(file).size).toBeGreaterThan(0);
  });
});
