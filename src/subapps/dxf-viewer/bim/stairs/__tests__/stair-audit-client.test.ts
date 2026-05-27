/**
 * ADR-380 — stair-audit-client unit tests. Mirror beam-audit-client.test.ts.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordStairChange } from '../stair-audit-client';
import type { StairEntity } from '../../types/stair-types';

const postMock = apiClient.post as jest.Mock;

function baseStair(): Pick<StairEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'stair_1',
    kind: 'straight',
    layerId: 'STAIRS',
    params: {
      basePoint: { x: 0, y: 0, z: 0 },
      direction: 0,
      rise: 175,
      tread: 280,
      nosing: 25,
      nosingSide: 'front',
      width: 1200,
      stepCount: 17,
      totalRise: 2975,
      totalRun: 4480,
      pitch: 33.6,
      structureType: 'monolithic',
      riserType: 'closed',
      antiskidNosing: false,
      adaContrastStrip: false,
      variant: { kind: 'straight' },
      walklineOffset: 300,
      handrails: { inner: true, outer: true, height: 900 },
      upDirection: 'forward',
      treadNumberStart: 1,
      treadLabelDisplay: 'all',
      treadLabelRestartPerFlight: false,
      codeProfile: 'nok',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordStairChange', () => {
  it('created — emits dimensional + structure fields, skips coords', () => {
    recordStairChange('created', baseStair());
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.entityType).toBe('stair');
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining([
      'kind', 'rise', 'tread', 'width', 'stepCount', 'structureType', 'codeProfile',
    ]));
    expect(fields).not.toContain('basePoint');
    expect(fields).not.toContain('direction');
    expect(fields).not.toContain('perTreadOverrides');
  });

  it('updated — only the field that changed', () => {
    const prev = baseStair();
    const next = { ...prev, params: { ...prev.params, width: 1500 } };
    recordStairChange('updated', next, { prevParams: prev.params });
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'width', oldValue: 1200, newValue: 1500 }),
    ]);
  });

  it('updated — no-op skips POST', () => {
    const prev = baseStair();
    recordStairChange('updated', prev, { prevParams: prev.params });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('deleted — reverse-diff emits per-field oldValue→null', () => {
    recordStairChange('deleted', baseStair());
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    const widthEntry = (payload.changes as Array<{ field: string; oldValue: unknown; newValue: unknown }>)
      .find((c) => c.field === 'width');
    expect(widthEntry).toMatchObject({ oldValue: 1200, newValue: null });
  });
});
