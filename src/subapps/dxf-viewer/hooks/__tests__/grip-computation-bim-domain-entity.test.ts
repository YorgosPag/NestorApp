/**
 * ADR-402 regression — `computeDxfEntityGrips` must accept BOTH the 2D DxfEntity
 * wrapper (`.stairEntity` / `.slabEntity`) AND the raw domain BIM entity (params
 * at top level).
 *
 * The 3D snap path (`bim3d-edit-interaction-handlers.buildDragSnapFn`) feeds the
 * level-scene domain `Entity` straight into `computeDxfEntityGrips` (cast to
 * `DxfEntityUnion`) to harvest characteristic snap points. For wall/beam/column
 * the domain shape already matched, but stair/slab read a nested wrapper field
 * (`entity.stairEntity` / `entity.slabEntity`) that the domain entity does not
 * have → `getStairGrips(undefined)` threw `entity is undefined` on pointer-down.
 *
 * These tests reproduce that exact call (domain entity → `computeDxfEntityGrips`)
 * and lock parity: the wrapper shape and the domain shape yield identical grips.
 */

import { computeDxfEntityGrips } from '../grip-computation';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../drawing/stair-completion';
import {
  buildDefaultSlabParams,
  buildSlabEntity,
} from '../drawing/slab-completion';

describe('computeDxfEntityGrips — domain BIM entity (ADR-402 3D snap regression)', () => {
  it('stair: a raw domain StairEntity (no .stairEntity wrapper) does not throw and yields grips', () => {
    const stair = buildStairEntity(buildDefaultStairParams({ x: 0, y: 0 }, 0), '0');

    // This is exactly what buildDragSnapFn does: cast the domain entity to the
    // DxfEntityUnion the grip SSoT expects.
    const domainGrips = computeDxfEntityGrips(stair as unknown as DxfEntityUnion);
    expect(domainGrips.length).toBeGreaterThan(0);

    // The 2D canvas wraps the same StairEntity under `.stairEntity` — parity.
    const wrapped = { id: stair.id, type: 'stair', stairEntity: stair } as unknown as DxfEntityUnion;
    const wrappedGrips = computeDxfEntityGrips(wrapped);
    expect(domainGrips).toEqual(wrappedGrips);
  });

  it('slab: a raw domain SlabEntity (no .slabEntity wrapper) does not throw and yields grips', () => {
    const built = buildSlabEntity(
      buildDefaultSlabParams([
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ]),
      '0',
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const slab = built.entity;

    const domainGrips = computeDxfEntityGrips(slab as unknown as DxfEntityUnion);
    expect(domainGrips.length).toBeGreaterThan(0);

    const wrapped = { id: slab.id, type: 'slab', slabEntity: slab } as unknown as DxfEntityUnion;
    const wrappedGrips = computeDxfEntityGrips(wrapped);
    expect(domainGrips).toEqual(wrappedGrips);
  });
});

describe('computeDxfEntityGrips — hatch gradient origin grip (ADR-507 Φ5 A3)', () => {
  const SQUARE = [[
    { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 },
  ]];

  it('emits the origin grip at bbox-center for a gradient hatch (no patternOrigin)', () => {
    const hatch = {
      id: 'h1', type: 'hatch', boundaryPaths: SQUARE, fillType: 'gradient',
      gradient: { type: 'linear', color1: '#2980b9', color2: '#ffffff' },
    } as unknown as DxfEntityUnion;
    const grips = computeDxfEntityGrips(hatch);
    const origin = grips.find((g) => g.hatchGripKind === 'hatch-gradient-origin');
    expect(origin).toBeDefined();
    expect(origin?.position).toEqual({ x: 500, y: 500 });
    // 4 vertex grips + 1 origin.
    expect(grips).toHaveLength(5);
  });

  it('does NOT emit the origin grip for a non-gradient (solid) hatch', () => {
    const hatch = {
      id: 'h2', type: 'hatch', boundaryPaths: SQUARE, fillType: 'solid',
    } as unknown as DxfEntityUnion;
    const grips = computeDxfEntityGrips(hatch);
    expect(grips.find((g) => g.hatchGripKind === 'hatch-gradient-origin')).toBeUndefined();
    expect(grips).toHaveLength(4);
  });
});
