/**
 * =============================================================================
 * 🏢 ENTERPRISE: AI INBOX - Admin Triage Queue (Server Component)
 * =============================================================================
 *
 * Server Component για admin authentication και authorization.
 * Delegates UI rendering στο AIInboxClient (Client Component).
 *
 * @route /admin/ai-inbox
 * @enterprise Server-side RBAC enforcement
 * @created 2026-02-03
 * @updated 2026-02-03 - Converted to Server Component με requireAdminForPage
 *
 * ARCHITECTURE:
 * - Tier 1: Navigation visibility (permissions: ['admin_access'])
 * - Tier 2: Page-level server-side auth (requireAdminForPage)
 * - Tier 3: API-level enforcement (server actions με requireAdminContext)
 *
 * SECURITY:
 * - Server-side authentication με Firebase Admin
 * - Admin role verification (admin/broker/builder)
 * - MFA enforcement για admin roles
 * - Audit trail logging
 */

import { requireAdminForPage } from '@/server/admin/admin-guards';
import AIInboxClient from './AIInboxClient';
import AIInboxUnauthorized from './AIInboxUnauthorized';

// ============================================================================
// SERVER COMPONENT (PAGE)
// ============================================================================

export default async function AIInboxPage() {
  // 🏢 ENTERPRISE: Server-side admin authentication
  // Uses requireAdminForPage (thin wrapper around requireAdminContext)
  try {
    const adminContext = await requireAdminForPage('AI_INBOX_PAGE_ACCESS');

    // Authorized → render client component (breadcrumb inside AIInboxHeader)
    return <AIInboxClient adminContext={adminContext} />;
  } catch (error) {
    // Not authorized → render unauthorized view
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return <AIInboxUnauthorized error={errorMessage} />;
  }
}

// ============================================================================
// METADATA (Optional - Next.js 13+ App Router)
// ============================================================================

export const metadata = {
  title: 'AI Inbox | Admin',
  description: 'Manual review και approval εισερχόμενων messages',
};
