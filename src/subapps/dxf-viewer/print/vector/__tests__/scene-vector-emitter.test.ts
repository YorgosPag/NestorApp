/**
 * ADR-608 — scene-vector-emitter unit tests.
 *
 * Verifies the emitter maps each flattened primitive to the correct jsPDF vector
 * call (line/circle/lines/text) in placed paper mm, applies the plot-colour policy,
 * and skips unsupported types — without a real jsPDF or canvas.
 */

import type { Entity } from '../../../types/entities';
import type { AnnotationSymbolEntity } from '../../../types/annotation-symbol';
import type { Point2D } from '../../../rendering/types/Types';
import { emitSceneToPdf } from '../scene-vector-emitter';
import { decomposeAnnotationEntity } from '../../../export/core/annotation-to-primitives';

interface Call { fn: string; args: readonly unknown[]; }

/**
 * Ο emitter χτίζει pattern registry σε ΚΑΘΕ `draw` (ADR-667 Απόφαση 10) ⇒ το mock χρειάζεται την
 * ελάχιστη επιφάνεια tiling-pattern του jsPDF. Τα ΠΡΑΓΜΑΤΙΚΑ μαθηματικά/κύκλος ζωής επικυρώνονται
 * με **αληθινό jsPDF** στο `pdf-tiling-pattern.test.ts` — εδώ ελέγχεται μόνο το **dispatch**.
 */
