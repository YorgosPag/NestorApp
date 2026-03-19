'use client';

/**
 * ADR-244: Roles & Permissions Tab — Container
 *
 * 3 collapsible sections showing:
 * - Role Hierarchy Diagram
 * - Role × Permission Matrix
 * - Permission Set Cards
 *
 * Read-only in Phase A.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';

import { RoleHierarchyDiagram } from './RoleHierarchyDiagram';
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { PermissionSetCard } from './PermissionSetCard';
import { PERMISSION_SETS } from '@/lib/auth/permission-sets';

// =============================================================================
// COMPONENT
// =============================================================================

export function RolesTab() {
  const { t } = useTranslation('admin');

  const permissionSetEntries = Object.entries(PERMISSION_SETS);

  return (
    <section className="space-y-6">
      {/* Section 1: Role Hierarchy */}
      <details open>
        <summary className="cursor-pointer text-lg font-semibold mb-3">
          {t('roleManagement.hierarchy.title', 'Role Hierarchy')}
        </summary>
        <RoleHierarchyDiagram />
      </details>

      {/* Section 2: Role × Permission Matrix */}
      <details>
        <summary className="cursor-pointer text-lg font-semibold mb-3">
          {t('roleManagement.matrix.title', 'Permission Matrix')}
        </summary>
        <RolePermissionMatrix />
      </details>

      {/* Section 3: Permission Sets */}
      <details>
        <summary className="cursor-pointer text-lg font-semibold mb-3">
          {t('roleManagement.permissionSetCards.title', 'Permission Sets')} ({permissionSetEntries.length})
        </summary>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
          {permissionSetEntries.map(([setId, definition]) => (
            <li key={setId}>
              <PermissionSetCard setId={setId} definition={definition} />
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
