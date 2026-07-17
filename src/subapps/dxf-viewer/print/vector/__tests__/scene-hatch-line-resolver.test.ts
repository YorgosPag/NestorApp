/**
 * ADR-667 Φ3 — pre-pass γραμμών μοτίβου.
 *
 * Τι κλειδώνεται εδώ (όλα **σιωπηλές** αστοχίες αν σπάσουν):
 *   • **Απόφαση 6** — το `patternSpace:'screen'` είναι ΟΡΘΟΓΩΝΙΑ διάσταση: παίρνει ριγέ κελί και
 *     **ΠΟΤΕ** world-space segments (το `buildHatchEntitySegments` δεν γνωρίζει καν το πεδίο ⇒ θα
 *     έβγαζε γραμμές που **ποτέ δεν εμφανίστηκαν στην οθόνη**).
 *   • **Απόφαση 7** — ο budget guard τρέχει **ΠΡΙΝ** το explode. Χωρίς αυτό: **164s πάγωμα / OOM
 *     4GB** (μετρημένο) — ένα **αόρατο** λάθος στη θέση ενός ορατού.
 *   • **Απόφαση 5** — η σειρά dispatch: ό,τι κερδίζει πριν τους κλάδους γραμμών δεν καταναλώνει
 *     ούτε budget ούτε κελί.
 *   • **Απόφαση 11** — υποβάθμιση **πάντα** με σημείωση· catalog MISS **χωρίς** (μηδέν απόκλιση
 *     από την οθόνη ⇒ τίποτα να αναφερθεί).
 */

import type { Entity, HatchEntity } from '../../../types/entities';
import type { PrintColorPolicy } from '../../../config/print-color-policy';
import { resolveSceneHatchLines } from '../scene-hatch-line-resolver';
import {
  SCREEN_HATCH_DEFAULT_ANGLE_DEG, SCREEN_HATCH_PAPER_CELL_W_MM,
  SCREEN_HATCH_PAPER_LINE_MM, SCREEN_HATCH_PAPER_SPACING_MM,
} from '../../../rendering/entities/shared/screen-hatch-constants';
import {
  HATCH_MIN_LINE_SPACING_PAPER_MM,
} from '../../../rendering/entities/shared/hatch-density-lod';

const POLICY: PrintColorPolicy = { style: 'colour', dpi: 150 };

/**
 * mm ανά μονάδα σχεδίου — plot 1:1. Με αυτό, το `lineSpacing` των fixtures **είναι** η απόσταση
 * σε mm χαρτιού ⇒ τα κατώφλια πυκνότητας διαβάζονται κατευθείαν, χωρίς νοητή αριθμητική.
 */
const PAPER_SCALE = 1;

/** Μικρό τετράγωνο όριο — αρκετά αραιό ώστε το explode να περνά άνετα το budget. */
const SQUARE = [[
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
]];

function hatch(over: Partial<HatchEntity> & { id: string }): Entity {
  return {
    type: 'hatch', layerId: '0', boundaryPaths: SQUARE,
    fillType: 'user-defined', lineSpacing: 2, lineAngle: 0, color: '#00ff00',
    ...over,
  } as unknown as Entity;
}

function resolve(entities: Entity[], paperScale = PAPER_SCALE) {
  return resolveSceneHatchLines(entities, POLICY, paperScale);
}