function mockPdf(): { pdf: Record<string, unknown>; calls: Call[] } {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
  const matrix = (...m: number[]) => ({
    multiply: () => matrix(...m), toString: () => m.join(' '),
  });
  const pdf = {
    setDrawColor: rec('setDrawColor'),
    setFillColor: rec('setFillColor'),
    setLineWidth: rec('setLineWidth'),
    setLineCap: rec('setLineCap'),
    setLineJoin: rec('setLineJoin'),
    setFontSize: rec('setFontSize'),
    line: rec('line'),
    circle: rec('circle'),
    lines: rec('lines'),
    text: rec('text'),
    addImage: rec('addImage'),
    saveGraphicsState: rec('saveGraphicsState'),
    restoreGraphicsState: rec('restoreGraphicsState'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    close: rec('close'),
    clipEvenOdd: rec('clipEvenOdd'),
    discardPath: rec('discardPath'),
    // ── tiling patterns (ADR-667 Φ2) ──
    internal: { scaleFactor: 72 / 25.4, pageSize: { getHeight: () => 210 } },
    Matrix: (...m: number[]) => matrix(...m),
    TilingPattern: () => ({ cloneIndex: 0 }),
    advancedAPI: (body: () => void) => { calls.push({ fn: 'advancedAPI', args: [] }); body(); },
    beginTilingPattern: rec('beginTilingPattern'),
    endTilingPattern: rec('endTilingPattern'),
    fillEvenOdd: rec('fillEvenOdd'),
  };
  return { pdf, calls };
}

// Simple Y-flip placement so transformed coords are assertable.
const toPaper = (p: Point2D): Point2D => ({ x: p.x, y: 100 - p.y });
const EMPTY_IMAGES = {
  images: new Map(), patternCells: new Map(), solidFallbacks: new Map(), warnings: [],
};
/** ADR-667 Φ3 — το sibling pre-pass των γραμμών μοτίβου (κενό = καμία γραμμοσκίαση με γραμμές). */
const EMPTY_HATCH_LINES = {
  segments: new Map(), stripeFills: new Map(), collapsedFills: new Set<string>(), warnings: [],
};
const baseParams = {
  toPaper, worldToPaperScale: 1, colorPolicy: { style: 'colour' as const, dpi: 150 },
  images: EMPTY_IMAGES,
  hatchLines: EMPTY_HATCH_LINES,
};

function emit(
  entities: Entity[], policy = baseParams.colorPolicy, images = EMPTY_IMAGES,
  hatchLines = EMPTY_HATCH_LINES,
) {
  const { pdf, calls } = mockPdf();
  emitSceneToPdf(pdf as never, {
    ...baseParams, colorPolicy: policy, entities, images, hatchLines,
  });
  return calls;
}

function only(calls: Call[], fn: string): Call[] {
  return calls.filter((c) => c.fn === fn);
}

describe('scene-vector-emitter — primitive dispatch', () => {
  it('line → pdf.line in placed paper mm', () => {
    const e = { id: 'l1', type: 'line', layerId: '0', start: { x: 0, y: 0 }, end: { x: 10, y: 20 } };
    const line = only(emit([e as unknown as Entity]), 'line');
    expect(line).toHaveLength(1);
    // toPaper flips Y: (0,0)→(0,100), (10,20)→(10,80).
    expect(line[0].args).toEqual([0, 100, 10, 80]);
  });

  it('circle → pdf.circle with scaled radius + stroke style', () => {
    const e = { id: 'c1', type: 'circle', layerId: '0', center: { x: 5, y: 5 }, radius: 3 };
    const circle = only(emit([e as unknown as Entity]), 'circle');
    expect(circle).toHaveLength(1);
    expect(circle[0].args).toEqual([5, 95, 3, 'S']);
  });

  it('arc → tessellated pdf.lines (stroke, open)', () => {
    const e = {
      id: 'a1', type: 'arc', layerId: '0',
      center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90,
    };
    const lines = only(emit([e as unknown as Entity]), 'lines');
    expect(lines).toHaveLength(1);
    // style 'S', closed false.
    expect(lines[0].args[4]).toBe('S');
    expect(lines[0].args[5]).toBe(false);
    // several segments for a 90° sweep.
    expect((lines[0].args[0] as unknown[]).length).toBeGreaterThanOrEqual(4);
  });

  it('sets round line cap + join so corners close without notches', () => {
    const e = { id: 'l1', type: 'line', layerId: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    const calls = emit([e as unknown as Entity]);
    expect(only(calls, 'setLineCap')[0].args).toEqual(['round']);
    expect(only(calls, 'setLineJoin')[0].args).toEqual(['round']);
  });

  it('polyline (closed) → pdf.lines closed', () => {
    const e = {
      id: 'p1', type: 'lwpolyline', layerId: '0', closed: true,
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    };
    const lines = only(emit([e as unknown as Entity]), 'lines');
    expect(lines).toHaveLength(1);
    expect(lines[0].args[5]).toBe(true);
  });

  it('rectangle → closed pdf.lines', () => {
    const e = { id: 'r1', type: 'rectangle', layerId: '0', x: 0, y: 0, width: 4, height: 2 };
    const lines = only(emit([e as unknown as Entity]), 'lines');
    expect(lines).toHaveLength(1);
    expect(lines[0].args[5]).toBe(true);
  });

  it('text → native pdf.text + setFontSize', () => {
    const e = {
      id: 't1', type: 'text', layerId: '0',
      position: { x: 2, y: 8 }, text: 'ΑΒ', height: 2.5, rotation: 0,
    };
    const calls = emit([e as unknown as Entity]);
    expect(only(calls, 'setFontSize')).toHaveLength(1);
    const text = only(calls, 'text');
    expect(text).toHaveLength(1);
    expect(text[0].args[0]).toBe('ΑΒ');
    // placed at toPaper(position) = (2, 92).
    expect(text[0].args[1]).toBe(2);
    expect(text[0].args[2]).toBe(92);
  });

  it('hatch boundary → stroked pdf.lines', () => {
    const e = {
      id: 'h1', type: 'hatch', layerId: '0',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]],
    };
    const lines = only(emit([e as unknown as Entity]), 'lines');
    expect(lines).toHaveLength(1);
  });

  it('unsupported type (point) → no draw calls', () => {
    const e = { id: 'pt1', type: 'point', layerId: '0', position: { x: 1, y: 1 } };
    const calls = emit([e as unknown as Entity]);
    expect(only(calls, 'line')).toHaveLength(0);
    expect(only(calls, 'lines')).toHaveLength(0);
    expect(only(calls, 'circle')).toHaveLength(0);
  });
});

