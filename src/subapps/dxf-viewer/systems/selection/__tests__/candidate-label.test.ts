/**
 * candidate-label — bug fix regression tests (2026-07-17).
 *
 * Bug: two stacked slabs (e.g. floor + ceiling of the same bay) produced
 * IDENTICAL selection-cycling popover rows (`Slab  lvl_<id>  …<suffix>`), so
 * the user had no way to tell them apart. Fix: slab candidates now resolve a
 * Revit-grade `[role] [thickness] [elevation]` triple; everything else falls
 * back to the existing `entityTypeLabel()` SSoT — never the raw `lvl_…` id.
 */

import { buildDefaultSlabParams, buildSlabEntity } from '../../../hooks/drawing/slab-completion';
import type { Entity } from '../../../types/entities';
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
