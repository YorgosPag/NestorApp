/**
 * ADR-437 — Region-detection integration: a space separator's 2-point segment must
 * reach `extractLineSegments` (the gateway into `getCachedRegionPerimeters`), so the
 * thermal-space tool closes/subdivides regions on separators like on walls.
 *
 * This is the core SSoT guarantee — without it the separator is invisible to the
 * region detector (the full open-plan → 2 regions flow is browser-verified).
 */

import { extractLineSegments } from '../wall-in-region';
import { createSpaceSeparator } from '@/services/factories/space-separator.factory';
import { computeSpaceSeparatorGeometry } from '../../types/space-separator-types';
import type { Entity } from '../../../types/entities';

function makeSeparator(start: { x: number; y: number }, end: { x: number; y: number }) {
  const params = { start, end, sceneUnits: 'mm' as const };
  return createSpaceSeparator({
    params,
    geometry: computeSpaceSeparatorGeometry(params),
    layerId: 'lyr_x',
  });
}

describe('space-separator region integration', () => {
  it('extractLineSegments yields the separator 2-point segment', () => {
    const sep = makeSeparator({ x: 100, y: 200 }, { x: 900, y: 200 });
    const segs = extractLineSegments([sep as unknown as Entity]);
    expect(segs).toHaveLength(1);
    expect(segs[0].start).toEqual({ x: 100, y: 200 });
    expect(segs[0].end).toEqual({ x: 900, y: 200 });
    expect(segs[0].id).toBe(sep.id);
  });

  it('emits one segment per separator across a mixed list', () => {
    const a = makeSeparator({ x: 0, y: 0 }, { x: 0, y: 1000 });
    const b = makeSeparator({ x: 0, y: 1000 }, { x: 1000, y: 1000 });
    const segs = extractLineSegments([a, b] as unknown as Entity[]);
    expect(segs).toHaveLength(2);
  });

  it('ignores non-line entities (zero regression)', () => {
    const segs = extractLineSegments([
      { id: 'x', type: 'circle', center: { x: 0, y: 0 }, radius: 5 } as unknown as Entity,
    ]);
    expect(segs).toHaveLength(0);
  });
});
