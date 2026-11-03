/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ — **ποιος διαχειρίζεται συμφωνητικό υπεργολαβίας** (ADR-928 §5.15 · ADR-926).
 *
 * Τρέχουν το πραγματικό `withAuth`, το πραγματικό `checkPermission`, ο πραγματικός κατάλογος ρόλων, ο πραγματικός πόρος
 * (`agreement-resource.server.ts`) και ο πραγματικός φράχτης έργου. Αντικαθίστανται μόνο τα άκρα: ταυτότητα, ιδιότητα
 * μέλους, ανάγνωση συμφωνητικού και οι γραφείς. Το αναμενόμενο είναι **χειρόγραφο** (OWASP Authorization Testing
 * Automation): αν βγαίνει από τον κατάλογο, μια λάθος παραχώρηση μετακινεί και τις δύο πλευρές.
 *
 * Πρακτική: AIA A421 (κύρια σύμβαση, εταιρεία) + A422 (εντολή εργασίας, έργο) · Procore Commitments (έργο).
 */

/* global describe, it, expect, beforeEach, jest */

import { NextRequest } from 'next/server';
import { buildRequestContext } from '@/lib/auth/auth-context';
import { readProjectMember, type ProjectMemberRead } from '@/lib/auth/project-member-read';
import { PREDEFINED_ROLES } from '@/lib/auth/role-catalogue';
import type { GlobalRole } from '@/lib/auth/types';
import { readAgreementForAuthorization } from '@/server/subcontracts/subcontract-store.server';
import { sampleDraftInput } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import * as agreementsRoute from '../agreements/route';
import * as agreementRoute from '../agreements/[id]/route';
import * as transitionRoute from '../agreements/[id]/transitions/[transition]/route';
import * as assignmentsRoute from '../agreements/[id]/assignments/route';
import * as decideRoute from '../agreements/[id]/deviations/decide/route';
import { seedTenantDocuments } from '../../buildings/__tests__/tenant-fake-firestore.fixture';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/auth/auth-context', () => ({ buildRequestContext: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/firebaseAdmin', () => {
  const { tenantFakeDb } = jest.requireActual('../../buildings/__tests__/tenant-fake-firestore.fixture');
  return { getAdminFirestore: () => tenantFakeDb(), isFirebaseAdminAvailable: () => true, getAdminAuth: jest.fn() };
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
jest.mock('@/server/subcontracts/subcontract-store.server', () => ({ readAgreementForAuthorization: jest.fn() }));
jest.mock('@/server/subcontracts/agreement-writer.server', () => ({
  createSubcontractAgreement: jest.fn(async () => ({ id: 'sca_new' })),
  updateSubcontractAgreementDraft: jest.fn(async () => ({ id: 'sca_x' })),
  addSubcontractAgreementAssignment: jest.fn(async () => ({ id: 'scas_new' })),
}));
jest.mock('@/server/subcontracts/agreement-lifecycle-writer.server', () => ({
  transitionSubcontractAgreement: jest.fn(async () => ({ id: 'sca_x' })),
}));
jest.mock('@/server/subcontracts/agreement-deviation-writer.server', () => ({
  decideSubcontractAgreementDeviation: jest.fn(async () => ({ id: 'sca_x' })),
}));

type Route = (request: NextRequest, segment?: unknown) => Promise<Response>;

/** 🔑 Χειρόγραφη πολιτική: ο μόνος ρόλος έργου που γράφει συμφωνητικά (§5.15). */
const SUBCONTRACT_PROJECT_WRITERS: readonly string[] = ['project_manager'];

const PROJECT_ROLE_IDS = Object.entries(PREDEFINED_ROLES).filter(([, role]) => role.isProjectRole).map(([id]) => id);

const AGREEMENTS: Readonly<Record<string, { companyId: string; scope: unknown }>> = {
  sca_single: { companyId: 'co_a', scope: { kind: 'single_project', project: { projectId: 'prj_a' } } },
  sca_master: { companyId: 'co_a', scope: { kind: 'multi_project', assignments: [] } },
};

function requestOf(method: string, pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });
}

