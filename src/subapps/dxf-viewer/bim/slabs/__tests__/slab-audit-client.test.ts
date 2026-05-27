/**
 * ADR-XXX — slab-audit-client unit tests. Mirror of wall-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordSlabChange } from '../slab-audit-client';
import type { SlabEntity } from '../../types/slab-types';

const postMock = apiClient.post as jest.Mock;

function baseSlab(): Pick<SlabEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'slab_1',
    kind: 'floor',
    layerId: 'SLABS',
    params: {
      kind: 'floor',
      outline: { vertices: [] },
      levelElevation: 0,
      thickness: 200,
      geometryType: 'box',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordSlabChange', () => {
  it('created — emits thickness/levelElevation/geometryType', () => {
    recordSlabChange('created', baseSlab());
    const payload = postMock.mock.calls[0][1];
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'thickness', 'levelElevation', 'geometryType']));
    expect(fields).not.toContain('outline');
  });

  it('updated — thickness change only', () => {
    const prev = baseSlab();
    const next = { ...prev, params: { ...prev.params, thickness: 250 } };
    recordSlabChange('updated', next, { prevParams: prev.params });
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'thickness', oldValue: 200, newValue: 250 }),
    ]);
  });

  it('deleted — reverse diff', () => {
    recordSlabChange('deleted', baseSlab());
    const payload = postMock.mock.calls[0][1];
    const t = (payload.changes as Array<{ field: string; newValue: unknown; oldValue: unknown }>)
      .find((c) => c.field === 'thickness');
    expect(t).toMatchObject({ oldValue: 200, newValue: null });
  });
});
