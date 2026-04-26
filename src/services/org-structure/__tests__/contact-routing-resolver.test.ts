/**
 * Tests for L2 contact org-structure resolver (ADR-326 Phase 6.0)
 */

import {
  resolveEmailFromContactOrgStructure,
} from '../org-routing-resolver';
import type { OrgStructure } from '@/types/org/org-structure';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOrgStructure(overrides: Partial<OrgStructure> = {}): OrgStructure {
  return {
    id: 'org_test',
    departments: [],
    updatedAt: new Date() as unknown as import('@/types/contacts/contracts').FirestoreishTimestamp,
    updatedBy: 'user_test',
    ...overrides,
  };
}

const HEAD_EMAIL = 'head@supplier.com';
const BACKUP_EMAIL = 'backup@supplier.com';
const DEPT_EMAIL = 'accounting@supplier.com';

const accountingDeptWithHead = {
  id: 'odep_acc',
  code: 'accounting' as const,
  members: [
    {
      id: 'omem_head',
      displayName: 'Head User',
      mode: 'plain' as const,
      role: 'head' as const,
      reportsTo: null,
      isDepartmentHead: true,
      receivesNotifications: true,
      emails: [{ email: HEAD_EMAIL, type: 'work' as const, isPrimary: true }],
      phones: [],
      status: 'active' as const,
    },
    {
      id: 'omem_backup',
      displayName: 'Backup User',
      mode: 'plain' as const,
      role: 'employee' as const,
      reportsTo: 'omem_head',
      isDepartmentHead: false,
      receivesNotifications: true,
      emails: [{ email: BACKUP_EMAIL, type: 'work' as const, isPrimary: true }],
      phones: [],
      status: 'active' as const,
    },
  ],
  emails: [{ email: DEPT_EMAIL, type: 'work' as const, isPrimary: true }],
  status: 'active' as const,
  createdAt: new Date() as unknown as import('@/types/contacts/contracts').FirestoreishTimestamp,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('resolveEmailFromContactOrgStructure', () => {
  it('returns head email when head is active', () => {
    const orgStructure = makeOrgStructure({ departments: [accountingDeptWithHead] });
    const result = resolveEmailFromContactOrgStructure(orgStructure, 'accounting');
    expect(result).not.toBeNull();
    expect(result!.email).toBe(HEAD_EMAIL);
    expect(result!.source).toBe('head');
  });

  it('falls back to backup when head is archived', () => {
    const deptArchivedHead = {
      ...accountingDeptWithHead,
      members: accountingDeptWithHead.members.map((m) =>
        m.isDepartmentHead ? { ...m, status: 'archived' as const } : m,
      ),
    };
    const orgStructure = makeOrgStructure({ departments: [deptArchivedHead] });
    const result = resolveEmailFromContactOrgStructure(orgStructure, 'accounting');
    expect(result).not.toBeNull();
    expect(result!.email).toBe(BACKUP_EMAIL);
    expect(result!.source).toBe('backup');
  });

  it('falls back to dept-level email when no active members', () => {
    const deptNoActiveMembers = {
      ...accountingDeptWithHead,
      members: accountingDeptWithHead.members.map((m) => ({ ...m, status: 'archived' as const })),
    };
    const orgStructure = makeOrgStructure({ departments: [deptNoActiveMembers] });
    const result = resolveEmailFromContactOrgStructure(orgStructure, 'accounting');
    expect(result).not.toBeNull();
    expect(result!.email).toBe(DEPT_EMAIL);
    expect(result!.source).toBe('dept');
  });

  it('returns null when orgStructure has no matching dept', () => {
    const orgStructure = makeOrgStructure({ departments: [] });
    const result = resolveEmailFromContactOrgStructure(orgStructure, 'accounting');
    expect(result).toBeNull();
  });

  it('returns null when matching dept is archived', () => {
    const archivedDept = { ...accountingDeptWithHead, status: 'archived' as const };
    const orgStructure = makeOrgStructure({ departments: [archivedDept] });
    const result = resolveEmailFromContactOrgStructure(orgStructure, 'accounting');
    expect(result).toBeNull();
  });
});
