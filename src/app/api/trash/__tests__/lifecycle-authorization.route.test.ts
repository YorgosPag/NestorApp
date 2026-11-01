/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **ποιος βγάζει κάτι από τον κάδο** (ADR-926 §4).
 *
 * Τρέχουν το πραγματικό `withAuth`, ο πραγματικός κριτής, ο πραγματικός κατάλογος ρόλων και οι πραγματικές διαδρομές.
 * Αντικαθίστανται τα άκρα: ταυτότητα, βάση, μηχανή κύκλου ζωής, αναγνώστης μέλους.
 *
 * 🔴 Μέχρι τις 2026-11-02 το `DELETE /api/trash/.../permanent-delete` και το `POST /api/trash/.../restore` ζητούσαν μόνο
 * σύνδεση: κάθε συνδεδεμένος του χώρου έσβηνε οριστικά ό,τι βρισκόταν στον κάδο.
 */

/* global describe, it, expect, beforeEach, jest */

import { NextRequest } from 'next/server';
import { logAuditEvent } from '@/lib/auth/audit';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { readProjectMember } from '@/lib/auth/project-member-read';
import type { GlobalRole } from '@/lib/auth/types';
import { permanentDelete, restoreFromTrash } from '@/lib/firestore/soft-delete-engine';
import { seedTenantDocuments } from '@/app/api/buildings/__tests__/tenant-fake-firestore.fixture';
import * as permanentDeleteRoute from '../[entityType]/[entityId]/permanent-delete/route';
import * as restoreRoute from '../[entityType]/[entityId]/restore/route';
import * as contactPermanentDeleteRoute from '../../contacts/[contactId]/permanent-delete/route';
import * as deletionGuardRoute from '../../deletion-guard/[entityType]/[entityId]/route';
import * as capabilitiesRoute from '../../projects/[projectId]/viewer-capabilities/route';
import * as landownerRoute from '../../projects/[projectId]/landowner-unlink-check/route';

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
  logAuditEvent: jest.fn(async () => undefined),
}));
jest.mock('@/lib/auth/project-member-read', () => ({
  ...jest.requireActual('@/lib/auth/project-member-read'),
  readProjectMember: jest.fn(async () => ({ outcome: 'absent' })),
}));
jest.mock('@/lib/firestore/soft-delete-engine', () => ({
  permanentDelete: jest.fn(async () => ({ success: true })),
  restoreFromTrash: jest.fn(async () => ({ restoredStatus: 'active' })),
}));
jest.mock('@/lib/firestore/deletion-guard', () => ({
  checkDeletionDependencies: jest.fn(async () => ({ allowed: true, dependencies: [], message: 'ok' })),
  isArchiveOffered: () => false,
}));
jest.mock('@/app/api/projects/_shared/project-cache', () => ({ invalidateProjectCaches: jest.fn() }));

type Route = (request: NextRequest, segment?: unknown) => Promise<Response>;

const ORIGIN = 'http://localhost';
const requestOf = (method: string, pathname: string): NextRequest => new NextRequest(`${ORIGIN}${pathname}`, { method });

function signIn(globalRole: GlobalRole, permissions?: readonly string[]): void {
  (buildRequestContext as jest.Mock).mockResolvedValue({
    uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole, mfaEnrolled: true, isAuthenticated: true, permissions,
  });
}

function projectManagerOf(projectId: string): void {
  (readProjectMember as jest.Mock).mockImplementation(async (query: { projectId: string }) => (
    query.projectId === projectId
      ? { outcome: 'member', member: { roleId: 'project_manager', permissionSetIds: [], effectivePermissions: [] } }
      : { outcome: 'absent' }
  ));
}

const entitySegment = (entityType: string, entityId: string) => ({ params: Promise.resolve({ entityType, entityId }) });

const purge = (entityType: string, entityId: string): Promise<Response> =>
  (permanentDeleteRoute.DELETE as unknown as Route)(
    requestOf('DELETE', `/api/trash/${entityType}/${entityId}/permanent-delete`), entitySegment(entityType, entityId));

