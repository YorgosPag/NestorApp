/**
 * GOLDEN / CHARACTERIZATION — per-entity DXF emission (ADR-505 §A dispatch, ADR-648).
 *
 * Locks the exact ENTITIES-section bytes each entity type serializes to, so ANY change to an
 * ALREADY-supported type's output breaks the snapshot (the zero-regression net demanded before
 * the additive ellipse/spline/xline/ray work — see the DXF/TEK export handoff §1.1). New types
 * get their OWN snapshot (a new golden never rewrites an old one). Extracts just the ENTITIES
 * section so the professional HEADER/TABLES churn (shared with another agent) never perturbs it.
 */

import { writeDxfAscii } from '../dxf-ascii-writer';
import type { Entity } from '../../../types/entities';

const LAYERS = { L: { name: 'L0' } };

/** Slice the ENTITIES-section body (between `2\nENTITIES` and its `0\nENDSEC`). */
function entitiesSection(dxf: string): string {
  const start = dxf.indexOf('ENTITIES\n');
  const body = start >= 0 ? dxf.slice(start + 'ENTITIES\n'.length) : dxf;
  const end = body.indexOf('0\nENDSEC');
  return (end >= 0 ? body.slice(0, end) : body).trim();
}

/** Emit ONE entity and return its ENTITIES-section bytes. `mode='lines'` = Tekton explode path. */
function emit(e: Entity, mode?: 'lines'): string {
  return entitiesSection(writeDxfAscii([e], { layersById: LAYERS, lineMode: mode }));
}

const ELLIPSE = {
  id: 'el', type: 'ellipse', layerId: 'L', color: '#ff0000',
  center: { x: 10, y: 20 }, majorAxis: 8, minorAxis: 4, rotation: 30,
} as unknown as Entity;

const ARC_ELLIPSE = {
  id: 'ela', type: 'ellipse', layerId: 'L',
  center: { x: 0, y: 0 }, majorAxis: 5, minorAxis: 3, rotation: 0,
  startParam: 0, endParam: Math.PI,
} as unknown as Entity;

const SPLINE = {
  id: 'sp', type: 'spline', layerId: 'L', color: '#00ff00',
  controlPoints: [{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 0 }], degree: 3,
} as unknown as Entity;

const XLINE = {
  id: 'xl', type: 'xline', layerId: 'L',
  basePoint: { x: 1, y: 2 }, direction: { x: 3, y: 4 }, // non-unit → normalized to (0.6, 0.8)
} as unknown as Entity;

const RAY = {
  id: 'ry', type: 'ray', layerId: 'L',
  basePoint: { x: 0, y: 0 }, secondPoint: { x: 0, y: 5 }, // direction from base→second → (0,1)
} as unknown as Entity;

describe('DXF dispatch characterization — NEW types (ADR-648 additive)', () => {
  it('ellipse → native AcDb ELLIPSE (AutoCAD path)', () => {
    expect(emit(ELLIPSE)).toMatchInlineSnapshot(`
"0
ELLIPSE
10
10
20
20
30
0
11
6.928203
21
4
31
0
40
0.5
41
0
42
6.283185
8
L0
62
1"
`);
  });

  it('elliptical arc → native ELLIPSE with start/end params', () => {
    expect(emit(ARC_ELLIPSE)).toMatchInlineSnapshot(`
"0
ELLIPSE
10
0
20
0
30
0
11
5
21
0
31
0
40
0.6
41
0
42
3.141593
8
L0
62
7"
`);
  });

  it('ellipse → tessellated POLYLINE on the Tekton (explode) path', () => {
    const out = emit(ELLIPSE, 'lines');
    // Explode → LINE segments (no native ELLIPSE token reaches Tekton's minimal parser).
    expect(out).toContain('LINE');
    expect(out).not.toContain('ELLIPSE');
  });

  it('spline → native SPLINE with a valid clamped knot vector', () => {
    expect(emit(SPLINE)).toMatchInlineSnapshot(`
"0
SPLINE
8
L0
62
3
70
8
71
3
72
8
73
4
74
0
40
0
40
0
40
0
40
0
40
1
40
1
40
1
40
1
10
0
20
0
30
0
10
1
20
3
30
0
10
4
20
3
30
0
10
5
20
0
30
0"
`);
  });

  it('spline → tessellated LINEs on the Tekton (explode) path', () => {
    const out = emit(SPLINE, 'lines');
    expect(out).toContain('LINE');
    expect(out).not.toContain('SPLINE');
  });

  it('xline → native XLINE with a UNIT direction vector', () => {
    expect(emit(XLINE)).toMatchInlineSnapshot(`
"0
XLINE
10
1
20
2
30
0
11
0.6
21
0.8
31
0
8
L0
62
7"
`);
  });

  it('ray → native RAY (direction derived from base→second)', () => {
    expect(emit(RAY)).toMatchInlineSnapshot(`
"0
RAY
10
0
20
0
30
0
11
0
21
1
31
0
8
L0
62
7"
`);
  });

  it('xline/ray are DROPPED on the Tekton (explode) path (no infinite line)', () => {
    expect(emit(XLINE, 'lines')).toBe('');
    expect(emit(RAY, 'lines')).toBe('');
  });
});

describe('DXF dispatch characterization — EXISTING types (regression lock)', () => {
  const LINE = { id: 'l', type: 'line', layerId: 'L', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
  const CIRCLE = { id: 'c', type: 'circle', layerId: 'L', center: { x: 2, y: 3 }, radius: 4 } as unknown as Entity;
  const ARC = { id: 'a', type: 'arc', layerId: 'L', center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: 90 } as unknown as Entity;

  it('line stays byte-identical', () => {
    expect(emit(LINE)).toMatchInlineSnapshot(`
"0
LINE
10
0
20
0
11
1
21
1
8
L0
62
7"
`);
  });
  it('circle stays byte-identical', () => {
    expect(emit(CIRCLE)).toMatchInlineSnapshot(`
"0
CIRCLE
10
2
20
3
40
4
8
L0
62
7"
`);
  });
  it('arc stays byte-identical', () => {
    expect(emit(ARC)).toMatchInlineSnapshot(`
"0
ARC
10
0
20
0
40
5
50
0
51
90
8
L0
62
7"
`);
  });
});
