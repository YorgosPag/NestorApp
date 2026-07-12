/**
 * ADR-641 — unit tests for the BLOCK selection-box grips (4 corners + 4 edges) and their
 * SCALE drag (opposite corner/edge fixed → `scaleEntity` case 'block').
 *
 * Covers the pure emission (`getBlockBoxGrips`), the pure drag → `{ position, scale }` INSERT
 * patch (`applyBlockBoxGripDrag`), the role↔kind maps, and the shared-pipeline wiring
 * (corners/edges stay press-drag + render the default 'square' glyph — no FSM / glyph change).
 */

import {
  getBlockBoxGrips,
  applyBlockBoxGripDrag,
  blockBoxRoleFromKind,
  isBlockBoxGripKind,
} from '../block-box-grips';
import { computeBlockSelectionBounds } from '../block-selection-bounds';
import { gripGlyphShape } from '../../../bim/grips/grip-glyph-registry';
import { hotGripOpForKind } from '../../../hooks/grips/wall-hot-grip-fsm';
import { gripKindOf } from '../../../hooks/grip-kinds';
import type { GroupSelectionBounds } from '../../group/group-selection-bounds';
import type { BlockEntity, Entity } from '../../../types/entities';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

// Bounds: min {0,0}, max {4,2} → centre {2,1}, halfWidth 2, halfLength 1.
const makeBlock = (): BlockEntity =>
  ({
    id: 'BLK1', type: 'block', name: 'Door', layerId: 'lyr_test', visible: true,
    position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0,
    entities: [mkLine('a', 0, 0, 4, 0), mkLine('b', 0, 2, 4, 2)],
  } as unknown as BlockEntity);

describe('getBlockBoxGrips (ADR-641)', () => {
  it('emits 4 corners (2-5) then 4 edges (6-9), all keyed on the block id', () => {
    const bounds = computeBlockSelectionBounds(makeBlock())!;
    const grips = getBlockBoxGrips('BLK1', bounds);
    expect(grips).toHaveLength(8);
    expect(grips.every((g) => g.entityId === 'BLK1')).toBe(true);
    expect(grips.map((g) => g.gripIndex)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(grips.map((g) => gripKindOf(g, 'block'))).toEqual([
      'block-corner-ne', 'block-corner-nw', 'block-corner-sw', 'block-corner-se',
      'block-edge-n', 'block-edge-e', 'block-edge-s', 'block-edge-w',
    ]);
  });

  it('places corners at the AABB vertices and edges at the AABB edge midpoints', () => {
    const bounds = computeBlockSelectionBounds(makeBlock())!;
    const byKind = new Map(getBlockBoxGrips('BLK1', bounds).map((g) => [gripKindOf(g, 'block'), g.position]));
    expect(byKind.get('block-corner-ne')).toEqual({ x: 4, y: 2 });
    expect(byKind.get('block-corner-nw')).toEqual({ x: 0, y: 2 });
    expect(byKind.get('block-corner-sw')).toEqual({ x: 0, y: 0 });
    expect(byKind.get('block-corner-se')).toEqual({ x: 4, y: 0 });
    expect(byKind.get('block-edge-n')).toEqual({ x: 2, y: 2 });
    expect(byKind.get('block-edge-e')).toEqual({ x: 4, y: 1 });
    expect(byKind.get('block-edge-s')).toEqual({ x: 2, y: 0 });
    expect(byKind.get('block-edge-w')).toEqual({ x: 0, y: 1 });
  });

  it('marks corners structural (always visible) and edges as midpoints (gated)', () => {
    const bounds = computeBlockSelectionBounds(makeBlock())!;
    const grips = getBlockBoxGrips('BLK1', bounds);
    expect(grips.slice(0, 4).every((g) => g.type === 'corner')).toBe(true);
    expect(grips.slice(4, 8).every((g) => g.type === 'midpoint')).toBe(true);
    expect(grips.every((g) => g.movesEntity === false)).toBe(true);
  });

  it('emits nothing for a degenerate (zero-area) bbox', () => {
    const flat = { min: { x: 0, y: 0 }, max: { x: 0, y: 5 }, center: { x: 0, y: 2.5 }, count: 1 } as unknown as GroupSelectionBounds;
    expect(getBlockBoxGrips('BLK1', flat)).toHaveLength(0);
  });
});

describe('applyBlockBoxGripDrag (ADR-641) — corner/edge → INSERT scale patch', () => {
  it('corner-ne drag scales both axes about the fixed SW corner', () => {
    // Δ(2,2): halfWidth 2→3 (sx 1.5), halfLength 1→2 (sy 2); base = SW = (0,0).
    const patch = applyBlockBoxGripDrag('corner-ne', makeBlock(), { x: 2, y: 2 });
    expect(patch).not.toBeNull();
    expect(patch!.scale).toEqual({ x: 1.5, y: 2 });
    expect(patch!.position).toEqual({ x: 0, y: 0 }); // insertion point IS the SW base → unchanged
  });

  it('edge-e drag stretches ONLY the x axis (y untouched), opposite edge fixed', () => {
    // Δ(2, 5): halfWidth 2→3 (sx 1.5); y ignored (sy 1); base = W edge midpoint (0,1).
    const patch = applyBlockBoxGripDrag('edge-e', makeBlock(), { x: 2, y: 5 });
    expect(patch).not.toBeNull();
    expect(patch!.scale).toEqual({ x: 1.5, y: 1 });
    expect(patch!.position).toEqual({ x: 0, y: 0 });
  });

  it('is a no-op (null) for a zero drag', () => {
    expect(applyBlockBoxGripDrag('corner-ne', makeBlock(), { x: 0, y: 0 })).toBeNull();
  });
});

describe('block box grip role ↔ kind maps (ADR-641)', () => {
  it('blockBoxRoleFromKind maps the 8 box kinds and rejects move/rotation', () => {
    expect(blockBoxRoleFromKind('block-corner-ne')).toBe('corner-ne');
    expect(blockBoxRoleFromKind('block-edge-w')).toBe('edge-w');
    expect(blockBoxRoleFromKind('block-move')).toBeNull();
    expect(blockBoxRoleFromKind('block-rotation')).toBeNull();
    expect(blockBoxRoleFromKind(undefined)).toBeNull();
  });

  it('isBlockBoxGripKind is true only for the 8 box kinds', () => {
    expect(isBlockBoxGripKind('block-corner-se')).toBe(true);
    expect(isBlockBoxGripKind('block-edge-n')).toBe(true);
    expect(isBlockBoxGripKind('block-move')).toBe(false);
  });
});

describe('block box grips — shared pipeline (no glyph / FSM change)', () => {
  it('renders the default square glyph (corners/edges absent from the glyph registry)', () => {
    expect(gripGlyphShape('block-corner-ne')).toBe('square');
    expect(gripGlyphShape('block-edge-e')).toBe('square');
  });

  it('stays press-drag — the box kinds are absent from the hot-grip registry', () => {
    expect(hotGripOpForKind('block-corner-ne')).toBeNull();
    expect(hotGripOpForKind('block-edge-e')).toBeNull();
  });
});
