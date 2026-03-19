'use client';

/**
 * ADR-244: Role Management Admin Console — Main Page
 *
 * 4-tab shell for user management, roles & permissions, audit log, and project members.
 * Access control: super_admin and company_admin only.
 * canEdit: only super_admin can modify roles/permissions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';

import { UsersTab } from './components/UsersTab';
import { RolesTab } from './components/RolesTab';
import type { TabId } from './types';
import type { GlobalRole } from '@/lib/auth/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_ROLES: readonly GlobalRole[] = ['super_admin', 'company_admin'] as const;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function RoleManagementPage() {
  const { user } = useAuth();
  const { t } = useTranslation('admin');
  const spacing = useSpacingTokens();

  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [globalRole, setGlobalRole] = useState<GlobalRole | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Extract globalRole from Firebase ID token claims
  // ---------------------------------------------------------------------------
  const loadClaims = useCallback(async () => {
    if (!user) {
      setClaimsLoading(false);
      return;
    }

    try {
      const tokenResult = await user.getIdTokenResult();
      const role = tokenResult.claims['globalRole'] as GlobalRole | undefined;
      setGlobalRole(role ?? null);
    } catch {
      setGlobalRole(null);
    } finally {
      setClaimsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const canEdit = globalRole === 'super_admin';
  const hasAccess = globalRole !== null && (ALLOWED_ROLES as readonly string[]).includes(globalRole);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (claimsLoading) {
    return (
      <main className={`${spacing.page} flex items-center justify-center min-h-[60vh]`}>
        <p className="text-muted-foreground animate-pulse">
          {t('roleManagement.loading', 'Loading access permissions...')}
        </p>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Access denied
  // ---------------------------------------------------------------------------
  if (!hasAccess) {
    return (
      <main className={spacing.page}>
        <Alert variant="destructive">
          <h2 className="font-semibold text-lg">
            {t('roleManagement.accessDenied', 'Access Denied')}
          </h2>
          <p className="mt-1 text-sm">
            {t(
              'roleManagement.accessDeniedDescription',
              'You do not have permission to access the Role Management console. Only Super Admins and Company Admins may view this page.'
            )}
          </p>
        </Alert>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Main layout
  // ---------------------------------------------------------------------------
  return (
    <main className={spacing.page}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('roleManagement.title', 'Role Management')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('roleManagement.subtitle', 'Manage users, roles, and permissions for your organization.')}
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabId)}
      >
        <TabsList>
          <TabsTrigger value="users">
            {t('roleManagement.tabs.users', 'Users')}
          </TabsTrigger>
          <TabsTrigger value="roles">
            {t('roleManagement.tabs.roles', 'Roles & Permissions')}
          </TabsTrigger>
          <TabsTrigger value="audit">
            {t('roleManagement.tabs.audit', 'Audit Log')}
          </TabsTrigger>
          <TabsTrigger value="projects">
            {t('roleManagement.tabs.projects', 'Project Members')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <section className="rounded-lg border p-8 text-center">
            <h2 className="text-lg font-semibold text-muted-foreground">
              {t('roleManagement.comingSoon', 'Coming soon — Phase B')}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('roleManagement.auditLogPlaceholder', 'Audit log with role change history and permission modifications.')}
            </p>
          </section>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <section className="rounded-lg border p-8 text-center">
            <h2 className="text-lg font-semibold text-muted-foreground">
              {t('roleManagement.comingSoon', 'Coming soon — Phase B')}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('roleManagement.projectMembersPlaceholder', 'Manage project-level role assignments and permission sets.')}
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
