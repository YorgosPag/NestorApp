import type { OrgMember, OrgDepartment } from '@/types/org/org-structure';

export interface OrgHierarchyValidation {
  valid: boolean;
  errors: string[];
}

const MAX_DEPTH = 10;

/** Validates head count and reportsTo invariants for a single department's members. */
function validateHeadInvariants(members: OrgMember[]): string[] {
  const errors: string[] = [];
  const heads = members.filter((m) => m.isDepartmentHead);

  if (heads.length === 0) errors.push('dept.no_head');
  if (heads.length > 1) errors.push('dept.multiple_heads');

  for (const h of heads) {
    if (h.reportsTo !== null) errors.push(`member.head_with_reports_to:${h.id}`);
  }

  const memberIds = new Set(members.map((m) => m.id));
  for (const m of members.filter((m) => !m.isDepartmentHead)) {
    if (!m.reportsTo) errors.push(`member.missing_reports_to:${m.id}`);
    else if (m.reportsTo === m.id) errors.push(`member.self_reference:${m.id}`);
    else if (!memberIds.has(m.reportsTo)) errors.push(`member.invalid_reports_to:${m.id}`);
  }

  return errors;
}

/** DFS cycle detection. Returns cycle path string or null if clean. */
function detectCycle(members: OrgMember[]): string | null {
  const childrenOf = new Map<string, string[]>();
  for (const m of members) {
    if (m.reportsTo) {
      const arr = childrenOf.get(m.reportsTo) ?? [];
      arr.push(m.id);
      childrenOf.set(m.reportsTo, arr);
    }
  }
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(id: string): string | null {
    if (stack.has(id)) return id;
    if (visited.has(id)) return null;
    visited.add(id);
    stack.add(id);
    for (const child of childrenOf.get(id) ?? []) {
      const cycle = dfs(child);
      if (cycle) return cycle;
    }
    stack.delete(id);
    return null;
  }

  for (const m of members) {
    const cycle = dfs(m.id);
    if (cycle) return cycle;
  }
  return null;
}

/** BFS reachability from head. Returns set of reachable member IDs. */
function getReachable(head: OrgMember, members: OrgMember[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const m of members) {
    if (m.reportsTo) {
      const arr = childrenOf.get(m.reportsTo) ?? [];
      arr.push(m.id);
      childrenOf.set(m.reportsTo, arr);
    }
  }
  const reachable = new Set<string>();
  const queue = [head.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return reachable;
}

/** Recursive max-depth calculation from a root member. */
function getMaxDepth(memberId: string, childrenOf: Map<string, string[]>, depth: number): number {
  const children = childrenOf.get(memberId) ?? [];
  if (children.length === 0) return depth;
  return Math.max(...children.map((c) => getMaxDepth(c, childrenOf, depth + 1)));
}

/** Validates graph integrity: cycles, orphans, depth cap. */
function validateGraphIntegrity(members: OrgMember[]): string[] {
  const errors: string[] = [];
  const heads = members.filter((m) => m.isDepartmentHead);

  const cycle = detectCycle(members);
  if (cycle) errors.push(`dept.cycle:${cycle}`);

  if (heads.length === 1 && !cycle) {
    const reachable = getReachable(heads[0], members);
    const orphans = members.filter((m) => !reachable.has(m.id)).map((m) => m.id);
    if (orphans.length > 0) errors.push(`dept.orphans:${orphans.join(',')}`);

    const childrenOf = new Map<string, string[]>();
    for (const m of members) {
      if (m.reportsTo) {
        const arr = childrenOf.get(m.reportsTo) ?? [];
        arr.push(m.id);
        childrenOf.set(m.reportsTo, arr);
      }
    }
    const maxDepth = getMaxDepth(heads[0].id, childrenOf, 0);
    if (maxDepth > MAX_DEPTH) errors.push(`dept.depth_exceeded:${maxDepth}`);
  }

  return errors;
}

/** Validates canonical uniqueness (G6): max 1 department per canonical code per org. */
function validateCanonicalUniqueness(departments: OrgDepartment[]): string[] {
  const counts = new Map<string, number>();
  for (const dept of departments) {
    if (dept.code !== 'custom') {
      counts.set(dept.code, (counts.get(dept.code) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => `org.canonical_duplicate:${code}`);
}

/**
 * Full validation of org hierarchy invariants (ADR-326 §3.11).
 * Pass `departments` to also check canonical uniqueness (G6).
 */
export function validateOrgHierarchy(
  members: OrgMember[],
  departments?: OrgDepartment[],
): OrgHierarchyValidation {
  const errors = [
    ...validateHeadInvariants(members),
    ...validateGraphIntegrity(members),
    ...(departments ? validateCanonicalUniqueness(departments) : []),
  ];
  return { valid: errors.length === 0, errors };
}
