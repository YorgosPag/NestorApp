import type { OrgMember, OrgNode } from '@/types/org/org-structure';

export class OrgStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgStructureError';
  }
}

/**
 * Builds a read-side tree from a flat OrgMember array using the manager-pointer pattern (ADR-326 §3.11).
 * Pure function — no side effects. Orphaned members (unreachable from head) are excluded.
 * Cycle detection is a pre-condition: run validateOrgHierarchy before writing, not here.
 */
export function buildOrgTree(members: OrgMember[]): OrgNode {
  if (members.length === 0) throw new OrgStructureError('No members in department');

  const head = members.find((m) => m.isDepartmentHead && m.reportsTo === null);
  if (!head) throw new OrgStructureError('No department head found');

  const childrenByParent = new Map<string, OrgMember[]>();
  for (const m of members) {
    if (m.reportsTo) {
      const arr = childrenByParent.get(m.reportsTo) ?? [];
      arr.push(m);
      childrenByParent.set(m.reportsTo, arr);
    }
  }

  return assembleNode(head, childrenByParent, 0);
}

function assembleNode(
  member: OrgMember,
  childrenByParent: Map<string, OrgMember[]>,
  depth: number,
): OrgNode {
  const children = (childrenByParent.get(member.id) ?? []).map((child) =>
    assembleNode(child, childrenByParent, depth + 1),
  );
  return { member, children, depth };
}
