/**
 * Org Routing Resolver (ADR-326 §3.5)
 * Resolves the email recipient for a tenant notification event.
 *
 * Cascade 4-step (NO env var fallback — ADR-326 G1/Q8):
 *   1. NotificationRoutingRule.overrideEmail (explicit per-event override)
 *   2. Department head primary email (isDepartmentHead && status === 'active')
 *   2.5. Backup: first active member with receivesNotifications=true (G3)
 *   3. Department-level emails[0] (fallback to dept centralino)
 *   4. null → skip email, structured warn logged by caller
 */

import type { OrgStructure, OrgDepartment, OrgMember } from '@/types/org/org-structure';
import type { DepartmentCode } from '@/config/department-codes';
import type { NotificationEventCode } from '@/config/notification-events';
import { DEFAULT_EVENT_TO_DEPARTMENT } from '@/config/notification-events';

export interface ResolveResult {
  email: string;
  source: 'override' | 'head' | 'backup' | 'dept';
  memberDisplayName?: string;
  departmentCode: DepartmentCode;
}

/** Finds the department to route to for a given event, respecting per-tenant overrides. */
function resolveDepartment(
  orgStructure: OrgStructure,
  event: NotificationEventCode,
): OrgDepartment | null {
  const routingRule = orgStructure.notificationRouting?.find((r) => r.event === event);
  const targetCode = routingRule?.targetDepartmentCode ?? DEFAULT_EVENT_TO_DEPARTMENT[event];
  if (!targetCode) return null;
  return (
    orgStructure.departments.find(
      (d) => d.code === targetCode && d.status === 'active',
    ) ?? null
  );
}

/** Step 1: per-event override email. */
function resolveOverride(
  orgStructure: OrgStructure,
  event: NotificationEventCode,
  deptCode: DepartmentCode,
): ResolveResult | null {
  const rule = orgStructure.notificationRouting?.find((r) => r.event === event);
  if (rule?.overrideEmail) {
    return { email: rule.overrideEmail, source: 'override', departmentCode: deptCode };
  }
  return null;
}

/** Step 2: department head primary email. Step 2.5: backup member (G3). */
function resolveFromMembers(
  members: OrgMember[],
  deptCode: DepartmentCode,
): ResolveResult | null {
  const activeMembers = members.filter((m) => m.status === 'active');
  const head = activeMembers.find((m) => m.isDepartmentHead);

  const headEmail = head?.emails.find((e) => e.isPrimary)?.email;
  if (headEmail) {
    return { email: headEmail, source: 'head', memberDisplayName: head!.displayName, departmentCode: deptCode };
  }

  const backup = activeMembers.find(
    (m) => !m.isDepartmentHead && m.receivesNotifications,
  );
  const backupEmail = backup?.emails.find((e) => e.isPrimary)?.email;
  if (backupEmail) {
    return { email: backupEmail, source: 'backup', memberDisplayName: backup!.displayName, departmentCode: deptCode };
  }

  return null;
}

/** Step 3: department-level email (centralino). */
function resolveDeptLevel(dept: OrgDepartment): ResolveResult | null {
  const email = dept.emails?.[0]?.email;
  if (email) {
    return { email, source: 'dept', departmentCode: dept.code };
  }
  return null;
}

/**
 * Pure resolver — takes in-memory OrgStructure and returns the email to notify.
 * Returns null when no email can be resolved (step 4: caller should warn + audit).
 */
export function resolveEmailFromOrgStructure(
  orgStructure: OrgStructure,
  event: NotificationEventCode,
): ResolveResult | null {
  const dept = resolveDepartment(orgStructure, event);
  if (!dept) return null;

  return (
    resolveOverride(orgStructure, event, dept.code) ??
    resolveFromMembers(dept.members, dept.code) ??
    resolveDeptLevel(dept) ??
    null
  );
}

/**
 * Firestore-backed resolver (ADR-326 Phase 1).
 * Reads orgStructure from companies/{companyId}.settings.orgStructure via Admin SDK.
 * Cache 5-min in-memory (invalidated on save by OrgStructureRepository).
 * Returns null when orgStructure absent or no email resolves — caller should warn + audit.
 */
export async function resolveTenantNotificationEmail(
  companyId: string,
  event: NotificationEventCode,
): Promise<ResolveResult | null> {
  const { getOrgStructure } = await import('./org-structure-repository');
  const orgStructure = await getOrgStructure(companyId);
  if (!orgStructure) return null;
  return resolveEmailFromOrgStructure(orgStructure, event);
}
