import { resolveEmailFromOrgStructure, resolveTenantNotificationEmail } from '../org-routing-resolver';
import type { OrgStructure, OrgDepartment, OrgMember } from '@/types/org/org-structure';
import { NOTIFICATION_EVENTS } from '@/config/notification-events';
import { DEPARTMENT_CODES } from '@/config/department-codes';

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

function makeOrgStructure(partial: Partial<OrgStructure> = {}): OrgStructure {
  return {
    id: 'org_test',
    departments: [],
    updatedAt: new Date(),
    updatedBy: 'test',
    ...partial,
  };
}

function makeAccountingDept(memberOverrides: Partial<OrgMember>[] = []): OrgDepartment {
  const head = makeMember({
    id: 'omem_head',
    isDepartmentHead: true,
    reportsTo: null,
    role: 'head',
    emails: [{ email: 'accounting-head@tenant.gr', type: 'work', isPrimary: true }],
  });
  const members = [head, ...memberOverrides.map((o) => makeMember({ id: `omem_extra_${Math.random()}`, ...o }))];
  return {
    id: 'odep_acc',
    code: DEPARTMENT_CODES.ACCOUNTING,
    members,
    status: 'active',
    createdAt: new Date(),
  };
}

describe('resolveEmailFromOrgStructure', () => {
  describe('Step 1 — override email', () => {
    it('returns override email when routing rule has overrideEmail', () => {
      const org = makeOrgStructure({
        departments: [makeAccountingDept()],
        notificationRouting: [
          {
            event: NOTIFICATION_EVENTS.RESERVATION_CREATED,
            targetDepartmentCode: DEPARTMENT_CODES.ACCOUNTING,
            overrideEmail: 'override@tenant.gr',
          },
        ],
      });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result?.email).toBe('override@tenant.gr');
      expect(result?.source).toBe('override');
    });
  });

  describe('Step 2 — department head', () => {
    it('returns head primary email when head is active', () => {
      const org = makeOrgStructure({ departments: [makeAccountingDept()] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result?.email).toBe('accounting-head@tenant.gr');
      expect(result?.source).toBe('head');
    });

    it('uses default event-to-department mapping', () => {
      const org = makeOrgStructure({ departments: [makeAccountingDept()] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.SALE_FINAL_INVOICE);
      expect(result?.source).toBe('head');
    });
  });

  describe('Step 2.5 — backup member (G3)', () => {
    it('returns backup member when head is archived', () => {
      const archivedHead = makeMember({
        id: 'omem_head',
        isDepartmentHead: true,
        reportsTo: null,
        role: 'head',
        emails: [{ email: 'archived-head@tenant.gr', type: 'work', isPrimary: true }],
        status: 'archived',
      });
      const backup = makeMember({
        id: 'omem_backup',
        reportsTo: 'omem_head',
        receivesNotifications: true,
        emails: [{ email: 'backup@tenant.gr', type: 'work', isPrimary: true }],
      });
      const dept: OrgDepartment = {
        id: 'odep_acc',
        code: DEPARTMENT_CODES.ACCOUNTING,
        members: [archivedHead, backup],
        status: 'active',
        createdAt: new Date(),
      };
      const org = makeOrgStructure({ departments: [dept] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result?.email).toBe('backup@tenant.gr');
      expect(result?.source).toBe('backup');
    });
  });

  describe('Step 3 — department-level email', () => {
    it('returns dept email when no active members with email', () => {
      const headNoEmail = makeMember({
        id: 'omem_head',
        isDepartmentHead: true,
        role: 'head',
        emails: [],
        status: 'active',
      });
      const dept: OrgDepartment = {
        id: 'odep_acc',
        code: DEPARTMENT_CODES.ACCOUNTING,
        members: [headNoEmail],
        emails: [{ email: 'dept@tenant.gr', type: 'work', isPrimary: true }],
        status: 'active',
        createdAt: new Date(),
      };
      const org = makeOrgStructure({ departments: [dept] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result?.email).toBe('dept@tenant.gr');
      expect(result?.source).toBe('dept');
    });
  });

  describe('Step 4 — null (no email)', () => {
    it('returns null when no dept matches event', () => {
      const org = makeOrgStructure({ departments: [] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result).toBeNull();
    });

    it('returns null when dept exists but has no emails anywhere', () => {
      const headNoEmail = makeMember({
        id: 'h',
        isDepartmentHead: true,
        role: 'head',
        emails: [],
      });
      const dept: OrgDepartment = {
        id: 'odep_acc',
        code: DEPARTMENT_CODES.ACCOUNTING,
        members: [headNoEmail],
        emails: [],
        status: 'active',
        createdAt: new Date(),
      };
      const org = makeOrgStructure({ departments: [dept] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result).toBeNull();
    });

    it('returns null when dept is archived', () => {
      const dept: OrgDepartment = { ...makeAccountingDept(), status: 'archived' };
      const org = makeOrgStructure({ departments: [dept] });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.RESERVATION_CREATED);
      expect(result).toBeNull();
    });
  });

  describe('routing rule — custom department code override', () => {
    it('routes to custom dept when routing rule targets it', () => {
      const customDept: OrgDepartment = {
        id: 'odep_custom',
        code: DEPARTMENT_CODES.CUSTOM,
        label: 'Special Finance',
        members: [
          makeMember({
            id: 'h2',
            isDepartmentHead: true,
            role: 'head',
            emails: [{ email: 'custom@tenant.gr', type: 'work', isPrimary: true }],
          }),
        ],
        status: 'active',
        createdAt: new Date(),
      };
      const org = makeOrgStructure({
        departments: [makeAccountingDept(), customDept],
        notificationRouting: [
          {
            event: NOTIFICATION_EVENTS.SALE_DEPOSIT_INVOICE,
            targetDepartmentCode: DEPARTMENT_CODES.CUSTOM,
          },
        ],
      });
      const result = resolveEmailFromOrgStructure(org, NOTIFICATION_EVENTS.SALE_DEPOSIT_INVOICE);
      expect(result?.email).toBe('custom@tenant.gr');
      expect(result?.departmentCode).toBe(DEPARTMENT_CODES.CUSTOM);
    });
  });
});

describe('resolveTenantNotificationEmail', () => {
  it('throws until Phase 1 is implemented', async () => {
    await expect(
      resolveTenantNotificationEmail('comp_test', NOTIFICATION_EVENTS.RESERVATION_CREATED),
    ).rejects.toThrow('Phase 1 required');
  });
});
