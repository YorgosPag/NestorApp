'use client';

/**
 * ADR-244: Role Management Admin Console — Main Page
 *
 * 4-tab shell for user management, roles & permissions, audit log, and project members.
 * Access control: super_admin and company_admin only.
 * canEdit: only super_admin can modify roles/permissions.
 */

import { useState } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';

import { UsersTab } from './components/UsersTab';
import { RolesTab } from './components/RolesTab';
import type { TabId } from './types';
import type { GlobalRole } from '@/lib/auth/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_ROLES: readonly string[] = ['super_admin', 'company_admin'] as const;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function RoleManagementPage() {
  const { user, loading } = useAuth();
  const { t } = useTranslation('admin');

  const [activeTab, setActiveTab] = useState<TabId>('users');

  // ---------------------------------------------------------------------------
  // Derive role from FirebaseAuthUser (has globalRole from custom claims)
  // ---------------------------------------------------------------------------
  const globalRole = (user?.globalRole as GlobalRole | undefined) ?? null;
  const canEdit = globalRole === 'super_admin';
  const hasAccess = globalRole !== null && ALLOWED_ROLES.includes(globalRole);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <main className="p-6 flex items-center justify-center min-h-[60vh]">
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
      <main className="p-6">
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
    <main className="p-6">
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
