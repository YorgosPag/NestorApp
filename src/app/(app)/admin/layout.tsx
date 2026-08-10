/**
 * =============================================================================
 * ADMIN LAYOUT — Server-Side Auth Gate + Sidebar Shell
 * =============================================================================
 *
 * Protects ALL /admin/* pages with server-side authentication.
 * Non-admin users see an Unauthorized page without any client-side code loading.
 *
 * Provides Google Admin Console-style sidebar navigation (ADR-347).
 * The isSuperAdmin flag is derived server-side from AdminContext and passed to
 * the client sidebar to gate super_admin-only links without an extra round-trip.
 *
 * @see ADR-347 (Admin Console Sidebar)
 * @see ADR-294 (TODO #6: Admin Page Auth Inconsistency)
 * @enterprise Google/Vercel standard — layout-level auth gate
 */

import { requireAdminForPage } from '@/server/admin/admin-guards-page-auth';
import AIInboxUnauthorized from '@/components/admin/ai-inbox/AIInboxUnauthorized';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const adminContext = await requireAdminForPage('ADMIN_SECTION_ACCESS');
    const isSuperAdmin = adminContext.role === 'super_admin';
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar isSuperAdmin={isSuperAdmin} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return <AIInboxUnauthorized error={msg} />;
  }
}

export const metadata = {
  title: 'Admin | Nestor',
};
