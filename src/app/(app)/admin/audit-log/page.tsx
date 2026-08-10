/**
 * /admin/audit-log — Company-wide audit trail (admin only)
 *
 * Server wrapper for `GlobalAuditLogView`. Auth gating is handled by
 * `src/app/admin/layout.tsx` (`requireAdminForPage('ADMIN_SECTION_ACCESS')`).
 * The API endpoint consumed by the view also enforces
 * `requiredGlobalRoles: ['super_admin', 'company_admin']` so this page is
 * safe under defense-in-depth.
 *
 * @enterprise ADR-195 — Entity Audit Trail (Phase 7)
 */

import { GlobalAuditLogView } from '@/components/admin/audit-log/GlobalAuditLogView';

export const metadata = {
  title: 'Audit Log | Nestor Admin',
};

export default function AdminAuditLogPage() {
  return <GlobalAuditLogView />;
}
