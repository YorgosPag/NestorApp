'use client';

import { Crown, Bell } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { buildOrgTree, OrgStructureError } from '@/services/org-structure/utils/build-org-tree';
import type { OrgDepartment, OrgNode } from '@/types/org/org-structure';

interface OrgTreeViewProps {
  department: OrgDepartment;
}

function OrgNodeRow({ node }: { node: OrgNode }) {
  const { t } = useTranslation('org-structure');

  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 text-sm"
        style={{ paddingLeft: `${8 + node.depth * 16}px` }}
      >
        {node.member.isDepartmentHead && (
          <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        )}
        {!node.member.isDepartmentHead && (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}

        <span className={node.member.status === 'archived' ? 'line-through opacity-50' : ''}>
          {node.member.displayName}
        </span>

        <Badge variant="outline" className="text-xs">
          {t(`roles.${node.member.role}`)}
        </Badge>

        {node.member.receivesNotifications && (
          <Bell className="h-3 w-3 text-blue-500 shrink-0" aria-label={t('orgStructure.member.receivesNotifications')} />
        )}
      </div>

      {node.children.map((child) => (
        <OrgNodeRow key={child.member.id} node={child} />
      ))}
    </>
  );
}

export function OrgTreeView({ department }: OrgTreeViewProps) {
  const { t } = useTranslation('org-structure');
  const activeMembers = department.members.filter((m) => m.status === 'active');

  if (activeMembers.length === 0) {
    return (
      <p className="text-sm opacity-60 py-2 px-2">
        {t('orgStructure.noMembers')}
      </p>
    );
  }

  let root: OrgNode | null = null;
  try {
    root = buildOrgTree(activeMembers);
  } catch (err) {
    if (err instanceof OrgStructureError) {
      return (
        <p className="text-sm text-destructive py-2 px-2">{err.message}</p>
      );
    }
    throw err;
  }

  return (
    <div className="border rounded-md bg-muted/30">
      <OrgNodeRow node={root} />
    </div>
  );
}
