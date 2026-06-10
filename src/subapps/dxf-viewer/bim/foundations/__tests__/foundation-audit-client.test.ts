/**
 * ADR-436 Slice 1-persist — foundation-audit-client unit tests.
 * Mirror του column-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordFoundationChange } from '../foundation-audit-client';
import type { FoundationEntity } from '../../types/foundation-types';

const postMock = apiClient.post as jest.Mock;

function basePad(): Pick<FoundationEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'fnd_1',
    kind: 'pad',
    layerId: 'FND',
    params: {
      kind: 'pad',
      topElevationMm: -1000,
      thicknessMm: 500,
      position: { x: 0, y: 0, z: 0 },
      width: 1500,
      length: 1500,
      rotation: 0,
      anchor: 'center',
      profile: 'flat',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordFoundationChange', () => {
  it('created — emits dimensional entries, excludes coordinate position', () => {
    recordFoundationChange('created', basePad());
    const payload = postMock.mock.calls[0][1];
    expect(payload.entityType).toBe('foundation');
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'width', 'length', 'thicknessMm', 'anchor', 'profile']));
    expect(fields).not.toContain('position');
  });

  it('updated — only rotation diffs', () => {
    const prev = basePad();
    const next = { ...prev, params: { ...prev.params, rotation: 45 } };
    recordFoundationChange('updated', next, { prevParams: prev.params });
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'rotation', oldValue: 0, newValue: 45 }),
    ]);
  });

  it('deleted — reverse diff', () => {
    recordFoundationChange('deleted', basePad());
    const payload = postMock.mock.calls[0][1];
    const w = (payload.changes as Array<{ field: string; newValue: unknown; oldValue: unknown }>)
      .find((c) => c.field === 'width');
    expect(w).toMatchObject({ oldValue: 1500, newValue: null });
  });
});
