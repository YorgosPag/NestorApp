/**
 * ADR-739 Φάση Θ — 🔴 **ΤΟ TEST ΤΗΣ ΦΑΣΗΣ: «Ο ΠΙΝΑΚΑΣ ΦΤΑΝΕΙ ΣΤΟ 3Δ, ΚΑΙ ΦΤΑΝΕΙ ΟΛΟΚΛΗΡΟΣ».**
 *
 * ## Τι απέτυχε πριν, και γιατί καμία πύλη δεν το έβλεπε
 * Ο πίνακας **έφτανε ήδη** στο `DxfToThreeConverter` μέσα στο `dxfScene.entities` — και έπεφτε
 * στο `default: break` του `appendEntitySegments`. Μηδέν σφάλμα, μηδέν προειδοποίηση, μηδέν
 * κόκκινο test: απλώς **τίποτα στην οθόνη**. Ο πρώτος έλεγχος εδώ είναι ακριβώς αυτή η πρόταση.
 *
 * ## Οι τρεις σιωπηλές αστοχίες που κλειδώνονται (καμία δεν φαίνεται σε επιθεώρηση)
 * 1. **Η τυπογραφία ταξιδεύει σε AST, ο atlas ρωτά επίπεδο πεδίο.** Το `makeText` γράφει
 *    έντονα/πλάγια/οικογένεια στο `textNode.…runs[0].style`· ο `resolveTextFont` διαβάζει
 *    `entity.textStyle` για να φτιάξει το `faceKey`. Χωρίς τη μετάφραση, η **έντονη κεφαλίδα
 *    ζωγραφίζεται κανονική** — κείμενο σωστό, όψη λάθος, όλα πράσινα.
 * 2. **Το χρώμα μελανιού δεν είναι μέρος της προβολής κειμένου.** Το `projectSceneTextToDxf`
 *    απαντά «πού και με τι γράμματα», όχι «με τι μελάνι». Σκέτο, θα έβγαζε **κάθε κελί λευκό**
 *    (`resolveEntityColor` → `DEFAULT_COLOR`).
 * 3. **Η επιφάνεια καθορίζει το αυτόματο μελάνι (§38).** Με την προεπιλογή «χαρτί» ο πίνακας
 *    βγαίνει **μαύρος σε σκούρα σκηνή** — εμφανίζεται, αλλά δεν διαβάζεται.
 *
 * @see ../dxf-table-3d-decompose.ts — ο κώδικας που ελέγχεται
 * @see ../../../export/core/__tests__/table-export-parity.test.ts — το αδελφό test της εξαγωγής
 */

import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { DxfTable, DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../../types/entities';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import {
  decomposeTableForUnderlay3D,
  appendTableToUnderlay,
  table3DSurfaceHex,
} from '../dxf-table-3d-decompose';
import { appendEntitySegments } from '../dxf-underlay-segments';

// ── Το σενάριο: δύο γραμμές × δύο στήλες, κεφαλίδα ΕΝΤΟΝΗ και ΒΑΜΜΕΝΗ ────────────────
// Ίδιο σχήμα με το test ισοτιμίας εξαγωγής: η κεφαλίδα κουβαλά `bold` + `fillColorHex` ως
// **παράκαμψη γραμμής** (το preset `standard` είναι ουδέτερο από 2026-08-04), γιατί αλλιώς
// κάθε έλεγχος τυπογραφίας θα «περνούσε» χωρίς να ρωτά τίποτα.

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
];

const HEADER_FILL_HEX = '#EDEDED';

const ROWS: TableRow[] = [
  { id: 'rh', rowClass: 'header', styleOverride: { fillColorHex: HEADER_FILL_HEX, bold: true } },
  { id: 'rd', rowClass: 'data' },
];

const cell = (value: string): TableCell => ({ kind: 'text', value });

const CELLS: Array<[string, string, TableCell]> = [
  ['rh', 'c1', cell('Α/Α')],
  ['rh', 'c2', cell('Περιγραφή')],
  ['rd', 'c1', cell('1')],
  ['rd', 'c2', cell('Εκσκαφή θεμελίων')],
];

