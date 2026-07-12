/**
 * ADR-640 arc-disappearance regression — the per-entity line-layer suppression MUST be type-gated,
 * so a container member (block/group/array) that shares the container id with a batched line sibling
 * is not wrongly skipped. The furniture block bug: 20 line members + 8 arc members all carry the
 * block id → the batched line put that id in `batchedIds` → the arcs vanished from the per-entity pass.
 */
import { describe, it, expect } from '@jest/globals';
import { isDrawnByBatchedLineLayer, isDrawnByWebglLineLayer } from '../line-layer-draw-suppression';
import type { DxfEntityUnion } from '../../dxf-canvas/dxf-types';

const SHARED = 'block-1'; // the container id every member carries (block/group/array convention)
const line = { id: SHARED, type: 'line' } as unknown as DxfEntityUnion;
const arc = { id: SHARED, type: 'arc' } as unknown as DxfEntityUnion;
const circle = { id: SHARED, type: 'circle' } as unknown as DxfEntityUnion;
const polyline = { id: SHARED, type: 'polyline' } as unknown as DxfEntityUnion;

describe('isDrawnByBatchedLineLayer — type-gated Canvas2D batch suppression', () => {
  const batched = new Set<string>([SHARED]); // a line member batch-drew under the container id

  it('suppresses the LINE member (it was batch-drawn)', () => {
    expect(isDrawnByBatchedLineLayer(line, batched)).toBe(true);
  });

  it('does NOT suppress the ARC member sharing the container id (the bug)', () => {
    expect(isDrawnByBatchedLineLayer(arc, batched)).toBe(false);
  });

  it('does NOT suppress a CIRCLE member sharing the container id', () => {
    expect(isDrawnByBatchedLineLayer(circle, batched)).toBe(false);
  });

  it('does not suppress a line whose id was never batched', () => {
    expect(isDrawnByBatchedLineLayer({ id: 'other', type: 'line' } as unknown as DxfEntityUnion, batched)).toBe(false);
  });
});

describe('isDrawnByWebglLineLayer — type-gated GPU suppression', () => {
  const owned = new Set<string>([SHARED]); // a line/plain-polyline member owned by the GPU layer

  it('suppresses the owned LINE and plain POLYLINE members', () => {
    expect(isDrawnByWebglLineLayer(line, owned)).toBe(true);
    expect(isDrawnByWebglLineLayer(polyline, owned)).toBe(true);
  });

  it('does NOT suppress the ARC member sharing the owned id (the bug)', () => {
    expect(isDrawnByWebglLineLayer(arc, owned)).toBe(false);
  });

  it('null owned set (GPU layer off) → never suppresses', () => {
    expect(isDrawnByWebglLineLayer(line, null)).toBe(false);
    expect(isDrawnByWebglLineLayer(arc, null)).toBe(false);
  });
});
