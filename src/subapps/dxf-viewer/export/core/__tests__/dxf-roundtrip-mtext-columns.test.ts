/**
 * ADR-737 §11-1 — **στηλοποίηση MTEXT (embedded object, group 101) στο EXPORT**.
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ: ο parser διάβαζε σωστά το `101` (ADR-737 §import, `dxf-embedded-object.ts`)
 * αλλά **καμία scene entity δεν το κουβαλούσε** — το `convertMText` δεχόταν μόνο το flat `data`.
 * Άρα ο writer δεν είχε τι να ξαναγράψει και σε κάθε re-export η στηλοποίηση **χανόταν σιωπηλά**.
 *
 * ⚠️ **ΚΑΝΟΝΑΣ ΤΟΥ ΑΡΧΕΙΟΥ (γιατί γεννήθηκε το ADR-737)**: ΚΑΝΕΝΑ test εδώ δεν κατασκευάζει scene
 * entity με το χέρι και δεν «πειράζει» το output του importer. Κάθε test τρέχει τον **ΠΡΑΓΜΑΤΙΚΟ
 * αγωγό παραγωγής**:
 *
 *     DXF κείμενο → DxfEntityParser.parseEntity → convertEntityToScene → writeDxfAscii
 *                 → DxfEntityParser.parseEntity → findMTextColumns
 *
 * Ένα test που παρακάμπτει έστω κι έναν κρίκο πιστοποιεί νεκρό δίδυμο (ακριβώς το περιστατικό
 * `asMText()` του ADR-737 §11: πράσινο επί μήνες πάνω σε μονοπάτι που η παραγωγή δεν εκτελεί).
 *
 * ⚠️ **Η ΠΑΓΙΔΑ ΤΗΣ ΚΛΙΜΑΚΑΣ**: τα ωμά ζεύγη του embedded object είναι **μήκη σε μονάδες πηγής**,
 * ενώ όλο το υπόλοιπο MTEXT εξάγεται ×`s` (canonical-mm, ADR-462). Το test `scale` παρακάτω είναι
 * ο φύλακας: μήκη κλιμακώνονται, πλήθη/σημαίες ΟΧΙ.
 */
import { describe, it, expect } from '@jest/globals';
import { writeDxfAscii } from '../dxf-ascii-writer';
import { DxfEntityParser } from '../../../utils/dxf-entity-parser';
import { convertEntityToScene } from '../../../utils/dxf-entity-converters';
import { findMTextColumns, type MTextColumnsData } from '../../../utils/dxf-embedded-object';
import { scaleEntity } from '../../../systems/scale/scale-entity-transform';
import type { Entity } from '../../../types/entities';
import type { AnySceneEntity } from '../../../types/scene';

const LAYERS = { L: { name: 'TXT' } };

/** R2018 professional envelope — η ΜΟΝΗ διάλεκτος όπου το `101` είναι έγκυρο (δες `emitMText`). */
const R2018 = { layersById: LAYERS, acadVer: 'AC1032' } as const;

// ── Fixture: MTEXT 3 δυναμικών στηλών, με στρογγυλά μήκη ώστε το ×scale να ελέγχεται ακριβώς ──

const HOST: ReadonlyArray<readonly [string, string]> = [
  ['8', 'L'],
  ['10', '100'], ['20', '50'], ['30', '0'],
  ['40', '2.5'],   // ύψος χαρακτήρα
  ['41', '30'],    // reference rectangle width
  ['71', '1'],     // top-left attachment
  ['1', 'alpha\\Pbeta'],
];

const COLUMNS_TAGS: ReadonlyArray<readonly [string, string]> = [
  ['70', '1'],
  ['10', '1.0'], ['20', '0.0'], ['30', '0.0'],   // text direction (μοναδιαίο)
  ['11', '100'], ['21', '50'], ['31', '0'],      // repeated insertion point
  ['40', '30'],                                  // repeated reference column width
  ['41', '8'],                                   // defined column height
  ['42', '64'], ['43', '8'],                     // total width / height
  ['71', '2'],                                   // dynamic
  ['72', '3'],                                   // 3 στήλες
  ['44', '20'], ['45', '2'],                     // column width / gutter
  ['73', '0'], ['74', '0'],
  ['46', '8'], ['46', '8'], ['46', '8'],
];