function model(): ReturnType<typeof createTableModel> {
  return createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS });
}

const ENTITY: TableEntity = {
  id: 'ent_3d',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 0, y: 0 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  model: toPersistedTableModel(model()),
  // Κληρονομημένο χρώμα οντότητας, σκόπιμα διαφορετικό από κάθε χρώμα του στυλ: κάθε κομμάτι
  // που «ξεχνά» να δηλώσει το δικό του θα το φορέσει και θα προδοθεί.
  color: '#FF00FF',
  colorAci: 6,
} as TableEntity;

const SCALE = 100;
/** Σκούρη επιφάνεια — το προεπιλεγμένο θέμα `nestorApp1`, όπου το μελάνι χαρτιού δίνει 1,27:1. */
const DARK_SURFACE = '#1d283a';
/** Λευκή επιφάνεια — η εξαγωγή σε χαρτί. */
const PAPER_SURFACE = '#ffffff';

const decompose = (surfaceHex = DARK_SURFACE, drawingScale = SCALE) =>
  decomposeTableForUnderlay3D(ENTITY, drawingScale, 'mm', surfaceHex);

const headerText = (texts: readonly DxfText[]): DxfText => {
  const found = texts.find((t) => t.text === 'Α/Α');
  if (!found) throw new Error('το κείμενο της κεφαλίδας δεν έφτασε στο 3Δ');
  return found;
};

describe('ADR-739 Φ.Θ — ο πίνακας φτάνει στο 3Δ υπόστρωμα', () => {
  it('🔴 Η ΙΔΙΟΤΗΤΑ ΤΗΣ ΦΑΣΗΣ: παράγει και γραμμές ΚΑΙ κείμενα', () => {
    const parts = decompose();
    // Πριν τη Φ.Θ και τα δύο ήταν κενά — ο πίνακας έπεφτε στο `default: break`.
    expect(parts.segments.length).toBeGreaterThan(0);
    expect(parts.texts.length).toBe(4); // ένα ανά κελί με περιεχόμενο
  });

  it('κάθε κελί φτάνει με το κείμενό του (κανένα δεν χάνεται)', () => {
    const values = decompose().texts.map((t) => t.text);
    expect(values).toEqual(expect.arrayContaining(['Α/Α', 'Περιγραφή', '1', 'Εκσκαφή θεμελίων']));
  });

  it('τα τμήματα είναι αποκλειστικά γραμμές (τα γεμίσματα έχουν δικό τους κανάλι)', () => {
    expect(decompose().segments.every((s) => s.type === 'line')).toBe(true);
  });
});

/**
 * 🔴 **Η ΣΥΖΕΥΞΗ ΠΟΥ ΒΡΕΘΗΚΕ ΓΡΑΦΟΝΤΑΣ ΑΥΤΗ ΤΗ ΦΑΣΗ.**
 *
 * Η πρώτη υλοποίηση απέρριπτε τα γεμίσματα με συνεπές επιχείρημα («το υπόστρωμα είναι
 * wireframe»). Το επιχείρημα αγνοούσε ότι το αυτόματο μελάνι λύνεται **στη διάταξη**, με
 * backdrop το γέμισμα: γκρίζα κεφαλίδα ⇒ **μαύρο** μελάνι. Χωρίς το γκρι, το μαύρο κάθεται
 * στο σκούρο φόντο σκηνής — **1,27:1**, δηλαδή κεφαλίδα που «εμφανίστηκε» και δεν διαβάζεται.
 *
 * Οι δύο έλεγχοι εδώ κλειδώνουν και τα δύο σκέλη της σύζευξης: ότι το γέμισμα φτάνει, **και**
 * ότι το μελάνι που το προϋποθέτει είναι όντως το σκούρο. Αν κάποιος αφαιρέσει τα γεμίσματα
 * «για συνέπεια με το wireframe», ο δεύτερος έλεγχος μένει πράσινος και ο πρώτος γίνεται
 * κόκκινος — δηλαδή η αστοχία θα ονομάζεται, αντί να ξαναγίνει σιωπηλή.
 */