const singleDraft = (projectId: string) => sampleDraftInput({ scope: { kind: 'single_project', projectId, buildingIds: [] } });
const masterDraft = () => sampleDraftInput({ scope: { kind: 'multi_project' } });

const create = (draft: unknown) => (agreementsRoute.POST as unknown as Route)(requestOf('POST', '/api/subcontracts/agreements', { draft }));
const edit = (id: string, draft: unknown) =>
  (agreementRoute.PATCH as unknown as Route)(requestOf('PATCH', `/api/subcontracts/agreements/${id}`, { expectedRevision: 1, draft }), { params: Promise.resolve({ id }) });
const issue = (id: string) =>
  (transitionRoute.POST as unknown as Route)(requestOf('POST', `/api/subcontracts/agreements/${id}/transitions/issue`, { expectedRevision: 1 }), { params: Promise.resolve({ id, transition: 'issue' }) });
const assign = (id: string, projectId: string) =>
  (assignmentsRoute.POST as unknown as Route)(
    requestOf('POST', `/api/subcontracts/agreements/${id}/assignments`, { expectedRevision: 1, projectId, buildingIds: [], startDate: null, durationDays: null, note: null }),
    { params: Promise.resolve({ id }) },
  );
const decide = (id: string) =>
  (decideRoute.POST as unknown as Route)(
    requestOf('POST', `/api/subcontracts/agreements/${id}/deviations/decide`, { expectedRevision: 1, clauseKey: 'payment.instruments', parameterKey: 'instrument', decision: 'approved', reason: null }),
    { params: Promise.resolve({ id }) },
  );

function signIn(globalRole: GlobalRole): void {
  (buildRequestContext as jest.Mock).mockResolvedValue({
    uid: 'u_a', email: 'a@a.gr', companyId: 'co_a', globalRole, mfaEnrolled: true, isAuthenticated: true,
  });
}

function memberOf(memberships: Readonly<Record<string, string>>): void {
  (readProjectMember as jest.Mock).mockImplementation(async ({ projectId }: { projectId: string }): Promise<ProjectMemberRead> => {
    const roleId = memberships[projectId];
    if (roleId === undefined) return { outcome: 'absent' };
    return { outcome: 'member', member: { roleId, permissionSetIds: [], effectivePermissions: [] } as never };
  });
}

/** Ως `internal_user`, PM στο `prj_a` μόνο. */
function asProjectManagerOfA(): void {
  signIn('internal_user');
  memberOf({ prj_a: 'project_manager' });
}

beforeEach(() => {
  (readProjectMember as jest.Mock).mockReset();
  (readProjectMember as jest.Mock).mockResolvedValue({ outcome: 'absent' });
  (readAgreementForAuthorization as jest.Mock).mockImplementation(async (ctx: { companyId: string }, id: string) => {
    const agreement = AGREEMENTS[id];
    return agreement && agreement.companyId === ctx.companyId ? agreement : null;
  });
  seedTenantDocuments({
    projects: {
      prj_a: { companyId: 'co_a', name: 'Δικό μου' },
      prj_c: { companyId: 'co_a', name: 'Άλλο δικό μου' },
      prj_b: { companyId: 'co_b', name: 'Ξένο' },
    },
  });
});

describe('Σ1 — η εταιρεία', () => {
  it('Σ1.1 — ο company_admin κάνει όλες τις πράξεις, και κύρια σύμβαση', async () => {
    signIn('company_admin');
    expect((await create(masterDraft())).status).toBe(201);
    expect((await create(singleDraft('prj_a'))).status).toBe(201);
    expect((await issue('sca_master')).status).toBe(200);
    expect((await decide('sca_single')).status).toBe(200);
  });

  it('Σ1.2 — internal_user χωρίς ρόλο έργου ⇒ 403 παντού', async () => {
    signIn('internal_user');
    expect((await create(singleDraft('prj_a'))).status).toBe(403);
    expect((await issue('sca_single')).status).toBe(403);
    expect((await assign('sca_master', 'prj_a')).status).toBe(403);
  });
});

