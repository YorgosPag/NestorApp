/**
 * ADR-608 — scene-vector-emitter unit tests.
 *
 * Verifies the emitter maps each flattened primitive to the correct jsPDF vector
 * call (line/circle/lines/text) in placed paper mm, applies the plot-colour policy,
 * and skips unsupported types — without a real jsPDF or canvas.
 */

import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { emitSceneToPdf } from '../scene-vector-emitter';

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
  };
  return { pdf, calls };
}

// Simple Y-flip placement so transformed coords are assertable.
const toPaper = (p: Point2D): Point2D => ({ x: p.x, y: 100 - p.y });
const baseParams = { toPaper, worldToPaperScale: 1, colorPolicy: { style: 'colour' as const, dpi: 150 } };

function emit(entities: Entity[], policy = baseParams.colorPolicy) {
  const { pdf, calls } = mockPdf();
  emitSceneToPdf(pdf as never, { ...baseParams, colorPolicy: policy, entities });
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
