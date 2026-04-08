/**
 * =============================================================================
 * ADMIN LAYOUT — Server-Side Auth Gate
 * =============================================================================
 *
 * Protects ALL /admin/* pages with server-side authentication.
 * Non-admin users see an Unauthorized page without any client-side code loading.
 *
 * Individual pages (ai-inbox, operator-inbox) may add their own requireAdminForPage()
 * calls to obtain AdminContext for their client components — this layout provides
 * the broad security gate.
 *
 * @see ADR-294 (TODO #6: Admin Page Auth Inconsistency)
 * @enterprise Google/Vercel standard — layout-level auth gate
 */

import { requireAdminForPage } from '@/server/admin/admin-guards-page-auth';
import AIInboxUnauthorized from '@/components/admin/ai-inbox/AIInboxUnauthorized';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdminForPage('ADMIN_SECTION_ACCESS');
    return <>{children}</>;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return <AIInboxUnauthorized error={msg} />;
  }
}

export const metadata = {
  title: 'Admin | Nestor',
};
