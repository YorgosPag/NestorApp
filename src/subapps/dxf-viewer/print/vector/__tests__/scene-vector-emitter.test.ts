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

function mockPdf(): { pdf: Record<string, unknown>; calls: Call[] } {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
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
  };
  return { pdf, calls };
}

// Simple Y-flip placement so transformed coords are assertable.
const toPaper = (p: Point2D): Point2D => ({ x: p.x, y: 100 - p.y });
const EMPTY_IMAGES = { images: new Map(), solidFallbacks: new Map(), warnings: [] };
const baseParams = {
  toPaper, worldToPaperScale: 1, colorPolicy: { style: 'colour' as const, dpi: 150 },
  images: EMPTY_IMAGES,
};

function emit(
  entities: Entity[], policy = baseParams.colorPolicy, images = EMPTY_IMAGES,
) {
  const { pdf, calls } = mockPdf();
  emitSceneToPdf(pdf as never, { ...baseParams, colorPolicy: policy, entities, images });
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
    const images = { images: new Map([['img1', axisAlignedImage]]), solidFallbacks: new Map(), warnings: [] };
    const calls = only(emit([e as unknown as Entity], baseParams.colorPolicy, images), 'addImage');
    expect(calls).toHaveLength(1);
    const [data, fmt, x, y, w, h, alias, comp, rot] = calls[0].args;
    expect([data, fmt, alias, comp]).toEqual(['data:img', 'PNG', 'tex-a', 'FAST']);
    // BL paper = (0,100), hMm = 4 → y = 100 - 4 = 96 (top-left). w=10, h=4, rotation 0.
    expect([x, y, w, h, rot]).toEqual([0, 96, 10, 4, 0]);
  });

  it('image-fill hatch (resolved) → one addImage per tile sharing the alias', () => {
    const e = { id: 'h1', type: 'hatch', layerId: '0', fillType: 'image', boundaryPaths: [[{ x: 0, y: 0 }]] };
    const twoTiles = {
      dataUrl: 'data:tile', alias: 'mat-x',
      placements: [
        { bl: { x: 0, y: 0 }, br: { x: 2, y: 0 }, tl: { x: 0, y: 2 }, wWorld: 2, hWorld: 2 },
        { bl: { x: 2, y: 0 }, br: { x: 4, y: 0 }, tl: { x: 2, y: 2 }, wWorld: 2, hWorld: 2 },
      ],
    };
    const images = { images: new Map([['h1', twoTiles]]), solidFallbacks: new Map(), warnings: [] };
    const calls = only(emit([e as unknown as Entity], baseParams.colorPolicy, images), 'addImage');
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.args[6] === 'mat-x')).toBe(true); // shared alias → 1 embed
  });

  it('image-fill hatch (solid fallback) → filled boundary (pdf.lines style F), no addImage', () => {
    const e = {
      id: 'h2', type: 'hatch', layerId: '0', fillType: 'image',
      boundaryPaths: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }]],
    };
    const images = { images: new Map(), solidFallbacks: new Map([['h2', '#804020']]), warnings: [] };
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
    const images = { images: new Map([['img1', axisAlignedImage]]), solidFallbacks: new Map(), warnings: [] };
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
