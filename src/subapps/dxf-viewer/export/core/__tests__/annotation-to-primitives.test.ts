/**
 * ADR-608 — annotation-to-primitives decomposition unit tests.
 *
 * Verifies `annotation-symbol` + `scale-bar` explode into the neutral primitives
 * the vector emitter / DXF writer draw (line / lwpolyline / circle / arc / text /
 * solid-fill hatch), with the correct unit→world mapping, annotative scaling,
 * rotation and colour inheritance — and that all other entities pass through.
 */

import type { Entity, LineEntity, HatchEntity } from '../../../types/entities';
import type { AnnotationSymbolEntity } from '../../../types/annotation-symbol';
import type { ScaleBarEntity } from '../../../types/scale-bar';
import {
  expandAnnotationsToPrimitives,
  decomposeAnnotationEntity,
  type AnnotationDecomposeContext,
} from '../annotation-to-primitives';

const CTX: AnnotationDecomposeContext = { drawingScale: 100, sceneUnits: 'mm' };

function symbol(overrides: Partial<AnnotationSymbolEntity> = {}): AnnotationSymbolEntity {
  return {
    id: 'ann1',
    type: 'annotation-symbol',
    layerId: 'lyr_a',
    color: '#123456',
    position: { x: 0, y: 0 },
    kind: 'north-arrow',
    symbolId: 'northArrowSimple',
    sizeMm: 15,
    rotation: 0,
    ...overrides,
  };
}

function scaleBar(overrides: Partial<ScaleBarEntity> = {}): ScaleBarEntity {
  return {
    id: 'sb1',
    type: 'scale-bar',
    layerId: 'lyr_b',
    color: '#00ff00',
    position: { x: 0, y: 0 },
    angleRad: 0,
    length: 10,
    unit: 'm',
    divisions: 4,
    subdivisions: 0,
    style: 'alternating',
    barHeightMm: 4,
    labelHeightMm: 2.5,
    labelPlacement: 'below',
    ...overrides,
  };
}

const byType = (out: Entity[], type: string) => out.filter((e) => e.type === type);

describe('decompose — annotation symbol (north arrow)', () => {
  it('northArrowSimple → shaft line + filled arrowhead (hatch) + "N" polyline', () => {
    const out = decomposeAnnotationEntity(symbol(), CTX) ?? [];
    expect(byType(out, 'line')).toHaveLength(1);   // shaft
    expect(byType(out, 'hatch')).toHaveLength(1);  // solid arrowhead
    expect(byType(out, 'lwpolyline')).toHaveLength(1); // the "N"
  });

  it('folds paper size through the drawing scale (annotative)', () => {
    // sizeMm 15 @ 1:100 (mm scene) → modelSize 1500. Shaft [0,-0.5]→[0,0.06].
    const out = decomposeAnnotationEntity(symbol(), CTX) ?? [];
    const shaft = byType(out, 'line')[0] as LineEntity;
    expect(shaft.start.y).toBeCloseTo(-750); // -0.5 × 1500
    expect(shaft.end.y).toBeCloseTo(90);     // 0.06 × 1500
  });

  it('rotates the glyph about the insertion point', () => {
    // 90° CCW: shaft start [0,-0.5] → world (+750, 0).
    const out = decomposeAnnotationEntity(symbol({ rotation: 90 }), CTX) ?? [];
    const shaft = byType(out, 'line')[0] as LineEntity;
    expect(shaft.start.x).toBeCloseTo(750);
    expect(shaft.start.y).toBeCloseTo(0);
  });

  it('inherits the source colour on every primitive', () => {
    const out = decomposeAnnotationEntity(symbol({ color: '#abcdef' }), CTX) ?? [];
    expect(out.every((e) => e.color === '#abcdef')).toBe(true);
    const fill = byType(out, 'hatch')[0] as HatchEntity;
    expect(fill.fillColor).toBe('#abcdef');
    expect(fill.patternType).toBe('solid');
  });

  it('grid bubble text → centred, middle-baseline, upright label', () => {
    const out = decomposeAnnotationEntity(
      symbol({ kind: 'grid-bubble', symbolId: 'gridBubbleCircle' }), CTX,
    ) ?? [];
    const text = byType(out, 'text')[0] as Entity & {
      alignment?: string; rotation?: number; vBaseline?: string; text?: string;
    };
    expect(text.text).toBe('1');
    expect(text.alignment).toBe('center');
    expect(text.vBaseline).toBe('middle');
    expect(text.rotation).toBe(0); // upright even though it rides the glyph
  });
});

describe('decompose — scale bar', () => {
  it('explodes into lines/hatch/lwpolyline + numeral texts', () => {
    const out = decomposeAnnotationEntity(scaleBar(), CTX) ?? [];
    // alternating → filled cells produce hatch fills + outlines; every style labels.
    expect(byType(out, 'hatch').length).toBeGreaterThanOrEqual(1);
    expect(byType(out, 'lwpolyline').length).toBeGreaterThanOrEqual(1);
    const texts = byType(out, 'text').map((e) => (e as { text?: string }).text ?? '');
    // Boundary numerals (formatted via the length SSoT) + trailing unit label.
    expect(texts.some((t) => t.replace(/\D/g, '') === '10000')).toBe(true); // far boundary
    expect(texts).toContain('m');
  });

  it('numeral text inherits colour + carries alignment', () => {
    const out = decomposeAnnotationEntity(scaleBar({ color: '#ff8800' }), CTX) ?? [];
    const text = byType(out, 'text')[0] as Entity & { alignment?: string; vBaseline?: string };
    expect(text.color).toBe('#ff8800');
    expect(text.vBaseline).toBe('middle');
  });
});

describe('expandAnnotationsToPrimitives — pass-through + mixed', () => {
  const plainLine: Entity = {
    id: 'l1', type: 'line', layerId: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
  } as unknown as Entity;

  it('non-annotation entities pass through by reference', () => {
    const out = expandAnnotationsToPrimitives([plainLine], CTX);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(plainLine);
  });

  it('decomposeAnnotationEntity returns null for a plain entity', () => {
    expect(decomposeAnnotationEntity(plainLine, CTX)).toBeNull();
  });

  it('mixed list → symbol expanded, plain line kept', () => {
    const out = expandAnnotationsToPrimitives([plainLine, symbol()], CTX);
    // 1 plain line + (shaft line + hatch + "N") = original preserved, symbol exploded.
    expect(out).toContain(plainLine);
    expect(byType(out, 'hatch')).toHaveLength(1);
    expect(out.length).toBeGreaterThan(2);
  });
});
