import type { GlobalRole } from '@/lib/auth';

/**
 * RBAC guard for the Spend Analytics page (ADR-331 D10=D).
 * Cross-company financial data: restricted to company admin and super admin.
 * NOTE: accountant project-role support requires per-user Firestore lookup → Phase H.
 * @see ADR-331 §4 D10
 */

const ALLOWED: ReadonlySet<string> = new Set<GlobalRole>(['super_admin', 'company_admin']);

export function canViewSpendAnalytics(globalRole: string): boolean {
  return ALLOWED.has(globalRole);
}