/** Η τυποποιημένη μορφή που ΠΡΕΠΕΙ να επιβιώσει σε κλίμακα 1. */
const EXPECTED: MTextColumnsData = {
  columnType: 'dynamic', count: 3,
  definedHeight: 8, totalWidth: 64, totalHeight: 8,
  width: 20, gutterWidth: 2,
  autoHeight: false, reversedFlow: false,
  heights: [8, 8, 8],
};

function sourceLines(withColumns: boolean): string[] {
  const flat = (t: ReadonlyArray<readonly [string, string]>) => t.flatMap(([c, v]) => [c, v]);
  return [
    '0', 'MTEXT',
    ...flat(HOST),
    ...(withColumns ? ['101', 'Embedded Object', ...flat(COLUMNS_TAGS)] : []),
    '0', 'ENDSEC',
  ];
}

/** ΚΡΙΚΟΙ 1-2 του αγωγού: ωμό DXF → scene entity (μηδέν χειροκίνητη κατασκευή). */
function importMText(withColumns = true): AnySceneEntity {
  const parsed = DxfEntityParser.parseEntity(sourceLines(withColumns), 0);
  const scene = convertEntityToScene(parsed!, 0);
  return scene as AnySceneEntity;
}

/** ΚΡΙΚΟΣ 4: ξανα-parse της ΓΡΑΜΜΕΝΗΣ οντότητας με τον production parser. */
function reparseMText(dxf: string) {
  const lines = dxf.split('\n');
  const at = lines.findIndex((l, i) => l.trim() === '0' && lines[i + 1]?.trim() === 'MTEXT');
  expect(at).toBeGreaterThanOrEqual(0);
  return DxfEntityParser.parseEntity(lines, at)!;
}

const asEntity = (e: AnySceneEntity): Entity => e as unknown as Entity;

// ── (α) Ο κρίκος που έλειπε: η σκηνή κουβαλά πλέον τη στηλοποίηση ─────────────

describe('ADR-737 §11-1 — η στηλοποίηση φτάνει ΣΤΗ ΣΚΗΝΗ', () => {
  it('convertEntityToScene γεμίζει το `mtextColumns` από το embedded object', () => {
    const e = importMText() as unknown as { mtextColumns?: MTextColumnsData };
    expect(e.mtextColumns).toEqual(EXPECTED);
  });

  it('MTEXT χωρίς `101` δεν αποκτά ΠΟΤΕ πεδίο στηλών (Firestore-safe: κανένα undefined)', () => {
    const e = importMText(false) as unknown as Record<string, unknown>;
    expect('mtextColumns' in e).toBe(false);
  });
});

// ── (β) Πλήρες round-trip μέσα από τον production writer ─────────────────────

describe('ADR-737 §11-1 — round-trip export → re-import', () => {
  it('ο writer ξαναγράφει το embedded object και τυποποιείται ΠΑΝΟΜΟΙΟΤΥΠΑ', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], R2018);
    expect(dxf).toContain('\n101\nEmbedded Object\n');

    const back = reparseMText(dxf);
    expect(back.embeddedObjects).toHaveLength(1);
    expect(findMTextColumns(back.embeddedObjects)).toEqual(EXPECTED);
  });

  it('το `101` μπαίνει ΤΕΛΕΥΤΑΙΟ: κανένας κωδικός στηλών δεν διαρρέει στην host οντότητα', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], R2018);
    const back = reparseMText(dxf);
    expect(back.embeddedObjects).toHaveLength(1); // η ενότητα ΓΡΑΦΤΗΚΕ…

    // …και ΜΕΤΑ τα δεδομένα της οντότητας:
    // 71 = attachment (1 = top-left), ΟΧΙ ο column type (2). 41 = reference width, ΟΧΙ το
    // defined column height (8). Αν το 101 έμπαινε νωρίς, αυτά θα ήταν οι τιμές των στηλών.
    expect(back.data['71']).toBe('1');
    expect(parseFloat(back.data['41'])).toBe(30);
    expect(parseFloat(back.data['10'])).toBe(100);
    expect(parseFloat(back.data['20'])).toBe(50);
    // Κωδικοί αποκλειστικοί του embedded ΔΕΝ υπάρχουν στην οντότητα.
    for (const code of ['42', '43', '45', '46', '72', '73', '74']) {
      expect(back.data[code]).toBeUndefined();
    }
  });

  it('δεύτερο round-trip (export → import → export) μένει σταθερό — μηδέν διάβρωση', () => {
    const first = writeDxfAscii([asEntity(importMText())], R2018);
    const scene2 = convertEntityToScene(reparseMText(first), 0) as AnySceneEntity;
    const second = writeDxfAscii([asEntity(scene2)], R2018);
    expect(findMTextColumns(reparseMText(second).embeddedObjects)).toEqual(EXPECTED);
  });
});

