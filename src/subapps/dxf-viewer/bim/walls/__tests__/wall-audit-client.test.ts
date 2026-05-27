/**
 * ADR-XXX — wall-audit-client unit tests.
 *
 * Verifies the audit POST payload shape for create / update / delete actions.
 * Apoclient.post is mocked so the test stays unit-scoped (no fetch / no auth).
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordWallChange } from '../wall-audit-client';
import type { WallEntity } from '../../types/wall-types';

const postMock = apiClient.post as jest.Mock;

function baseWall(): Pick<WallEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'wall_1',
    kind: 'straight',
    layerId: 'WALLS-EXT',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordWallChange', () => {
  it('created — POSTs full creation diff', () => {
    recordWallChange('created', baseWall());
    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, payload] = postMock.mock.calls[0];
    expect(url).toBe('/api/audit-trail/record');
    expect(payload).toMatchObject({
      entityType: 'wall',
      entityId: 'wall_1',
      action: 'created',
    });
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'height', 'thickness', 'category']));
    // start/end never tracked — coordinate noise.
    expect(fields).not.toContain('start');
    expect(fields).not.toContain('end');
  });

  it('updated — POSTs only the changed fields', () => {
    const prev = baseWall();
    const next = { ...prev, params: { ...prev.params, thickness: 300 } };
    recordWallChange('updated', next, { prevParams: prev.params });
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.action).toBe('updated');
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'thickness', oldValue: 250, newValue: 300 }),
    ]);
  });

  it('updated — no-op when nothing changed (no POST)', () => {
    const prev = baseWall();
    recordWallChange('updated', prev, { prevParams: prev.params });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('updated — no-op when prevParams missing (no diff possible)', () => {
    recordWallChange('updated', baseWall());
    expect(postMock).not.toHaveBeenCalled();
  });

  it('deleted — POSTs reverse diff (oldValue → null)', () => {
    recordWallChange('deleted', baseWall());
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.action).toBe('deleted');
    const heightEntry = (payload.changes as Array<{ field: string; oldValue: unknown; newValue: unknown }>)
      .find((c) => c.field === 'height');
    expect(heightEntry).toMatchObject({ oldValue: 3000, newValue: null });
  });

  it('deleted — falls back to minimal payload when only id+kind available', () => {
    recordWallChange('deleted', { id: 'wall_x', kind: 'straight' });
    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0][1];
    expect(payload.changes).toEqual([
      expect.objectContaining({ field: 'kind', oldValue: 'straight', newValue: null }),
    ]);
  });
});