const restore = (entityType: string, entityId: string): Promise<Response> =>
  (restoreRoute.POST as unknown as Route)(
    requestOf('POST', `/api/trash/${entityType}/${entityId}/restore`), entitySegment(entityType, entityId));

const purgeContact = (): Promise<Response> =>
  (contactPermanentDeleteRoute.DELETE as unknown as Route)(
    requestOf('DELETE', '/api/contacts/cont_a/permanent-delete'), { params: Promise.resolve({ contactId: 'cont_a' }) });

const guard = (entityType: string, entityId: string): Promise<Response> =>
  (deletionGuardRoute.GET as unknown as Route)(requestOf('GET', `/api/deletion-guard/${entityType}/${entityId}`));

const capabilities = (projectId: string): Promise<Response> =>
  (capabilitiesRoute.GET as unknown as Route)(
    requestOf('GET', `/api/projects/${projectId}/viewer-capabilities`), { params: Promise.resolve({ projectId }) });

beforeEach(() => {
  (permanentDelete as jest.Mock).mockClear();
  (restoreFromTrash as jest.Mock).mockClear();
  (logAuditEvent as jest.Mock).mockClear();
  (readProjectMember as jest.Mock).mockReset();
  (readProjectMember as jest.Mock).mockResolvedValue({ outcome: 'absent' });
  seedTenantDocuments({
    projects: {
      prj_a: { companyId: 'co_a', linkedCompanyId: 'cont_a', name: 'Δικό μου' },
      prj_b: { companyId: 'co_b', linkedCompanyId: 'cont_b', name: 'Ξένο' },
    },
    buildings: {
      bld_p: { companyId: 'co_a', name: 'Στο έργο', projectId: 'prj_a', status: 'deleted' },
      bld_a: { companyId: 'co_a', name: 'Χωρίς έργο', projectId: null, status: 'deleted' },
      bld_b: { companyId: 'co_b', name: 'Ξένο', projectId: 'prj_b', status: 'deleted' },
    },
    contacts: { cont_a: { companyId: 'co_a', firstName: 'Α', status: 'deleted' } },
  });
});

describe('Οριστική διαγραφή — μόνο ο `company_admin` (§4)', () => {
  for (const entityType of ['building', 'project', 'property', 'contact'] as const) {
    for (const role of ['internal_user', 'external_user'] as const) {
      it(`${entityType} · ${role} ⇒ 403, η μηχανή δεν καλείται`, async () => {
        signIn(role);
        expect((await purge(entityType, 'bld_p')).status).toBe(403);
        expect(permanentDelete).not.toHaveBeenCalled();
      });
    }
  }

  it('ο `project_manager` του έργου δεν σβήνει οριστικά, ούτε το κτίριο του έργου του', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    expect((await purge('building', 'bld_p')).status).toBe(403);
    expect(permanentDelete).not.toHaveBeenCalled();
  });

  it('`company_admin` ⇒ περνά', async () => {
    signIn('company_admin');
    expect((await purge('building', 'bld_p')).status).toBeLessThan(300);
    expect(permanentDelete).toHaveBeenCalledTimes(1);
  });

  it('η διαδρομή επαφής ζητά το ίδιο δικαίωμα: το `crm:contacts:delete` δεν αρκεί', async () => {
    signIn('internal_user', ['crm:contacts:delete']);
    expect((await purgeContact()).status).toBe(403);

    signIn('company_admin');
    expect((await purgeContact()).status).toBeLessThan(300);
  });
});

