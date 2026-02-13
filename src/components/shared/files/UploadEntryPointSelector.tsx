/**
 * =============================================================================
 * 🏢 ENTERPRISE: Upload Entry Point Selector
 * =============================================================================
 *
 * UI για επιλογή τύπου εγγράφου πριν το upload.
 * Enterprise pattern από Salesforce, Dynamics, SAP.
 *
 * @module components/shared/files/UploadEntryPointSelector
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```tsx
 * <UploadEntryPointSelector
 *   entityType="contact"
 *   selectedEntryPointId={selected}
 *   onSelect={(entryPoint) => setSelected(entryPoint.id)}
 * />
 * ```
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EntityType, FileCategory } from '@/config/domain-constants';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import { getSortedEntryPoints } from '@/config/upload-entry-points';
import * as LucideIcons from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface UploadEntryPointSelectorProps {
  /** Entity type για filtering entry points */
  entityType: EntityType;
  /** Currently selected entry point ID */
  selectedEntryPointId?: string;
  /** Callback when entry point is selected */
  onSelect: (entryPoint: UploadEntryPoint) => void;
  /** Optional CSS class */
  className?: string;
  /** Display language */
  language?: 'el' | 'en';
  /** 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ) */
  customTitle?: string;
  /** 🏢 ENTERPRISE: Callback when custom title changes */
  onCustomTitleChange?: (title: string) => void;
  /** 🏢 ENTERPRISE: Filter to show only specific categories (e.g., 'photos' for PhotosTab) */
  categoryFilter?: FileCategory;
  /** 🏢 ENTERPRISE: Exclude specific categories (e.g., ['photos', 'videos'] for DocumentsTab) */
  excludeCategories?: FileCategory[];
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Upload Entry Point Selector
 *
 * Displays available entry points για το συγκεκριμένο entity type.
 * User selects τι τύπο εγγράφου θα ανεβάσει (ταυτότητα, φωτογραφία, κτλ).
 */
export function UploadEntryPointSelector({
  entityType,
  selectedEntryPointId,
  onSelect,
  className,
  language, // Optional override - defaults to current i18n language
  customTitle = '',
  onCustomTitleChange,
  categoryFilter,
  excludeCategories,
}: UploadEntryPointSelectorProps) {
  const iconSizes = useIconSizes();
  const { t, i18n } = useTranslation('files');

  // 🏢 ENTERPRISE: Use current i18n language unless explicitly overridden
  // Fixes bug where cards showed Greek text even with English selected
  const currentLanguage = (language || i18n.language?.split('-')[0] || 'en') as 'el' | 'en';

  // Get entry points for this entity type
  const allEntryPoints = getSortedEntryPoints(entityType);

  // 🏢 ENTERPRISE: Filter entry points by category
  // - categoryFilter: show ONLY entries with this category (e.g., 'photos' for PhotosTab)
  // - excludeCategories: hide entries with these categories (e.g., ['photos', 'videos'] for DocumentsTab)
  const entryPoints = allEntryPoints.filter((ep) => {
    // If categoryFilter is set, only show entries matching that category
    if (categoryFilter && ep.category !== categoryFilter) {
      return false;
    }
    // If excludeCategories is set, hide entries matching those categories
    if (excludeCategories && excludeCategories.includes(ep.category)) {
      return false;
    }
    return true;
  });

  // Get selected entry point
  const selectedEntryPoint = entryPoints.find((ep) => ep.id === selectedEntryPointId);

  // If no entry points defined, return null
  if (entryPoints.length === 0) {
    return null;
  }

  // Get icon component from lucide-react (type-safe dynamic lookup)
  const getIcon = (iconName?: string): LucideIcons.LucideIcon => {
    if (!iconName) return LucideIcons.File;
    const icons = LucideIcons as Record<string, LucideIcons.LucideIcon | undefined>;
    return icons[iconName] ?? LucideIcons.File;
  };

  return (
    <section className={cn('space-y-3', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
      {/* Header */}
      <header>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t('upload.typeQuestion')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('upload.categoryHint')}
        </p>
      </header>

      {/* Entry Points Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {entryPoints.map((entryPoint) => {
          const Icon = getIcon(entryPoint.icon);
          const isSelected = selectedEntryPointId === entryPoint.id;

          return (
            <Tooltip key={entryPoint.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(entryPoint)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    'hover:shadow-md hover:scale-105',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-md scale-105'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={entryPoint.label[currentLanguage]}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className={iconSizes.md} aria-hidden="true" />
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-xs font-medium text-center leading-tight',
                      isSelected ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {entryPoint.label[currentLanguage]}
                  </span>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              {entryPoint.description?.[currentLanguage] && (
                <TooltipContent>{entryPoint.description[currentLanguage]}</TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>

      {/* Selected description */}
      {selectedEntryPointId && (
        <footer className="p-3 bg-muted/50 rounded-md border border-border">
          {entryPoints
            .filter((ep) => ep.id === selectedEntryPointId)
            .map((ep) => (
              <p key={ep.id} className="text-xs text-muted-foreground">
                <strong className="text-foreground">{ep.label[currentLanguage]}:</strong>{' '}
                {ep.description?.[currentLanguage] || t('upload.documentForCategory')}
              </p>
            ))}
        </footer>
      )}

      {/* 🏢 ENTERPRISE: Custom Title Input (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
          Displayed when selected entry point requires custom title */}
      {selectedEntryPoint?.requiresCustomTitle && (
        <div className="space-y-2">
          <label htmlFor="custom-title" className="block text-sm font-medium text-foreground">
            {t('upload.documentTitle')} <span className="text-destructive">*</span>
          </label>
          <input
            id="custom-title"
            type="text"
            value={customTitle}
            onChange={(e) => onCustomTitleChange?.(e.target.value)}
            placeholder={t('upload.customTitlePlaceholder')}
            required
            className={cn(
              'w-full px-3 py-2 rounded-md border bg-background text-foreground',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors',
              customTitle.trim() === ''
                ? 'border-destructive/50 focus:ring-destructive'
                : 'border-border'
            )}
            aria-required="true"
            aria-invalid={customTitle.trim() === ''}
            aria-describedby="custom-title-hint"
          />
          <p id="custom-title-hint" className="text-xs text-muted-foreground">
            {t('upload.customTitleHint')}
          </p>
        </div>
      )}
    </section>
  );
}
