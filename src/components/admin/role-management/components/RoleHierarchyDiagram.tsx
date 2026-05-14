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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// HIERARCHY DATA
// =============================================================================

interface HierarchyNode {
  roleId: string;
  level: number;
  badgeVariant: BadgeVariant;
  children: HierarchyNode[];
}

const HIERARCHY: HierarchyNode = {
  roleId: 'super_admin',
  level: 0,
  badgeVariant: 'destructive',
  children: [
    {
      roleId: 'company_admin',
      level: 1,
      badgeVariant: 'default',
      children: [
        {
          roleId: 'project_manager',
          level: 2,
          badgeVariant: 'success',
          children: [
            { roleId: 'architect',     level: 3, badgeVariant: 'secondary', children: [] },
            { roleId: 'engineer',      level: 3, badgeVariant: 'secondary', children: [] },
            { roleId: 'site_manager',  level: 4, badgeVariant: 'secondary', children: [] },
            { roleId: 'accountant',    level: 4, badgeVariant: 'secondary', children: [] },
            { roleId: 'sales_agent',   level: 4, badgeVariant: 'secondary', children: [] },
            { roleId: 'data_entry',    level: 5, badgeVariant: 'secondary', children: [] },
            { roleId: 'vendor',        level: 5, badgeVariant: 'warning',   children: [] },
            { roleId: 'viewer',        level: 6, badgeVariant: 'secondary', children: [] },
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
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();
  const roleDef = PREDEFINED_ROLES[node.roleId];
  const permCount = roleDef?.permissions.length ?? 0;

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
        <span className="font-medium text-sm">
          {t(`roleManagement.roleNames.${node.roleId}`)}
        </span>
        <span className={cn("text-[10px]", colors.text.muted)}>
          ({permCount} {t('roleManagement.hierarchy.permsSuffix')})
        </span>
        {roleDef?.isProjectRole && (
          <span className={cn("text-[10px] italic", colors.text.muted)}>
            {t('roleManagement.hierarchy.projectScoped')}
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
  const colors = useSemanticColors();

  return (
    <nav
      aria-label={t('roleManagement.hierarchy.title')}
      className="pb-6"
    >
      <ul className="list-none pb-4" role="tree">
        <li className="pt-1">
          <article className="flex items-center gap-2 pb-1">
            <Badge variant={HIERARCHY.badgeVariant}>
              L{HIERARCHY.level}
            </Badge>
            <span className="font-medium text-sm">
              {t(`roleManagement.roleNames.${HIERARCHY.roleId}`)}
            </span>
            <span className={cn("text-[10px]", colors.text.muted)}>
              ({t('roleManagement.hierarchy.allPermsLabel')})
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
        <p className={cn("text-xs", colors.text.muted)}>
          {t('roleManagement.hierarchyNote')}
        </p>
      </footer>
    </nav>
  );
}