describe('scene-vector-emitter — plot colour policy', () => {
  it('monochrome forces black draw colour', () => {
    const e = { id: 'l1', type: 'line', layerId: '0', color: '#ff0000', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    const draw = only(emit([e as unknown as Entity], { style: 'monochrome', dpi: 150 }), 'setDrawColor');
    expect(draw[0].args).toEqual([0, 0, 0]);
  });

  it('colour policy keeps a non-white entity colour', () => {
    const e = { id: 'l1', type: 'line', layerId: '0', color: '#ff0000', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    const draw = only(emit([e as unknown as Entity]), 'setDrawColor');
    expect(draw[0].args).toEqual([255, 0, 0]);
  });
});

describe('scene-vector-emitter — annotation label + solid fill (ADR-608)', () => {
  it('decomposed label honours alignment + vertical baseline', () => {
    const e = {
      id: 't1', type: 'text', layerId: '0', position: { x: 2, y: 8 },
      text: 'N', height: 2.5, rotation: 0, alignment: 'center', vBaseline: 'middle',
    };
    const text = only(emit([e as unknown as Entity]), 'text');
    expect(text).toHaveLength(1);
    const opts = text[0].args[3] as { align?: string; baseline?: string };
    expect(opts.align).toBe('center');
    expect(opts.baseline).toBe('middle');
  });

  it('scene text without hints → default left / alphabetic (unchanged)', () => {
    const e = { id: 't2', type: 'text', layerId: '0', position: { x: 0, y: 0 }, text: 'A', height: 2.5 };
    const opts = only(emit([e as unknown as Entity]), 'text')[0].args[3] as {
      align?: string; baseline?: string;
    };
    expect(opts.align).toBe('left');
    expect(opts.baseline).toBe('alphabetic');
  });

  it('solid-fill hatch (dxfFaces) → filled pdf.lines (style F)', () => {
    const e = {
      id: 'h1', type: 'hatch', layerId: '0',
      dxfFaces: [[{ x: 0, y: 0, zMm: 0 }, { x: 5, y: 0, zMm: 0 }, { x: 5, y: 5, zMm: 0 }]],
    };
    const lines = only(emit([e as unknown as Entity]), 'lines');
    expect(lines).toHaveLength(1);
    expect(lines[0].args[4]).toBe('F');
  });

  // End-to-end guard: the REAL decomposer output (not a hand-written face) must
  // actually paint a fill. This is what would have caught the flat-dxfFaces bug —
  // the siloed unit tests each passed while the wired pipeline drew no arrowhead.
  it('decomposed north arrow → emits a filled triangle (pdf.lines style F)', () => {
    const arrow = {
      id: 'na', type: 'annotation-symbol', layerId: '0', color: '#00ff00',
      position: { x: 0, y: 0 }, kind: 'north-arrow', symbolId: 'northArrowSimple', sizeMm: 15,
    } as unknown as AnnotationSymbolEntity;
    const primitives = decomposeAnnotationEntity(arrow as Entity, { drawingScale: 100, sceneUnits: 'mm' }) ?? [];
    const fills = only(emit(primitives), 'lines').filter((c) => c.args[4] === 'F');
    expect(fills.length).toBeGreaterThanOrEqual(1); // the filled arrowhead
  });
});

describe('scene-vector-emitter — hybrid image compositing (ADR-608)', () => {
  // A resolved image whose axis-aligned placement makes the addImage args assertable.
  // World rect BL(0,0) BR(10,0) TL(0,4) → toPaper Y-flip → BL(0,100) BR(10,100) TL(0,96).
  const axisAlignedImage = {
    dataUrl: 'data:img', alias: 'tex-a',
    placements: [{ bl: { x: 0, y: 0 }, br: { x: 10, y: 0 }, tl: { x: 0, y: 4 }, wWorld: 10, hWorld: 4 }],
  };

  it('ImageEntity → pdf.addImage at the placed rect (top-left, w, h, rotation 0)', () => {
    const e = { id: 'img1', type: 'image', layerId: '0' };
    const images = { ...EMPTY_IMAGES, images: new Map([['img1', axisAlignedImage]]) };
    const calls = only(emit([e as unknown as Entity], baseParams.colorPolicy, images), 'addImage');
    expect(calls).toHaveLength(1);
    const [data, fmt, x, y, w, h, alias, comp, rot] = calls[0].args;
    expect([data, fmt, alias, comp]).toEqual(['data:img', 'PNG', 'tex-a', 'FAST']);
    // BL paper = (0,100), hMm = 4 → y = 100 - 4 = 96 (top-left). w=10, h=4, rotation 0.
    expect([x, y, w, h, rot]).toEqual([0, 96, 10, 4, 0]);
  });

  it('image-fill hatch (solid fallback) → filled boundary (pdf.lines style F), no addImage', () => {
    const e = {
      id: 'h2', type: 'hatch', layerId: '0', fillType: 'image',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]],
    };
    const images = { ...EMPTY_IMAGES, solidFallbacks: new Map([['h2', '#804020']]) };
    const calls = emit([e as unknown as Entity], baseParams.colorPolicy, images);
    expect(only(calls, 'addImage')).toHaveLength(0);
    const fills = only(calls, 'lines').filter((c) => c.args[4] === 'F');
    expect(fills).toHaveLength(1);
    // fallback colour applied (last setFillColor — after the base applyEntityStyle one).
    const fillColors = only(calls, 'setFillColor');
    expect(fillColors[fillColors.length - 1].args).toEqual([128, 64, 32]);
  });

  it('composites images INLINE in array order (z-order preserved with linework)', () => {
    const line = { id: 'l1', type: 'line', layerId: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    const img = { id: 'img1', type: 'image', layerId: '0' };
    const images = { ...EMPTY_IMAGES, images: new Map([['img1', axisAlignedImage]]) };
    // Image BEFORE line in the array → addImage must be recorded before pdf.line.
    const calls = emit([img as unknown as Entity, line as unknown as Entity], baseParams.colorPolicy, images);
    const order = calls.filter((c) => c.fn === 'addImage' || c.fn === 'line').map((c) => c.fn);
    expect(order).toEqual(['addImage', 'line']);
  });

  it('ImageEntity with no resolved entry → skipped (no addImage)', () => {
    const e = { id: 'ghost', type: 'image', layerId: '0' };
    const calls = only(emit([e as unknown as Entity]), 'addImage');
    expect(calls).toHaveLength(0);
  });
});

// ─── ADR-667 Φ2 — native tiling patterns (η φάση που σκοτώνει το γκρι) ────────

describe('scene-vector-emitter — hatch dispatch (ADR-667 Απόφαση 5)', () => {
  const cell = {
    dataUrl: 'data:cell', alias: 'mat-stripes',
    tileWWorld: 4, tileHWorld: 2, angleDeg: 30, anchorWorld: { x: 0, y: 0 },
  };
  const imageHatch = (id: string) => ({
    id, type: 'hatch', layerId: '0', fillType: 'image',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }]],
  } as unknown as Entity);

  function emitWithCell(entities: Entity[], cells: [string, typeof cell][]) {
    return emit(entities, baseParams.colorPolicy, { ...EMPTY_IMAGES, patternCells: new Map(cells) });
  }

  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: image-fill hatch → ΕΝΑ tiling pattern fill, ΜΗΔΕΝ raster tiles', () => {
    const calls = emitWithCell([imageHatch('h1')], [['h1', cell]]);
    // Το γκρι πέθανε: κανένα `addImage` στη σελίδα, κανένα solid — ένα μοτίβο.
    expect(only(calls, 'addImage').filter((c) => c.args[6] !== 'mat-stripes')).toHaveLength(0);
    expect(only(calls, 'fillEvenOdd')).toHaveLength(1);
  });

  it('τα κελιά ορίζονται σε ΕΝΑ advancedAPI block ΠΡΙΝ εκπεμφθεί η πρώτη οντότητα', () => {
    const line = { id: 'l1', type: 'line', layerId: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    const calls = emitWithCell([line as unknown as Entity, imageHatch('h1')], [['h1', cell]]);
    const seq = calls.map((c) => c.fn);
    expect(only(calls, 'advancedAPI')).toHaveLength(1);
    // Ορισμός → ΠΡΙΝ από κάθε γεωμετρία (lazy ορισμός ⇒ ξετύλιχτο render-target stack ⇒ λευκή σελίδα).
    expect(seq.indexOf('endTilingPattern')).toBeLessThan(seq.indexOf('line'));
    expect(seq.indexOf('beginTilingPattern')).toBeLessThan(seq.indexOf('endTilingPattern'));
  });

  it('το κελί γράφεται σε paper mm με ΑΝΕΞΑΡΤΗΤΟ πλάτος/ύψος (Απόφαση 9 — όχι scalar)', () => {
    // worldToPaperScale = 1 ⇒ 4×2 world → 4×2 mm. Ένα scalar `cellPaperMm` θα έριχνε το ύψος.
    const calls = emitWithCell([imageHatch('h1')], [['h1', cell]]);
    const [, , x, y, w, h, alias] = only(calls, 'addImage')[0].args;
    expect([x, y, w, h, alias]).toEqual([0, 0, 4, 2, 'mat-stripes']);
  });

  it('το path χτίζεται με style === null (αλλιώς ο jsPDF κάνει stroke αντί για pattern fill)', () => {
    const calls = emitWithCell([imageHatch('h1')], [['h1', cell]]);
    const path = only(calls, 'lines');
    expect(path).toHaveLength(1);
    expect(path[0].args[4]).toBeNull();
    expect(path[0].args[5]).toBe(true); // κλειστό loop
  });

  it('ίδιο υλικό σε δύο hatch → ΕΝΑ ορισμένο κελί (dedup), δύο fills', () => {
    const calls = emitWithCell([imageHatch('h1'), imageHatch('h2')], [['h1', cell], ['h2', cell]]);
    expect(only(calls, 'beginTilingPattern')).toHaveLength(1);
    expect(only(calls, 'fillEvenOdd')).toHaveLength(2);
  });

  it('εκφυλισμένο boundary → ΚΑΝΕΝΑ pattern fill, πέφτει στο δάπεδο (Απόφαση 8)', () => {
    const degenerate = {
      id: 'h1', type: 'hatch', layerId: '0', fillType: 'image',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]], // 2 σημεία → κανένα πολύγωνο
    } as unknown as Entity;
    const calls = emitWithCell([degenerate], [['h1', cell]]);
    expect(only(calls, 'fillEvenOdd')).toHaveLength(0);
    expect(only(calls, 'lines').filter((c) => c.args[4] === 'S')).toHaveLength(1); // outline
  });

  // 🔴 Ο ΛΟΓΟΣ που η σειρά είναι νόμος: το `fillType` είναι optional και οι παραγωγοί `dxfFaces`
  // ΔΕΝ το θέτουν. Ένα `switch (fillType)` ⇒ κάθε structural/poché solid γίνεται άδειο περίγραμμα.
  it('dxfFaces ΧΩΡΙΣ fillType → γεμίζει (ΔΕΝ πέφτει σε άδειο περίγραμμα)', () => {
    const e = {
      id: 'h1', type: 'hatch', layerId: '0', patternType: 'solid',
      dxfFaces: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]],
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]],
    };
    const fills = only(emit([e as unknown as Entity]), 'lines').filter((c) => c.args[4] === 'F');
    expect(fills).toHaveLength(1);
  });

  it('solid hatch ΧΩΡΙΣ dxfFaces → γεμίζει με fillColor (κάτοπτρο HatchRenderer)', () => {
    const e = {
      id: 'h1', type: 'hatch', layerId: '0', fillType: 'solid',
      color: '#ff0000', fillColor: '#00ff00',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]],
    };
    const calls = emit([e as unknown as Entity]);
    expect(only(calls, 'lines').filter((c) => c.args[4] === 'F')).toHaveLength(1);
    const fillColors = only(calls, 'setFillColor');
    expect(fillColors[fillColors.length - 1].args).toEqual([0, 255, 0]); // fillColor, όχι color
  });
});

