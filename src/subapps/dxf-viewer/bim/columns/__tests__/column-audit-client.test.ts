/**
 * ADR-XXX — column-audit-client unit tests. Mirror of wall-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordColumnChange } from '../column-audit-client';
import type { ColumnEntity } from '../../types/column-types';

const postMock = apiClient.post as jest.Mock;

function baseColumn(): Pick<ColumnEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'col_1',
    kind: 'rectangular',
    layerId: 'COLS',
    params: {
      kind: 'rectangular',
      position: { x: 0, y: 0, z: 0 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 0,
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordColumnChange', () => {
  it('created — emits width/depth/height/anchor entries', () => {
    recordColumnChange('created', baseColumn());
    const payload = postMock.mock.calls[0][1];
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'width', 'depth', 'height', 'anchor']));
    expect(fields).not.toContain('position');
  });

  it('updated — only rotation diffs', () => {
    const prev = baseColumn();
    const next = { ...prev, params: { ...prev.params, rotation: 45 } };
    recordColumnChange('updated', next, { prevParams: prev.params });
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'rotation', oldValue: 0, newValue: 45 }),
    ]);
  });

  it('deleted — reverse diff', () => {
    recordColumnChange('deleted', baseColumn());
    const payload = postMock.mock.calls[0][1];
    const w = (payload.changes as Array<{ field: string; newValue: unknown; oldValue: unknown }>)
      .find((c) => c.field === 'width');
    expect(w).toMatchObject({ oldValue: 400, newValue: null });
  });
});
