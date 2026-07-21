/**
 * ADR-684 Φ4-C — generic-solid-audit-client unit tests. Mirror του foundation-audit-client.test.ts.
 * Φρουρεί: σωστό entityType (που ΤΩΡΑ δέχεται ο διακομιστής), tracked-field diffs (shape ολόκληρο,
 * structuralRole), reverse-diff στο delete, no-op σε μη-αλλαγή.
 */

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: jest.fn(() => Promise.resolve({ success: true, data: { auditId: 'a1' } })) },
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { recordGenericSolidChange } from '../generic-solid-audit-client';
import type { GenericSolidEntity } from '../generic-solid-types';

const postMock = apiClient.post as jest.Mock;

function baseSolid(): Pick<GenericSolidEntity, 'id' | 'kind' | 'layerId' | 'params'> {
  return {
    id: 'gsol_1',
    kind: 'generic',
    layerId: '0',
    params: {
      kind: 'generic',
      shape: { kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 },
      position: { x: 0, y: 0, z: 0 },
      rotationDeg: 0,
      mountingElevationMm: 0,
      material: 'oak',
      structuralRole: 'decorative',
    },
  };
}

beforeEach(() => postMock.mockClear());

describe('recordGenericSolidChange', () => {
  it('created — entityType generic-solid + shape/material/structuralRole, όχι coordinate position', () => {
    recordGenericSolidChange('created', baseSolid());
    const payload = postMock.mock.calls[0][1];
    expect(payload.entityType).toBe('generic-solid');
    const fields = (payload.changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['kind', 'shape', 'material', 'structuralRole']));
    expect(fields).not.toContain('position');
  });

  it('updated — μόνο το structuralRole diff (δομικό↔διακοσμητικό, BOQ-relevant)', () => {
    const prev = baseSolid();
    const next = { ...prev, params: { ...prev.params, structuralRole: 'structural' as const } };
    recordGenericSolidChange('updated', next, { prevParams: prev.params });
    expect(postMock.mock.calls[0][1].changes).toEqual([
      expect.objectContaining({ field: 'structuralRole', oldValue: 'decorative', newValue: 'structural' }),
    ]);
  });

  it('updated — αλλαγή διάστασης σχήματος → το shape (ολόκληρο) diff', () => {
    const prev = baseSolid();
    const next = { ...prev, params: { ...prev.params, shape: { kind: 'box' as const, widthMm: 600, depthMm: 500, heightMm: 500 } } };
    recordGenericSolidChange('updated', next, { prevParams: prev.params });
    const fields = (postMock.mock.calls[0][1].changes as Array<{ field: string }>).map((c) => c.field);
    expect(fields).toEqual(['shape']);
  });

  it('updated — καμία αλλαγή → κανένα POST (route απορρίπτει changes: [])', () => {
    const prev = baseSolid();
    recordGenericSolidChange('updated', prev, { prevParams: prev.params });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('deleted — reverse diff (shape oldValue → null)', () => {
    recordGenericSolidChange('deleted', baseSolid());
    const shape = (postMock.mock.calls[0][1].changes as Array<{ field: string; oldValue: unknown; newValue: unknown }>)
      .find((c) => c.field === 'shape');
    expect(shape).toMatchObject({ newValue: null });
    expect(shape?.oldValue).toContain('box');
  });
});