describe('Σ2 — ο ρόλος έργου ισχύει στο ΔΙΚΟ του έργο', () => {
  for (const roleId of PROJECT_ROLE_IDS) {
    const allowed = SUBCONTRACT_PROJECT_WRITERS.includes(roleId);
    it(`Σ2.1 — μέλος ${roleId} του prj_a: γέννηση single ⇒ ${allowed ? '201' : '403'}`, async () => {
      signIn('internal_user');
      memberOf({ prj_a: roleId });
      expect((await create(singleDraft('prj_a'))).status).toBe(allowed ? 201 : 403);
    });
  }

  it('Σ2.2 — PM: πρόχειρο και μετάβαση στο έργο του ⇒ επιτρέπεται', async () => {
    asProjectManagerOfA();
    expect((await edit('sca_single', singleDraft('prj_a'))).status).toBe(200);
    expect((await issue('sca_single')).status).toBe(200);
  });

  it('Σ2.3 — PM: γέννηση σε άλλο έργο ⇒ 403', async () => {
    asProjectManagerOfA();
    expect((await create(singleDraft('prj_c'))).status).toBe(403);
  });
});

describe('Σ3 — η κύρια σύμβαση είναι της εταιρείας', () => {
  it('Σ3.1 — PM: γέννηση multi_project ⇒ 403', async () => {
    asProjectManagerOfA();
    expect((await create(masterDraft())).status).toBe(403);
  });

  it('Σ3.2 — PM: πλαστό `projectId` σε σώμα multi_project δεν δίνει έργο ⇒ 403', async () => {
    asProjectManagerOfA();
    const forged = { ...masterDraft(), scope: { kind: 'multi_project', projectId: 'prj_a' } };
    expect((await create(forged)).status).toBe(403);
  });

  it('Σ3.3 — PM: μετάβαση κύριας σύμβασης ⇒ 403', async () => {
    asProjectManagerOfA();
    expect((await issue('sca_master')).status).toBe(403);
  });

  it('Σ3.4 — PM: πρόχειρο που μετακομίζει σε άλλο έργο ή γίνεται κύρια σύμβαση ⇒ 403', async () => {
    asProjectManagerOfA();
    expect((await edit('sca_single', singleDraft('prj_c'))).status).toBe(403);
    expect((await edit('sca_single', masterDraft())).status).toBe(403);
  });
});

describe('Σ4 — εντολή εργασίας στο έργο-στόχο (AIA A422)', () => {
  it('Σ4.1 — PM: ανάθεση της κύριας σύμβασης στο έργο του ⇒ 201', async () => {
    asProjectManagerOfA();
    expect((await assign('sca_master', 'prj_a')).status).toBe(201);
  });

  it('Σ4.2 — PM: ανάθεση σε άλλο έργο ⇒ 403', async () => {
    asProjectManagerOfA();
    expect((await assign('sca_master', 'prj_c')).status).toBe(403);
  });
});

describe('Σ5 — έγκριση απόκλισης μόνο από την εταιρεία', () => {
  it('Σ5.1 — PM του έργου του εγγράφου ⇒ 403', async () => {
    asProjectManagerOfA();
    expect((await decide('sca_single')).status).toBe(403);
  });
});

describe('Σ6 — ξένος χώρος: 404 πριν από κρίση ρόλου', () => {
  it('Σ6.1 — συμφωνητικό που δεν υπάρχει/ξένο ⇒ 404, ακόμη και για company_admin', async () => {
    signIn('company_admin');
    expect((await issue('sca_foreign')).status).toBe(404);
  });

  it('Σ6.2 — γέννηση σε ξένο έργο ⇒ 404', async () => {
    signIn('company_admin');
    expect((await create(singleDraft('prj_b'))).status).toBe(404);
  });

  it('Σ6.3 — ανάθεση σε ξένο έργο ⇒ 404', async () => {
    signIn('company_admin');
    expect((await assign('sca_master', 'prj_b')).status).toBe(404);
  });
});
