/**
 * ADR-608 Φ-import-svg (export) — `svgGlyphToEntities` SSoT unit tests.
 *
 * Verifies an SVG glyph explodes into neutral entities (lwpolyline / circle / hatch /
 * line) with the SAME viewBox→world mapping as the on-screen renderer, and that the
 * real authored `FAMILY_GLYPH` (Bézier paths + fill circles) round-trips into geometry.
 */

import type { Entity, CircleEntity } from '../../../types/entities';
import type { AnnotationSymbolPoint } from '../../../config/annotation-symbol-catalog';
import type { AnnotationSymbolSvg } from '../../../config/annotation-symbol-svg-types';
import { FAMILY_GLYPH } from '../../../config/annotation-symbol-svg/family-glyph';
import { svgGlyphToEntities } from '../svg-glyph-to-entities';

const SOURCE = {
  id: 'sym1', type: 'annotation-symbol', layerId: 'L',
  color: '#000000', colorAci: 7, lineweightMm: 0.25, visible: true,
} as unknown as Entity;

/** Identity unit→world (so viewBox→unit math is what we assert). */
const identityWorld = (p: AnnotationSymbolPoint): { x: number; y: number } => ({ x: p[0], y: p[1] });
const idSeq = (): (() => string) => { let n = 0; return () => `g${n++}`; };
const byType = (out: Entity[], t: string): Entity[] => out.filter((e) => e.type === t);

describe('svgGlyphToEntities', () => {
  it('explodes a mixed glyph into the matching neutral entity kinds', () => {
    const glyph: AnnotationSymbolSvg = {
      kind: 'svg',
      viewBox: [0, 0, 10, 10],
      elements: [
        { el: 'line', x1: 0, y1: 0, x2: 10, y2: 10 },
        { el: 'circle', cx: 5, cy: 5, r: 2, fill: false },
        { el: 'circle', cx: 5, cy: 5, r: 1, fill: true },
        { el: 'path', fill: false, d: 'M0 0 L10 0 L10 10' },
      ],
    };
    const out = svgGlyphToEntities(glyph, SOURCE, identityWorld, 1, idSeq());
    expect(byType(out, 'line')).toHaveLength(1);
    expect(byType(out, 'circle')).toHaveLength(1); // the fill:false circle
    expect(byType(out, 'hatch')).toHaveLength(1);  // the fill:true circle → solid fill
    expect(byType(out, 'lwpolyline')).toHaveLength(1);
  });

  it('scales circle radius by (r / viewBoxHeight) * modelSize', () => {
    const glyph: AnnotationSymbolSvg = {
      kind: 'svg', viewBox: [0, 0, 10, 20],
      elements: [{ el: 'circle', cx: 5, cy: 10, r: 4, fill: false }],
    };
    const [circle] = svgGlyphToEntities(glyph, SOURCE, identityWorld, 5, idSeq()) as CircleEntity[];
    // r=4, h=20, modelSize=5 → (4/20)*5 = 1
    expect(circle.radius).toBeCloseTo(1, 6);
  });

  it('returns [] for a degenerate viewBox (height 0)', () => {
    const glyph: AnnotationSymbolSvg = {
      kind: 'svg', viewBox: [0, 0, 10, 0],
      elements: [{ el: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }],
    };
    expect(svgGlyphToEntities(glyph, SOURCE, identityWorld, 1, idSeq())).toEqual([]);
  });

  it('explodes the real authored FAMILY_GLYPH into vector geometry', () => {
    const out = svgGlyphToEntities(FAMILY_GLYPH, SOURCE, identityWorld, 1, idSeq());
    expect(out.length).toBeGreaterThan(10);
    expect(byType(out, 'lwpolyline').length).toBeGreaterThan(0); // Bézier paths → polylines
    expect(byType(out, 'hatch').length).toBeGreaterThan(0);      // fill circles → solid fill
    // Every emitted id is unique (idFor sequence, no collisions).
    const ids = out.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