describe('Επαναφορά — όποιος στέλνει στον κάδο', () => {
  it('ο PM του έργου επαναφέρει το κτίριό του', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    expect((await restore('building', 'bld_p')).status).toBeLessThan(300);
    expect(restoreFromTrash).toHaveBeenCalledTimes(1);
    expect((logAuditEvent as jest.Mock).mock.calls.filter(([, action]) => action === 'project_role_exercised')).toHaveLength(1);
  });

  it('μη μέλος ⇒ 403', async () => {
    signIn('internal_user');
    expect((await restore('building', 'bld_p')).status).toBe(403);
    expect(restoreFromTrash).not.toHaveBeenCalled();
  });

  it('Κ4 — κτίριο χωρίς έργο: ο PM άλλου έργου ⇒ 403', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    expect((await restore('building', 'bld_a')).status).toBe(403);
    expect(restoreFromTrash).not.toHaveBeenCalled();
  });

  it('ξένο κτίριο ⇒ 404, χωρίς κρίση ρόλου', async () => {
    signIn('company_admin');
    expect((await restore('building', 'bld_b')).status).toBe(404);
    expect(restoreFromTrash).not.toHaveBeenCalled();
  });

  it('`internal_user` δεν επαναφέρει οντότητα που δεν στέλνει στον κάδο', async () => {
    signIn('internal_user');
    expect((await restore('property', 'prop_a')).status).toBe(403);
    expect(restoreFromTrash).not.toHaveBeenCalled();
  });

  it('`company_admin` ⇒ περνά', async () => {
    signIn('company_admin');
    expect((await restore('building', 'bld_p')).status).toBeLessThan(300);
  });
});

describe('Προεπισκόπηση εξαρτήσεων — ίδια απάντηση με τη διαγραφή', () => {
  it('ο PM του έργου τη βλέπει', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    expect((await guard('building', 'bld_p')).status).toBeLessThan(300);
  });

  it('μη μέλος ⇒ 403 · ξένο ⇒ 404', async () => {
    signIn('internal_user');
    expect((await guard('building', 'bld_p')).status).toBe(403);
    expect((await guard('building', 'bld_b')).status).toBe(404);
  });

  it('ο όροφος δεν ανοίγει με ρόλο έργου: η διαγραφή του είναι οριστική', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    expect((await guard('floor', 'flr_p')).status).toBe(403);
  });
});

describe('Έλεγχος αποσύνδεσης οικοπεδούχου — ο φράχτης πριν από τον αθροιστικό κριτή', () => {
  it('ξένο έργο ⇒ 404, και για τον `company_admin`', async () => {
    signIn('company_admin');
    const response = await (landownerRoute.GET as unknown as Route)(
      requestOf('GET', '/api/projects/prj_b/landowner-unlink-check?contactId=c1'), { params: Promise.resolve({ projectId: 'prj_b' }) });

    expect(response.status).toBe(404);
  });
});

describe('Κ7 — `viewerCapabilities`', () => {
  const answerOf = async (projectId: string): Promise<Record<string, boolean>> => {
    const body = await (await capabilities(projectId)).json() as { data: { viewerCapabilities: Record<string, boolean> } };
    return body.data.viewerCapabilities;
  };

  it('PM του έργου: οι πράξεις δομής ναι, η οριστική διαγραφή και ο όροφος δεν υπάρχουν καν στην απάντηση', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    const answer = await answerOf('prj_a');

    expect(answer['buildings:buildings:update']).toBe(true);
    expect(answer['projects:floors:create']).toBe(true);
    expect(answer).not.toHaveProperty('trash:entities:purge');
    expect(answer).not.toHaveProperty('projects:floors:delete');
  });

  it('μη μέλος: όλα όχι, από τον ίδιο κριτή', async () => {
    signIn('internal_user');
    expect(Object.values(await answerOf('prj_a')).every((granted) => granted === false)).toBe(true);
  });

  it('το έγγραφο μέλους διαβάζεται μία φορά ανά αίτημα', async () => {
    signIn('internal_user');
    projectManagerOf('prj_a');
    await answerOf('prj_a');
    expect(readProjectMember).toHaveBeenCalledTimes(1);
  });

  it('ξένο έργο ⇒ 404', async () => {
    signIn('company_admin');
    expect((await capabilities('prj_b')).status).toBe(404);
  });
});