// ── (γ) Η ΠΑΓΙΔΑ: κλίμακα μόνο στα μήκη ──────────────────────────────────────

describe('ADR-737 §11-1 — κλίμακα: μήκη ναι, πλήθη/σημαίες όχι', () => {
  const S = 1000; // m → mm (canonical-mm, ADR-462)

  it('τα μήκη (41/42/43/44/45/46) ακολουθούν το `s` της οντότητας', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], { ...R2018, scale: S });
    const cols = findMTextColumns(reparseMText(dxf).embeddedObjects)!;

    expect(cols.definedHeight).toBe(8 * S);
    expect(cols.totalWidth).toBe(64 * S);
    expect(cols.totalHeight).toBe(8 * S);
    expect(cols.width).toBe(20 * S);
    expect(cols.gutterWidth).toBe(2 * S);
    expect(cols.heights).toEqual([8 * S, 8 * S, 8 * S]);
  });

  it('τα πλήθη/σημαίες (71/72/73/74) ΔΕΝ κλιμακώνονται', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], { ...R2018, scale: S });
    const cols = findMTextColumns(reparseMText(dxf).embeddedObjects)!;

    expect(cols.columnType).toBe('dynamic'); // code 71 = 2, ΟΧΙ 2000
    expect(cols.count).toBe(3);              // code 72 = 3, ΟΧΙ 3000
    expect(cols.autoHeight).toBe(false);
    expect(cols.reversedFlow).toBe(false);
  });

  it('το διάνυσμα κατεύθυνσης (10/20) μένει ΜΟΝΑΔΙΑΙΟ — δεν είναι μήκος', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], { ...R2018, scale: S });
    const raw = reparseMText(dxf).embeddedObjects![0];
    const get = (code: string) => raw.find(([c]) => c === code)?.[1];

    expect(parseFloat(get('10')!)).toBeCloseTo(1, 9);
    expect(parseFloat(get('20')!)).toBeCloseTo(0, 9);
    // ενώ το repeated insertion point (11/21) ΕΙΝΑΙ θέση → κλιμακώνεται με τον host.
    expect(parseFloat(get('11')!)).toBe(100 * S);
    expect(parseFloat(get('21')!)).toBe(50 * S);
    // …και το repeated reference column width (40) είναι μήκος.
    expect(parseFloat(get('40')!)).toBe(30 * S);
  });
});

// ── (δ) Πύλες: πού ΔΕΝ επιτρέπεται το 101 ────────────────────────────────────

describe('ADR-737 §11-1 — πύλες έκδοσης/διαλέκτου', () => {
  // ⚠️ Ο έλεγχος γίνεται ΣΗΜΑΣΙΟΛΟΓΙΚΑ (`embeddedObjects` του re-parse) και όχι με
  // `not.toContain('\n101\n')`: στο R2018 professional envelope το `101` εμφανίζεται και ως
  // **δεκαεξαδικό handle** (`5\n101`), οπότε η σκέτη αναζήτηση κειμένου δίνει ψευδώς θετικό.

  it('MTEXT χωρίς στήλες δεν γράφει ΠΟΤΕ `101` (μηδέν regression στα 99% των MTEXT)', () => {
    const dxf = writeDxfAscii([asEntity(importMText(false))], R2018);
    expect(dxf).toContain('0\nMTEXT\n');
    expect(dxf).not.toContain('Embedded Object');
    expect(reparseMText(dxf).embeddedObjects).toBeUndefined();
  });

  it('R2000: το embedded object είναι R2018+ → δεν γράφεται (οι στήλες ζούσαν σε XDATA)', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], { layersById: LAYERS, acadVer: 'AC1015' });
    expect(dxf).toContain('0\nMTEXT\n');
    expect(dxf).not.toContain('Embedded Object');
    expect(reparseMText(dxf).embeddedObjects).toBeUndefined();
  });

  it('γυμνό μονοπάτι (χωρίς HEADER): δεν γράφεται — οι STYLE κωδικοί 6/48/370 μπαίνουν ΜΕΤΑ', () => {
    // Στο γυμνό μονοπάτι ο dispatcher προσθέτει τα 6/48/370 μετά τον emitter· με ανοιχτή
    // ενότητα 101 θα κατέληγαν ΜΕΣΑ στο ενσωματωμένο αντικείμενο και θα χάνονταν.
    const dxf = writeDxfAscii([asEntity(importMText())], { layersById: LAYERS });
    expect(dxf).toContain('0\nMTEXT\n');
    expect(dxf).not.toContain('Embedded Object');
    expect(reparseMText(dxf).embeddedObjects).toBeUndefined();
  });

  it('Τέκτονας (explode): υποβαθμίζεται σε TEXT — καμία ενότητα 101', () => {
    const dxf = writeDxfAscii([asEntity(importMText())], { ...R2018, lineMode: 'lines' });
    expect(dxf).not.toContain('0\nMTEXT\n');
    expect(dxf).not.toContain('Embedded Object');
  });
});

