/**
 * 🔴 DXF group code **101 «Embedded Object»** — τομή ενότητας, όχι δεδομένο της οντότητας.
 *
 * ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΠΕΡΙΣΤΑΤΙΚΟ (`47_ergasia.dxf`, 2026-07-30): ο `parseEntity` ισοπέδωνε τα group
 * codes σε `Record<string,string>` και σταματούσε ΜΟΝΟ στο `0`. Έτσι, σε κάθε MTEXT με στήλες,
 * οι κωδικοί του ενσωματωμένου αντικειμένου **επέγραφαν** τους πραγματικούς:
 *
 *   10/20 : 407717.5228 / 4502407.4932 → 1.0 / 0.0   (text direction vector)
 *   41    : 0.5                        → 0
 *   71    : 1 (top-left)               → 2 (column type = dynamic)
 *   44    : 1.0 (line spacing)         → 0.5 (column width)
 *
 * Η θέση γινόταν (1, 0). Το σχέδιο είναι γεωαναφερμένο (ΕΓΣΑ87), άρα το
 * `dropOutOfExtentsEntities` τα θεωρούσε origin junk: **10 MTEXT εξαφανίζονταν σιωπηλά**
 * (75 MTEXT στο ENTITIES → 65 οντότητες σκηνής).
 *
 * Τα fixtures είναι το **αυτούσιο** απόσπασμα του handle 175A (inline, όχι εξωτερικό .dxf).
 */

import { DxfEntityParser } from '../dxf-entity-parser';
import { DxfSceneBuilder } from '../dxf-scene-builder';
import { dropOutOfExtentsEntities } from '../dxf-out-of-extents-filter';
import { createImportDiagnostics } from '../dxf-import-diagnostics';
import {
  EMBEDDED_OBJECT_CODE,
  EMBEDDED_OBJECT_MARKER,
  findMTextColumns,
  parseMTextColumns,
  splitEmbeddedObjects,
  type DxfPair,
} from '../dxf-embedded-object';
import type { AnySceneEntity } from '../../types/scene';

// ── Fixtures: το αυτούσιο MTEXT (handle 175A) ─────────────────────────────────

/** Τα ΠΡΑΓΜΑΤΙΚΑ tags της οντότητας (πριν το 101). */
const HOST_TAGS: ReadonlyArray<DxfPair> = [
  ['8', 'ΤΟΠΟΓΡΑΦΙΚΟ'],
  ['10', '407717.5228080326'],
  ['20', '4502407.493244525'],
  ['30', '0.0'],
  ['40', '0.5'],
  ['41', '0.5'],
  ['71', '1'],
  ['44', '1.0'],
  ['1', '{\\fTimes New Roman|b0|i0|c0|p18;I}'],
];

/** Τα tags του ενσωματωμένου αντικειμένου (MTEXT columns, R2018). */
const EMBEDDED_TAGS: ReadonlyArray<DxfPair> = [
  ['70', '1'],
  ['10', '1.0'], ['20', '0.0'],
  ['11', '407717.5228080326'], ['21', '4502407.493244525'],
  ['40', '0.5'], ['41', '0.0'],
  ['42', '0.2094448449891853'], ['43', '0.5'],
  ['71', '2'], ['72', '1'],
  ['44', '0.5'], ['45', '12.5'],
  ['73', '0'], ['74', '0'],
  ['46', '0.0'],
];

const flat = (tags: ReadonlyArray<DxfPair>): string[] => tags.flatMap(([c, v]) => [c, v]);

/** DXF γραμμές μιας οντότητας: `0/<type>` + tags + (προαιρετικά) embedded objects + `0/ENDSEC`. */
function entityLines(
  type: string,
  own: ReadonlyArray<DxfPair>,
  embedded: ReadonlyArray<ReadonlyArray<DxfPair>> = [],
): string[] {
  return [
    '0', type,
    ...flat(own),
    ...embedded.flatMap(b => [EMBEDDED_OBJECT_CODE, EMBEDDED_OBJECT_MARKER, ...flat(b)]),
    '0', 'ENDSEC',
  ];
}

// ── (α) Τα ΠΡΑΓΜΑΤΙΚΑ tags επιβιώνουν ─────────────────────────────────────────

