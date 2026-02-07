/**
 * =============================================================================
 * 🏢 ENTERPRISE: OPERATOR INBOX - Pipeline Review Queue (Server Component)
 * =============================================================================
 *
 * Server Component για admin authentication και authorization.
 * Delegates UI rendering στο OperatorInboxClient (Client Component).
 *
 * @route /admin/operator-inbox
 * @enterprise Server-side RBAC enforcement
 * @see ADR-080 (Pipeline Implementation)
 * @see UC-009 (Internal Operator Workflow)
 *
 * ARCHITECTURE:
 * - Tier 1: Navigation visibility (permissions: ['admin_access'])
 * - Tier 2: Page-level server-side auth (requireAdminForPage)
 * - Tier 3: API-level enforcement (withAuth middleware)
 */

import { requireAdminForPage } from '@/server/admin/admin-guards';
import OperatorInboxClient from './OperatorInboxClient';
import AIInboxUnauthorized from '@/app/admin/ai-inbox/AIInboxUnauthorized';

// ============================================================================
// SERVER COMPONENT (PAGE)
// ============================================================================

export default async function OperatorInboxPage() {
  try {
    const adminContext = await requireAdminForPage('OPERATOR_INBOX_PAGE_ACCESS');
    return <OperatorInboxClient adminContext={adminContext} />;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return <AIInboxUnauthorized error={errorMessage} />;
  }
}

// ============================================================================
// METADATA
// ============================================================================

export const metadata = {
  title: 'Operator Inbox | Admin',
  description: 'Review and approve AI pipeline proposals',
};
