import { validateOrgHierarchy } from '../utils/validate-org-hierarchy';
import type { OrgMember, OrgDepartment } from '@/types/org/org-structure';

function makeMember(overrides: Partial<OrgMember> & { id: string }): OrgMember {
  return {
    displayName: `Member ${overrides.id}`,
    mode: 'plain',
    contactId: null,
    userId: null,
    role: 'employee',
    reportsTo: null,
    isDepartmentHead: false,
    receivesNotifications: false,
    emails: [],
    phones: [],
    status: 'active',
    ...overrides,
  };
}

function makeDept(id: string, code: string): OrgDepartment {
  return {
    id,
    code: code as OrgDepartment['code'],
    members: [],
    status: 'active',
    createdAt: new Date(),
  };
}

const validMembers = (): OrgMember[] => [
  makeMember({ id: 'h', isDepartmentHead: true, reportsTo: null, role: 'head' }),
  makeMember({ id: 'e1', reportsTo: 'h' }),
  makeMember({ id: 'e2', reportsTo: 'h' }),
];

describe('validateOrgHierarchy', () => {
  describe('head invariants', () => {
    it('passes for valid single-head structure', () => {
      const result = validateOrgHierarchy(validMembers());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when no head', () => {
      const members = [makeMember({ id: 'e', reportsTo: 'h' })];
      const result = validateOrgHierarchy(members);
      expect(result.errors).toContain('dept.no_head');
    });

    it('fails when multiple heads', () => {
      const members = [
        makeMember({ id: 'h1', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'h2', isDepartmentHead: true, role: 'head' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors).toContain('dept.multiple_heads');
    });

    it('fails when head has reportsTo set', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, reportsTo: 'other', role: 'head' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('member.head_with_reports_to'))).toBe(true);
    });

    it('fails when non-head has no reportsTo', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'e', reportsTo: null }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('member.missing_reports_to'))).toBe(true);
    });

    it('fails on self-reference', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'e', reportsTo: 'e' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('member.self_reference'))).toBe(true);
    });

    it('fails when reportsTo points outside department', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'e', reportsTo: 'outsider_id' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('member.invalid_reports_to'))).toBe(true);
    });
  });

  describe('cycle detection', () => {
    it('detects A→B→A cycle', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'a', reportsTo: 'b' }),
        makeMember({ id: 'b', reportsTo: 'a' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('dept.cycle'))).toBe(true);
    });

    it('detects A→B→C→A cycle', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'a', reportsTo: 'c' }),
        makeMember({ id: 'b', reportsTo: 'a' }),
        makeMember({ id: 'c', reportsTo: 'b' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('dept.cycle'))).toBe(true);
    });

    it('passes for acyclic tree', () => {
      const result = validateOrgHierarchy(validMembers());
      expect(result.errors.filter((e) => e.startsWith('dept.cycle'))).toHaveLength(0);
    });
  });

  describe('orphan detection', () => {
    it('detects orphaned sub-graph', () => {
      const members = [
        makeMember({ id: 'h', isDepartmentHead: true, role: 'head' }),
        makeMember({ id: 'connected', reportsTo: 'h' }),
        makeMember({ id: 'orphan', reportsTo: 'ghost' }),
      ];
      const result = validateOrgHierarchy(members);
      expect(result.errors.some((e) => e.startsWith('dept.orphans'))).toBe(true);
    });
  });

  describe('depth cap', () => {
    it('rejects depth > 10', () => {
      const head = makeMember({ id: 'm0', isDepartmentHead: true, role: 'head' });
      const chain: OrgMember[] = [head];
      for (let i = 1; i <= 11; i++) {
        chain.push(makeMember({ id: `m${i}`, reportsTo: `m${i - 1}` }));
      }
      const result = validateOrgHierarchy(chain);
      expect(result.errors.some((e) => e.startsWith('dept.depth_exceeded'))).toBe(true);
    });

    it('accepts depth exactly 10', () => {
      const head = makeMember({ id: 'm0', isDepartmentHead: true, role: 'head' });
      const chain: OrgMember[] = [head];
      for (let i = 1; i <= 10; i++) {
        chain.push(makeMember({ id: `m${i}`, reportsTo: `m${i - 1}` }));
      }
      const result = validateOrgHierarchy(chain);
      expect(result.errors.filter((e) => e.startsWith('dept.depth_exceeded'))).toHaveLength(0);
    });
  });

  describe('canonical uniqueness (G6)', () => {
    it('fails when same canonical code appears twice', () => {
      const departments = [makeDept('d1', 'accounting'), makeDept('d2', 'accounting')];
      const result = validateOrgHierarchy([], departments);
      expect(result.errors).toContain('org.canonical_duplicate:accounting');
    });

    it('allows multiple custom departments', () => {
      const departments = [makeDept('d1', 'custom'), makeDept('d2', 'custom')];
      const result = validateOrgHierarchy([], departments);
      expect(result.errors.filter((e) => e.startsWith('org.canonical_duplicate'))).toHaveLength(0);
    });

    it('passes for one department per canonical code', () => {
      const departments = [makeDept('d1', 'accounting'), makeDept('d2', 'legal')];
      const result = validateOrgHierarchy([], departments);
      expect(result.errors.filter((e) => e.startsWith('org.canonical_duplicate'))).toHaveLength(0);
    });
  });
});