describe('parseEntity — το 101 σταματά την ανάγνωση της host οντότητας', () => {
  const parsed = DxfEntityParser.parseEntity(entityLines('MTEXT', HOST_TAGS, [EMBEDDED_TAGS]), 0);

  it('κρατά τη ΓΕΩΑΝΑΦΕΡΜΕΝΗ θέση, όχι το text-direction vector του embedded', () => {
    expect(parsed!.data['10']).toBe('407717.5228080326');
    expect(parsed!.data['20']).toBe('4502407.493244525');
  });

  it('κρατά width / attachment / line-spacing της οντότητας', () => {
    expect(parsed!.data['40']).toBe('0.5');   // ύψος χαρακτήρα
    expect(parsed!.data['41']).toBe('0.5');   // reference rectangle width (ήταν 0)
    expect(parsed!.data['71']).toBe('1');     // top-left attachment (ήταν 2)
    expect(parsed!.data['44']).toBe('1.0');   // line spacing (ήταν 0.5 = column width)
  });

  it('ΚΑΝΕΝΑΣ κωδικός αποκλειστικός του embedded δεν διαρρέει στην οντότητα', () => {
    for (const code of ['42', '43', '45', '46', '70', '72', '73', '74', '11', '21']) {
      expect(parsed!.data[code]).toBeUndefined();
    }
    // Ούτε ο ίδιος ο sentinel — δεν είναι δεδομένο.
    expect(parsed!.data[EMBEDDED_OBJECT_CODE]).toBeUndefined();
    expect(parsed!.pairs!.some(([c]) => c === EMBEDDED_OBJECT_CODE)).toBe(false);
  });

  it('τα ordered `pairs` περιέχουν ΜΟΝΟ τα own tags (ADR-507 σημασιολογία αναλλοίωτη)', () => {
    expect(parsed!.pairs).toEqual(HOST_TAGS.map(([c, v]) => [c, v]));
  });
});

// ── (β) Το embedded object ΔΕΝ πετιέται — τυποποιείται ────────────────────────

describe('το ενσωματωμένο αντικείμενο διατηρείται και τυποποιείται σε στήλες', () => {
  const parsed = DxfEntityParser.parseEntity(entityLines('MTEXT', HOST_TAGS, [EMBEDDED_TAGS]), 0);

  it('κρατιέται ΩΜΟ (όλα τα ζεύγη, με τη σειρά ροής)', () => {
    expect(parsed!.embeddedObjects).toHaveLength(1);
    expect(parsed!.embeddedObjects![0]).toEqual(EMBEDDED_TAGS.map(([c, v]) => [c, v]));
  });

  it('parse-άρεται σε MTextColumnsData με union type (όχι γυμνό number)', () => {
    expect(findMTextColumns(parsed!.embeddedObjects)).toEqual({
      columnType: 'dynamic',   // 71 = 2
      count: 1,                // 72
      definedHeight: 0,        // 41
      totalWidth: 0.2094448449891853, // 42
      totalHeight: 0.5,        // 43
      width: 0.5,              // 44
      gutterWidth: 12.5,       // 45
      autoHeight: false,       // 73
      reversedFlow: false,     // 74
      heights: [0],            // 46 (επαναλαμβανόμενος)
    });
  });

  it('parseMTextColumns → null όταν το bucket δεν περιγράφει στήλες (λείπει το 71)', () => {
    expect(parseMTextColumns([['44', '0.5'], ['45', '12.5']])).toBeNull();
    expect(findMTextColumns(undefined)).toBeNull();
  });

  it('άγνωστη τιμή στο 71 ⇒ null (δεν μαντεύουμε τύπο στηλών)', () => {
    expect(parseMTextColumns([['71', '9']])).toBeNull();
    expect(parseMTextColumns([['71', '0']])).toEqual({ columnType: 'none' });
  });
});

// ── (γ) Regression guard: οντότητα ΧΩΡΙΣ 101 ─────────────────────────────────

