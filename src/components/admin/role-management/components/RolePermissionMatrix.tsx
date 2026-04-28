'use client';

/**
 * ADR-244: Role × Permission Matrix
 *
 * Grid showing permissions per global role, grouped by domain.
 * Uses PREDEFINED_ROLES and PERMISSIONS as data source.
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import type { RoleDefinition } from '@/lib/auth/roles';
import { PERMISSIONS } from '@/lib/auth/types';
import type { PermissionId, GlobalRole } from '@/lib/auth/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { compareByLocale } from '@/lib/intl-formatting';

// =============================================================================
// CONSTANTS
// =============================================================================

const GLOBAL_ROLE_IDS: GlobalRole[] = [
  'super_admin',
  'company_admin',
  'internal_user',
  'external_user',
];

const ROLE_LABELS: Record<GlobalRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  internal_user: 'Internal',
  external_user: 'External',
};

// =============================================================================
// HELPERS
// =============================================================================

interface DomainGroup {
  domain: string;
  permissions: PermissionId[];
}

function groupPermissionsByDomain(): DomainGroup[] {
  const groups: Record<string, PermissionId[]> = {};
  const allPerms = Object.keys(PERMISSIONS) as PermissionId[];

  for (const perm of allPerms) {
    const domain = perm.includes(':') ? perm.split(':')[0] : 'other';
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(perm);
  }

  return Object.entries(groups)
    .map(([domain, permissions]) => ({ domain, permissions }))
    .sort((a, b) => compareByLocale(a.domain, b.domain));
}

type AccessLevel = 'full' | 'partial' | 'none';

function getDomainAccessLevel(
  roleDef: RoleDefinition | undefined,
  domainPermissions: PermissionId[]
): AccessLevel {
  if (!roleDef) return 'none';
  if (roleDef.isBypass) return 'full';

  const matchCount = domainPermissions.filter((p) =>
    roleDef.permissions.includes(p)
  ).length;

  if (matchCount === 0) return 'none';
  if (matchCount === domainPermissions.length) return 'full';
  return 'partial';
}

const ACCESS_ICON: Record<AccessLevel, string> = {
  full: '\u2705',     // green checkmark
  partial: '\uD83D\uDCD6', // open book
  none: '\u274C',     // red cross
};

const ACCESS_LABEL: Record<AccessLevel, string> = {
  full: 'Full access',
  partial: 'Partial access',
  none: 'No access',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function RolePermissionMatrix() {
  const { t } = useTranslation('admin');

  const domainGroups = useMemo(() => groupPermissionsByDomain(), []);
  const colors = useSemanticColors();

  return (
    <section className="rounded-lg border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">
              {t('roleManagement.domain', 'Domain')}
            </TableHead>
            {GLOBAL_ROLE_IDS.map((roleId) => (
              <TableHead key={roleId} className="text-center min-w-[100px]">
                {ROLE_LABELS[roleId]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {domainGroups.map((group) => (
            <TableRow key={group.domain}>
              <TableCell>
                <details>
                  <summary className="cursor-pointer font-medium text-sm capitalize">
                    {group.domain}
                    <span className={cn("text-xs ml-1", colors.text.muted)}>
                      ({group.permissions.length})
                    </span>
                  </summary>
                  <ul className="ml-2 mt-1 space-y-0.5">
                    {group.permissions.map((perm) => (
                      <li key={perm} className={cn("text-[10px] font-mono", colors.text.muted)}>
                        {perm}
                      </li>
                    ))}
                  </ul>
                </details>
              </TableCell>

              {GLOBAL_ROLE_IDS.map((roleId) => {
                const roleDef = PREDEFINED_ROLES[roleId];
                const level = getDomainAccessLevel(roleDef, group.permissions);

                return (
                  <TableCell key={roleId} className="text-center">
                    {/* non-centralized tooltip test */}
                    <span title={ACCESS_LABEL[level]} aria-label={ACCESS_LABEL[level]}>
                      {ACCESS_ICON[level]}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
