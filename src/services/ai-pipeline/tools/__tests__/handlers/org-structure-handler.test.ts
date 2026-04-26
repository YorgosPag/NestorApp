/**
 * ORG STRUCTURE HANDLER — Unit Tests (ADR-326 Phase 7)
 *
 * Covers all 5 agentic tools:
 *   - query_org_structure
 *   - get_department_head
 *   - find_department_member
 *   - traverse_hierarchy
 *   - resolve_routing_email
 *
 * Plus tenant isolation (L2 scope) and admin-only enforcement.
 */

import '../setup';

import { OrgStructureHandler } from '../../handlers/org-structure-handler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore, type MockFirestoreKit } from '../test-utils/mock-firestore';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

jest.mock('@/services/org-structure/org-structure-repository', () => ({
  getOrgStructure: jest.fn(),
  getContactOrgStructure: jest.fn(),
}));

jest.mock('@/services/org-structure/org-routing-resolver', () => ({
  resolveTenantNotificationEmail: jest.fn(),
  resolveContactDepartmentEmail: jest.fn(),
}));

const repo = jest.requireMock('@/services/org-structure/org-structure-repository');
const resolver = jest.requireMock('@/services/org-structure/org-routing-resolver');

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'omem_001',
    displayName: 'Παπαδόπουλος Ι.',
    mode: 'linked',
    contactId: null,
    userId: null,
    role: 'employee',
    positionLabel: null,
    reportsTo: null,
    isDepartmentHead: false,
    receivesNotifications: false,
    emails: [],
    phones: [],
    status: 'active',
    ...overrides,
  };
}