describe('οντότητα χωρίς 101 μένει byte-identical', () => {
  it('LINE: ίδια πεδία, ΚΑΝΕΝΑ `embeddedObjects` (ούτε κενό)', () => {
    const raw = entityLines('LINE', [['8', 'Α'], ['10', '1'], ['20', '2'], ['11', '3'], ['21', '4']]);
    const e = DxfEntityParser.parseEntity(raw, 0)!;
    expect(Object.keys(e).sort()).toEqual(['data', 'layer', 'pairs', 'type']);
    expect('embeddedObjects' in e).toBe(false);
    expect(e).toEqual({
      type: 'LINE',
      layer: 'Α',
      data: { '8': 'Α', '10': '1', '20': '2', '11': '3', '21': '4' },
      pairs: [['8', 'Α'], ['10', '1'], ['20', '2'], ['11', '3'], ['21', '4']],
    });
  });

  it('MTEXT χωρίς στήλες: το 71 παραμένει το attachment point', () => {
    const e = DxfEntityParser.parseEntity(entityLines('MTEXT', HOST_TAGS), 0)!;
    expect(e.data['71']).toBe('1');
    expect(e.embeddedObjects).toBeUndefined();
  });
});

// ── (δ) ΠΑΝΩ ΑΠΟ ΕΝΑ embedded object ─────────────────────────────────────────

describe('πολλαπλά ενσωματωμένα αντικείμενα', () => {
  const second: ReadonlyArray<DxfPair> = [['71', '1'], ['72', '3'], ['44', '9.5'], ['45', '1.25']];
  const e = DxfEntityParser.parseEntity(entityLines('MTEXT', HOST_TAGS, [EMBEDDED_TAGS, second]), 0)!;

  it('κάθε 101 ανοίγει ΞΕΧΩΡΙΣΤΟ bucket', () => {
    expect(e.embeddedObjects).toHaveLength(2);
    expect(e.embeddedObjects![1]).toEqual(second.map(([c, v]) => [c, v]));
  });

  it('η host οντότητα μένει ανέπαφη και μετά το δεύτερο', () => {
    expect(e.data['10']).toBe('407717.5228080326');
    expect(e.data['44']).toBe('1.0');
    expect(e.data['72']).toBeUndefined();
  });
});

// ── (ε) ATTRIB: ο ΙΔΙΟΣ μηχανισμός (type-agnostic) ───────────────────────────

describe('ATTRIB με embedded object (AcDbMTextObjectEmbedded)', () => {
  it('τα own tags του ATTRIB δεν επιγράφονται από το ενσωματωμένο MTEXT', () => {
    const own: ReadonlyArray<DxfPair> = [
      ['8', 'ΥΨΟΜΕΤΡΑ'], ['1', '12.34'], ['2', 'ELEV'],
      ['10', '407700.0'], ['20', '4502400.0'], ['40', '0.25'], ['71', '0'],
    ];
    const embedded: ReadonlyArray<DxfPair> = [
      ['10', '1.0'], ['20', '0.0'], ['40', '0.5'], ['71', '2'], ['1', 'ΞΕΝΟ ΚΕΙΜΕΝΟ'],
    ];
    const e = DxfEntityParser.parseEntity(entityLines('ATTRIB', own, [embedded]), 0)!;

    expect(e.data['1']).toBe('12.34');
    expect(e.data['2']).toBe('ELEV');
    expect(e.data['10']).toBe('407700.0');
    expect(e.data['40']).toBe('0.25');
    expect(e.data['71']).toBe('0');
    expect(e.embeddedObjects).toHaveLength(1);
  });
});

// ── (στ) Συνύπαρξη με το chunked MTEXT (ADR-635 Φ C.19) ──────────────────────

describe('chunked MTEXT (3…3/1) + embedded object', () => {
  it('ο collector παίρνει ΜΟΝΟ τα own chunks — δεν ρουφά κείμενο του embedded', () => {
    const own: ReadonlyArray<DxfPair> = [
      ['8', '0'], ['10', '407717.5'], ['20', '4502407.5'], ['40', '0.5'],
      ['3', 'ΜΕΡΟΣ-Α|'], ['3', 'ΜΕΡΟΣ-Β|'], ['1', 'ΟΥΡΑ'],
    ];
    const embedded: ReadonlyArray<DxfPair> = [
      ['71', '2'], ['72', '2'], ['3', 'ΞΕΝΟ-CHUNK'], ['1', 'ΞΕΝΗ-ΟΥΡΑ'],
    ];
    const e = DxfEntityParser.parseEntity(entityLines('MTEXT', own, [embedded]), 0)!;

    expect(e.data['1']).toBe('ΜΕΡΟΣ-Α|ΜΕΡΟΣ-Β|ΟΥΡΑ');
    expect(e.data['1']).not.toContain('ΞΕΝΟ');
    expect(findMTextColumns(e.embeddedObjects)).toEqual({ columnType: 'dynamic', count: 2 });
  });
});

