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
 * - Tier 3: API-level enforcement — `POST /api/admin/ai-inbox/.../triage` με
 *   `ADMIN_SURFACE_AUTH` (ADR-868). ⚠️ Εδώ έγραφε «server actions με requireAdminContext»·
 *   **ψευδές**: οι actions δεν έλεγχαν τίποτα, και η Next.js το λέει ρητά — *«A page-level
 *   authentication check does not extend to the Server Actions defined within it»*.
 *
 * SECURITY:
 * - Server-side authentication με Firebase Admin
 * - Admin role verification (admin/broker/builder)
 * - MFA enforcement για admin roles
 * - Audit trail logging
 */

import { requireAdminForPage } from '@/server/admin/admin-guards';
import AIInboxClient from '@/components/admin/ai-inbox/AIInboxClient';
import AIInboxUnauthorized from '@/components/admin/ai-inbox/AIInboxUnauthorized';

// ============================================================================
// SERVER COMPONENT (PAGE)
// ============================================================================

export default async function AIInboxPage() {
  // 🏢 ENTERPRISE: Server-side admin authentication
  // Uses requireAdminForPage (thin wrapper around requireAdminContext)
  try {
    const adminContext = await requireAdminForPage('AI_INBOX_PAGE_ACCESS');

    // 🔴 ADR-868 — τα εισερχόμενα είναι **ανά εταιρεία**. Ο διαχειριστής χωρίς εταιρεία
    //    έπαιρνε «καθολική όψη» μέσω server action (μηνύματα ΟΛΩΝ των εταιρειών) — ακριβώς
    //    η διαρροή. Μετρημένο 2026-09-19: 0 από 4 διαχειριστές παραγωγής χωρίς εταιρεία.
    if (!adminContext.companyId) {
      return <AIInboxUnauthorized />;
    }

    // Authorized → render client component (breadcrumb inside AIInboxHeader)
    return <AIInboxClient adminContext={{ ...adminContext, companyId: adminContext.companyId }} />;
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