describe('ADR-739 Φ.Θ — τα γεμίσματα κελιών φτάνουν (αλλιώς το μελάνι λέει ψέματα)', () => {
  it('🔴 η βαμμένη κεφαλίδα παράγει γέμισμα με το ΧΡΩΜΑ ΤΗΣ', () => {
    const fills = decompose().fills;
    expect(fills.length).toBe(2); // δύο κελιά κεφαλίδας
    expect(fills.every((f) => f.colorInt === hexToTrueColor(HEADER_FILL_HEX))).toBe(true);
  });

  it('🔴 το μελάνι της κεφαλίδας προϋποθέτει το γέμισμα — άρα είναι ΣΚΟΥΡΟ σε ΚΑΘΕ σκηνή', () => {
    const inkOn = (surface: string) => headerText(decompose(surface).texts).color;
    // Το ίδιο μελάνι και στις δύο επιφάνειες: το `#EDEDED` νικά, όπως ορίζει το
    // `tableCellBackdrop`. Αυτό ΕΙΝΑΙ σωστό — και ακριβώς γι' αυτό το γέμισμα πρέπει να φτάσει.
    expect(inkOn(DARK_SURFACE)).toBe(inkOn(PAPER_SURFACE));
    const ink = inkOn(DARK_SURFACE)!;
    expect(hexToTrueColor(ink)).toBeLessThan(hexToTrueColor('#808080'));
  });

  it('κάθε γέμισμα είναι τετράπλευρο (η μηχανή διάταξης δεν παράγει άλλο σχήμα)', () => {
    expect(decompose().fills.every((f) => f.ring.length === 4)).toBe(true);
  });

  it('πίνακας χωρίς βαμμένα κελιά → κανένα γέμισμα (μηδέν κόστος όπου δεν χρειάζεται)', () => {
    const plain = { ...ENTITY, model: toPersistedTableModel(createTableModel({
      columns: COLUMNS,
      rows: [{ id: 'rd', rowClass: 'data' }],
      cells: [['rd', 'c1', cell('1')]] as Array<[string, string, TableCell]>,
    })) } as TableEntity;
    expect(decomposeTableForUnderlay3D(plain, SCALE, 'mm', DARK_SURFACE).fills).toEqual([]);
  });
});

describe('ADR-739 Φ.Θ — η τυπογραφία επιβιώνει (AST → επίπεδο πεδίο)', () => {
  it('🔴 η ΕΝΤΟΝΗ κεφαλίδα φτάνει ως `textStyle.bold` — αλλιώς ο atlas τη ζωγραφίζει κανονική', () => {
    expect(headerText(decompose().texts).textStyle?.bold).toBe(true);
  });

  it('η γραμμή δεδομένων ΔΕΝ είναι έντονη (η διάκριση δεν ισοπεδώνεται)', () => {
    const dataText = decompose().texts.find((t) => t.text === '1');
    expect(dataText?.textStyle?.bold).toBe(false);
  });

  it('το ύψος κελιού επιβιώνει (ο atlas κλιμακώνει τις γλυφές με αυτό)', () => {
    expect(headerText(decompose().texts).height).toBeGreaterThan(0);
  });
});

