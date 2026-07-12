/**
 * ADR-640 — unit tests for the BLOCK selection-affordance bounds SSoT
 * (`computeBlockSelectionBounds` + `resolveSelectedBlocks` + `collectBlockEntities`),
 * mirror of systems/group/__tests__/group-selection-bounds.test.ts.
 */

import {
  computeBlockSelectionBounds,
  resolveSelectedBlocks,
  collectBlockEntities,
} from '../block-selection-bounds';
import type { BlockEntity, Entity } from '../../../types/entities';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

const mkBlock = (id: string, name: string, members: Entity[], overrides: Partial<BlockEntity> = {}): BlockEntity =>
  ({
    id, type: 'block', name, layerId: 'lyr_test', visible: true,
    position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0,
    entities: members, ...overrides,
  } as unknown as BlockEntity);

describe('computeBlockSelectionBounds (ADR-640)', () => {
  it('unions the placed members AABB, centre = midpoint, count = block.entities.length', () => {
    const block = mkBlock('BLK1', 'Door', [mkLine('a', 0, 0, 4, 0), mkLine('b', 0, 2, 4, 2)]);
    const b = computeBlockSelectionBounds(block);
    expect(b).not.toBeNull();
    expect(b!.min).toEqual({ x: 0, y: 0 });
    expect(b!.max).toEqual({ x: 4, y: 2 });
    expect(b!.center).toEqual({ x: 2, y: 1 });
    expect(b!.memberCount).toBe(2);
  });

  it('applies the INSERT placement transform (position offset) before unioning', () => {
    const block = mkBlock('BLK2', 'Win', [mkLine('a', 0, 0, 4, 0)], { position: { x: 10, y: 20 } });
    const b = computeBlockSelectionBounds(block);
    expect(b).not.toBeNull();
    expect(b!.min).toEqual({ x: 10, y: 20 });
    expect(b!.max).toEqual({ x: 14, y: 20 });
    expect(b!.center).toEqual({ x: 12, y: 20 });
  });

  it('returns null for an empty block', () => {
    expect(computeBlockSelectionBounds(mkBlock('BLK3', 'Empty', []))).toBeNull();
  });
});

describe('resolveSelectedBlocks (ADR-640)', () => {
  it('returns only the selected BLOCK containers', () => {
    const block = mkBlock('BLK1', 'Door', [mkLine('a', 0, 0, 1, 0)]);
    const loose = mkLine('loose', 5, 5, 6, 6);
    const entities: Entity[] = [block as unknown as Entity, loose];

    expect(resolveSelectedBlocks(entities, [block.id])).toEqual([block]);
    // A non-block id selected → no blocks.
    expect(resolveSelectedBlocks(entities, ['loose'])).toEqual([]);
    // Empty selection / empty scene → empty.
    expect(resolveSelectedBlocks(entities, [])).toEqual([]);
    expect(resolveSelectedBlocks(undefined, [block.id])).toEqual([]);
  });
});

describe('collectBlockEntities (ADR-640)', () => {
  it('keys ONLY the BLOCK containers by id, skipping plain entities', () => {
    const b1 = mkBlock('BLK1', 'Door', [mkLine('a', 0, 0, 1, 0)]);
    const b2 = mkBlock('BLK2', 'Win', [mkLine('c', 4, 4, 5, 4)]);
    const loose = mkLine('loose', 5, 5, 6, 6);
    const map = collectBlockEntities([b1 as unknown as Entity, loose, b2 as unknown as Entity]);

    expect(map.size).toBe(2);
    expect(map.get(b1.id)).toBe(b1);
    expect(map.get(b2.id)).toBe(b2);
    expect(map.has('loose')).toBe(false);
  });

  it('returns an empty map for undefined / empty input', () => {
    expect(collectBlockEntities(undefined).size).toBe(0);
    expect(collectBlockEntities([]).size).toBe(0);
  });
});
