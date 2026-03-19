'use client';

/**
 * ADR-244: Role Hierarchy Diagram
 *
 * Pure CSS tree showing the role hierarchy L0–L6.
 * Uses nested ul/li with semantic nav element.
 * No external library.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import type { BadgeVariant } from '../types';

// =============================================================================
// HIERARCHY DATA
// =============================================================================

interface HierarchyNode {
  roleId: string;
  label: string;
  level: number;
  badgeVariant: BadgeVariant;
  children: HierarchyNode[];
}

const HIERARCHY: HierarchyNode = {
  roleId: 'super_admin',
  label: 'Super Admin',
  level: 0,
  badgeVariant: 'destructive',
  children: [
    {
      roleId: 'company_admin',
      label: 'Company Admin',
      level: 1,
      badgeVariant: 'default',
      children: [
        {
          roleId: 'project_manager',
          label: 'Project Manager',
          level: 2,
          badgeVariant: 'success',
          children: [
            {
              roleId: 'architect',
              label: 'Architect',
              level: 3,
              badgeVariant: 'secondary',
              children: [],
            },
            {
              roleId: 'engineer',
              label: 'Engineer',
              level: 3,
              badgeVariant: 'secondary',
              children: [],
            },
            {
              roleId: 'site_manager',
              label: 'Site Manager',
              level: 4,
              badgeVariant: 'secondary',
              children: [],
            },
            {
              roleId: 'accountant',
              label: 'Accountant',
              level: 4,
              badgeVariant: 'secondary',
              children: [],
            },
            {
              roleId: 'sales_agent',
              label: 'Sales Agent',
              level: 4,
              badgeVariant: 'secondary',
              children: [],
            },
            {
              roleId: 'data_entry',
              label: 'Data Entry',
              level: 5,
              badgeVariant: 'secondary',
              children: [],
            },
            {
              roleId: 'vendor',
              label: 'Vendor',
              level: 5,
              badgeVariant: 'warning',
              children: [],
            },
            {
              roleId: 'viewer',
              label: 'Viewer',
              level: 6,
              badgeVariant: 'secondary',
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

// =============================================================================
// RECURSIVE TREE NODE
// =============================================================================

function TreeNode({ node }: { node: HierarchyNode }) {
  const roleDef = PREDEFINED_ROLES[node.roleId];
  const permCount = roleDef?.isBypass
    ? 'all'
    : `${roleDef?.permissions.length ?? 0}`;

  return (
    <li className="relative pl-6 pt-2">
      {/* Connector line */}
      <span
        className="absolute left-0 top-0 h-full w-px bg-border"
        aria-hidden="true"
      />
      <span
        className="absolute left-0 top-5 w-6 h-px bg-border"
        aria-hidden="true"
      />

      <article className="flex items-center gap-2 pb-1">
        <Badge variant={node.badgeVariant}>
          L{node.level}
        </Badge>
        <span className="font-medium text-sm">{node.label}</span>
        <span className="text-[10px] text-muted-foreground">
          ({permCount} perms)
        </span>
        {roleDef?.isProjectRole && (
          <span className="text-[10px] text-muted-foreground italic">
            project-scoped
          </span>
        )}
      </article>

      {node.children.length > 0 && (
        <ul className="list-none" role="group">
          {node.children.map((child) => (
            <TreeNode key={child.roleId} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RoleHierarchyDiagram() {
  const { t } = useTranslation('admin');

  return (
    <nav
      aria-label={t('roleManagement.hierarchy.title', 'Role Hierarchy')}
      className="pb-6"
    >
      <ul className="list-none pb-4" role="tree">
        <li className="pt-1">
          <article className="flex items-center gap-2 pb-1">
            <Badge variant={HIERARCHY.badgeVariant}>
              L{HIERARCHY.level}
            </Badge>
            <span className="font-medium text-sm">{HIERARCHY.label}</span>
            <span className="text-[10px] text-muted-foreground">
              (all perms — bypass)
            </span>
          </article>

          {HIERARCHY.children.length > 0 && (
            <ul className="list-none" role="group">
              {HIERARCHY.children.map((child) => (
                <TreeNode key={child.roleId} node={child} />
              ))}
            </ul>
          )}
        </li>
      </ul>

      <footer className="mt-2 p-3 rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground">
          {t(
            'roleManagement.hierarchyNote',
            'Lower level numbers mean higher access. Global roles (L0-L1) are organization-wide. Project roles (L2-L6) are scoped per project.'
          )}
        </p>
      </footer>
    </nav>
  );
}
