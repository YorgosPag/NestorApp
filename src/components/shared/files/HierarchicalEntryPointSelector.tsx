/**
 * =============================================================================
 * 🏢 ENTERPRISE: Hierarchical Entry Point Selector (ADR-191)
 * =============================================================================
 *
 * 2-step UI component for selecting study document entry points:
 * Step 1: Select study group category (7 colored cards)
 * Step 2: Select specific document entry point within the group
 *
 * Includes cross-group search and per-floor template expansion.
 *
 * @module components/shared/files/HierarchicalEntryPointSelector
 * @enterprise ADR-191 - Hierarchical Study Upload System
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchInput } from '@/components/ui/search/SearchInput';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import * as LucideIcons from 'lucide-react';
import type { EntityType, FileCategory } from '@/config/domain-constants';
import type { UploadEntryPoint, FloorInfo } from '@/config/upload-entry-points';
import {
  getSortedEntryPoints,
  getUngroupedEntryPoints,
  getGroupedEntryPoints,
  getAvailableGroups,
  expandFloorEntryPoints,
} from '@/config/upload-entry-points';
import {
  STUDY_GROUPS,
  getStudyGroupMeta,
  type StudyGroup,
  type StudyGroupMeta,
} from '@/config/study-groups-config';

// ============================================================================
// TYPES
// ============================================================================

type ViewState = 'groups' | 'entries' | 'search';

export interface HierarchicalEntryPointSelectorProps {
  entityType: EntityType;
  selectedEntryPointId?: string;
  onSelect: (entryPoint: UploadEntryPoint) => void;
  className?: string;
  language?: 'el' | 'en';
  customTitle?: string;
  onCustomTitleChange?: (title: string) => void;
  categoryFilter?: FileCategory;
  excludeCategories?: FileCategory[];
  /** 🏢 ENTERPRISE: Whitelist specific entry point IDs — shows ONLY these in flat mode (skips groups) */
  allowedEntryPointIds?: string[];
  floors?: FloorInfo[];
  /** Callback to navigate to the Floors tab (makes the no-floors warning clickable) */
  onNavigateToFloors?: () => void;
  /** Override link text (default: studies.goToFloors from i18n) */
  navigateToFloorsLabel?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const getIcon = (iconName?: string): LucideIcons.LucideIcon => {
  if (!iconName) return LucideIcons.File;
  const icons: Record<string, LucideIcons.LucideIcon | undefined> =
    LucideIcons as unknown as Record<string, LucideIcons.LucideIcon | undefined>;
  return icons[iconName] ?? LucideIcons.File;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function HierarchicalEntryPointSelector({
  entityType,
  selectedEntryPointId,
  onSelect,
  className,
  language,
  customTitle = '',
  onCustomTitleChange,
  categoryFilter,
  excludeCategories,
  allowedEntryPointIds,
  floors = [],
  onNavigateToFloors,
  navigateToFloorsLabel,
}: HierarchicalEntryPointSelectorProps) {
  const iconSizes = useIconSizes();
  const { t, i18n } = useTranslation('files');
  const [viewState, setViewState] = useState<ViewState>('groups');
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentLanguage = (language || i18n.language?.split('-')[0] || 'en') as 'el' | 'en';

  // ── Available groups for this entity type ────────────────────────────────
  const availableGroupIds = useMemo(
    () => new Set(getAvailableGroups(entityType)),
    [entityType]
  );

  const visibleGroups = useMemo(
    () => STUDY_GROUPS.filter((g) => availableGroupIds.has(g.group)),
    [availableGroupIds]
  );

  // ── Ungrouped (legacy) entry points ──────────────────────────────────────
  const ungroupedEntries = useMemo(() => {
    let entries = getUngroupedEntryPoints(entityType);
    if (categoryFilter) {
      entries = entries.filter((ep) => ep.category === categoryFilter);
    }
    if (excludeCategories) {
      entries = entries.filter((ep) => !excludeCategories.includes(ep.category));
    }
    return entries;
  }, [entityType, categoryFilter, excludeCategories]);

  // ── Entry count per group (for badges) ───────────────────────────────────
  const groupEntryCounts = useMemo(() => {
    const counts = new Map<StudyGroup, number>();
    for (const group of visibleGroups) {
      const entries = getGroupedEntryPoints(entityType, group.group, floors);
      let filtered = entries;
      if (categoryFilter) {
        filtered = filtered.filter((ep) => ep.category === categoryFilter);
      }
      if (excludeCategories) {
        filtered = filtered.filter((ep) => !excludeCategories.includes(ep.category));
      }
      counts.set(group.group, filtered.length);
    }
    return counts;
  }, [entityType, visibleGroups, floors, categoryFilter, excludeCategories]);

  // ── Active group entries (Step 2) ────────────────────────────────────────
  const activeGroupEntries = useMemo(() => {
    if (!activeGroup) return [];
    let entries = getGroupedEntryPoints(entityType, activeGroup, floors);
    if (categoryFilter) {
      entries = entries.filter((ep) => ep.category === categoryFilter);
    }
    if (excludeCategories) {
      entries = entries.filter((ep) => !excludeCategories.includes(ep.category));
    }
    return entries;
  }, [entityType, activeGroup, floors, categoryFilter, excludeCategories]);

  // ── Check if any group has perFloor templates ────────────────────────────
  const hasPerFloorTemplates = useMemo(() => {
    const allEntries = getSortedEntryPoints(entityType);
    return allEntries.some((ep) => ep.perFloor);
  }, [entityType]);

  // ── Cross-group search ───────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];

    // Search across ALL grouped + ungrouped entries
    const allGrouped = visibleGroups.flatMap((g) =>
      getGroupedEntryPoints(entityType, g.group, floors)
    );
    const all = [...ungroupedEntries, ...allGrouped];

    let filtered = all;
    if (categoryFilter) {
      filtered = filtered.filter((ep) => ep.category === categoryFilter);
    }
    if (excludeCategories) {
      filtered = filtered.filter((ep) => !excludeCategories.includes(ep.category));
    }

    return filtered.filter((ep) => {
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
  }, [searchQuery, entityType, visibleGroups, ungroupedEntries, floors, categoryFilter, excludeCategories]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGroupClick = useCallback((group: StudyGroup) => {
    setActiveGroup(group);
    setViewState('entries');
    setSearchQuery('');
  }, []);

  const handleBackToGroups = useCallback(() => {
    setActiveGroup(null);
    setViewState('groups');
    setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setViewState('search');
      setActiveGroup(null);
    } else {
      setViewState('groups');
    }
  }, []);

  // Get selected entry point for footer/custom title
  const allEntries = useMemo(() => {
    const grouped = visibleGroups.flatMap((g) =>
      getGroupedEntryPoints(entityType, g.group, floors)
    );
    return [...ungroupedEntries, ...grouped];
  }, [entityType, visibleGroups, ungroupedEntries, floors]);

  const selectedEntryPoint = allEntries.find((ep) => ep.id === selectedEntryPointId);

  // 🏢 ENTERPRISE: Whitelist mode — flat list, no groups/search
  const allowedEntries = useMemo(() => {
    if (!allowedEntryPointIds) return null;
    const idSet = new Set(allowedEntryPointIds);
    return allEntries
      .filter((ep) => idSet.has(ep.id))
      .sort((a, b) => {
        // Preserve the order from the allowedEntryPointIds array
        return allowedEntryPointIds.indexOf(a.id) - allowedEntryPointIds.indexOf(b.id);
      });
  }, [allowedEntryPointIds, allEntries]);

  // If no groups and no ungrouped, nothing to show
  if (visibleGroups.length === 0 && ungroupedEntries.length === 0) {
    return null;
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderEntryCard = (entryPoint: UploadEntryPoint, showGroupBadge = false) => {
    const Icon = getIcon(entryPoint.icon);
    const isSelected = selectedEntryPointId === entryPoint.id;
    const isCustomTitle = entryPoint.requiresCustomTitle === true;
    const groupMeta = entryPoint.group ? getStudyGroupMeta(entryPoint.group) : undefined;

    return (
      <Tooltip key={entryPoint.id}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(entryPoint)}
            className={cn(
              'relative flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all',
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

            {isCustomTitle && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                {currentLanguage === 'el' ? '(ελεύθερος τίτλος)' : '(free title)'}
              </span>
            )}

            {showGroupBadge && groupMeta && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', groupMeta.bgClass, groupMeta.colorClass)}>
                {groupMeta.label[currentLanguage]}
              </span>
            )}

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
  };

  const renderGroupCard = (group: StudyGroupMeta) => {
    const Icon = getIcon(group.icon);
    const count = groupEntryCounts.get(group.group) ?? 0;

    return (
      <button
        key={group.group}
        type="button"
        onClick={() => handleGroupClick(group.group)}
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border-2 border-l-4 transition-all',
          'hover:shadow-md hover:scale-[1.02]',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'border-border bg-card hover:border-primary/50',
          group.borderClass
        )}
      >
        <div className={cn('flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full', group.iconBgClass)}>
          <Icon className={cn(iconSizes.md, group.colorClass)} aria-hidden="true" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h4 className="text-sm font-semibold text-foreground leading-tight">
            {group.label[currentLanguage]}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
            {group.description[currentLanguage]}
          </p>
          <span className={cn('inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full', group.bgClass, group.colorClass)}>
            {t('studies.entriesCount', { count })}
          </span>
        </div>
      </button>
    );
  };

  // 🏢 ENTERPRISE: Whitelist mode — simplified flat list (no groups, no search)
  if (allowedEntries) {
    return (
      <section className={cn('space-y-3', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
        <h3 className="text-sm font-semibold text-foreground">
          {t('upload.selectDocumentType')}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {allowedEntries.map((ep) => renderEntryCard(ep))}
        </div>

        {/* Selected description footer */}
        {selectedEntryPoint && (
          <footer className="p-2 bg-muted/50 rounded-md border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{selectedEntryPoint.label[currentLanguage]}:</strong>{' '}
              {selectedEntryPoint.description?.[currentLanguage] || t('upload.documentForCategory')}
            </p>
          </footer>
        )}

        {/* Custom title input */}
        {selectedEntryPoint?.requiresCustomTitle && (
          <div className="space-y-2">
            <label htmlFor="custom-title-allowed" className="block text-sm font-medium text-foreground">
              {t('upload.documentTitle')} <span className="text-destructive">*</span>
            </label>
            <input
              id="custom-title-allowed"
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
            />
            <p className="text-xs text-muted-foreground">
              {t('upload.customTitleHint')}
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={cn('space-y-3', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
      {/* Search — always visible */}
      <SearchInput
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder={t('studies.searchAcrossAll')}
        debounceMs={0}
        className="text-sm"
      />

      {/* ── SEARCH RESULTS VIEW ─────────────────────────────────────────── */}
      {viewState === 'search' && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {t('studies.searchResults')}
          </h3>
          {searchResults.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('upload.noSearchResults')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {searchResults.map((ep) => renderEntryCard(ep, true))}
            </div>
          )}
        </div>
      )}

      {/* ── GROUPS VIEW (Step 1) ────────────────────────────────────────── */}
      {viewState === 'groups' && (
        <div className="space-y-3">
          {/* Ungrouped (general) entries */}
          {ungroupedEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t('studies.generalDocuments')}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {ungroupedEntries.map((ep) => renderEntryCard(ep))}
              </div>
            </div>
          )}

          {/* Study groups */}
          {visibleGroups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                {t('studies.studyCategories')}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleGroups.map((group) => renderGroupCard(group))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ENTRIES VIEW (Step 2) ───────────────────────────────────────── */}
      {viewState === 'entries' && activeGroup && (
        <div className="space-y-2">
          {/* Back button + group title */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToGroups}
              className={cn(
                'flex items-center gap-1 text-sm text-muted-foreground',
                'hover:text-foreground transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring rounded-md px-1'
              )}
            >
              <LucideIcons.ArrowLeft className={iconSizes.sm} aria-hidden="true" />
              {t('studies.backToGroups')}
            </button>
          </div>

          {/* Group header */}
          {(() => {
            const meta = getStudyGroupMeta(activeGroup);
            if (!meta) return null;
            const GroupIcon = getIcon(meta.icon);
            return (
              <div className={cn('flex items-center gap-2 p-2 rounded-lg border-l-4', meta.borderClass, meta.bgClass)}>
                <GroupIcon className={cn(iconSizes.md, meta.colorClass)} aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {meta.label[currentLanguage]}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {meta.description[currentLanguage]}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* No floors warning for perFloor templates */}
          {hasPerFloorTemplates && floors.length === 0 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800">
              <LucideIcons.AlertTriangle className={cn(iconSizes.sm, 'text-yellow-600 mt-0.5 flex-shrink-0')} aria-hidden="true" />
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                {t('studies.noFloorsWarning')}
                {onNavigateToFloors && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={onNavigateToFloors}
                      className="inline-flex items-center gap-1 font-semibold text-yellow-700 underline underline-offset-2 hover:text-yellow-900 dark:text-yellow-200 dark:hover:text-yellow-100 transition-colors"
                    >
                      {navigateToFloorsLabel || t('studies.goToFloors')}
                      <LucideIcons.ArrowRight className="inline h-3 w-3" aria-hidden="true" />
                    </button>
                  </>
                )}
              </p>
            </div>
          )}

          {/* Entry cards grid */}
          {activeGroupEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('upload.noSearchResults')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {activeGroupEntries.map((ep) => renderEntryCard(ep))}
            </div>
          )}
        </div>
      )}

      {/* ── Selected description footer ─────────────────────────────────── */}
      {selectedEntryPoint && (
        <footer className="p-2 bg-muted/50 rounded-md border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{selectedEntryPoint.label[currentLanguage]}:</strong>{' '}
            {selectedEntryPoint.description?.[currentLanguage] || t('upload.documentForCategory')}
          </p>
        </footer>
      )}

      {/* ── Custom title input ──────────────────────────────────────────── */}
      {selectedEntryPoint?.requiresCustomTitle && (
        <div className="space-y-2">
          <label htmlFor="custom-title-hierarchical" className="block text-sm font-medium text-foreground">
            {t('upload.documentTitle')} <span className="text-destructive">*</span>
          </label>
          <input
            id="custom-title-hierarchical"
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
            aria-describedby="custom-title-hierarchical-hint"
          />
          <p id="custom-title-hierarchical-hint" className="text-xs text-muted-foreground">
            {t('upload.customTitleHint')}
          </p>
        </div>
      )}
    </section>
  );
}
