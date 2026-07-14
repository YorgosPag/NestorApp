/**
 * ADR-656 M10 — survey-point label builder (selectivity is the whole point).
 *
 * The big-player rule these tests pin: a ground point shows ONLY its spot elevation (a `point`
 * node + the metre value); the full X,Y is written ONLY at the boundary vertices, NEVER at a
 * ground point. The three toggles are independent, and Z is formatted in metres (÷1000).
 */

import { buildSurveyPointLabelEntities, type PointLabelLayerIds } from '../topo-point-labels';
import type { PointLabelOptions } from '../topo-point-label-config';
import type { TinSampler } from '../tin-sampler';
import type { Point2D } from '../../../rendering/types/Types';
import type { TopoPoint } from '../topo-types';
import type { PointEntity, TextEntity } from '../../../types/entities';

const LAYERS: PointLabelLayerIds = {
  elevation: 'L-ELEV',
  code: 'L-CODE',
  number: 'L-NUM',
  boundary: 'L-BND',
};

/** Deterministic sampler — every boundary vertex sits at 5.00 m. */
const SAMPLER: TinSampler = { zAtMm: () => 5000 };

const POINTS: readonly TopoPoint[] = [
  { x: 100000, y: 200000, z: 103720, pointNumber: '101', code: 'TREE' },
  { x: 150000, y: 250000, z: 98450 },
];

const BOUNDARY: readonly Point2D[] = [
  { x: 100000, y: 200000 },
  { x: 300000, y: 200000 },
  { x: 300000, y: 400000 },
];

function opts(o: Partial<PointLabelOptions>): PointLabelOptions {
  return { showElevation: false, showPointNumberCode: false, showBoundaryXy: false, ...o };
}

const texts = (es: (TextEntity | PointEntity)[]): TextEntity[] =>
  es.filter((e): e is TextEntity => e.type === 'text');
const nodes = (es: (TextEntity | PointEntity)[]): PointEntity[] =>
  es.filter((e): e is PointEntity => e.type === 'point');

describe('buildSurveyPointLabelEntities — ADR-656 M10', () => {
  it('default (only Ζ): a dot node + a metre elevation per point, and NO X,Y anywhere', () => {
    const es = buildSurveyPointLabelEntities(POINTS, BOUNDARY, SAMPLER, LAYERS, opts({ showElevation: true }));

    // one node + one text per point.
    expect(nodes(es)).toHaveLength(POINTS.length);
    expect(nodes(es).every((n) => n.style === 'dot' && n.layerId === LAYERS.elevation)).toBe(true);
    const t = texts(es);
    expect(t).toHaveLength(POINTS.length);
    expect(t.map((e) => e.text)).toEqual(['103.72', '98.45']);
    // The whole milestone: never an X,Y coordinate string on a ground point.
    expect(t.every((e) => !e.text.includes('Χ') && !e.text.includes('Υ'))).toBe(true);
  });

  it('boundary X,Y toggle writes X,Y(+Z) ONLY at boundary vertices, on the boundary layer', () => {
    const es = buildSurveyPointLabelEntities(POINTS, BOUNDARY, SAMPLER, LAYERS, opts({ showBoundaryXy: true }));

    // No ground-point entities at all (elevation/number/code all off).
    expect(nodes(es)).toHaveLength(0);
    const t = texts(es);
    expect(t).toHaveLength(BOUNDARY.length);
    expect(t.every((e) => e.layerId === LAYERS.boundary)).toBe(true);
    // First vertex: Κ1 with X, Y and sampled Z (5.00 m).
    expect(t[0].text).toContain('Κ1');
    expect(t[0].text).toContain('Χ100.00');
    expect(t[0].text).toContain('Υ200.00');
    expect(t[0].text).toContain('Ζ5.00');
  });

  it('omits Ζ from a boundary label when the vertex is outside the surface', () => {
    const nullSampler: TinSampler = { zAtMm: () => null };
    const es = buildSurveyPointLabelEntities(POINTS, BOUNDARY, nullSampler, LAYERS, opts({ showBoundaryXy: true }));

    expect(texts(es)[0].text).not.toContain('Ζ');
  });

  it('number/code toggle emits the point number and feature code, each on its own layer', () => {
    const es = buildSurveyPointLabelEntities(POINTS, null, SAMPLER, LAYERS, opts({ showPointNumberCode: true }));
    const t = texts(es);

    // Point 1 has both number (101) and code (TREE); point 2 has neither.
    expect(t.map((e) => e.text).sort()).toEqual(['101', 'TREE']);
    expect(t.find((e) => e.text === '101')?.layerId).toBe(LAYERS.number);
    expect(t.find((e) => e.text === 'TREE')?.layerId).toBe(LAYERS.code);
  });

  it('never emits X,Y for a ground point even with every toggle on', () => {
    const es = buildSurveyPointLabelEntities(
      POINTS, BOUNDARY, SAMPLER, LAYERS,
      { showElevation: true, showPointNumberCode: true, showBoundaryXy: true },
    );
    const groundTexts = texts(es).filter((e) => e.layerId !== LAYERS.boundary);

    expect(groundTexts.every((e) => !e.text.includes('Χ') && !e.text.includes('Υ'))).toBe(true);
  });

  it('emits nothing when boundary is null but boundary toggle is on', () => {
    const es = buildSurveyPointLabelEntities(POINTS, null, SAMPLER, LAYERS, opts({ showBoundaryXy: true }));
    expect(es).toHaveLength(0);
  });
});
