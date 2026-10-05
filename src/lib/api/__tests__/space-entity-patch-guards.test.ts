/**
 * ADR-898 §21.6 Ε6 — **ο φρουρός «ίδιο έργο» είναι ΚΑΛΩΔΙΩΜΕΝΟΣ στο PATCH χώρου, ΠΡΙΝ τη γραφή**. Ένας φρουρός που
 * περνά τα δικά του tests αλλά δεν τον καλεί κανείς δεν αρνείται τίποτα: εδώ τρέχει ο πραγματικός handler με τον
 * πραγματικό φρουρό, και ελέγχεται ότι η άρνηση φτάνει **χωρίς** να έχει γραφτεί το έγγραφο.
 */

jest.mock('server-only', () => ({}));

const mockDb = { collection: jest.fn() };
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => mockDb }));
jest.mock('@/lib/auth', () => ({ logAuditEvent: jest.fn(async () => undefined) }));
jest.mock('@/lib/firestore/soft-delete-engine', () => ({ softDelete: jest.fn() }));
jest.mock('@/lib/firestore/entity-linking.service', () => ({
  linkEntity: jest.fn(async () => undefined),
  linkedSpaceOwnersInScope: jest.fn(async () => new Map()),
}));
jest.mock('@/lib/firestore/cascade-propagation.service', () => ({ propagateSpaceAllocationCodeChange: jest.fn(async () => undefined) }));
jest.mock('@/lib/floor/host-floor.server', () => ({ resolveHostedFloorPatch: jest.fn(async () => ({})) }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => undefined) } }));
jest.mock('@/lib/api/space-entity-write', () => ({
  planSpaceWrite: (_cfg: unknown, body: Record<string, unknown>) => ({ kind: 'ok', updateData: body }),
  spaceAuditEntry: () => null,
}));
jest.mock('@/lib/api/space-entity-fields', () => ({ resolveAllocationCodeChange: () => null }));

const mockVersionCheck = jest.fn(async () => ({ newVersion: 8 }));
jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: (...args: unknown[]) => mockVersionCheck(...(args as [])),
  ConflictError: class ConflictError extends Error {},
}));

import type { NextRequest } from 'next/server';
import { z } from 'zod';

import type { AuthContext, PermissionCache } from '@/lib/auth';
import type { SpaceEntityRouteConfig } from '@/lib/api/space-entity-route-types';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';

import { buildPatchHandler } from '../space-entity-handlers';

type Doc = Record<string, unknown>;
type Body = { buildingId?: string | null; _v?: number };

const DOCS: Record<string, Record<string, Doc>> = {
  parking_spaces: { park_1: { buildingId: 'bld_A', projectId: 'prj_1', number: 'Θ' } },
  buildings: { bld_A: { projectId: 'prj_1' }, bld_B: { projectId: 'prj_1' }, bld_Z: { projectId: 'prj_2' } },
};

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

const cfg = {
  collection: 'parking_spaces',
  entityKind: 'parking',
  apiPath: '/api/parking/[id]',
  logger,
  auditResource: 'parking_spot',
  auditIdKey: 'parkingSpotId',
  displayField: 'number',
  requireInTenant: jest.fn(async () => undefined),
  updateSchema: z.object({ buildingId: z.string().nullable().optional(), _v: z.number().optional() }),
  mapExtraFields: () => ({}),
  messages: { idRequired: 'id', updated: 'updated', updateFailed: 'failed', logUpdateError: 'error', logUpdated: 'updated', auditUpdateReason: 'reason' },
} as unknown as SpaceEntityRouteConfig<Body>;

function patch(body: Body) {
  const request = { url: 'http://localhost/api/parking/park_1', json: async () => body } as unknown as NextRequest;
  return buildPatchHandler(cfg)(request, { uid: 'u1', companyId: 'comp_1' } as AuthContext, {} as PermissionCache);
}

beforeEach(() => {
  mockVersionCheck.mockClear();
  mockDb.collection.mockImplementation((name: string) => ({
    doc: (id: string) => ({ get: async () => ({ exists: Boolean(DOCS[name]?.[id]), data: () => DOCS[name]?.[id] }) }),
  }));
});

describe('PATCH χώρου — φρουρός «ίδιο έργο»', () => {
  it('🔴 κτίριο ΑΛΛΟΥ έργου ⇒ 409 με κωδικό πολιτικής, και το έγγραφο ΔΕΝ γράφεται', async () => {
    await expect(patch({ buildingId: 'bld_Z', _v: 7 })).rejects.toMatchObject({
      statusCode: 409,
      errorCode: POLICY_ERROR_CODES.SPACE_BUILDING_OTHER_PROJECT,
    });
    expect(mockVersionCheck).not.toHaveBeenCalled();
  });

  it('κτίριο του ΙΔΙΟΥ έργου ⇒ η γραφή γίνεται', async () => {
    await patch({ buildingId: 'bld_B', _v: 7 });
    expect(mockVersionCheck).toHaveBeenCalledTimes(1);
  });
});
