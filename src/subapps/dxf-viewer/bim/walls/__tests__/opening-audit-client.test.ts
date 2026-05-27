/**
 * ADR-XXX — opening-audit-client unit tests. Mirror of wall-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordOpeningChange } from '../opening-audit-client';
import type { OpeningEntity } from '../../types/opening-types';

const postMock = apiClient.post as jest.Mock;

function baseOpening(): Pick<OpeningEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'op_1',
    kind: 'door',
    layerId: 'OPENINGS',
    params: {
      kind: 'door',
      wallId: 'wall_1',
      offsetFromStart: 500,
      width: 900,
      height: 2100,
      sillHeight: 0,
      handing: 'left',
      openDirection: 'inward',
      mark: 'Θ.101',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordOpeningChange', () => {
  it('created — emits wallId/width/height/sillHeight/mark/handing', () => {
    recordOpeningChange('created', baseOpening());
    const payload = postMock.mock.calls[0][1];
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining([
      'kind', 'wallId', 'width', 'height', 'sillHeight', 'mark', 'handing', 'openDirection',
    ]));
  });

  it('updated — mark renamed', () => {
    const prev = baseOpening();
    const next = { ...prev, params: { ...prev.params, mark: 'Θ.205', markIsManual: true } };
    recordOpeningChange('updated', next, { prevParams: prev.params });
    const payload = postMock.mock.calls[0][1];
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields.sort()).toEqual(['mark', 'markIsManual']);
  });

  it('deleted — reverse diff includes mark', () => {
    recordOpeningChange('deleted', baseOpening());
    const payload = postMock.mock.calls[0][1];
    const m = (payload.changes as Array<{ field: string; newValue: unknown; oldValue: unknown }>)
      .find((c) => c.field === 'mark');
    expect(m).toMatchObject({ oldValue: 'Θ.101', newValue: null });
  });
});
