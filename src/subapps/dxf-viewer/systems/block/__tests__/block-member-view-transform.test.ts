/**
 * ADR-641 — the member read/write SSoT applies the BEDIT VIEW transform: reads return VIEW-space,
 * writes inverse-transform back to the canonical DEFINITION space. Locks the transform boundary.
 */

import {
  findEntityOrBlockMember,
  updateEntityOrBlockMember,
  updateEntitiesOrBlockMembers,
  addBlockMember,
} from '../block-member-scene-access';
import type { BlockEditViewTransform } from '../block-edit-view-transform';
import type { BlockEntity, Entity, LineEntity } from '../../../types/entities';

const T: BlockEditViewTransform = { sx: 1000, sy: 1000, cx: 100, cy: 200 };

function line(id: string, x1: number, y1: number, x2: number, y2: number): LineEntity {
  return { id, type: 'line', layerId: '0', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as LineEntity;
}

function sceneWithBlock(members: Entity[]): { entities: Entity[]; block: BlockEntity } {
  const block = {
    id: 'blk', type: 'block', name: 'B', layerId: '0',
    position: { x: 0, y: 0 }, scale: { x: 1000, y: 1000 }, rotation: 0,
    entities: members, visible: true,
  } as BlockEntity;
  return { entities: [block], block };
}

describe('member read applies def→view', () => {
  it('findEntityOrBlockMember returns the member in VIEW space (real-size, recentred)', () => {
    // def member at the recenter point (100,200) → view (0,0); (100.4,200.5) → (400,500).
    const { entities } = sceneWithBlock([line('m1', 100, 200, 100.4, 200.5)]);
    const view = findEntityOrBlockMember(entities, 'm1', 'blk', T) as LineEntity;
    expect(view.start.x).toBeCloseTo(0, 6);
    expect(view.start.y).toBeCloseTo(0, 6);
    expect(view.end.x).toBeCloseTo(400, 6);
    expect(view.end.y).toBeCloseTo(500, 6);
  });

  it('without a transform the member is returned verbatim (legacy/top-level path)', () => {
    const { entities } = sceneWithBlock([line('m1', 100, 200, 101, 202)]);
    const raw = findEntityOrBlockMember(entities, 'm1', 'blk') as LineEntity;
    expect(raw.start).toEqual({ x: 100, y: 200 });
  });
});

describe('member write inverse-transforms view→def', () => {
  it('updateEntityOrBlockMember stores the updater result back in DEFINITION space', () => {
    const { entities } = sceneWithBlock([line('m1', 100, 200, 100.4, 200.5)]);
    // The updater runs in VIEW space (it sees start (0,0)); move it to view (500,500).
    const next = updateEntityOrBlockMember(
      entities, 'm1', 'blk',
      (e) => ({ ...(e as LineEntity), start: { x: 500, y: 500 } } as Entity),
      T,
    );
    const storedMember = (next[0] as BlockEntity).entities[0] as LineEntity;
    // def = C + view/scale = (100 + 500/1000, 200 + 500/1000) = (100.5, 200.5).
    expect(storedMember.start.x).toBeCloseTo(100.5, 6);
    expect(storedMember.start.y).toBeCloseTo(200.5, 6);
    // Untouched end round-trips back to its original def coords (no drift).
    expect(storedMember.end.x).toBeCloseTo(100.4, 6);
    expect(storedMember.end.y).toBeCloseTo(200.5, 6);
  });

  it('updateEntitiesOrBlockMembers inverse-transforms each patched member', () => {
    const { entities } = sceneWithBlock([line('m1', 100, 200, 100, 200)]);
    const patches = new Map<string, (e: Entity) => Entity>([
      ['m1', (e) => ({ ...(e as LineEntity), end: { x: 1000, y: 0 } } as Entity)],
    ]);
    const next = updateEntitiesOrBlockMembers(entities, patches, 'blk', T);
    const m = (next[0] as BlockEntity).entities[0] as LineEntity;
    // view end (1000,0) → def (100 + 1, 200 + 0) = (101, 200).
    expect(m.end.x).toBeCloseTo(101, 6);
    expect(m.end.y).toBeCloseTo(200, 6);
  });

  it('addBlockMember inverse-transforms a view-space member before storing', () => {
    const { entities } = sceneWithBlock([]);
    const created = line('new', 0, 0, 1000, 1000); // created in VIEW space
    const next = addBlockMember(entities, 'blk', created, T);
    const stored = (next[0] as BlockEntity).entities[0] as LineEntity;
    // view (0,0)-(1000,1000) → def (100,200)-(101,201).
    expect(stored.start.x).toBeCloseTo(100, 6);
    expect(stored.start.y).toBeCloseTo(200, 6);
    expect(stored.end.x).toBeCloseTo(101, 6);
    expect(stored.end.y).toBeCloseTo(201, 6);
  });

  it('round-trips: writing back the view a read returned leaves the definition unchanged', () => {
    const { entities } = sceneWithBlock([line('m1', 100, 200, 100.4, 200.5)]);
    const view = findEntityOrBlockMember(entities, 'm1', 'blk', T) as LineEntity;
    const next = updateEntityOrBlockMember(entities, 'm1', 'blk', () => view as Entity, T);
    const stored = (next[0] as BlockEntity).entities[0] as LineEntity;
    expect(stored.start.x).toBeCloseTo(100, 6);
    expect(stored.start.y).toBeCloseTo(200, 6);
    expect(stored.end.x).toBeCloseTo(100.4, 6);
    expect(stored.end.y).toBeCloseTo(200.5, 6);
  });
});
