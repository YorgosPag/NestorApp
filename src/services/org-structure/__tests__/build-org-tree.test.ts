import { buildOrgTree, OrgStructureError } from '../utils/build-org-tree';
import type { OrgMember } from '@/types/org/org-structure';

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

describe('buildOrgTree', () => {
  it('builds single-node tree for lone head', () => {
    const head = makeMember({ id: 'omem_1', isDepartmentHead: true, reportsTo: null, role: 'head' });
    const tree = buildOrgTree([head]);
    expect(tree.member.id).toBe('omem_1');
    expect(tree.children).toHaveLength(0);
    expect(tree.depth).toBe(0);
  });

  it('builds two-level tree correctly', () => {
    const head = makeMember({ id: 'omem_head', isDepartmentHead: true, reportsTo: null, role: 'head' });
    const emp1 = makeMember({ id: 'omem_emp1', reportsTo: 'omem_head' });
    const emp2 = makeMember({ id: 'omem_emp2', reportsTo: 'omem_head' });
    const tree = buildOrgTree([head, emp1, emp2]);
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].depth).toBe(1);
  });

  it('builds multi-level tree with correct depths', () => {
    const head = makeMember({ id: 'h', isDepartmentHead: true, reportsTo: null, role: 'head' });
    const mgr = makeMember({ id: 'm', reportsTo: 'h', role: 'manager' });
    const emp = makeMember({ id: 'e', reportsTo: 'm' });
    const tree = buildOrgTree([head, mgr, emp]);
    expect(tree.depth).toBe(0);
    expect(tree.children[0].depth).toBe(1);
    expect(tree.children[0].children[0].depth).toBe(2);
  });

  it('throws OrgStructureError when no members', () => {
    expect(() => buildOrgTree([])).toThrow(OrgStructureError);
  });

  it('throws OrgStructureError when no head', () => {
    const emp = makeMember({ id: 'omem_1', isDepartmentHead: false, reportsTo: 'omem_x' });
    expect(() => buildOrgTree([emp])).toThrow(OrgStructureError);
    expect(() => buildOrgTree([emp])).toThrow('No department head found');
  });

  it('excludes orphaned members not reachable from head', () => {
    const head = makeMember({ id: 'h', isDepartmentHead: true, reportsTo: null, role: 'head' });
    const connected = makeMember({ id: 'c', reportsTo: 'h' });
    const orphan = makeMember({ id: 'o', reportsTo: 'nonexistent_id' });
    const tree = buildOrgTree([head, connected, orphan]);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].member.id).toBe('c');
  });
});
