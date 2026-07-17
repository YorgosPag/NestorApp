/**
 * candidate-label — bug fix regression tests (2026-07-17) + structural-type
 * extension tests (2026-07-17, Giorgio-approved).
 *
 * Bug: two stacked slabs (e.g. floor + ceiling of the same bay) produced
 * IDENTICAL selection-cycling popover rows (`Slab  lvl_<id>  …<suffix>`), so
 * the user had no way to tell them apart. Fix: slab candidates now resolve a
 * Revit-grade `[role] [thickness] [elevation]` triple; everything else falls
 * back to the existing `entityTypeLabel()` SSoT — never the raw `lvl_…` id.
 *
 * Extension: wall/column/beam/foundation now resolve their own Revit-grade
 * triples too (thickness+height+base level for wall; section+height+base
 * level for column; section+top elevation for beam/foundation).
 */

import { buildDefaultSlabParams, buildSlabEntity } from '../../../hooks/drawing/slab-completion';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import { buildDefaultFoundationParams, buildFoundationEntity } from '../../../hooks/drawing/foundation-completion';
import type { Entity } from '../../../types/entities';
import type { ColumnKind } from '../../../bim/types/column-types';
import { buildCandidateSemantics, buildCandidateLabel, type CandidateLabelInput } from '../candidate-label';

/** Echoes the key (+ interpolated vars) — same fixture pattern as keyboard-focus-manager.test.ts. */
const fakeT = (key: string, vars?: Record<string, unknown>): string => {
  if (!vars) return key;
  const parts = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(',');
  return `${key}{${parts}}`;
};

/** Numeric part of a formatted length/coordinate, locale-separator agnostic. */
function numOf(formatted: string): number {
  return parseFloat(formatted.replace(/[^\d,.-]/g, '').replace(',', '.'));
}

const SQUARE = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

function makeWall(thicknessMm: number, heightMm: number, baseOffsetMm = 0): Entity {
  const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, { thickness: thicknessMm, height: heightMm });
  const built = buildWallEntity(params, '0');
  if (!built.ok) throw new Error(`fixture build failed: ${built.hardErrors.join(', ')}`);
  if (baseOffsetMm === 0) return built.entity;
  // baseOffset isn't override-able through the builder (always born 0) — relabel post-build,
  // same pattern as the DxfSlab wrapper fixture below. Geometry goes stale but semantics
  // extraction only reads `.params`, so this is safe for this narrow sign-testing purpose.
  return { ...built.entity, params: { ...built.entity.params, baseOffset: baseOffsetMm } } as unknown as Entity;
}

function makeColumn(kind: ColumnKind, widthMm: number, depthMm: number, heightMm: number, baseOffsetMm = 0): Entity {
  const params = buildDefaultColumnParams({ x: 2000, y: 1500 }, kind, {
    width: widthMm, depth: depthMm, height: heightMm, baseOffset: baseOffsetMm,
  });
  const built = buildColumnEntity(params, '0');
  if (!built.ok) throw new Error(`fixture build failed: ${built.hardErrors.join(', ')}`);
  return built.entity;
}

function makeBeam(widthMm: number, depthMm: number, topElevationMm: number): Entity {
  const params = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight', {
    width: widthMm, depth: depthMm, topElevation: topElevationMm,
  });
  const built = buildBeamEntity(params, '0');
  if (!built.ok) throw new Error(`fixture build failed: ${built.hardErrors.join(', ')}`);
  return built.entity;
}

function makePadFoundation(widthMm: number, lengthMm: number, thicknessMm: number, topElevationMm: number): Entity {
  const params = buildDefaultFoundationParams({ x: 0, y: 0 }, 'pad', {
    width: widthMm, length: lengthMm, thicknessMm, topElevationMm,
  });
  const built = buildFoundationEntity(params, '0');
  if (!built.ok) throw new Error(`fixture build failed: ${built.hardErrors.join(', ')}`);
  return built.entity;
}

function makeStripFoundation(widthMm: number, thicknessMm: number, topElevationMm: number): Entity {
  const params = buildDefaultFoundationParams({ x: 0, y: 0 }, 'strip', {
    width: widthMm, thicknessMm, topElevationMm, axisEnd: { x: 4000, y: 0, z: 0 },
  });
  const built = buildFoundationEntity(params, '0');
  if (!built.ok) throw new Error(`fixture build failed: ${built.hardErrors.join(', ')}`);
  return built.entity;
}

