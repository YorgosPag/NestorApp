'use client';

/**
 * =============================================================================
 * SHARED: NoProjectsEmptyState — SSoT empty-state CTA for "no projects yet"
 * =============================================================================
 *
 * Generic, domain-agnostic empty-state block shown when the user needs to
 * create a Project before continuing. Used by:
 *   - Property creation flow (via `PropertyHierarchyEmptyStates`)
 *   - Building management General tab (create mode)
 *
 * The `context` prop drives the description text so the same CTA can speak
 * to the specific workflow (Unit requires Project, Building requires Project).
 *
 * @module components/shared/empty-states/NoProjectsEmptyState
 * @enterprise ADR-238 (Entity Creation Centralization) · SSoT consolidation
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface NoProjectsEmptyStateProps {
  /** Domain-specific context key — drives description text */
  context: 'forUnit' | 'forBuilding';
  onCreateProject: () => void;
}

export function NoProjectsEmptyState({ context, onCreateProject }: NoProjectsEmptyStateProps) {
  const { t } = useTranslation('common-empty-states');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <section
      role="status"
      aria-label={t('noProjects.title')}
      className={cn(
        'rounded-md border border-dashed p-4 flex flex-col gap-3',
        colors.bg.muted,
      )}
    >
      <header className="flex items-start gap-3">
        <FolderPlus className={cn(iconSizes.md, colors.text.muted)} aria-hidden />
        <div className="flex-1">
          <p className={cn('font-medium', colors.text.primary)}>{t('noProjects.title')}</p>
          <p className={cn('text-xs mt-1', colors.text.muted)}>
            {t(`noProjects.description.${context}`)}
          </p>
        </div>
      </header>
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={onCreateProject}
        className="self-start"
      >
        <FolderPlus className={iconSizes.xs} aria-hidden />
        {t('noProjects.cta')}
      </Button>
    </section>
  );
}
