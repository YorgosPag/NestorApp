/**
 * ADR-499 Slice B — slab-size-patch (auto-size πάχους ως undoable patch + guards).
 */

import type { SlabEntity, SlabParams } from '../../../types/slab-types';
import type { ColumnEntity } from '../../../types/column-types';
import type { SlabSupportCondition } from '../../loads/slab-beam-support';
import type { SlabDna } from '../../../types/slab-dna-types';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import {
  buildSlabSizePatch,
  isSlabAutoSized,
  isSlabSectionAdequate,
  resolveSlabSectionLock,
} from '../slab-size-patch';

const CANTILEVER: SlabSupportCondition = {
  supportType: 'cantilever', supportCount: 1, cantileverLengthM: 3,
};

function makeSlab(over: Partial<SlabParams> = {}): SlabEntity {
  const params = {
    kind: 'floor',
    outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, { x: 4000, y: 3000, z: 0 }, { x: 0, y: 3000, z: 0 }] },
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    sceneUnits: 'mm',
    appliedLoad: { deadAxialKn: 240, liveAxialKn: 0 },
    ...over,
  } as SlabParams;
  return { type: 'slab', kind: params.kind, id: 'slab_test', params, geometry: { maxFreeSpanM: 3 } } as unknown as SlabEntity;
}

describe('isSlabAutoSized', () => {
  it('default AUTO όταν λείπει το flag', () => {
    expect(isSlabAutoSized(makeSlab().params)).toBe(true);
  });
  it('locked μόνο όταν autoSized:false', () => {
    expect(isSlabAutoSized(makeSlab({ autoSized: false }).params)).toBe(false);
  });
  it('composite (dna) → ΠΟΤΕ auto (το πάχος προκύπτει από dna.totalThickness)', () => {
    expect(isSlabAutoSized(makeSlab({ dna: {} as SlabDna }).params)).toBe(false);
  });
});

describe('buildSlabSizePatch', () => {
  it('πρόβολος 200mm → αυτο-μεγαλώνει + autoSized:true', () => {
    const patch = buildSlabSizePatch(makeSlab(), EUROCODE_PROVIDER, CANTILEVER);
    expect(patch).not.toBeNull();
    expect(patch!.next.thickness).toBeGreaterThan(200);
    expect(patch!.next.autoSized).toBe(true);
  });

  it('null χωρίς συνθήκη στήριξης (αμφιέρειστη → ο sizer δίνει undefined)', () => {
    expect(buildSlabSizePatch(makeSlab(), EUROCODE_PROVIDER)).toBeNull();
  });

  it('null για κλειδωμένη πλάκα (manual override wins)', () => {
    expect(buildSlabSizePatch(makeSlab({ autoSized: false }), EUROCODE_PROVIDER, CANTILEVER)).toBeNull();
  });

  it('null για composite (dna) πλάκα', () => {
    expect(buildSlabSizePatch(makeSlab({ dna: {} as SlabDna }), EUROCODE_PROVIDER, CANTILEVER)).toBeNull();
  });

  it('null για μη-πλάκα', () => {
    const column = { type: 'column', id: 'col_x', params: {} } as unknown as ColumnEntity;
    expect(buildSlabSizePatch(column, EUROCODE_PROVIDER, CANTILEVER)).toBeNull();
  });

  it('null όταν συγκλίνει (πάχος ήδη επαρκές)', () => {
    const grown = buildSlabSizePatch(makeSlab(), EUROCODE_PROVIDER, CANTILEVER)!.next.thickness;
    expect(buildSlabSizePatch(makeSlab({ thickness: grown }), EUROCODE_PROVIDER, CANTILEVER)).toBeNull();
  });
});

// ADR-503 Slice 3 — safety-gated lock (mirror κολώνας/δοκού).
const GROWN_CANTILEVER = buildSlabSizePatch(makeSlab(), EUROCODE_PROVIDER, CANTILEVER)!.next.thickness;

describe('isSlabSectionAdequate (ADR-503 Slice 3)', () => {
  it('flags an under-sized cantilever thickness as inadequate', () => {
    const slab = makeSlab({ thickness: 200 });
    const res = isSlabSectionAdequate(EUROCODE_PROVIDER, slab, slab.params, CANTILEVER);
    expect(res.adequate).toBe(false);
    expect(res.minThicknessMm).toBe(GROWN_CANTILEVER);
  });

  it('accepts a thickness at or above the minimum adequate', () => {
    const slab = makeSlab({ thickness: GROWN_CANTILEVER });
    expect(isSlabSectionAdequate(EUROCODE_PROVIDER, slab, slab.params, CANTILEVER).adequate).toBe(true);
  });

  it('no gate for a non-cantilever slab (sizer undefined → adequate)', () => {
    const slab = makeSlab({ thickness: 200 });
    expect(isSlabSectionAdequate(EUROCODE_PROVIDER, slab, slab.params).adequate).toBe(true);
  });
});

describe('resolveSlabSectionLock (ADR-503 Slice 3)', () => {
  it('passes through a composite (dna) slab untouched', () => {
    const slab = makeSlab({ dna: {} as SlabDna });
    const next = makeSlab({ dna: {} as SlabDna, thickness: 50 }).params;
    const lock = resolveSlabSectionLock(EUROCODE_PROVIDER, slab, slab.params, next, CANTILEVER);
    expect(lock.rejected).toBe(false);
    expect(lock.params).toBe(next);
    expect(lock.params.autoSized).toBeUndefined();
  });

  it('passes through a non-thickness edit (no autoSized mutation)', () => {
    const slab = makeSlab();
    const next = makeSlab({ levelElevation: 4000 }).params;
    const lock = resolveSlabSectionLock(EUROCODE_PROVIDER, slab, slab.params, next, CANTILEVER);
    expect(lock.rejected).toBe(false);
    expect(lock.params.autoSized).toBeUndefined();
  });

  it('locks an adequate manual thickness (autoSized:false, Revit user-wins)', () => {
    const slab = makeSlab();
    const next = makeSlab({ thickness: GROWN_CANTILEVER }).params;
    const lock = resolveSlabSectionLock(EUROCODE_PROVIDER, slab, slab.params, next, CANTILEVER);
    expect(lock.rejected).toBe(false);
    expect(lock.params.autoSized).toBe(false);
    expect(lock.params.thickness).toBe(GROWN_CANTILEVER);
  });

  it('BLOCKS an under-sized manual thickness → clamps to minimum adequate, stays AUTO', () => {
    const slab = makeSlab({ thickness: GROWN_CANTILEVER });
    const next = makeSlab({ thickness: 200 }).params;
    const lock = resolveSlabSectionLock(EUROCODE_PROVIDER, slab, slab.params, next, CANTILEVER);
    expect(lock.rejected).toBe(true);
    expect(lock.params.thickness).toBe(GROWN_CANTILEVER);
    expect(lock.params.autoSized).toBe(true);
  });
});