function makeSlab(kind: 'floor' | 'ceiling', thickness: number, levelElevation: number): Entity {
  const params = buildDefaultSlabParams(SQUARE, { kind, thickness, levelElevation });
  const built = buildSlabEntity(params, '0');
  if (!built.ok) throw new Error(`fixture build failed: ${built.hardErrors.join(', ')}`);
  return built.entity;
}

describe('buildCandidateSemantics', () => {
  it('returns undefined for null/undefined entities', () => {
    expect(buildCandidateSemantics(null)).toBeUndefined();
    expect(buildCandidateSemantics(undefined)).toBeUndefined();
  });

  it('returns undefined for non-slab entities', () => {
    const line = { id: 'l1', type: 'line' } as unknown as Entity;
    expect(buildCandidateSemantics(line)).toBeUndefined();
  });

  it('extracts kind/thickness/top-elevation (levelElevation + heightOffsetFromLevel) for a slab', () => {
    const floor = makeSlab('floor', 150, 3000);
    const semantics = buildCandidateSemantics(floor);
    expect(semantics).toEqual({ slabKind: 'floor', thicknessMm: 150, topElevationMm: 3000 });
  });

  it('folds heightOffsetFromLevel into topElevationMm', () => {
    const params = buildDefaultSlabParams(SQUARE, {
      kind: 'ceiling', thickness: 200, levelElevation: 5850, heightOffsetFromLevel: 100,
    });
    const built = buildSlabEntity(params, '0');
    if (!built.ok) throw new Error('fixture build failed');
    const semantics = buildCandidateSemantics(built.entity);
    expect(semantics?.topElevationMm).toBe(5950);
  });

  // Regression: the repeated-click path feeds the render-shape `DxfSlab` wrapper —
  // same `type:'slab'` but params nested under `.slabEntity`. A blind `entity.params`
  // destructure crashed here ("Cannot destructure property 'kind' of undefined").
  it('reads params from a DxfSlab render wrapper (params nested on .slabEntity)', () => {
    const floor = makeSlab('floor', 150, 3000);
    const wrapper = { id: floor.id, type: 'slab', slabEntity: floor } as unknown as Entity;
    expect(buildCandidateSemantics(wrapper)).toEqual({
      slabKind: 'floor', thicknessMm: 150, topElevationMm: 3000,
    });
  });

  it('returns undefined (no crash) for a slab that carries no params', () => {
    const paramless = { id: 's-legacy', type: 'slab' } as unknown as Entity;
    expect(buildCandidateSemantics(paramless)).toBeUndefined();
  });
});

describe('buildCandidateLabel — slab role/thickness/elevation (the bug fix)', () => {
  it('two stacked slabs (floor vs ceiling) now produce DIFFERENT labels', () => {
    const floor = makeSlab('floor', 150, 3000);
    const ceiling = makeSlab('ceiling', 200, 5850);

    const floorCandidate: CandidateLabelInput = {
      entityType: 'slab', layer: 'lvl_bae98ab6-9544-4514-841e-e00328ec02fe',
      semantics: buildCandidateSemantics(floor),
    };
    const ceilingCandidate: CandidateLabelInput = {
      entityType: 'slab', layer: 'lvl_bae98ab6-9544-4514-841e-e00328ec02fe',
      semantics: buildCandidateSemantics(ceiling),
    };

    const floorLabel = buildCandidateLabel(floorCandidate, fakeT, fakeT);
    const ceilingLabel = buildCandidateLabel(ceilingCandidate, fakeT, fakeT);

    // The regression: same entityType + same (level-id) layer used to render identical rows.
    expect(floorLabel).not.toEqual(ceilingLabel);
    expect(floorLabel.primary).toBe('selectionCycling.slabKind.floor');
    expect(ceilingLabel.primary).toBe('selectionCycling.slabKind.ceiling');
  });

  it('formats thickness fixed to mm regardless of the global display-unit toggle', () => {
    const floor = makeSlab('floor', 150, 3000);
    const label = buildCandidateLabel(
      { entityType: 'slab', layer: 'lvl_x', semantics: buildCandidateSemantics(floor) },
      fakeT, fakeT,
    );
    expect(numOf(label.secondary)).toBeCloseTo(150, 0);
    expect(label.secondary).toContain('mm');
  });

  it('formats a positive top elevation with an explicit leading +, in metres', () => {
    const floor = makeSlab('floor', 150, 3000);
    const label = buildCandidateLabel(
      { entityType: 'slab', layer: 'lvl_x', semantics: buildCandidateSemantics(floor) },
      fakeT, fakeT,
    );
    expect(label.tertiary.startsWith('+')).toBe(true);
    expect(numOf(label.tertiary)).toBeCloseTo(3, 2);
  });

  it('formats a negative top elevation without a leading +', () => {
    const params = buildDefaultSlabParams(SQUARE, { kind: 'foundation', thickness: 300, levelElevation: -1200 });
    const built = buildSlabEntity(params, '0');
    if (!built.ok) throw new Error('fixture build failed');
    const label = buildCandidateLabel(
      { entityType: 'slab', layer: 'lvl_x', semantics: buildCandidateSemantics(built.entity) },
      fakeT, fakeT,
    );
    expect(label.tertiary.startsWith('+')).toBe(false);
    expect(numOf(label.tertiary)).toBeCloseTo(-1.2, 2);
  });
});

