/**
 * Department Keyword Resolver — Unit Tests (ADR-326 Phase 7)
 *
 * Covers Greek-keyword detection + L1 orgStructure routing cascade
 * (head → backup → dept-level).
 */

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/services/org-structure/org-structure-repository', () => ({
  getOrgStructure: jest.fn(),
}));

import {
  detectDepartmentKeyword,
  tryResolveDepartmentEmail,
} from '../department-keyword-resolver';

const repo = jest.requireMock('@/services/org-structure/org-structure-repository');

function makeOrg(deptOverride: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'org_001',
    departments: [
      {
        id: 'odep_acc',
        code: 'accounting',
        label: 'Λογιστήριο',
        emails: [{ email: 'centralino@acc.test', type: 'work', isPrimary: true }],
        members: [
          {
            id: 'omem_head',
            displayName: 'Δήμητρα',
            role: 'head',
            isDepartmentHead: true,
            receivesNotifications: true,
            reportsTo: null,
            mode: 'plain', contactId: null, userId: null,
            emails: [{ email: 'head@acc.test', type: 'work', isPrimary: true }],
            phones: [], status: 'active',
          },
        ],
        status: 'active',
        ...deptOverride,
      },
    ],
    notificationRouting: [],
    updatedAt: new Date(),
    updatedBy: 'usr_test',
  };
}

describe('detectDepartmentKeyword', () => {
  test.each([
    ['στείλε email στο λογιστήριο', 'accounting'],
    ['Στείλε στους μηχανικούς', 'engineering'],
    ['Ποιοι κάνουν τις μελέτες;', 'architecture_studies'],
    ['στο νομικό τμήμα', 'legal'],
    ['πες στο HR', 'hr'],
    ['στις προμήθειες', 'procurement'],
    ['no department here', null],
  ])('"%s" → %s', (input, expected) => {
    expect(detectDepartmentKeyword(input)).toBe(expected);
  });

  test('empty message returns null', () => {
    expect(detectDepartmentKeyword('')).toBeNull();
  });
});

describe('tryResolveDepartmentEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when no keyword matches', async () => {
    const r = await tryResolveDepartmentEmail('hello world', 'comp_001', 'req_1');
    expect(r).toBeNull();
    expect(repo.getOrgStructure).not.toHaveBeenCalled();
  });

  test('returns null when orgStructure missing', async () => {
    repo.getOrgStructure.mockResolvedValue(null);
    const r = await tryResolveDepartmentEmail('στο λογιστήριο', 'comp_001', 'req_1');
    expect(r).toBeNull();
  });

  test('resolves to head primary email when present', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrg());
    const r = await tryResolveDepartmentEmail('στείλε στο λογιστήριο', 'comp_001', 'req_1');
    expect(r).toEqual({
      email: 'head@acc.test',
      departmentCode: 'accounting',
      source: 'head',
      memberDisplayName: 'Δήμητρα',
    });
  });

  test('falls back to backup when head has no email', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrg({
      members: [
        {
          id: 'omem_head', displayName: 'Δήμητρα', role: 'head',
          isDepartmentHead: true, receivesNotifications: false, reportsTo: null,
          mode: 'plain', contactId: null, userId: null,
          emails: [], phones: [], status: 'active',
        },
        {
          id: 'omem_backup', displayName: 'Backup', role: 'senior',
          isDepartmentHead: false, receivesNotifications: true, reportsTo: 'omem_head',
          mode: 'plain', contactId: null, userId: null,
          emails: [{ email: 'backup@acc.test', type: 'work', isPrimary: true }],
          phones: [], status: 'active',
        },
      ],
    }));
    const r = await tryResolveDepartmentEmail('στο λογιστήριο', 'comp_001', 'req_1');
    expect(r?.source).toBe('backup');
    expect(r?.email).toBe('backup@acc.test');
  });

  test('falls back to dept-level email when no head/backup email', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrg({
      members: [
        {
          id: 'omem_head', displayName: 'Δήμητρα', role: 'head',
          isDepartmentHead: true, receivesNotifications: false, reportsTo: null,
          mode: 'plain', contactId: null, userId: null,
          emails: [], phones: [], status: 'active',
        },
      ],
    }));
    const r = await tryResolveDepartmentEmail('στο λογιστήριο', 'comp_001', 'req_1');
    expect(r?.source).toBe('dept');
    expect(r?.email).toBe('centralino@acc.test');
  });

  test('returns null when department archived', async () => {
    repo.getOrgStructure.mockResolvedValue(makeOrg({ status: 'archived' }));
    const r = await tryResolveDepartmentEmail('στο λογιστήριο', 'comp_001', 'req_1');
    expect(r).toBeNull();
  });
});
