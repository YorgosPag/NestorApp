'use client';

/**
 * ProjectRolesSection — Shows projects where this contact has a role (landowner, buyer).
 *
 * Derived view — SSoT is the project's `landowners[]` array.
 * Uses onSnapshot for real-time updates (no page refresh needed).
 *
 * @module components/contacts/relationships/summary/ProjectRolesSection
 * @enterprise ADR-244 (Multi-Buyer Co-Ownership)
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useContactProjectRoles } from '@/hooks/contacts/useContactProjectRoles';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';
import { Landmark, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ProjectRolesSectionProps {
  contactId: string;
  className?: string;
}

// ============================================================================
// ROLE BADGE STYLES (labels come from i18n)
// ============================================================================

const ROLE_BADGE_STYLES: Record<string, string> = {
  landowner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

/** i18n keys per role — SSoT for labels (reuses existing common:ownership keys) */
const ROLE_I18N_KEYS: Record<string, string> = {
  landowner: 'ownership.ownerLandowner',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ProjectRolesSection({ contactId, className = 'mb-6' }: ProjectRolesSectionProps) {
  const { roles, loading } = useContactProjectRoles(contactId);
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();

  // Don't render section if no roles and not loading
  if (!loading && roles.length === 0) return null;

  return (
    <section className={className}>
      <header className="mb-3 flex items-center gap-2">
        <Landmark className={cn(iconSizes.sm, COLOR_BRIDGE.text.muted)} />
        <h4 className="text-sm font-medium">
          {t('relationships.summary.projectRoles', { defaultValue: 'Συμμετοχή σε Έργα' })}
        </h4>
      </header>

      {loading ? (
        <article className="flex items-center gap-2 py-2">
          <Loader2 className={cn(iconSizes.sm, 'animate-spin', COLOR_BRIDGE.text.muted)} />
          <span className={cn('text-xs', COLOR_BRIDGE.text.muted)}>
            {t('common.loading', { defaultValue: 'Φόρτωση...' })}
          </span>
        </article>
      ) : (
        <ul className="space-y-2">
          {roles.map((role) => {
            const badgeClass = ROLE_BADGE_STYLES[role.role] ?? '';
            const roleLabel = t(ROLE_I18N_KEYS[role.role] ?? role.role);
            return (
              <li
                key={`${role.projectId}-${role.role}`}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm font-medium">{role.projectName}</span>
                <nav className="flex items-center gap-2">
                  <Badge variant="outline" className={badgeClass}>
                    {roleLabel}
                  </Badge>
                  <Badge variant="secondary" className="tabular-nums">
                    {role.ownershipPct}%
                  </Badge>
                </nav>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