describe('Απόφαση 6 — `patternSpace:"screen"` = ριγέ κελί, ΠΟΤΕ world-space segments', () => {
  it('screen-space hatch → ριγέ κελί ΚΑΙ ΚΑΝΕΝΑ segment', () => {
    const r = resolve([hatch({ id: 'h1', patternSpace: 'screen' })]);
    expect(r.stripeFills.has('h1')).toBe(true);
    // 🔴 Αν αυτό σπάσει, τυπώνονται world-space γραμμές που ΠΟΤΕ δεν είδε ο χρήστης.
    expect(r.segments.has('h1')).toBe(false);
    expect(r.warnings).toEqual([]);
  });

  it('το κελί είναι σε **paper mm** (zoom/κλίμακα-ανεξάρτητο) με τον λόγο μελανιού της οθόνης', () => {
    const { cell } = resolve([hatch({ id: 'h1', patternSpace: 'screen' })]).stripeFills.get('h1')!;
    expect(cell.kind).toBe('stripe');
    expect(cell.cellHMm).toBe(SCREEN_HATCH_PAPER_SPACING_MM);
    expect(cell.cellWMm).toBe(SCREEN_HATCH_PAPER_CELL_W_MM);
    expect(cell.lineWidthMm).toBe(SCREEN_HATCH_PAPER_LINE_MM);
    // Λόγος μελανιού 1/3 — ό,τι βλέπει ο χρήστης στην οθόνη (1px γραμμή ανά 3px βήμα).
    expect(cell.lineWidthMm / cell.cellHMm).toBeCloseTo(1 / 3, 10);
  });

  it('η γωνία ζει στην ΤΟΠΟΘΕΤΗΣΗ, όχι στο κελί → ένα κελί ανά ΧΡΩΜΑ, όχι ανά γωνία', () => {
    const r = resolve([
      hatch({ id: 'a', patternSpace: 'screen', lineAngle: 30 }),
      hatch({ id: 'b', patternSpace: 'screen', lineAngle: 75 }),
    ]);
    const a = r.stripeFills.get('a')!;
    const b = r.stripeFills.get('b')!;
    expect([a.angleDeg, b.angleDeg]).toEqual([30, 75]);
    // Ίδιο χρώμα + διαφορετική γωνία ⇒ ΤΟ ΙΔΙΟ κελί (το registry το ορίζει μία φορά).
    expect(a.cell.materialKey).toBe(b.cell.materialKey);
  });

  it('χωρίς `lineAngle` → η προεπιλογή της ΟΘΟΝΗΣ (45°), όχι σκέτο literal', () => {
    const r = resolve([hatch({ id: 'h1', patternSpace: 'screen', lineAngle: undefined })]);
    expect(r.stripeFills.get('h1')!.angleDeg).toBe(SCREEN_HATCH_DEFAULT_ANGLE_DEG);
  });

  it('το μελάνι είναι της ΓΡΑΜΜΟΣΚΙΑΣΗΣ (`fillColor ?? color`) και περνά από το plot policy', () => {
    const r = resolveSceneHatchLines(
      [hatch({ id: 'h1', patternSpace: 'screen', fillColor: '#123456' })],
      { style: 'monochrome', dpi: 150 }, PAPER_SCALE,
    );
    expect(r.stripeFills.get('h1')!.cell.strokeRgb).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('Απόφαση 5 — ό,τι κερδίζει νωρίτερα δεν παίρνει ούτε γραμμές ούτε κελί', () => {
  it.each([
    ['solid (μέσω patternType, με fillType undefined)',
      { patternType: 'solid', fillType: undefined }],
    ['fillType solid', { fillType: 'solid' }],
    ['image (→ raster tiling pattern, Φ2)', { fillType: 'image' }],
    ['gradient (→ ⏳ Φ4)', { fillType: 'gradient' }],
  ])('%s → τίποτα', (_label, over) => {
    const r = resolve([hatch({ id: 'h1', ...(over as Partial<HatchEntity>) })]);
    expect(r.segments.size).toBe(0);
    expect(r.stripeFills.size).toBe(0);
  });

  it('`dxfFaces` (structural/poché) → τίποτα, ΑΚΟΜΗ ΚΑΙ με patternSpace:"screen"', () => {
    // 🔴 Οι παραγωγοί `dxfFaces` ΔΕΝ θέτουν `fillType` — ένα `switch (fillType)` θα τα έριχνε
    //    στο `default` και κάθε structural solid θα γινόταν άδειο περίγραμμα.
    const e = hatch({ id: 'h1', patternSpace: 'screen' }) as unknown as Record<string, unknown>;
    e.dxfFaces = [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]];
    const r = resolve([e as unknown as Entity]);
    expect(r.stripeFills.size).toBe(0);
    expect(r.segments.size).toBe(0);
  });

  it('μη-hatch entities αγνοούνται', () => {
    const line = { id: 'l1', type: 'line', layerId: '0' } as unknown as Entity;
    const r = resolve([line]);
    expect([r.segments.size, r.stripeFills.size, r.warnings.length]).toEqual([0, 0, 0]);
  });

  it('όριο <3 σημείων → τίποτα (δεν υπάρχει επιφάνεια να γεμίσει)', () => {
    const r = resolve([hatch({ id: 'h1', boundaryPaths: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]] })]);
    expect([r.segments.size, r.stripeFills.size]).toEqual([0, 0]);
  });
});

describe('Απόφαση 7 — budget guard ΠΡΙΝ το explode (χωρίς αυτόν: 164s / OOM 4GB)', () => {
  /**
   * **ΑΝΑΓΝΩΣΙΜΟ αλλά ΤΕΡΑΣΤΙΟ** — και τα δύο σκόπιμα (ADR-667 Φ3.1).
   *
   * 🔴 Το βήμα είναι **50mm** (πολύ πάνω από το {@link HATCH_MIN_LINE_SPACING_PAPER_MM}) ώστε το
   * hatch να **περνά** τον density-LOD και να φτάσει πράγματι στο budget. Ένα **πυκνό** τέρας
   * (π.χ. βήμα 0.05) θα κατέρρεε πλέον σε tint **πριν** τον budget guard ⇒ το test θα περνούσε
   * **πράσινο χωρίς να δοκιμάζει το budget**. Το μέγεθος (3.000.000 μονάδες) δίνει ~60.000
   * γραμμές > `MAX_TEK_FILL_LINES_PER_HATCH` (40.000).
   */
  const monster = () => hatch({
    id: 'boom',
    boundaryPaths: [[
      { x: 0, y: 0 }, { x: 3_000_000, y: 0 }, { x: 3_000_000, y: 3_000_000 },
      { x: 0, y: 3_000_000 },
    ]],
    lineSpacing: 50,
  });

  it('πάνω από το budget → σημείωση + ΚΑΝΕΝΑ segment (και ΔΕΝ παγώνει)', () => {
    const started = Date.now();
    const r = resolve([monster()]);
    // Ο guard κόβει ΠΡΙΝ πληρωθεί το κόστος: αν έτρεχε το explode, αυτό θα κρατούσε λεπτά.
    expect(Date.now() - started).toBeLessThan(2000);
    expect(r.segments.has('boom')).toBe(false);
    expect(r.warnings).toEqual(['hatch-lines:budget']);
  });

  it('η υποβάθμιση ΔΕΝ είναι σιωπηλή — ο κωδικός χαρτογραφείται σε ορατή σημείωση', () => {
    // (Ο πλήρης έλεγχος του mapping ζει στο `print-fidelity.test.ts` — εδώ κλειδώνεται μόνο
    //  ότι το pre-pass ΕΚΠΕΜΠΕΙ κωδικό, αντί να πετάξει τις γραμμές στα σιωπηλά.)
    expect(resolve([monster()]).warnings.length).toBeGreaterThan(0);
  });

  it('το budget είναι ΣΥΝΟΛΙΚΟ: ένα τέρας δεν εμποδίζει τα αθώα που ήρθαν πριν', () => {
    const r = resolve([hatch({ id: 'ok' }), monster()]);
    expect(r.segments.has('ok')).toBe(true);
    expect(r.segments.has('boom')).toBe(false);
  });

  it('αραιή γραμμοσκίαση → κανονικά segments, καμία σημείωση', () => {
    const r = resolve([hatch({ id: 'h1' })]);
    expect(r.segments.get('h1')!.length).toBeGreaterThan(0);
    expect(r.warnings).toEqual([]);
  });
});

describe('Φ3.1 — density-LOD χαρτιού (η Απόφαση 7 έλεγε «δεν χρειάζεται» — ΛΑΘΟΣ)', () => {
  /**
   * **Το ΠΡΑΓΜΑΤΙΚΟ περιστατικό, σε αριθμούς** (μετρημένο στο εξαγόμενο PDF, όχι υποθετικό):
   * οι διαγώνιες απείχαν **0,089mm** στο χαρτί με μελάνι **0,18mm** ⇒ ~200% κάλυψη ⇒ συμπαγές
   * μαύρο. Εδώ: βήμα 0,089 world × κλίμακα 1 = **0,089mm χαρτιού** — το ίδιο νούμερο.
   */
  const blackMass = () => hatch({ id: 'mass', lineSpacing: 0.089 });

  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — 0,089mm στο χαρτί → tint, ΟΧΙ 69.136 γραμμές που γίνονται μαύρη μάζα', () => {
    const r = resolve([blackMass()]);
    expect(r.collapsedFills.has('mass')).toBe(true);
    // 🔴 ΚΑΙ perf: όπως η οθόνη, ΔΕΝ παράγει καν τα segments.
    expect(r.segments.has('mass')).toBe(false);
  });

  it('🔴 ο budget guard ΔΕΝ το πιάνει — γι᾽ αυτό ακριβώς χρειάζεται ο density-LOD', () => {
    // Ο λόγος ύπαρξης όλης της Φ3.1: ο budget μετρά ΠΛΗΘΟΣ, όχι ΑΝΑΓΝΩΣΙΜΟΤΗΤΑ. Στο πραγματικό
    // περιστατικό οι 69.136 γραμμές πέρασαν άνετα κάτω από τα 120.000 και βγήκε μαύρο πλακάκι.
    // Αν αυτό γίνει ποτέ 'hatch-lines:budget', κάποιος έδεσε τα δύο ερωτήματα μεταξύ τους.
    expect(resolve([blackMass()]).warnings).toEqual(['hatch-lines:density']);
  });

  it('η υποβάθμιση ΔΕΝ είναι σιωπηλή — το Revit το κάνει σιωπηλά, εμείς όχι (Απόφαση 11)', () => {
    // Υπαρκτή απόκλιση: ο χρήστης βλέπει γραμμές στο zoom του, το χαρτί δίνει απόχρωση.
    expect(resolve([blackMass()]).warnings).toContain('hatch-lines:density');
  });

  it('ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΠΡΟΤΥΠΟΥ (ISO 128-2 ≥0,7mm) — ακριβώς στο όριο δεν καταρρέει', () => {
    // Αυστηρή ανισότητα: `< κατώφλι` καταρρέει. Στο ίδιο το κατώφλι το μοτίβο είναι αναγνώσιμο.
    const at = resolve([hatch({ id: 'at', lineSpacing: HATCH_MIN_LINE_SPACING_PAPER_MM })]);
    expect(at.collapsedFills.has('at')).toBe(false);
    expect(at.segments.has('at')).toBe(true);

    const below = resolve([hatch({ id: 'below', lineSpacing: HATCH_MIN_LINE_SPACING_PAPER_MM * 0.99 })]);
    expect(below.collapsedFills.has('below')).toBe(true);
  });

  it('🔴 Η ΚΛΙΜΑΚΑ ΤΟΥ ΧΑΡΤΙΟΥ ΜΕΤΡΑΕΙ — το ΙΔΙΟ hatch, δύο κλίμακες, δύο αποτελέσματα', () => {
    // Αυτό καταρρίπτει το σκεπτικό της αρχικής Απόφασης 7 («το χαρτί δεν έχει zoom»): το
    // `worldToPaperScale` είναι ΑΚΡΙΒΩΣ το ανάλογο του `transform.scale` της οθόνης.
    const dense = () => hatch({ id: 'h1', lineSpacing: 0.5 });
    // 1:1 → 0,5mm στο χαρτί ⇒ κάτω από το ISO όριο ⇒ tint.
    expect(resolve([dense()], 1).collapsedFills.has('h1')).toBe(true);
    // Μεγέθυνση ×10 → 5mm στο χαρτί ⇒ άνετα αναγνώσιμο ⇒ πραγματικές γραμμές.
    expect(resolve([dense()], 10).segments.has('h1')).toBe(true);
    expect(resolve([dense()], 10).collapsedFills.size).toBe(0);
  });

  it('screen-space μοτίβο ΔΕΝ καταρρέει ποτέ — έχει σταθερή πυκνότητα εξ ορισμού', () => {
    // Κάτοπτρο της οθόνης: εκεί ο density-LOD κάθεται ΜΕΤΑ τον screen-space κλάδο ⇒ δεν τον
    // αγγίζει ποτέ. Το ριγέ κελί γράφεται σε 0,8mm — είναι ΗΔΗ στο όριο, by construction.
    const r = resolve([hatch({ id: 'h1', patternSpace: 'screen', lineSpacing: 0.001 })]);
    expect(r.stripeFills.has('h1')).toBe(true);
    expect(r.collapsedFills.size).toBe(0);
  });

  it('solid → καμία κατάρρευση (δεν έχει γραμμές να χάσει)', () => {
    expect(resolve([hatch({ id: 'h1', fillType: 'solid' })]).collapsedFills.size).toBe(0);
  });

  it('αραιό μοτίβο → πραγματικές γραμμές, καμία κατάρρευση, καμία σημείωση', () => {
    const r = resolve([hatch({ id: 'h1' })]); // lineSpacing 2 → 2mm στο χαρτί
    expect(r.collapsedFills.size).toBe(0);
    expect(r.segments.has('h1')).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});

describe('Απόφαση 8/11 — catalog MISS: ΔΑΠΕΔΟ περίγραμμα, ΧΩΡΙΣ ψευδή σημείωση', () => {
  it('άγνωστο predefined μοτίβο → κανένα segment ΚΑΙ καμία σημείωση', () => {
    // Η οθόνη δείχνει κι αυτή τίποτα ⇒ **μηδέν απόκλιση** οθόνης↔χαρτιού. Μια σημείωση εδώ θα
    // ήταν ψευδώς θετική: το fidelity report μετρά τι έχασε το PDF **έναντι της οθόνης**.
    const r = resolve([hatch({
      id: 'h1', fillType: 'predefined', patternName: '__ΑΝΥΠΑΡΚΤΟ__', inlinePattern: undefined,
    })]);
    expect(r.segments.size).toBe(0);
    expect(r.warnings).toEqual([]);
  });
});
