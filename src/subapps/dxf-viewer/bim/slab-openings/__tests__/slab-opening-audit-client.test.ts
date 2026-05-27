/**
 * ADR-380 — slab-opening-audit-client unit tests. Mirror beam-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordSlabOpeningChange } from '../slab-opening-audit-client';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';

const postMock = apiClient.post as jest.Mock;

function baseEntity(): Pick<SlabOpeningEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'slabop_1',
    kind: 'shaft',
    layerId: 'SLAB_OPENINGS',
    params: {
      kind: 'shaft',
      slabId: 'slab_host_1',
      outline: [
        { x: 0, y: 0, z: 0 },
        { x: 1500, y: 0, z: 0 },
        { x: 1500, y: 1500, z: 0 },
        { x: 0, y: 1500, z: 0 },
      ],
      fireRating: 90,
      sceneUnits: 'mm',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordSlabOpeningChange', () => {
  it('created — emits kind/slabId/fireRating, skips outline', () => {
    recordSlabOpeningChange('created', baseEntity());
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.entityType).toBe('slab-opening');
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'slabId', 'fireRating']));
    expect(fields).not.toContain('outline');
  });

  it('updated — only fireRating changed', () => {
    const prev = baseEntity();
    const next = { ...prev, params: { ...prev.params, fireRating: 120 as const } };
    recordSlabOpeningChange('updated', next, { prevParams: prev.params });
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'fireRating', oldValue: 90, newValue: 120 }),
    ]);
  });

  it('updated — no-op skips POST', () => {
    const prev = baseEntity();
    recordSlabOpeningChange('updated', prev, { prevParams: prev.params });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('deleted — reverse-diff emits per-field oldValue→null', () => {
    recordSlabOpeningChange('deleted', baseEntity());
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    const slabIdEntry = (payload.changes as Array<{ field: string; oldValue: unknown; newValue: unknown }>)
      .find((c) => c.field === 'slabId');
    expect(slabIdEntry).toMatchObject({ oldValue: 'slab_host_1', newValue: null });
  });
});
