/**
 * ADR-898 §21.6 Ε6 — **οι φρουροί του κτιρίου είναι ΚΑΛΩΔΙΩΜΕΝΟΙ στο PATCH χώρου, ΠΡΙΝ τη γραφή**. Ένας φρουρός που
 * περνά τα δικά του tests αλλά δεν τον καλεί κανείς δεν αρνείται τίποτα: εδώ τρέχει ο πραγματικός handler με τον
 * πραγματικό φρουρό **και τον πραγματικό φύλακα του πόρου**, και ελέγχεται ότι η άρνηση φτάνει **χωρίς** να έχει
 * γραφτεί το έγγραφο — και με τον σωστό κωδικό HTTP (η χοάνη σφαλμάτων έκανε τις αρνήσεις του φύλακα 500).
 */

jest.mock('server-only', () => ({}));

const mockDb = { collection: jest.fn() };
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => mockDb }));
jest.mock('@/lib/auth', () => ({ logAuditEvent: jest.fn(async () => undefined) }));
jest.mock('@/lib/auth/audit', () => ({ logAuditEvent: jest.fn(async () => undefined) }));
jest.mock('@/lib/firestore/soft-delete-engine', () => ({ softDelete: jest.fn() }));
const mockLinkEntity = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('@/lib/firestore/entity-linking.service', () => ({
  linkEntity: (...args: unknown[]) => mockLinkEntity(...args),
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
import { TenantIsolationError } from '@/lib/auth/tenant-isolation-error';
import type { SpaceEntityRouteConfig } from '@/lib/api/space-entity-route-types';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';

import { buildDeleteHandler, buildPatchHandler } from '../space-entity-handlers';

type Doc = Record<string, unknown>;
type Body = { buildingId?: string | null; _v?: number };

const DOCS: Record<string, Record<string, Doc>> = {
  parking_spaces: {
    park_1: { buildingId: 'bld_A', projectId: 'prj_1', number: 'Θ' },
    park_free: { number: 'Ασύνδετη' },
  },
  buildings: {
    bld_A: { companyId: 'comp_1', projectId: 'prj_1' },
    bld_B: { companyId: 'comp_1', projectId: 'prj_1' },
    bld_Z: { companyId: 'comp_1', projectId: 'prj_2' },
    bld_FOREIGN: { companyId: 'comp_2', projectId: 'prj_9' },
  },
};

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const requireInTenant = jest.fn(async (): Promise<void> => undefined);

const cfg = {
  collection: 'parking_spaces',
  entityKind: 'parking',
  apiPath: '/api/parking/[id]',
  logger,
  auditResource: 'parking_spot',
  auditIdKey: 'parkingSpotId',
  displayField: 'number',
  requireInTenant,
  updateSchema: z.object({ buildingId: z.string().nullable().optional(), _v: z.number().optional() }),
  mapExtraFields: () => ({}),
  messages: {
    idRequired: 'id', updated: 'updated', updateFailed: 'failed', deleteFailed: 'delete failed',
    logUpdateError: 'error', logDeleteError: 'delete error', logUpdated: 'updated', auditUpdateReason: 'reason',
  },
} as unknown as SpaceEntityRouteConfig<Body>;

const CALLER = { uid: 'u1', companyId: 'comp_1', globalRole: 'company_admin' } as unknown as AuthContext;

function patch(body: Body, spaceId = 'park_1') {
  const request = { url: `http://localhost/api/parking/${spaceId}`, json: async () => body } as unknown as NextRequest;
  return buildPatchHandler(cfg)(request, CALLER, {} as PermissionCache);
}

beforeEach(() => {
  mockVersionCheck.mockClear();
  mockLinkEntity.mockClear();
  logger.error.mockClear();
  requireInTenant.mockReset();
  requireInTenant.mockResolvedValue(undefined);
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

describe('PATCH χώρου — 🔒 το κτίριο είναι του καλούντος (Ε6-γ)', () => {
  it('🔴 ασύνδετος χώρος + κτίριο ΑΛΛΟΥ χώρου εργασίας ⇒ 404· ούτε γραφή ούτε καταρράκτης', async () => {
    await expect(patch({ buildingId: 'bld_FOREIGN', _v: 1 }, 'park_free')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Building not found',
    });
    expect(mockVersionCheck).not.toHaveBeenCalled();
    expect(mockLinkEntity).not.toHaveBeenCalled();
  });

  it('ασύνδετος χώρος + ΔΙΚΟ μας κτίριο ⇒ η ανάθεση γίνεται', async () => {
    await patch({ buildingId: 'bld_Z', _v: 1 }, 'park_free');
    expect(mockVersionCheck).toHaveBeenCalledTimes(1);
    expect(mockLinkEntity).toHaveBeenCalledTimes(1);
  });
});

describe('η χοάνη σφαλμάτων — η άρνηση του φύλακα ΔΕΝ γίνεται 500', () => {
  const foreignSpace = () => requireInTenant.mockRejectedValue(new TenantIsolationError('Parking spot not found', 404, 'NOT_FOUND'));

  it('🔴 PATCH σε ξένο/ανύπαρκτο χώρο ⇒ 404, χωρίς «σφάλμα» στο log', async () => {
    foreignSpace();
    await expect(patch({ buildingId: 'bld_B' })).rejects.toMatchObject({ statusCode: 404, message: 'Parking spot not found' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('🔴 DELETE σε ξένο/ανύπαρκτο χώρο ⇒ 404', async () => {
    foreignSpace();
    const request = { url: 'http://localhost/api/parking/park_1' } as unknown as NextRequest;
    await expect(buildDeleteHandler(cfg)(request, CALLER, {} as PermissionCache)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('πραγματική βλάβη (όχι άρνηση) μένει 500 και καταγράφεται', async () => {
    requireInTenant.mockRejectedValue(new Error('database on fire'));
    await expect(patch({ buildingId: 'bld_B' })).rejects.toMatchObject({ statusCode: 500 });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
