'use client';

/**
 * ADR-244: User Detail Panel
 *
 * Read-only dialog showing full user details:
 * User Info, Org-Level Permission Sets, Project Memberships, Effective Permissions.
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

import type { CompanyUser } from '../types';
import { ROLE_BADGE_VARIANT, STATUS_BADGE_VARIANT } from '../types';
import { formatRelativeDate } from '../utils/format-relative-date';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import type { RoleDefinition } from '@/lib/auth/roles';
import { PERMISSION_SETS, computeEffectivePermissions } from '@/lib/auth/permission-sets';
import type { PermissionId } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';

// =============================================================================
// TYPES
// =============================================================================

interface UserDetailPanelProps {
  user: CompanyUser;
  open: boolean;
  onClose: () => void;
}

// =============================================================================
// ROLE LABELS
// =============================================================================

const ROLE_LABELS: Record<GlobalRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  internal_user: 'Internal User',
  external_user: 'External User',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function UserDetailPanel({ user, open, onClose }: UserDetailPanelProps) {
  const { t } = useTranslation('admin');

  // ---------------------------------------------------------------------------
  // Compute effective permissions from globalRole + org-level permission sets
  // ---------------------------------------------------------------------------
  const effectivePermissions = useMemo((): PermissionId[] => {
    const roleDef: RoleDefinition | undefined = PREDEFINED_ROLES[user.globalRole];

    // Super admin bypasses — show all as implicit
    if (roleDef?.isBypass) {
      return [];
    }

    const rolePerms = new Set<PermissionId>(roleDef?.permissions ?? []);
    const setPerms = computeEffectivePermissions(user.permissionSetIds);

    for (const p of setPerms) {
      rolePerms.add(p);
    }

    return Array.from(rolePerms).sort();
  }, [user.globalRole, user.permissionSetIds]);

  const isBypass = PREDEFINED_ROLES[user.globalRole]?.isBypass === true;

  // ---------------------------------------------------------------------------
  // Group permissions by domain
  // ---------------------------------------------------------------------------
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionId[]> = {};
    for (const perm of effectivePermissions) {
      const domain = perm.includes(':') ? perm.split(':')[0] : 'other';
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(perm);
    }
    return groups;
  }, [effectivePermissions]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {t('roleManagement.userDetails', 'User Details')}
          </DialogTitle>
        </DialogHeader>

        <article className="space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Section 1: User Info */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              {t('roleManagement.userInfo', 'User Information')}
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('roleManagement.name', 'Name')}</dt>
              <dd className="font-medium">{user.displayName ?? '—'}</dd>

              <dt className="text-muted-foreground">{t('roleManagement.email', 'Email')}</dt>
              <dd>{user.email}</dd>

              <dt className="text-muted-foreground">{t('roleManagement.uid', 'UID')}</dt>
              <dd className="font-mono text-xs break-all">{user.uid}</dd>

              <dt className="text-muted-foreground">{t('roleManagement.globalRole', 'Global Role')}</dt>
              <dd>
                <Badge variant={ROLE_BADGE_VARIANT[user.globalRole]}>
                  {ROLE_LABELS[user.globalRole]}
                </Badge>
              </dd>

              <dt className="text-muted-foreground">{t('roleManagement.table.status', 'Status')}</dt>
              <dd>
                <Badge variant={STATUS_BADGE_VARIANT[user.status]}>
                  {user.status}
                </Badge>
              </dd>

              <dt className="text-muted-foreground">{t('roleManagement.mfa', 'MFA')}</dt>
              <dd>{user.mfaEnrolled ? 'Enabled' : 'Not enrolled'}</dd>

              <dt className="text-muted-foreground">{t('roleManagement.lastSignIn', 'Last Sign-In')}</dt>
              <dd>{formatRelativeDate(user.lastSignIn)}</dd>

              <dt className="text-muted-foreground">{t('roleManagement.projects', 'Projects')}</dt>
              <dd>{user.projectCount}</dd>
            </dl>
          </section>

          {/* Section 2: Org-Level Permission Sets */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              {t('roleManagement.orgPermissionSets', 'Org-Level Permission Sets')}
            </h3>
            {user.permissionSetIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('roleManagement.noPermissionSets', 'No org-level permission sets assigned.')}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {user.permissionSetIds.map((setId) => {
                  const definition = PERMISSION_SETS[setId];
                  return (
                    <li key={setId}>
                      <Badge variant="secondary" title={definition?.description ?? setId}>
                        {definition?.name ?? setId}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Section 3: Project Memberships */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              {t('roleManagement.projectMemberships', 'Project Memberships')}
            </h3>
            {user.projectMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('roleManagement.noProjectMemberships', 'Not a member of any projects.')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('roleManagement.project', 'Project')}</TableHead>
                    <TableHead>{t('roleManagement.projectRole', 'Role')}</TableHead>
                    <TableHead>{t('roleManagement.extraSets', 'Extra Sets')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.projectMemberships.map((membership) => (
                    <TableRow key={membership.projectId}>
                      <TableCell className="text-sm font-medium">
                        {membership.projectName}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary">{membership.roleId}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {membership.permissionSetIds.length === 0
                          ? '—'
                          : membership.permissionSetIds.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Section 4: Effective Permissions */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              {t('roleManagement.effectivePermissions', 'Effective Permissions')}
            </h3>

            {isBypass ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  'roleManagement.bypassRole',
                  'This user has a bypass role (super_admin) — all permission checks are granted.'
                )}
              </p>
            ) : effectivePermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('roleManagement.noPermissions', 'No permissions computed.')}
              </p>
            ) : (
              <nav>
                {Object.entries(groupedPermissions).map(([domain, perms]) => (
                  <details key={domain} className="mb-2">
                    <summary className="cursor-pointer text-sm font-medium capitalize">
                      {domain} ({perms.length})
                    </summary>
                    <ul className="ml-4 mt-1 space-y-0.5">
                      {perms.map((perm) => (
                        <li key={perm} className="text-xs text-muted-foreground font-mono">
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </nav>
            )}
          </section>
        </article>
      </DialogContent>
    </Dialog>
  );
}