// ─── ADR-667 Φ3 — γραμμές μοτίβου + screen-space + backgroundColor ────────────

describe('scene-vector-emitter — Φ3: ο default τύπος κάθε νέου hatch γεμίζει επιτέλους', () => {
  const SQUARE = [[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]];
  const lineHatch = (over: Record<string, unknown> = {}) => ({
    id: 'h1', type: 'hatch', layerId: '0', fillType: 'user-defined',
    boundaryPaths: SQUARE, color: '#00ff00', ...over,
  } as unknown as Entity);

  const STRIPE_CELL = {
    kind: 'stripe' as const, materialKey: '0,255,0', cellWMm: 2.1333333, cellHMm: 0.8,
    strokeRgb: { r: 0, g: 255, b: 0 }, lineWidthMm: 0.2666667,
  };
  const withStripe = (id: string, angleDeg = 45) => ({
    ...EMPTY_HATCH_LINES, stripeFills: new Map([[id, { cell: STRIPE_CELL, angleDeg }]]),
  });
  const withSegments = (id: string, segs: { start: Point2D; end: Point2D }[]) => ({
    ...EMPTY_HATCH_LINES, segments: new Map([[id, segs]]),
  });

  it('exploded segments → ΜΙΑ pdf.line ανά γραμμή, σε paper mm', () => {
    const segs = [
      { start: { x: 0, y: 1 }, end: { x: 4, y: 1 } },
      { start: { x: 0, y: 3 }, end: { x: 4, y: 3 } },
    ];
    const calls = emit([lineHatch()], baseParams.colorPolicy, EMPTY_IMAGES, withSegments('h1', segs));
    const lines = only(calls, 'line');
    expect(lines).toHaveLength(2);
    expect(lines[0].args).toEqual([0, 99, 4, 99]); // toPaper: y → 100 - y
  });

  it('οι γραμμές μοτίβου παίρνουν το χρώμα της ΓΡΑΜΜΟΣΚΙΑΣΗΣ (fillColor ?? color)', () => {
    const segs = [{ start: { x: 0, y: 1 }, end: { x: 4, y: 1 } }];
    const calls = emit(
      [lineHatch({ fillColor: '#ff0000' })], baseParams.colorPolicy, EMPTY_IMAGES,
      withSegments('h1', segs),
    );
    const draws = only(calls, 'setDrawColor');
    expect(draws[draws.length - 1].args).toEqual([255, 0, 0]);
  });

  it('🔴 το ΔΑΠΕΔΟ περίγραμμα βγαίνει ΚΑΙ μαζί με τις γραμμές (κάτοπτρο οθόνης)', () => {
    // Η οθόνη ζωγραφίζει το περίγραμμα σε ΚΑΘΕ κλάδο. Αν το χάναμε εδώ, η Φ3 θα ΑΦΑΙΡΟΥΣΕ
    // το περίγραμμα που τυπώνεται ήδη σήμερα ⇒ regression αντί για βελτίωση.
    const segs = [{ start: { x: 0, y: 1 }, end: { x: 4, y: 1 } }];
    const calls = emit([lineHatch()], baseParams.colorPolicy, EMPTY_IMAGES, withSegments('h1', segs));
    expect(only(calls, 'lines').filter((c) => c.args[4] === 'S')).toHaveLength(1);
  });

  it('χωρίς segments (catalog MISS / πάνω από budget) → ΜΟΝΟ περίγραμμα, καμία γραμμή', () => {
    const calls = emit([lineHatch()]);
    expect(only(calls, 'line')).toHaveLength(0);
    expect(only(calls, 'lines').filter((c) => c.args[4] === 'S')).toHaveLength(1);
  });

  it('screen-space → ριγέ tiling pattern (fillEvenOdd) + ΔΑΠΕΔΟ περίγραμμα', () => {
    const calls = emit(
      [lineHatch({ patternSpace: 'screen' })], baseParams.colorPolicy, EMPTY_IMAGES,
      withStripe('h1'),
    );
    expect(only(calls, 'fillEvenOdd')).toHaveLength(1);
    // Το κελί ορίστηκε στην ΑΡΧΗ του draw (Απόφαση 10), πριν εκπεμφθεί η πρώτη οντότητα.
    const order = calls.map((c) => c.fn);
    expect(order.indexOf('endTilingPattern')).toBeLessThan(order.indexOf('fillEvenOdd'));
    // ΔΑΠΕΔΟ = το ΚΛΕΙΣΤΟ stroke (η ανοιχτή 'S' γραμμή είναι η ρίγα ΜΕΣΑ στο κελί).
    expect(only(calls, 'lines').filter((c) => c.args[4] === 'S' && c.args[5] === true))
      .toHaveLength(1);
  });

  it('screen-space → ΚΑΜΙΑ world-space γραμμή (Απόφαση 6 — ορθογώνια διάσταση)', () => {
    const calls = emit(
      [lineHatch({ patternSpace: 'screen' })], baseParams.colorPolicy, EMPTY_IMAGES,
      withStripe('h1'),
    );
    expect(only(calls, 'line')).toHaveLength(0);
  });
});