describe('ADR-739 Φ.Θ — το μελάνι φτάνει στο 3Δ', () => {
  it('🔴 το κείμενο κουβαλά ΔΙΚΟ του χρώμα, όχι το κληρονομημένο της οντότητας', () => {
    const header = headerText(decompose().texts);
    // Το `#FF00FF` / ACI 6 της οντότητας δεν επιτρέπεται να νικήσει το μελάνι της διάταξης.
    expect(header.color).toBeDefined();
    expect(header.color?.toLowerCase()).not.toBe('#ff00ff');
    // Ρητό χρώμα ⇒ το κληρονομημένο ACI ΠΡΕΠΕΙ να έχει σβηστεί, αλλιώς νικά στον καταρράκτη.
    expect(header.colorAci).toBeUndefined();
  });

  it('🔴 §38 — σε ΣΚΟΥΡΗ επιφάνεια το αυτόματο μελάνι είναι ΑΝΟΙΧΤΟ', () => {
    // ⚠️ Το κελί δοκιμής είναι της γραμμής **δεδομένων**, που δεν έχει γέμισμα. Η κεφαλίδα ΔΕΝ
    // κάνει: το `tableCellBackdrop` ορίζει ότι «το γέμισμα νικά την επιφάνεια», άρα το μελάνι
    // της λύνεται πάντα ως προς το `#EDEDED` — μαύρο και στις δύο σκηνές, σωστά. Ένα test που
    // ρωτούσε την κεφαλίδα θα ήταν κόκκινο για λάθος λόγο (και ήταν, γράφοντας αυτό το αρχείο).
    const dataInk = (surface: string): string => {
      const t = decompose(surface).texts.find((x) => x.text === 'Εκσκαφή θεμελίων');
      if (!t?.color) throw new Error('το κελί δεδομένων δεν έφτασε με μελάνι');
      return t.color;
    };
    const onDark = dataInk(DARK_SURFACE);
    const onPaper = dataInk(PAPER_SURFACE);
    // Η ίδια οντότητα, δύο επιφάνειες, δύο μελάνια: αυτό ΕΙΝΑΙ η σημασιολογία ACI 7. Ένα
    // σταθερό χρώμα εδώ θα σήμαινε πίνακα αόρατο στη μία από τις δύο.
    expect(onDark).not.toBe(onPaper);
    const luminanceOf = (hex: string): number => {
      const n = hexToTrueColor(hex);
      return ((n >> 16) & 0xff) + ((n >> 8) & 0xff) + (n & 0xff);
    };
    expect(luminanceOf(onDark)).toBeGreaterThan(luminanceOf(onPaper));
  });

  it('η επιφάνεια του 3Δ είναι έγκυρο hex (ο ΙΔΙΟΣ resolver με το `scene.background`)', () => {
    expect(table3DSurfaceHex()).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });
});

describe('ADR-739 Φ.Θ — annotative γεωμετρία + χαρτογράφηση σκηνής', () => {
  it('🔴 η κλίμακα σχεδίασης αλλάζει το μέγεθος (γι΄ αυτό μπήκε στο κλειδί ταυτοδυναμίας)', () => {
    const spanOf = (drawingScale: number): number => {
      const buf: number[] = [];
      for (const s of decompose(DARK_SURFACE, drawingScale).segments) appendEntitySegments(buf, s);
      const xs = buf.filter((_, i) => i % 3 === 0);
      return Math.max(...xs) - Math.min(...xs);
    };
    // Το `drawingScale` **πολλαπλασιάζει** (`paperHeightToModel`: paperMm × scale × units):
    // στο 1:100 ένα sheet-mm είναι 100 μονάδες μοντέλου, στο 1:50 μόνο 50. Άρα ο πίνακας
    // μεγαλώνει με την κλίμακα, δεν μικραίνει — η αντίθετη διαίσθηση κόστισε ένα κόκκινο test
    // γράφοντας αυτό το αρχείο, και γι' αυτό η φορά είναι πλέον καρφωμένη εδώ.
    expect(spanOf(100)).toBeCloseTo(spanOf(50) * 2, 5);
  });

  it('κάθε συντεταγμένη τμήματος είναι πεπερασμένη (ένα NaN δηλητηριάζει το Box3 της κάμερας)', () => {
    const buf: number[] = [];
    for (const s of decompose().segments) appendEntitySegments(buf, s);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.every(Number.isFinite)).toBe(true);
  });

  it('τα τμήματα κάθονται στο επίπεδο δαπέδου (y = 0 σε κάθε κορυφή)', () => {
    const buf: number[] = [];
    for (const s of decompose().segments) appendEntitySegments(buf, s);
    expect(buf.filter((_, i) => i % 3 === 1).every((y) => y === 0)).toBe(true);
  });

  it('η αναστροφή y γίνεται ΜΙΑ φορά: ο πίνακας εκτείνεται προς −Z κάτω από την άγκυρα', () => {
    const buf: number[] = [];
    for (const s of decompose().segments) appendEntitySegments(buf, s);
    const zs = buf.filter((_, i) => i % 3 === 2);
    // Άγκυρα (0,0) = πάνω-αριστερά, `+v` κάτω στο χαρτί ⇒ `−y` σκηνής ⇒ `+z` μετά τη
    // χαρτογράφηση `y → −Z`. Διπλή αναστροφή θα γύριζε το πρόσημο και ο πίνακας θα «κρεμόταν».
    expect(Math.max(...zs)).toBeGreaterThan(0);
    expect(Math.min(...zs)).toBeCloseTo(0, 6);
  });
});