describe('buildCandidateLabel — generic fallback (non-slab / unresolved entity)', () => {
  it('uses entityTypeLabel() for a known type, hides an internal lvl_ layer id', () => {
    const label = buildCandidateLabel(
      { entityType: 'wall', layer: 'lvl_bae98ab6-9544-4514-841e-e00328ec02fe' },
      fakeT, fakeT,
    );
    expect(label.primary).toBe('entityTypes.wall');
    expect(label.secondary).toBe(''); // NEVER the raw lvl_… id again
    expect(label.tertiary).toBe('');
  });

  it('keeps a real DXF layer name for plain 2D entities', () => {
    const label = buildCandidateLabel({ entityType: 'line', layer: 'A-WALL' }, fakeT, fakeT);
    expect(label.primary).toBe('entityTypes.line');
    expect(label.secondary).toBe('A-WALL');
  });

  it('falls back to the raw entityType string when unrecognized', () => {
    const label = buildCandidateLabel({ entityType: 'mystery-type', layer: '0' }, fakeT, fakeT);
    expect(label.primary).toBe('mystery-type');
  });
});

describe('buildCandidateSemantics — wall/column/beam/foundation (2026-07-17 extension)', () => {
  it('wall: extracts thickness/height/baseOffset', () => {
    const wall = makeWall(200, 3000);
    expect(buildCandidateSemantics(wall)).toEqual({
      structuralKind: 'wall', wallThicknessMm: 200, wallHeightMm: 3000, wallBaseOffsetMm: 0,
    });
  });

  it('column: extracts shape/width/depth/height/baseOffset', () => {
    const column = makeColumn('rectangular', 400, 400, 3000);
    expect(buildCandidateSemantics(column)).toEqual({
      structuralKind: 'column', columnShapeKind: 'rectangular',
      columnWidthMm: 400, columnDepthMm: 400, columnHeightMm: 3000, columnBaseOffsetMm: 0,
    });
  });

  it('beam: extracts width/depth/topElevation (absolute)', () => {
    const beam = makeBeam(200, 400, 3000);
    expect(buildCandidateSemantics(beam)).toEqual({
      structuralKind: 'beam', beamWidthMm: 200, beamDepthMm: 400, beamTopElevationMm: 3000,
    });
  });

  it('foundation (pad): extracts width/length/thickness/topElevation', () => {
    const pad = makePadFoundation(1500, 1500, 400, -1000);
    expect(buildCandidateSemantics(pad)).toEqual({
      structuralKind: 'foundation', foundationShapeKind: 'pad',
      foundationWidthMm: 1500, foundationLengthMm: 1500,
      foundationThicknessMm: 400, foundationTopElevationMm: -1000,
    });
  });

  it('foundation (strip): foundationLengthMm stays undefined (line-based, no footprint length)', () => {
    const strip = makeStripFoundation(300, 400, -1000);
    const semantics = buildCandidateSemantics(strip);
    expect(semantics?.foundationShapeKind).toBe('strip');
    expect(semantics?.foundationLengthMm).toBeUndefined();
    expect(semantics?.foundationWidthMm).toBe(300);
    expect(semantics?.foundationThicknessMm).toBe(400);
  });
});

