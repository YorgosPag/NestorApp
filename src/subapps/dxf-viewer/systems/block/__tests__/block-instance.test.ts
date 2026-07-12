/**
 * ADR-640 — BLOCK instance construction + EXPLODE.
 *
 * `createBlockInstance` builds a first-class BlockEntity from a DXF INSERT + its block definition,
 * baking the block base to the origin (so members are stored relative to base) and reading the
 * INSERT placement (position/scale/rotation). `explodeBlockInstance` places the members in world
 * space with FRESH ids (AutoCAD EXPLODE of an INSERT).
 */

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => { cb(null); return () => {}; },
  signInAnonymously: jest.fn(),
}));

import { createBlockInstance, explodeBlockInstance } from '../block-instance';
import type { ExpandContext } from '../../../utils/dxf-block-expander';
import type { BlockDef, BlockDefMap } from '../../../utils/dxf-block-parser';
import type { EntityData } from '../../../utils/dxf-converter-helpers';
import type { LineEntity } from '../../../types/entities';

function lineData(x1: number, y1: number, x2: number, y2: number): EntityData {
  return {
    type: 'LINE',
    layer: 'EPIPLA',
    data: { '8': 'EPIPLA', '10': String(x1), '20': String(y1), '11': String(x2), '21': String(y2) },
  };
}

function insert(x: number, y: number, rot = 0, sx = 1, sy = 1): EntityData {
  return {
    type: 'INSERT', layer: '0',
    data: { '2': 'NEC32_BLOCK', '8': '0', '10': String(x), '20': String(y), '41': String(sx), '42': String(sy), '50': String(rot) },
  };
}

const emptyBlockDefs: BlockDefMap = new Map();
const ctx = (): ExpandContext => ({ idSeq: { n: 0 } });

describe('ADR-640 createBlockInstance', () => {
  it('builds a BlockEntity with name + INSERT placement + members', () => {
    const def: BlockDef = { base: { x: 0, y: 0 }, entities: [lineData(0, 0, 10, 0)] };
    const block = createBlockInstance('NEC32_BLOCK', def, insert(100, 50, 30, 2, 3), emptyBlockDefs, ctx());
    expect(block).not.toBeNull();
    expect(block!.type).toBe('block');
    expect(block!.name).toBe('NEC32_BLOCK');
    expect(block!.position).toEqual({ x: 100, y: 50 });
    expect(block!.scale).toEqual({ x: 2, y: 3 });
    expect(block!.rotation).toBe(30);
    expect(block!.entities).toHaveLength(1);
  });

  it('bakes the block base to the origin (member stored relative to base)', () => {
    // Member authored at (5,0)-(15,0) with base (5,0) → stored local (0,0)-(10,0).
    const def: BlockDef = { base: { x: 5, y: 0 }, entities: [lineData(5, 0, 15, 0)] };
    const block = createBlockInstance('B', def, insert(0, 0), emptyBlockDefs, ctx());
    const m = block!.entities[0] as LineEntity;
    expect(m.start.x).toBeCloseTo(0);
    expect(m.end.x).toBeCloseTo(10);
  });

  it('returns null for a block with no renderable members (caller falls back to flatten)', () => {
    const def: BlockDef = { base: { x: 0, y: 0 }, entities: [] };
    expect(createBlockInstance('EMPTY', def, insert(0, 0), emptyBlockDefs, ctx())).toBeNull();
  });

  it('EXPLODE places members in world space with FRESH ids', () => {
    const def: BlockDef = { base: { x: 0, y: 0 }, entities: [lineData(0, 0, 10, 0)] };
    const block = createBlockInstance('B', def, insert(100, 50), emptyBlockDefs, ctx())!;
    const originalMemberId = block.entities[0].id;
    const exploded = explodeBlockInstance(block) as LineEntity[] | null;
    expect(exploded).not.toBeNull();
    expect(exploded).toHaveLength(1);
    expect(exploded![0].start).toEqual({ x: 100, y: 50 });
    expect(exploded![0].end).toEqual({ x: 110, y: 50 });
    expect(exploded![0].id).not.toBe(originalMemberId);
    expect(exploded![0].id).not.toBe(block.id);
  });
});