// ── (ε) canonical-mm × στηλοποίηση: το κενό ΕΚΛΕΙΣΕ ──────────────────────────

describe('ADR-737 §11-1.b — canonical-mm × στηλοποίηση', () => {
  /**
   * 🔴 Το ΑΚΡΙΒΩΣ ίδιο σχήμα με το περιστατικό ADR-635 Φ C.20 (`width`) — **τρίτη** επανάληψη
   * στο ίδιο σημείο: το εισαγόμενο MTEXT περνά από `applyCanonicalMmScale` → `scaleEntity` →
   * `scaleText`, που κλιμάκωνε `position`/`height`/`textNode`/`width` αλλά **ΟΧΙ** το
   * `mtextColumns`. Σε σχέδιο σε μέτρα (mmFactor = 1000) οι στήλες έμεναν σε μονάδες πηγής ενώ
   * όλα τα υπόλοιπα γίνονταν mm ⇒ το export έγραφε στήλες **1000× μικρότερες** από την οντότητα
   * που τις φιλοξενεί. Ελληνικό τοπογραφικό σε μέτρα = **η κανονική περίπτωση**, όχι ακραία.
   *
   * Έκλεισε με τον SSoT `scaleMTextColumns` (`utils/dxf-embedded-object.ts`), που καλείται και
   * από τους **δύο** κλάδους (`scaleText` για το ισοπεδωμένο `type:'text'`, `scaleMText` για το
   * γνήσιο) — ένα σημείο απόφασης, ώστε να μην ξαναγίνει τέταρτη φορά σε έναν μόνο κλάδο.
   */
  it('ο scaleEntity κλιμακώνει το mtextColumns μαζί με την οντότητα', () => {
    const imported = importMText();
    const scaled = {
      ...imported,
      ...scaleEntity(imported as unknown as Entity, { x: 0, y: 0 }, 1000, 1000),
    } as unknown as { width?: number; mtextColumns?: MTextColumnsData };

    expect(scaled.width).toBe(30 * 1000);               // ADR-635 Φ C.20
    expect(scaled.mtextColumns?.width).toBe(20 * 1000); // ADR-737 §11-1.b
  });

  /**
   * ⚠️ ΑΡΝΗΤΙΚΟ PIN — τα `columnType`/`count` είναι **απαρίθμηση και πλήθος**, όχι μήκη.
   * Χωρίς αυτό, ένα «πιο απλό» `Object.entries(...).map(v => v * s)` θα περνούσε τον παραπάνω
   * έλεγχο και θα μετέτρεπε σιωπηλά 2 στήλες σε 2.000.
   */
  it('πλήθος και τύπος στηλών ΔΕΝ κλιμακώνονται', () => {
    const imported = importMText();
    const scaled = {
      ...imported,
      ...scaleEntity(imported as unknown as Entity, { x: 0, y: 0 }, 1000, 1000),
    } as unknown as { mtextColumns?: MTextColumnsData };

    expect(scaled.mtextColumns?.count).toBe(imported.mtextColumns?.count);
    expect(scaled.mtextColumns?.columnType).toBe(imported.mtextColumns?.columnType);
  });
});
