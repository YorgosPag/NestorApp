'use client';

/**
 * ADR-244 Phase B: Member Table
 *
 * Displays project members with role, permissions, and actions.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProjectMemberEntry } from '../types';

// =============================================================================
// PROPS
// =============================================================================

interface MemberTableProps {
  members: ProjectMemberEntry[];
  canEdit: boolean;
  onUpdateMember: (uid: string) => void;
  onRemoveMember: (uid: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MemberTable({ members, canEdit, onUpdateMember, onRemoveMember }: MemberTableProps) {
  const { t } = useTranslation('admin');

  if (members.length === 0) {
    return (
      <section className="py-8 text-center">
        <p className="text-muted-foreground">
          {t('roleManagement.projectMembers.noMembers', 'No members in this project.')}
        </p>
      </section>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('roleManagement.table.user', 'User')}</TableHead>
          <TableHead>{t('roleManagement.table.email', 'Email')}</TableHead>
          <TableHead>{t('roleManagement.projectMembers.role', 'Project Role')}</TableHead>
          <TableHead>{t('roleManagement.projectMembers.permissionSets', 'Permission Sets')}</TableHead>
          <TableHead>{t('roleManagement.projectMembers.addedAt', 'Added')}</TableHead>
          {canEdit && (
            <TableHead className="text-right">
              {t('roleManagement.table.actions', 'Actions')}
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.uid}>
            <TableCell className="font-medium">
              {member.displayName ?? member.uid.slice(0, 12)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {member.email}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{member.roleId || '—'}</Badge>
            </TableCell>
            <TableCell>
              {member.permissionSetIds.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {member.permissionSetIds.map((setId) => (
                    <Badge key={setId} variant="outline" className="text-[10px]">
                      {setId}
                    </Badge>
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {member.addedAt
                ? new Date(member.addedAt).toLocaleDateString()
                : '—'}
            </TableCell>
            {canEdit && (
              <TableCell className="text-right">
                <nav className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateMember(member.uid)}
                  >
                    {t('roleManagement.projectMembers.edit', 'Edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onRemoveMember(member.uid)}
                  >
                    {t('roleManagement.projectMembers.remove', 'Remove')}
                  </Button>
                </nav>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
