'use client';

/**
 * =============================================================================
 * ENTERPRISE: PropertyHierarchyEmptyStates — Shared Empty State CTAs
 * =============================================================================
 *
 * Reusable empty-state CTAs για την ιεραρχία Property creation (ADR-284 §3.3).
 * Extracted από το AddPropertyDialog σε Batch 7 ώστε να χρησιμοποιείται από:
 *   - `AddPropertyDialog` (Path #1, modal)
 *   - `PropertyFieldsBlock` (Path #2, inline __new__ template)
 *
 * Τα 4 empty states:
 *   1. **noProjects**: Καμία Project δεν υπάρχει → CTA "Δημιούργησε Έργο"
 *   2. **noBuildings**: Project επιλεγμένο, δεν έχει Buildings → CTA nav to /buildings
 *   3. **orphanBuilding**: Building επιλεγμένο χωρίς projectId → CTA "Σύνδεσέ το τώρα"
 *   4. **noFloors**: Building επιλεγμένο, δεν έχει Floors → CTA "Πρόσθεσε Όροφο"
 *
 * Render conditions βασίζονται στα `flags` props (καλούμενος υπολογίζει state).
 *
 * @module components/properties/shared/PropertyHierarchyEmptyStates
 * @enterprise ADR-284 §3.3, Batch 7 (SSoT Consolidation)
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Layers, AlertTriangle, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { NoProjectsEmptyState } from '@/components/shared/empty-states/NoProjectsEmptyState';

// =============================================================================
// TYPES
// =============================================================================

export interface PropertyHierarchyEmptyStateFlags {
  noProjects: boolean;
  noBuildings: boolean;
  orphanBuilding: boolean;
  noFloors: boolean;
}

export interface PropertyHierarchyEmptyStatesProps {
  flags: PropertyHierarchyEmptyStateFlags;
  selectedProjectName: string;
  selectedBuildingName: string;
  onCreateProject: () => void;
  onCreateBuilding: () => void;
  onLinkBuildingToProject: () => void;
  onPickAnotherBuilding: () => void;
  onCreateFloor: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PropertyHierarchyEmptyStates({
  flags,
  selectedProjectName,
  selectedBuildingName,
  onCreateProject,
  onCreateBuilding,
  onLinkBuildingToProject,
  onPickAnotherBuilding,
  onCreateFloor,
}: PropertyHierarchyEmptyStatesProps) {
  const { t } = useTranslation('properties');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const sectionClass = cn(
    'rounded-md border border-dashed p-4 flex flex-col gap-3',
    colors.bg.muted,
  );

  return (
    <>
      {flags.noProjects && (
        <NoProjectsEmptyState context="forUnit" onCreateProject={onCreateProject} />
      )}

      {flags.noBuildings && (
        <section
          role="status"
          aria-label={t('dialog.addUnit.emptyState.noBuildings.title')}
          className={sectionClass}
        >
          <header className="flex items-start gap-3">
            <Building2 className={cn(iconSizes.md, colors.text.muted)} aria-hidden />
            <div className="flex-1">
              <p className={cn('font-medium', colors.text.primary)}>
                {t('dialog.addUnit.emptyState.noBuildings.title')}
              </p>
              <p className={cn('text-xs mt-1', colors.text.muted)}>
                {t('dialog.addUnit.emptyState.noBuildings.description')}
              </p>
            </div>
          </header>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onCreateBuilding}
            className="self-start"
          >
            <Building2 className={iconSizes.xs} aria-hidden />
            {t('dialog.addUnit.emptyState.noBuildings.cta')}
          </Button>
        </section>
      )}

      {flags.orphanBuilding && (
        <section
          role="status"
          aria-label={t('dialog.addUnit.emptyState.orphanBuilding.title')}
          className={sectionClass}
        >
          <header className="flex items-start gap-3">
            <Link2 className={cn(iconSizes.md, colors.text.muted)} aria-hidden />
            <div className="flex-1">
              <p className={cn('font-medium', colors.text.primary)}>
                {`Το Κτίριο "${selectedBuildingName || '—'}" δεν είναι συνδεδεμένο με Έργο`}
              </p>
              <p className={cn('text-xs mt-1', colors.text.muted)}>
                {t('dialog.addUnit.emptyState.orphanBuilding.description')}
              </p>
            </div>
          </header>
          <nav className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onLinkBuildingToProject}
            >
              <Link2 className={iconSizes.xs} aria-hidden />
              {t('dialog.addUnit.emptyState.orphanBuilding.cta.fixNow')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPickAnotherBuilding}
            >
              {t('dialog.addUnit.emptyState.orphanBuilding.cta.pickOther')}
            </Button>
          </nav>
        </section>
      )}

      {flags.noFloors && (
        <section
          role="status"
          aria-label={t('dialog.addUnit.emptyState.noFloors.title')}
          className={sectionClass}
        >
          <header className="flex items-start gap-3">
            <AlertTriangle className={cn(iconSizes.md, colors.text.muted)} aria-hidden />
            <div className="flex-1">
              <p className={cn('font-medium', colors.text.primary)}>
                {`Το Κτίριο "${selectedBuildingName || '—'}" δεν έχει ορόφους`}
              </p>
            </div>
          </header>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onCreateFloor}
            className="self-start"
          >
            <Layers className={iconSizes.xs} aria-hidden />
            {t('dialog.addUnit.emptyState.noFloors.cta')}
          </Button>
        </section>
      )}
    </>
  );
}