describe('ADR-739 Φ.Θ — η σύνδεση με τον χτίστη του ορόφου', () => {
  const sinkOf = (layersById?: Record<string, SceneLayer>) => ({
    drawingScale: SCALE,
    sceneUnits: 'mm' as const,
    colorBuckets: new Map<number, number[]>(),
    fillBuckets: new Map<number, number[]>(),
    textEntities: [] as DxfText[],
    layersById,
  });

  it('γεμίζει τα buckets γραμμών, τα buckets γεμισμάτων ΚΑΙ την ουρά κειμένου', () => {
    const sink = sinkOf();
    appendTableToUnderlay(ENTITY as unknown as DxfTable, sink);
    expect(sink.colorBuckets.size).toBeGreaterThan(0);
    expect(sink.textEntities.length).toBe(4);
    for (const positions of sink.colorBuckets.values()) {
      expect(positions.length % 6).toBe(0); // ζεύγη κορυφών × 3 συνιστώσες
    }
  });

  it('🔴 τα γεμίσματα βγαίνουν ΤΡΙΓΩΝΑ (Mesh), όχι ζεύγη κορυφών (LineSegments)', () => {
    const sink = sinkOf();
    appendTableToUnderlay(ENTITY as unknown as DxfTable, sink);
    const fill = sink.fillBuckets.get(hexToTrueColor(HEADER_FILL_HEX));
    // 2 κελιά × 2 τρίγωνα × 3 κορυφές × 3 συνιστώσες = 36. Η τοπολογία είναι ΑΣΥΜΒΑΤΗ με των
    // γραμμών· γι' αυτό οι δύο χάρτες είναι χωριστοί ακόμα και για ίδιο χρώμα.
    expect(fill).toHaveLength(36);
    expect(fill!.every(Number.isFinite)).toBe(true);
    expect(fill!.filter((_, i) => i % 3 === 1).every((y) => y === 0)).toBe(true);
  });

  it('🔴 τα διαφορετικά μολύβια πέφτουν σε ΔΙΑΦΟΡΕΤΙΚΑ buckets — δεν ισοπεδώνονται', () => {
    // Το εξωτερικό πλαίσιο και οι εσωτερικοί διαχωριστές έχουν διαφορετικό μολύβι· ένα ενιαίο
    // bucket «του πίνακα» θα έσβηνε ακριβώς τα χρώματα που η Φ.Ε/Φ1 πλήρωσε για να φτάσουν εδώ.
    const sink = sinkOf();
    appendTableToUnderlay(ENTITY as unknown as DxfTable, sink);
    const inheritedEntityColor = hexToTrueColor('#FF00FF');
    expect([...sink.colorBuckets.keys()]).not.toContain(inheritedEntityColor);
  });

  it('οντότητα που δεν είναι πίνακας αγνοείται χωρίς παρενέργεια', () => {
    const sink = sinkOf();
    appendTableToUnderlay({ id: 'x', type: 'line', visible: true } as unknown as DxfTable, sink);
    expect(sink.colorBuckets.size).toBe(0);
    expect(sink.textEntities).toHaveLength(0);
  });
});
