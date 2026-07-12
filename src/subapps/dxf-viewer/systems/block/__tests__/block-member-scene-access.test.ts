/**
 * ADR-641 Φ4 — unit tests for the BLOCK-member-aware scene access SSoT
 * (`findEntityOrBlockMember` / `updateEntityOrBlockMember` / `updateEntitiesOrBlockMembers` /
 * `addBlockMember` / `removeEntityOrBlockMember`).
 *
 * Key contract vs the GROUP sibling: descent is GATED on `activeBlockId` (block-local coords are only
 * addressable while entered) and SINGLE-LEVEL (blocks do not nest).
 */

import {
  findEntityOrBlockMember,
  updateEntityOrBlockMember,
  updateEntitiesOrBlockMembers,
  addBlockMember,
  removeEntityOrBlockMember,
} from '../block-member-scene-access';
import type { Entity, BlockEntity } from '../../../types/entities';

const mkLine = (id: string, x0 = 0, y0 = 0, x1 = 1, y1 = 1): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

const mkBlock = (id: string, members: Entity[]): BlockEntity =>
  ({ id, type: 'block', name: 'B', layerId: 'lyr_test', visible: true, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, entities: members } as unknown as BlockEntity);

const startX = (e: Entity): number => (e as unknown as { start: { x: number } }).start.x;

describe('findEntityOrBlockMember (ADR-641)', () => {
  const memberA = mkLine('a');
  const memberB = mkLine('b');
  const block = mkBlock('blk1', [memberA, memberB]);
  const loose = mkLine('loose');
  const entities: Entity[] = [block as unknown as Entity, loose];

  it('finds a top-level entity (activeBlockId irrelevant)', () => {
    expect(findEntityOrBlockMember(entities, 'loose', 'blk1')).toBe(loose);
    expect(findEntityOrBlockMember(entities, 'loose', null)).toBe(loose);
  });

  it('finds the block container by its own id (no descent)', () => {
    expect(findEntityOrBlockMember(entities, 'blk1', 'blk1')).toBe(block as unknown as Entity);
  });

  it('finds a member INSIDE the active block by the member id', () => {
    expect(findEntityOrBlockMember(entities, 'b', 'blk1')).toBe(memberB);
  });

  it('does NOT descend into a block that is not the active one (gating)', () => {
    expect(findEntityOrBlockMember(entities, 'b', null)).toBeNull();
    expect(findEntityOrBlockMember(entities, 'b', 'other')).toBeNull();
  });

  it('returns null for an unknown id / empty inputs', () => {
    expect(findEntityOrBlockMember(entities, 'nope', 'blk1')).toBeNull();
    expect(findEntityOrBlockMember(undefined, 'a', 'blk1')).toBeNull();
    expect(findEntityOrBlockMember(entities, null, 'blk1')).toBeNull();
  });
});

describe('updateEntityOrBlockMember (ADR-641)', () => {
  it('updates a member and writes back a NEW container + NEW entities array', () => {
    const memberA = mkLine('a', 0, 0, 1, 0);
    const block = mkBlock('blk1', [memberA]);
    const entities: Entity[] = [block as unknown as Entity];

    const next = updateEntityOrBlockMember(entities, 'a', 'blk1', (e) => ({ ...e, start: { x: 9, y: 9 } } as Entity));

    expect(next).not.toBe(entities);                          // new top-level array
    const nextBlock = next[0] as unknown as BlockEntity;
    expect(nextBlock).not.toBe(block);                        // new container ref
    expect(nextBlock.entities).not.toBe(block.entities);      // new entities array
    expect(startX(nextBlock.entities[0])).toBe(9);
    expect(startX(block.entities[0])).toBe(0);                // original untouched
  });

  it('updates a top-level entity directly', () => {
    const loose = mkLine('loose', 0, 0);
    const next = updateEntityOrBlockMember([loose], 'loose', 'blk1', (e) => ({ ...e, start: { x: 5, y: 5 } } as Entity));
    expect(startX(next[0])).toBe(5);
  });

  it('does NOT touch a member when not gated to its block (no-op ref)', () => {
    const block = mkBlock('blk1', [mkLine('a')]);
    const entities: Entity[] = [block as unknown as Entity];
    const next = updateEntityOrBlockMember(entities, 'a', null, (e) => ({ ...e, start: { x: 1, y: 1 } } as Entity));
    expect(next).toBe(entities);
  });

  it('returns the SAME array reference when the id is not found (no-op)', () => {
    const block = mkBlock('blk1', [mkLine('a')]);
    const entities: Entity[] = [block as unknown as Entity];
    const next = updateEntityOrBlockMember(entities, 'ghost', 'blk1', (e) => e);
    expect(next).toBe(entities);
  });
});

