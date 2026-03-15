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

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchInput } from '@/components/ui/search/SearchInput';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EntityType, FileCategory } from '@/config/domain-constants';
import type { ContactType } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import { getSortedEntryPoints, getFilteredContactEntryPoints } from '@/config/upload-entry-points';
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
  /** 🏢 ENTERPRISE: Whitelist specific entry point IDs — shows ONLY these */
  allowedEntryPointIds?: string[];
  /** 🏢 ENTERPRISE: Contact type for persona-aware filtering (individual/company/service) */
  contactType?: ContactType;
  /** 🎭 ENTERPRISE: Active personas for individual contacts (ADR-121) */
  activePersonas?: PersonaType[];
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
  allowedEntryPointIds,
  contactType,
  activePersonas,
}: UploadEntryPointSelectorProps) {
  const iconSizes = useIconSizes();
  const { t, i18n } = useTranslation('files');
  const [searchQuery, setSearchQuery] = useState('');

  // 🏢 ENTERPRISE: Use current i18n language unless explicitly overridden
  // Fixes bug where cards showed Greek text even with English selected
  const currentLanguage = (language || i18n.language?.split('-')[0] || 'en') as 'el' | 'en';

  // 🏢 ENTERPRISE: Get entry points — persona-aware for contacts, standard for others
  const baseEntryPoints = (entityType === 'contact' && contactType)
    ? getFilteredContactEntryPoints(contactType, activePersonas)
    : getSortedEntryPoints(entityType);

  // 🏢 ENTERPRISE: Apply category filters on top of persona filtering
  // - categoryFilter: show ONLY entries with this category (e.g., 'photos' for PhotosTab)
  // - excludeCategories: hide entries with these categories (e.g., ['photos', 'videos'] for DocumentsTab)
  const entryPoints = baseEntryPoints.filter((ep) => {
    // 🏢 ENTERPRISE: Whitelist mode — if allowedEntryPointIds is set, ONLY show these
    if (allowedEntryPointIds && !allowedEntryPointIds.includes(ep.id)) {
      return false;
    }
    if (categoryFilter && ep.category !== categoryFilter) {
      return false;
    }
    if (excludeCategories && excludeCategories.includes(ep.category)) {
      return false;
    }
    return true;
  });

  // 🏢 ENTERPRISE: Search filtering — searches both el/en label + description
  // "Άλλο Έγγραφο" (requiresCustomTitle) is always pinned visible
  const filteredEntryPoints = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return entryPoints;

    return entryPoints.filter((ep) => {
      // Always pin "Άλλο Έγγραφο" cards
      if (ep.requiresCustomTitle) return true;

      const haystack = [
        ep.label.el,
        ep.label.en,
        ep.description?.el,
        ep.description?.en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(trimmed);
    });
  }, [entryPoints, searchQuery]);

  // Get selected entry point
  const selectedEntryPoint = entryPoints.find((ep) => ep.id === selectedEntryPointId);

  // If no entry points defined, return null
  if (entryPoints.length === 0) {
    return null;
  }

  const showSearch = entryPoints.length > 8;

  // Get icon component from lucide-react (type-safe dynamic lookup)
  const getIcon = (iconName?: string): LucideIcons.LucideIcon => {
    if (!iconName) return LucideIcons.File;
    const icons: Record<string, LucideIcons.LucideIcon | undefined> = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon | undefined>;
    return icons[iconName] ?? LucideIcons.File;
  };

  return (
    <section className={cn('space-y-2', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
      {/* Header */}
      <header>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {t('upload.typeQuestion')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('upload.categoryHint')}
        </p>
      </header>

      {/* Search Input — visible only when >8 entry points */}
      {showSearch && (
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('upload.searchDocumentPlaceholder')}
          debounceMs={0}
          className="text-sm"
        />
      )}

      {/* Entry Points Grid */}
      {filteredEntryPoints.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('upload.noSearchResults')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredEntryPoints.map((entryPoint) => {
            const Icon = getIcon(entryPoint.icon);
            const isSelected = selectedEntryPointId === entryPoint.id;
            const isCustomTitle = entryPoint.requiresCustomTitle === true;

            return (
              <Tooltip key={entryPoint.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(entryPoint)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all',
                      'hover:shadow-md hover:scale-105',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md scale-105'
                        : isCustomTitle
                          ? 'border-dashed border-amber-400 bg-amber-50 hover:border-amber-500 dark:border-amber-600 dark:bg-amber-950/30 dark:hover:border-amber-500'
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
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : isCustomTitle
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className={iconSizes.md} aria-hidden="true" />
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        'text-xs font-medium text-center leading-tight',
                        isSelected
                          ? 'text-primary'
                          : isCustomTitle
                            ? 'text-amber-800 dark:text-amber-300'
                            : 'text-foreground'
                      )}
                    >
                      {entryPoint.label[currentLanguage]}
                    </span>

                    {/* Free-title hint for custom title entries */}
                    {isCustomTitle && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                        {currentLanguage === 'el' ? '(ελεύθερος τίτλος)' : '(free title)'}
                      </span>
                    )}

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
      )}

      {/* Selected description */}
      {selectedEntryPointId && (
        <footer className="p-2 bg-muted/50 rounded-md border border-border">
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
              'w-full px-2 py-2 rounded-md border bg-background text-foreground',
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
