'use client';

/**
 * ADR-244: User Table Component
 *
 * Sortable table with 8 columns: Avatar+Name, Email, Global Role, Status,
 * MFA, Projects, Last Sign-In, Actions.
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { CompanyUser, UserListFilters } from '../types';
import { ROLE_BADGE_VARIANT, STATUS_BADGE_VARIANT } from '../types';
import { formatRelativeDate } from '../utils/format-relative-date';
import type { GlobalRole } from '@/lib/auth/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

interface UserTableProps {
  users: CompanyUser[];
  currentUserId: string;
  canEdit: boolean;
  isLoading: boolean;
  sortBy: UserListFilters['sortBy'];
  sortOrder: UserListFilters['sortOrder'];
  onSort: (column: UserListFilters['sortBy']) => void;
  onChangeRole: (user: CompanyUser) => void;
  onManagePermissions: (user: CompanyUser) => void;
  onSuspend: (user: CompanyUser) => void;
  onViewDetails: (user: CompanyUser) => void;
}

// =============================================================================
// AVATAR COLOR — deterministic from uid
// =============================================================================

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-teal-500',
] as const;

function getAvatarColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash += uid.charCodeAt(i);
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(displayName: string | null, email: string): string {
  if (displayName) {
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// =============================================================================
// ROLE DISPLAY LABELS
// =============================================================================

const ROLE_LABELS: Record<GlobalRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  internal_user: 'Internal User',
  external_user: 'External User',
};

// =============================================================================
// SORT ICON
// =============================================================================

function SortIndicator({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40" aria-hidden="true">↕</span>;
  return <span className="ml-1" aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function UserTable({
  users,
  currentUserId,
  canEdit,
  isLoading,
  sortBy,
  sortOrder,
  onSort,
  onChangeRole,
  onManagePermissions,
  onSuspend,
  onViewDetails,
}: UserTableProps) {
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();

  const renderSortableHead = useCallback(
    (column: UserListFilters['sortBy'], label: string) => (
      <TableHead>
        <button
          type="button"
          className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
          onClick={() => onSort(column)}
          aria-label={`Sort by ${label}`}
        >
          {label}
          <SortIndicator active={sortBy === column} order={sortOrder} />
        </button>
      </TableHead>
    ),
    [sortBy, sortOrder, onSort]
  );

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <section className="flex items-center justify-center py-16">
        <p className={cn("animate-pulse", colors.text.muted)}>
          {t('roleManagement.loadingUsers', 'Loading users...')}
        </p>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (users.length === 0) {
    return (
      <section className="flex items-center justify-center py-16 rounded-lg border">
        <p className={colors.text.muted}>
          {t('roleManagement.noUsersFound', 'No users found matching your filters.')}
        </p>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Table
  // ---------------------------------------------------------------------------
  return (
    <section className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {renderSortableHead('name', t('roleManagement.columns.name', 'Name'))}
            {renderSortableHead('email', t('roleManagement.columns.email', 'Email'))}
            {renderSortableHead('globalRole', t('roleManagement.columns.role', 'Role'))}
            <TableHead>{t('roleManagement.columns.status', 'Status')}</TableHead>
            <TableHead>{t('roleManagement.columns.mfa', 'MFA')}</TableHead>
            <TableHead>{t('roleManagement.columns.projects', 'Projects')}</TableHead>
            {renderSortableHead('lastSignIn', t('roleManagement.columns.lastSignIn', 'Last Sign-In'))}
            <TableHead className="text-right">
              {t('roleManagement.columns.actions', 'Actions')}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {users.map((companyUser) => {
            const isSelf = companyUser.uid === currentUserId;
            const initials = getInitials(companyUser.displayName, companyUser.email);
            const avatarColor = getAvatarColor(companyUser.uid);

            return (
              <TableRow
                key={companyUser.uid}
                className={cn(isSelf && 'bg-muted/30')}
              >
                {/* Avatar + Name */}
                <TableCell>
                  <figure className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {companyUser.photoURL ? (
                        <AvatarImage src={companyUser.photoURL} alt={companyUser.displayName ?? ''} />
                      ) : null}
                      <AvatarFallback className={cn(avatarColor, 'text-white text-xs font-semibold')}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <figcaption className="flex flex-col">
                      <span className="font-medium text-sm">
                        {companyUser.displayName ?? t('roleManagement.unnamed', 'Unnamed')}
                        {isSelf && (
                          <span className={cn("ml-1 text-xs", colors.text.muted)}>
                            ({t('roleManagement.you', 'you')})
                          </span>
                        )}
                      </span>
                    </figcaption>
                  </figure>
                </TableCell>

                {/* Email */}
                <TableCell className={cn("text-sm", colors.text.muted)}>
                  {companyUser.email}
                </TableCell>

                {/* Global Role */}
                <TableCell>
                  <Badge variant={ROLE_BADGE_VARIANT[companyUser.globalRole]}>
                    {ROLE_LABELS[companyUser.globalRole]}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[companyUser.status]}>
                    {companyUser.status}
                  </Badge>
                </TableCell>

                {/* MFA */}
                <TableCell>
                  <span
                    className={cn(
                      'text-sm',
                      companyUser.mfaEnrolled ? 'text-green-600' : colors.text.muted
                    )}
                    title={companyUser.mfaEnrolled ? 'MFA Enabled' : 'MFA Not Enabled'}
                    aria-label={companyUser.mfaEnrolled ? 'MFA Enabled' : 'MFA Not Enabled'}
                  >
                    {companyUser.mfaEnrolled ? '🔒' : '—'}
                  </span>
                </TableCell>

                {/* Projects */}
                <TableCell className="text-sm text-center">
                  {companyUser.projectCount}
                </TableCell>

                {/* Last Sign-In */}
                <TableCell className={cn("text-sm", colors.text.muted)}>
                  {formatRelativeDate(companyUser.lastSignIn)}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <nav className="flex items-center justify-end gap-1" aria-label="User actions">
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onChangeRole(companyUser)}
                          disabled={isSelf}
                          title={isSelf ? t('roleManagement.cannotChangeOwnRole', 'Cannot change your own role') : ''}
                        >
                          {t('roleManagement.actions.changeRole', 'Role')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onManagePermissions(companyUser)}
                        >
                          {t('roleManagement.actions.permissions', 'Perms')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSuspend(companyUser)}
                          disabled={isSelf}
                          title={isSelf ? t('roleManagement.cannotSuspendSelf', 'Cannot suspend yourself') : ''}
                        >
                          {companyUser.status === 'active'
                            ? t('roleManagement.actions.suspend', 'Suspend')
                            : t('roleManagement.actions.activate', 'Activate')}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(companyUser)}
                    >
                      {t('roleManagement.actions.details', 'Details')}
                    </Button>
                  </nav>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
