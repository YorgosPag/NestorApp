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
import { formatRelativeTime } from '@/lib/intl-formatting';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import type { RoleDefinition } from '@/lib/auth/roles';
import { PERMISSION_SETS, computeEffectivePermissions } from '@/lib/auth/permission-sets';
import type { PermissionId } from '@/lib/auth/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface UserDetailPanelProps {
  user: CompanyUser;
  open: boolean;
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

function translatePermissionId(perm: string, t: ReturnType<typeof useTranslation>['t']): string {
  const parts = perm.split(':');
  if (parts.length >= 3) {
    const [domain, ...rest] = parts;
    const key = `roleManagement.permissionNames.${domain}.${rest.join('_')}`;
    const translated = t(key);
    return translated !== key ? translated : perm;
  }
  return perm;
}

export function UserDetailPanel({ user, open, onClose }: UserDetailPanelProps) {
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();

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
            {t('roleManagement.userDetails')}
          </DialogTitle>
        </DialogHeader>

        <article className="space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Section 1: User Info */}
          <section>
            <h3 className={cn("text-sm font-semibold mb-3 uppercase tracking-wide", colors.text.muted)}>
              {t('roleManagement.userInfo')}
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className={colors.text.muted}>{t('roleManagement.name')}</dt>
              <dd className="font-medium">{user.displayName ?? '—'}</dd>

              <dt className={colors.text.muted}>{t('roleManagement.email')}</dt>
              <dd>{user.email}</dd>

              <dt className={colors.text.muted}>{t('roleManagement.uid')}</dt>
              <dd className="font-mono text-xs break-all">{user.uid}</dd>

              <dt className={colors.text.muted}>{t('roleManagement.globalRole')}</dt>
              <dd>
                <Badge variant={ROLE_BADGE_VARIANT[user.globalRole]}>
                  {t(`roleManagement.roleNames.${user.globalRole}`)}
                </Badge>
              </dd>

              <dt className={colors.text.muted}>{t('roleManagement.table.status')}</dt>
              <dd>
                <Badge variant={STATUS_BADGE_VARIANT[user.status]}>
                  {t(`roleManagement.statusLabels.${user.status}`)}
                </Badge>
              </dd>

              <dt className={colors.text.muted}>{t('roleManagement.userDetail.mfa')}</dt>
              <dd>{user.mfaEnrolled
                ? t('roleManagement.userDetail.mfaEnrolled')
                : t('roleManagement.userDetail.mfaNotEnrolled')}
              </dd>

              <dt className={colors.text.muted}>{t('roleManagement.lastSignIn')}</dt>
              <dd>{user.lastSignIn ? formatRelativeTime(user.lastSignIn) : t('users.activity.never')}</dd>

              <dt className={colors.text.muted}>{t('roleManagement.projects')}</dt>
              <dd>{user.projectCount}</dd>
            </dl>
          </section>

          {/* Section 2: Org-Level Permission Sets */}
          <section>
            <h3 className={cn("text-sm font-semibold mb-3 uppercase tracking-wide", colors.text.muted)}>
              {t('roleManagement.orgPermissionSets')}
            </h3>
            {user.permissionSetIds.length === 0 ? (
              <p className={cn("text-sm", colors.text.muted)}>
                {t('roleManagement.noPermissionSets')}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {user.permissionSetIds.map((setId) => {
                  const definition = PERMISSION_SETS[setId];
                  const name = definition
                    ? t(`roleManagement.definitions.${setId}.name`)
                    : setId;
                  const description = definition
                    ? t(`roleManagement.definitions.${setId}.description`)
                    : setId;
                  return (
                    <li key={setId}>
                      <Badge variant="secondary" title={description}>
                        {name}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Section 3: Project Memberships */}
          <section>
            <h3 className={cn("text-sm font-semibold mb-3 uppercase tracking-wide", colors.text.muted)}>
              {t('roleManagement.projectMemberships')}
            </h3>
            {user.projectMemberships.length === 0 ? (
              <p className={cn("text-sm", colors.text.muted)}>
                {t('roleManagement.noProjectMemberships')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('roleManagement.project')}</TableHead>
                    <TableHead>{t('roleManagement.projectRole')}</TableHead>
                    <TableHead>{t('roleManagement.extraSets')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.projectMemberships.map((membership) => (
                    <TableRow key={membership.projectId}>
                      <TableCell className="text-sm font-medium">
                        {membership.projectName}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary">
                          {t(`roleManagement.roleNames.${membership.roleId}`, membership.roleId)}
                        </Badge>
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
            <h3 className={cn("text-sm font-semibold mb-3 uppercase tracking-wide", colors.text.muted)}>
              {t('roleManagement.effectivePermissions')}
            </h3>

            {isBypass ? (
              <p className={cn("text-sm", colors.text.muted)}>
                {t('roleManagement.bypassRole')}
              </p>
            ) : effectivePermissions.length === 0 ? (
              <p className={cn("text-sm", colors.text.muted)}>
                {t('roleManagement.noPermissions')}
              </p>
            ) : (
              <nav>
                {Object.entries(groupedPermissions).map(([domain, perms]) => (
                  <details key={domain} className="mb-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      {t(`roleManagement.domains.${domain}`, domain)} ({perms.length})
                    </summary>
                    <ul className="ml-4 mt-1 space-y-0.5">
                      {perms.map((perm) => (
                        <li key={perm} className={cn("text-xs", colors.text.muted)}>
                          {translatePermissionId(perm, t)}
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