// ── Ο καθαρός διαχωριστής (SSoT, ίδιες primitives με τον parser) ─────────────

describe('splitEmbeddedObjects', () => {
  it('χωρίζει own / embedded χωρίς να χάσει ζεύγος', () => {
    const r = splitEmbeddedObjects([
      ['10', '1'], [EMBEDDED_OBJECT_CODE, EMBEDDED_OBJECT_MARKER], ['71', '2'],
      [EMBEDDED_OBJECT_CODE, EMBEDDED_OBJECT_MARKER], ['72', '3'],
    ]);
    expect(r.own).toEqual([['10', '1']]);
    expect(r.embedded).toEqual([[['71', '2']], [['72', '3']]]);
  });

  it('χωρίς 101 επιστρέφει τα πάντα ως own (κενό embedded)', () => {
    const r = splitEmbeddedObjects([['10', '1'], ['20', '2']]);
    expect(r.own).toHaveLength(2);
    expect(r.embedded).toEqual([]);
  });
});

// ── Η ΣΥΝΕΠΕΙΑ: η οντότητα επιβιώνει στη σκηνή ──────────────────────────────

/** Γεωαναφερμένο σχέδιο (ΕΓΣΑ87) με δηλωμένα $EXTMIN/$EXTMAX, όπως το πραγματικό αρχείο. */
function geoReferencedDxf(entity: string[]): string {
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$EXTMIN', '10', '407000.0', '20', '4502000.0',
    '9', '$EXTMAX', '10', '408000.0', '20', '4503000.0',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...entity,
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

describe('regression 47_ergasia.dxf — το MTEXT δεν εξαφανίζεται πια', () => {
  it('παραμένει στη σκηνή αντί να πεταχτεί ως origin junk', () => {
    const content = geoReferencedDxf([
      '0', 'MTEXT',
      ...flat(HOST_TAGS),
      EMBEDDED_OBJECT_CODE, EMBEDDED_OBJECT_MARKER,
      ...flat(EMBEDDED_TAGS),
    ]);

    const scene = DxfSceneBuilder.buildScene(content, 'mm');
    expect(scene.entities.filter(e => e.type === 'text')).toHaveLength(1);
  });
});

// ── Α4: η διαγραφή παύει να είναι ΣΙΩΠΗΛΗ ───────────────────────────────────

describe('dropOutOfExtentsEntities — καταγραφή στα ImportDiagnostics', () => {
  const at = (id: string, x: number, y: number): AnySceneEntity =>
    ({ id, type: 'text', layerId: '0', visible: true, position: { x, y }, text: 'Α' } as unknown as AnySceneEntity);

  it('κάθε drop αφήνει ίχνος (τύπος + id + λόγος) στο ΥΠΑΡΧΟΝ SSoT', () => {
    const d = createImportDiagnostics();
    const r = dropOutOfExtentsEntities(
      [at('junk', 1, 0), at('real', 407717, 4502407)],
      { x: 407000, y: 4502000 }, { x: 408000, y: 4503000 },
      d,
    );
    expect(r.dropped).toBe(1);
    expect(d.errors).toHaveLength(1);
    expect(d.errors[0].kind).toBe('text');
    expect(d.errors[0].at).toBe('junk');
    expect(d.errors[0].reason).toContain('$EXTMIN/$EXTMAX');
  });

  it('χωρίς collector συμπεριφέρεται ακριβώς όπως πριν (σιωπηλά, καμία εξαίρεση)', () => {
    const r = dropOutOfExtentsEntities(
      [at('junk', 1, 0)], { x: 407000, y: 4502000 }, { x: 408000, y: 4503000 },
    );
    expect(r.dropped).toBe(1);
    expect(r.kept).toEqual([]);
  });
});