function makeOrgStructure(): Record<string, unknown> {
  const head = makeMember({
    id: 'omem_head_acc',
    displayName: 'Δήμητρα Λογιστή',
    role: 'head',
    isDepartmentHead: true,
    receivesNotifications: true,
    emails: [{ email: 'head@accounting.test', type: 'work', isPrimary: true }],
  });
  const senior = makeMember({
    id: 'omem_senior_acc',
    displayName: 'Νίκος Senior',
    role: 'senior',
    reportsTo: 'omem_head_acc',
    emails: [{ email: 'nikos@accounting.test', type: 'work', isPrimary: true }],
  });
  const junior = makeMember({
    id: 'omem_jr_acc',
    displayName: 'Γιάννης Junior',
    role: 'employee',
    reportsTo: 'omem_senior_acc',
  });
  const engHead = makeMember({
    id: 'omem_head_eng',
    displayName: 'Κώστας Μηχανικός',
    role: 'head',
    isDepartmentHead: true,
    receivesNotifications: true,
    emails: [{ email: 'head@eng.test', type: 'work', isPrimary: true }],
  });

  return {
    id: 'org_001',
    departments: [
      {
        id: 'odep_acc',
        code: 'accounting',
        label: 'Λογιστήριο',
        emails: [{ email: 'centralino@accounting.test', type: 'work', isPrimary: true }],
        members: [head, senior, junior],
        status: 'active',
      },
      {
        id: 'odep_eng',
        code: 'engineering',
        label: null,
        emails: [],
        members: [engHead],
        status: 'active',
      },
    ],
    notificationRouting: [],
    updatedAt: new Date(),
    updatedBy: 'usr_test',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OrgStructureHandler', () => {
  let handler: OrgStructureHandler;
  let mockDb: MockFirestoreKit;

  beforeEach(() => {
    handler = new OrgStructureHandler();
    mockDb = createMockFirestore();
    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb.instance);
    jest.clearAllMocks();
  });

  // -- Admin-only enforcement -------------------------------------------------

  test('rejects non-admin context for every tool', async () => {
    const ctx = createCustomerContext();
    for (const tool of ['query_org_structure', 'get_department_head', 'find_department_member', 'traverse_hierarchy', 'resolve_routing_email']) {
      const r = await handler.execute(tool, { scope: 'tenant' }, ctx);
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/admin-only/);
    }
  });

  // -- query_org_structure ---------------------------------------------------

  test('query_org_structure: tenant scope returns departments + members', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute('query_org_structure', { scope: 'tenant' }, createAdminContext());
    expect(r.success).toBe(true);
    const data = r.data as { departments: Array<Record<string, unknown>>; totalMembers: number };
    expect(data.departments).toHaveLength(2);
    expect(data.totalMembers).toBe(4);
  });

  test('query_org_structure: returns "no org structure" when missing', async () => {
    repo.getOrgStructure.mockResolvedValue(null);
    const r = await handler.execute('query_org_structure', { scope: 'tenant' }, createAdminContext());
    expect(r.success).toBe(true);
    expect((r.data as { found: boolean }).found).toBe(false);
  });

  test('query_org_structure: contact scope without contactId fails', async () => {
    const r = await handler.execute('query_org_structure', { scope: 'contact' }, createAdminContext());
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/contactId/);
  });

  test('query_org_structure: contact scope verifies tenant ownership', async () => {
    mockDb.seedCollection('contacts', { 'cont_evil': { companyId: 'OTHER_TENANT' } });
    const r = await handler.execute(
      'query_org_structure',
      { scope: 'contact', contactId: 'cont_evil' },
      createAdminContext(),
    );
    expect(r.success).toBe(true);
    expect((r.data as { found: boolean }).found).toBe(false);
    expect(repo.getContactOrgStructure).not.toHaveBeenCalled();
  });

  test('query_org_structure: contact scope reads when ownership matches', async () => {
    mockDb.seedCollection('contacts', { 'cont_ok': { companyId: 'test-company-001' } });
    repo.getContactOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'query_org_structure',
      { scope: 'contact', contactId: 'cont_ok' },
      createAdminContext(),
    );
    expect(r.success).toBe(true);
    expect(repo.getContactOrgStructure).toHaveBeenCalledWith('cont_ok');
  });

  // -- get_department_head ---------------------------------------------------

  test('get_department_head: returns head by canonical code', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'get_department_head',
      { scope: 'tenant', departmentCode: 'accounting' },
      createAdminContext(),
    );
    expect(r.success).toBe(true);
    const data = r.data as { found: boolean; member: { displayName: string; primaryEmail: string } };
    expect(data.found).toBe(true);
    expect(data.member.displayName).toBe('Δήμητρα Λογιστή');
    expect(data.member.primaryEmail).toBe('head@accounting.test');
  });

  test('get_department_head: returns head by Greek label', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'get_department_head',
      { scope: 'tenant', label: 'Λογιστήριο' },
      createAdminContext(),
    );
    const data = r.data as { found: boolean; member: { displayName: string } };
    expect(data.found).toBe(true);
    expect(data.member.displayName).toBe('Δήμητρα Λογιστή');
  });

  test('get_department_head: missing department arg fails', async () => {
    const r = await handler.execute('get_department_head', { scope: 'tenant' }, createAdminContext());
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/departmentCode or label/);
  });

  // -- find_department_member ------------------------------------------------

  test('find_department_member: substring match across departments', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'find_department_member',
      { scope: 'tenant', query: 'senior' },
      createAdminContext(),
    );
    const data = r.data as { matches: Array<Record<string, unknown>> };
    expect(data.matches.length).toBeGreaterThan(0);
    expect(data.matches.some(m => (m.member as { id: string }).id === 'omem_senior_acc')).toBe(true);
  });

  test('find_department_member: empty query fails', async () => {
    const r = await handler.execute('find_department_member', { scope: 'tenant' }, createAdminContext());
    expect(r.success).toBe(false);
  });

  // -- traverse_hierarchy ----------------------------------------------------

  test('traverse_hierarchy: descendants from head returns chain', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'traverse_hierarchy',
      { scope: 'tenant', memberId: 'omem_head_acc', direction: 'descendants', maxDepth: 5 },
      createAdminContext(),
    );
    const data = r.data as { found: boolean; results: Array<{ depth: number; member: { id: string } }> };
    expect(data.found).toBe(true);
    expect(data.results.map(r => r.member.id)).toEqual(['omem_senior_acc', 'omem_jr_acc']);
  });

  test('traverse_hierarchy: ascendants from junior reaches head', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'traverse_hierarchy',
      { scope: 'tenant', memberId: 'omem_jr_acc', direction: 'ascendants', maxDepth: 5 },
      createAdminContext(),
    );
    const data = r.data as { found: boolean; results: Array<{ member: { id: string } }> };
    expect(data.found).toBe(true);
    expect(data.results.map(r => r.member.id)).toEqual(['omem_senior_acc', 'omem_head_acc']);
  });

  test('traverse_hierarchy: clamps maxDepth to safety cap', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'traverse_hierarchy',
      { scope: 'tenant', memberId: 'omem_head_acc', direction: 'descendants', maxDepth: 9999 },
      createAdminContext(),
    );
    const data = r.data as { maxDepth: number };
    expect(data.maxDepth).toBeLessThanOrEqual(10);
  });

  test('traverse_hierarchy: unknown member returns found=false', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrgStructure());
    const r = await handler.execute(
      'traverse_hierarchy',
      { scope: 'tenant', memberId: 'omem_ghost', direction: 'descendants' },
      createAdminContext(),
    );
    expect((r.data as { found: boolean }).found).toBe(false);
  });

  // -- resolve_routing_email -------------------------------------------------

  test('resolve_routing_email: tenant event delegates to L1 resolver', async () => {
    resolver.resolveTenantNotificationEmail.mockResolvedValue({
      email: 'acc@tenant.test',
      source: 'head',
      departmentCode: 'accounting',
    });
    const r = await handler.execute(
      'resolve_routing_email',
      { scope: 'tenant', event: 'reservation.created' },
      createAdminContext(),
    );
    expect(r.success).toBe(true);
    expect((r.data as { resolved: boolean; email: string }).resolved).toBe(true);
    expect((r.data as { email: string }).email).toBe('acc@tenant.test');
  });

  test('resolve_routing_email: tenant event with unknown code rejected', async () => {
    const r = await handler.execute(
      'resolve_routing_email',
      { scope: 'tenant', event: 'bogus.event' },
      createAdminContext(),
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Unknown notification event/);
  });

  test('resolve_routing_email: contact scope delegates to L2 resolver', async () => {
    mockDb.seedCollection('contacts', { 'cont_b2b': { companyId: 'test-company-001' } });
    resolver.resolveContactDepartmentEmail.mockResolvedValue({
      email: 'l2@b2b.test',
      source: 'head',
      departmentCode: 'accounting',
    });
    const r = await handler.execute(
      'resolve_routing_email',
      { scope: 'contact', contactId: 'cont_b2b', departmentCode: 'accounting' },
      createAdminContext(),
    );
    expect((r.data as { resolved: boolean; email: string }).resolved).toBe(true);
    expect(resolver.resolveContactDepartmentEmail).toHaveBeenCalledWith('cont_b2b', 'accounting');
  });

  test('resolve_routing_email: contact scope rejects cross-tenant contactId', async () => {
    mockDb.seedCollection('contacts', { 'cont_other': { companyId: 'OTHER_TENANT' } });
    const r = await handler.execute(
      'resolve_routing_email',
      { scope: 'contact', contactId: 'cont_other', departmentCode: 'accounting' },
      createAdminContext(),
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/outside tenant scope/);
  });
});