describe('updateEntitiesOrBlockMembers (ADR-641)', () => {
  it('applies patches to several members of the active block in one pass', () => {
    const a = mkLine('a', 0, 0);
    const b = mkLine('b', 0, 0);
    const block = mkBlock('blk1', [a, b]);
    const entities: Entity[] = [block as unknown as Entity];

    const patches = new Map<string, (e: Entity) => Entity>([
      ['a', (e) => ({ ...e, start: { x: 1, y: 1 } } as Entity)],
      ['b', (e) => ({ ...e, start: { x: 2, y: 2 } } as Entity)],
    ]);
    const next = updateEntitiesOrBlockMembers(entities, patches, 'blk1');
    const nextBlock = next[0] as unknown as BlockEntity;
    expect(startX(nextBlock.entities[0])).toBe(1);
    expect(startX(nextBlock.entities[1])).toBe(2);
  });

  it('returns the same array reference for an empty patch map', () => {
    const entities: Entity[] = [mkLine('a')];
    expect(updateEntitiesOrBlockMembers(entities, new Map(), 'blk1')).toBe(entities);
  });
});

describe('addBlockMember (ADR-641)', () => {
  it('appends a member to the active block (new container ref)', () => {
    const block = mkBlock('blk1', [mkLine('a')]);
    const entities: Entity[] = [block as unknown as Entity];
    const next = addBlockMember(entities, 'blk1', mkLine('new'));
    const nextBlock = next[0] as unknown as BlockEntity;
    expect(nextBlock.entities.map((m) => m.id)).toEqual(['a', 'new']);
    expect(nextBlock).not.toBe(block);
    expect(block.entities.length).toBe(1);                    // original untouched
  });

  it('falls back to a top-level append when no block is active', () => {
    const entities: Entity[] = [mkLine('a')];
    const next = addBlockMember(entities, null, mkLine('new'));
    expect(next.map((e) => e.id)).toEqual(['a', 'new']);
  });
});

describe('removeEntityOrBlockMember (ADR-641)', () => {
  it('removes a member from the active block (new container ref)', () => {
    const block = mkBlock('blk1', [mkLine('a'), mkLine('b')]);
    const entities: Entity[] = [block as unknown as Entity];
    const next = removeEntityOrBlockMember(entities, 'a', 'blk1');
    const nextBlock = next[0] as unknown as BlockEntity;
    expect(nextBlock.entities.map((m) => m.id)).toEqual(['b']);
    expect(nextBlock).not.toBe(block);
  });

  it('removes a top-level entity', () => {
    const entities: Entity[] = [mkLine('a'), mkLine('b')];
    const next = removeEntityOrBlockMember(entities, 'a', 'blk1');
    expect(next.map((e) => e.id)).toEqual(['b']);
  });

  it('returns the same array reference when nothing matched (no-op)', () => {
    const block = mkBlock('blk1', [mkLine('a')]);
    const entities: Entity[] = [block as unknown as Entity];
    const next = removeEntityOrBlockMember(entities, 'ghost', 'blk1');
    expect(next).toBe(entities);
  });
});