describe('buildCandidateLabel — wall (thickness + height + base level, Giorgio-approved)', () => {
  it('formats "20 cm · ύψος 3,00" secondary, "+0,00" tertiary', () => {
    const wall = makeWall(200, 3000);
    const label = buildCandidateLabel(
      { entityType: 'wall', layer: 'lvl_x', semantics: buildCandidateSemantics(wall) },
      fakeT, fakeT,
    );
    expect(label.primary).toBe('entityTypes.wall');
    expect(label.secondary.startsWith('20 cm · selectionCycling.heightLabel{value=')).toBe(true);
    const heightValue = label.secondary.match(/value=([\d.,]+)\}$/)?.[1];
    expect(heightValue).toBeDefined();
    expect(numOf(heightValue as string)).toBeCloseTo(3, 2);
    expect(label.tertiary.startsWith('+')).toBe(true);
    expect(numOf(label.tertiary)).toBeCloseTo(0, 2);
  });

  it('negative base offset renders without a leading +', () => {
    const wall = makeWall(200, 3000, -500);
    const label = buildCandidateLabel(
      { entityType: 'wall', layer: 'lvl_x', semantics: buildCandidateSemantics(wall) },
      fakeT, fakeT,
    );
    expect(label.tertiary.startsWith('+')).toBe(false);
    expect(numOf(label.tertiary)).toBeCloseTo(-0.5, 2);
  });
});

describe('buildCandidateLabel — column (section + height + base level)', () => {
  it('rectangular → "40×40 cm · ύψος 3,00"', () => {
    const column = makeColumn('rectangular', 400, 400, 3000);
    const label = buildCandidateLabel(
      { entityType: 'column', layer: 'lvl_x', semantics: buildCandidateSemantics(column) },
      fakeT, fakeT,
    );
    expect(label.primary).toBe('entityTypes.column');
    expect(label.secondary.startsWith('40×40 cm · selectionCycling.heightLabel{value=')).toBe(true);
    const heightValue = label.secondary.match(/value=([\d.,]+)\}$/)?.[1];
    expect(heightValue).toBeDefined();
    expect(numOf(heightValue as string)).toBeCloseTo(3, 2);
    expect(label.tertiary.startsWith('+')).toBe(true);
    expect(numOf(label.tertiary)).toBeCloseTo(0, 2);
  });

  it('circular → "Ø40 cm" section (diameter, not width×depth)', () => {
    const column = makeColumn('circular', 400, 400, 3000);
    const label = buildCandidateLabel(
      { entityType: 'column', layer: 'lvl_x', semantics: buildCandidateSemantics(column) },
      fakeT, fakeT,
    );
    expect(label.secondary.startsWith('Ø40 cm')).toBe(true);
  });
});

describe('buildCandidateLabel — beam (section + absolute top elevation)', () => {
  it('formats "20×40 cm" secondary, "+3,00" tertiary', () => {
    const beam = makeBeam(200, 400, 3000);
    const label = buildCandidateLabel(
      { entityType: 'beam', layer: 'lvl_x', semantics: buildCandidateSemantics(beam) },
      fakeT, fakeT,
    );
    expect(label.primary).toBe('entityTypes.beam');
    expect(label.secondary).toBe('20×40 cm');
    expect(label.tertiary.startsWith('+')).toBe(true);
    expect(numOf(label.tertiary)).toBeCloseTo(3, 2);
  });
});

describe('buildCandidateLabel — foundation (dimensions + absolute top elevation)', () => {
  it('pad → plan footprint width×length, negative elevation no leading +', () => {
    const pad = makePadFoundation(1500, 1500, 400, -1000);
    const label = buildCandidateLabel(
      { entityType: 'foundation', layer: 'lvl_x', semantics: buildCandidateSemantics(pad) },
      fakeT, fakeT,
    );
    // normalizeEntityType() (status-bar-text-generator.ts) doesn't recognise 'foundation'
    // yet (pre-existing gap, out of this file's scope) — candidate-label.ts reads the
    // bim3d.entityTypes.foundation key directly as a documented fallback.
    expect(label.primary).toBe('entityTypes.foundation');
    expect(label.secondary).toBe('150×150 cm');
    expect(label.tertiary.startsWith('+')).toBe(false);
    expect(numOf(label.tertiary)).toBeCloseTo(-1, 2);
  });

  it('strip → cross-section width×thickness (not a footprint length)', () => {
    const strip = makeStripFoundation(300, 400, -1000);
    const label = buildCandidateLabel(
      { entityType: 'foundation', layer: 'lvl_x', semantics: buildCandidateSemantics(strip) },
      fakeT, fakeT,
    );
    expect(label.secondary).toBe('30×40 cm');
  });
});
