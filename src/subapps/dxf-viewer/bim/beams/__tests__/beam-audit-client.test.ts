/**
 * ADR-XXX — beam-audit-client unit tests. Mirror of wall-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordBeamChange } from '../beam-audit-client';
import type { BeamEntity } from '../../types/beam-types';

const postMock = apiClient.post as jest.Mock;

function baseBeam(): Pick<BeamEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'beam_1',
    kind: 'straight',
    layerId: 'BEAMS',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 5000, y: 0, z: 0 },
      width: 250,
      depth: 500,
      topElevation: 3000,
      supportType: 'simple',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordBeamChange', () => {
  it('created — emits width/depth/topElevation/supportType', () => {
    recordBeamChange('created', baseBeam());
    const payload = postMock.mock.calls[0][1];
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'width', 'depth', 'topElevation', 'supportType']));
    expect(fields).not.toContain('startPoint');
    expect(fields).not.toContain('endPoint');
  });

  it('updated — depth only', () => {
    const prev = baseBeam();
    const next = { ...prev, params: { ...prev.params, depth: 600 } };
    recordBeamChange('updated', next, { prevParams: prev.params });
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'depth', oldValue: 500, newValue: 600 }),
    ]);
  });

  it('deleted — reverse diff', () => {
    recordBeamChange('deleted', baseBeam());
    const payload = postMock.mock.calls[0][1];
    const d = (payload.changes as Array<{ field: string; newValue: unknown; oldValue: unknown }>)
      .find((c) => c.field === 'depth');
    expect(d).toMatchObject({ oldValue: 500, newValue: null });
  });
});
