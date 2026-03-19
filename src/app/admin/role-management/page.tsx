'use client';

/**
 * ADR-244: Role Management Admin Console — Main Page
 *
 * 4-tab shell for user management, roles & permissions, audit log, and project members.
 * Access control: super_admin and company_admin only.
 * canEdit: only super_admin can modify roles/permissions.
 */

import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { TabsContainer } from '@/components/ui/navigation/TabsComponents';
import type { TabDefinition } from '@/components/ui/navigation/TabsComponents';
import { Alert } from '@/components/ui/alert';
import { Users, Shield, FileText, FolderOpen } from 'lucide-react';

import { UsersTab } from './components/UsersTab';
import { RolesTab } from './components/RolesTab';
import { AuditTab } from './components/AuditTab';
import { ProjectMembersTab } from './components/ProjectMembersTab';
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

      <TabsContainer
        tabs={[
          { id: 'users', label: t('roleManagement.tabs.users', 'Users'), icon: Users, content: <UsersTab canEdit={canEdit} /> },
          { id: 'roles', label: t('roleManagement.tabs.roles', 'Roles & Permissions'), icon: Shield, content: <RolesTab /> },
          { id: 'audit', label: t('roleManagement.tabs.audit', 'Audit Log'), icon: FileText, content: <AuditTab canExport={canEdit} /> },
          { id: 'projects', label: t('roleManagement.tabs.projects', 'Project Members'), icon: FolderOpen, content: <ProjectMembersTab canEdit={canEdit} /> },
        ] satisfies TabDefinition[]}
        defaultTab="users"
      />
    </main>
  );
}
