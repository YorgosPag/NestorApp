'use client';

/**
 * ADR-244: Role Management Admin Console — Main Page
 *
 * 4-tab shell for user management, roles & permissions, audit log, and project members.
 * Access control: super_admin and company_admin only.
 * canEdit: only super_admin can modify roles/permissions.
 *
 * @performance ADR-294 Batch 5 — lazy-loaded via LazyRoutes
 */

import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { TabsContainer } from '@/components/ui/navigation/TabsComponents';
import type { TabDefinition } from '@/components/ui/navigation/TabsComponents';
import { Alert } from '@/components/ui/alert';
import { Users, Shield, FileText, FolderOpen } from 'lucide-react';

import { UsersTab } from '@/app/admin/role-management/components/UsersTab';
import { RolesTab } from '@/app/admin/role-management/components/RolesTab';
import { AuditTab } from '@/app/admin/role-management/components/AuditTab';
import { ProjectMembersTab } from '@/app/admin/role-management/components/ProjectMembersTab';
import type { GlobalRole } from '@/lib/auth/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALLOWED_ROLES: readonly string[] = ['super_admin', 'company_admin'] as const;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export function RoleManagementPageContent() {
  const { user, loading } = useAuth();
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();

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
        <p className={cn("animate-pulse", colors.text.muted)}>
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
        <p className={cn("mt-1", colors.text.muted)}>
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

export default RoleManagementPageContent;
