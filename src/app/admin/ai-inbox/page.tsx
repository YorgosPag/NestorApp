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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, LogIn } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// UNAUTHORIZED VIEW
// ============================================================================

function UnauthorizedView({ error }: { error: string }) {
  return (
    <main className="container mx-auto py-10">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldX className="h-5 w-5 text-red-500" />
            Unauthorized Access
          </CardTitle>
          <CardDescription>
            You do not have permission to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link href="/login">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// ============================================================================
// SERVER COMPONENT (PAGE)
// ============================================================================

export default async function AIInboxPage() {
  // 🏢 ENTERPRISE: Server-side admin authentication
  // Uses requireAdminForPage (thin wrapper around requireAdminContext)
  try {
    const adminContext = await requireAdminForPage('AI_INBOX_PAGE_ACCESS');

    // Authorized → render client component
    return <AIInboxClient adminContext={adminContext} />;
  } catch (error) {
    // Not authorized → render unauthorized view
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return <UnauthorizedView error={errorMessage} />;
  }
}

// ============================================================================
// METADATA (Optional - Next.js 13+ App Router)
// ============================================================================

export const metadata = {
  title: 'AI Inbox | Admin',
  description: 'Manual review και approval εισερχόμενων messages',
};
