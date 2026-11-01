/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **η πρόταση κωδικού δεν μιλά για ξένο κτίριο** (ADR-829 §7.1).
 *
 * Το `buildingId` έρχεται από το URL και το ερώτημα της ακολουθίας φιλτράρει μόνο με αυτό. Βρέθηκε μετρώντας την κλάση
 * «φίλτρο γονέα χωρίς φράχτη»: ο καλών μάθαινε ύπαρξη, γράμμα και πλήθος ξένου κτιρίου.
 */

/* global describe, it, expect, beforeEach, jest */

import { NextRequest } from 'next/server';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { seedTenantDocuments } from '@/app/api/buildings/__tests__/tenant-fake-firestore.fixture';
import { GET } from '../route';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/auth-context', () => ({ buildRequestContext: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/firebaseAdmin', () => {
  const { tenantFakeDb } = jest.requireActual('@/app/api/buildings/__tests__/tenant-fake-firestore.fixture');
  return { getAdminFirestore: () => tenantFakeDb(), isFirebaseAdminAvailable: () => true, getAdminAuth: jest.fn() };
});
jest.mock('@/lib/api/admin-db', () => {
  const { tenantFakeDb } = jest.requireActual('@/app/api/buildings/__tests__/tenant-fake-firestore.fixture');
  return { requireAdminFirestore: () => tenantFakeDb() };
});
jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T,>(handler: T) => handler }));
jest.mock('@/lib/auth/audit', () => ({
  ...jest.requireActual('@/lib/auth/audit'),
  logAuditEvent: async () => undefined,
}));

type Route = (request: NextRequest) => Promise<Response>;

const suggest = (buildingId: string): Promise<Response> => (GET as unknown as Route)(new NextRequest(
  `http://localhost/api/entity-code/suggest?entityType=storage&buildingId=${buildingId}&floorLevel=0`));

function signIn(globalRole: string): void {
  (buildRequestContext as jest.Mock).mockResolvedValue({
    uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole, mfaEnrolled: true, isAuthenticated: true,
  });
}

beforeEach(() => {
  seedTenantDocuments({
    buildings: {
      bld_a: { companyId: 'co_a', name: 'Κτίριο Α', code: 'Α' },
      bld_b: { companyId: 'co_b', name: 'Κτίριο Β', code: 'Β' },
    },
  });
});

describe('GET /api/entity-code/suggest — ADR-829 §7.1', () => {
  it('δικό μου κτίριο ⇒ πρόταση με το γράμμα του', async () => {
    signIn('internal_user');
    const response = await suggest('bld_a');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"buildingLetter":"A"');
  });

  it('🔴 ξένο κτίριο ⇒ 404, χωρίς το γράμμα του', async () => {
    signIn('company_admin');
    const response = await suggest('bld_b');

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('"buildingLetter"');
  });

  it('ξένο και ανύπαρκτο απαντούν το ίδιο', async () => {
    signIn('company_admin');
    const foreign = await suggest('bld_b');
    const missing = await suggest('bld_missing');

    expect(missing.status).toBe(foreign.status);
  });

  it('ο super_admin περνά το όριο χώρου, δηλωμένα', async () => {
    signIn('super_admin');
    expect((await suggest('bld_b')).status).toBe(200);
  });
});