describe('scene-vector-emitter — Φ3: backgroundColor (AutoCAD DXF 63)', () => {
  const SQUARE = [[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]];
  const bgHatch = (over: Record<string, unknown> = {}) => ({
    id: 'h1', type: 'hatch', layerId: '0', fillType: 'user-defined',
    boundaryPaths: SQUARE, color: '#00ff00', backgroundColor: '#ffffff', ...over,
  } as unknown as Entity);

  it('🔴 ΛΕΥΚΟ φόντο μένει ΛΕΥΚΟ — το white-safe policy ΔΕΝ εφαρμόζεται σε υπόστρωμα', () => {
    // Ο Τέκτων δίνει λευκό `raster_bgcolor` σε κάθε imported hatch. Το `applyPlotColor` θα το
    // έκανε ΜΑΥΡΟ (λευκό ΜΕΛΑΝΙ = αόρατο σε λευκό χαρτί) ⇒ μαύρο ορθογώνιο πάνω από το σχέδιο.
    // Το raster μονοπάτι το εκπέμπει αυτούσιο ⇒ το vector πρέπει να συμφωνεί.
    const calls = emit([bgHatch()]);
    const fills = only(calls, 'setFillColor');
    expect(fills.map((c) => c.args)).toContainEqual([255, 255, 255]);
    expect(fills.map((c) => c.args)).not.toContainEqual([0, 0, 0]);
  });

  it('το υπόστρωμα μπαίνει ΠΙΣΩ από τις γραμμές (γέμισμα πριν το stroke)', () => {
    const segs = [{ start: { x: 0, y: 1 }, end: { x: 4, y: 1 } }];
    const calls = emit(
      [bgHatch()], baseParams.colorPolicy, EMPTY_IMAGES,
      { ...EMPTY_HATCH_LINES, segments: new Map([['h1', segs]]) },
    );
    const order = calls.filter((c) => (c.fn === 'lines' && c.args[4] === 'F') || c.fn === 'line')
      .map((c) => c.fn);
    expect(order).toEqual(['lines', 'line']); // πρώτα το φόντο, μετά οι γραμμές
  });

  it.each([['image'], ['gradient']])(
    '%s → ΚΑΝΕΝΑ υπόστρωμα (γεμίζουν πλήρως, θα το έκρυβαν)',
    (fillType) => {
      const calls = emit([bgHatch({ fillType })]);
      expect(only(calls, 'lines').filter((c) => c.args[4] === 'F')).toHaveLength(0);
    },
  );

  it('χωρίς backgroundColor → κανένα υπόστρωμα', () => {
    const calls = emit([bgHatch({ backgroundColor: undefined })]);
    expect(only(calls, 'lines').filter((c) => c.args[4] === 'F')).toHaveLength(0);
  });
});
