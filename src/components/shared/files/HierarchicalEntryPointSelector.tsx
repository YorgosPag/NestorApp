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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
} from '@/config/upload-entry-points';
import {
  STUDY_GROUPS,
  getStudyGroupMeta,
  type StudyGroup,
} from '@/config/study-groups-config';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted card components
import { EntryCard, GroupCard, getIcon } from './hierarchical-entry-cards';

// Re-exports for backward compatibility
export { EntryCard, GroupCard } from './hierarchical-entry-cards';
export type { EntryCardProps, GroupCardProps } from './hierarchical-entry-cards';

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
  allowedEntryPointIds?: string[];
  floors?: FloorInfo[];
  onNavigateToFloors?: () => void;
  navigateToFloorsLabel?: string;
}

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
  const colors = useSemanticColors();

  const currentLanguage = (language || i18n.language?.split('-')[0] || 'en') as 'el' | 'en';

  const availableGroupIds = useMemo(() => new Set(getAvailableGroups(entityType)), [entityType]);
  const visibleGroups = useMemo(() => STUDY_GROUPS.filter((g) => availableGroupIds.has(g.group)), [availableGroupIds]);

  const ungroupedEntries = useMemo(() => {
    let entries = getUngroupedEntryPoints(entityType);
    if (categoryFilter) entries = entries.filter((ep) => ep.category === categoryFilter);
    if (excludeCategories) entries = entries.filter((ep) => !excludeCategories.includes(ep.category));
    return entries;
  }, [entityType, categoryFilter, excludeCategories]);

  const groupEntryCounts = useMemo(() => {
    const counts = new Map<StudyGroup, number>();
    for (const group of visibleGroups) {
      let filtered = getGroupedEntryPoints(entityType, group.group, floors);
      if (categoryFilter) filtered = filtered.filter((ep) => ep.category === categoryFilter);
      if (excludeCategories) filtered = filtered.filter((ep) => !excludeCategories.includes(ep.category));
      counts.set(group.group, filtered.length);
    }
    return counts;
  }, [entityType, visibleGroups, floors, categoryFilter, excludeCategories]);

  const activeGroupEntries = useMemo(() => {
    if (!activeGroup) return [];
    let entries = getGroupedEntryPoints(entityType, activeGroup, floors);
    if (categoryFilter) entries = entries.filter((ep) => ep.category === categoryFilter);
    if (excludeCategories) entries = entries.filter((ep) => !excludeCategories.includes(ep.category));
    return entries;
  }, [entityType, activeGroup, floors, categoryFilter, excludeCategories]);

  const hasPerFloorTemplates = useMemo(() => {
    return getSortedEntryPoints(entityType).some((ep) => ep.perFloor);
  }, [entityType]);

  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    const allGrouped = visibleGroups.flatMap((g) => getGroupedEntryPoints(entityType, g.group, floors));
    let all = [...ungroupedEntries, ...allGrouped];
    if (categoryFilter) all = all.filter((ep) => ep.category === categoryFilter);
    if (excludeCategories) all = all.filter((ep) => !excludeCategories.includes(ep.category));
    return all.filter((ep) => {
      if (ep.requiresCustomTitle) return true;
      const haystack = [ep.label.el, ep.label.en, ep.description?.el, ep.description?.en].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [searchQuery, entityType, visibleGroups, ungroupedEntries, floors, categoryFilter, excludeCategories]);

  const handleGroupClick = useCallback((group: StudyGroup) => {
    setActiveGroup(group); setViewState('entries'); setSearchQuery('');
  }, []);

  const handleBackToGroups = useCallback(() => {
    setActiveGroup(null); setViewState('groups'); setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) { setViewState('search'); setActiveGroup(null); } else { setViewState('groups'); }
  }, []);

  const allEntries = useMemo(() => {
    const grouped = visibleGroups.flatMap((g) => getGroupedEntryPoints(entityType, g.group, floors));
    return [...ungroupedEntries, ...grouped];
  }, [entityType, visibleGroups, ungroupedEntries, floors]);

  const selectedEntryPoint = allEntries.find((ep) => ep.id === selectedEntryPointId);

  const allowedEntries = useMemo(() => {
    if (!allowedEntryPointIds) return null;
    const idSet = new Set(allowedEntryPointIds);
    return allEntries
      .filter((ep) => idSet.has(ep.id))
      .sort((a, b) => allowedEntryPointIds.indexOf(a.id) - allowedEntryPointIds.indexOf(b.id));
  }, [allowedEntryPointIds, allEntries]);

  if (visibleGroups.length === 0 && ungroupedEntries.length === 0) return null;

  // ── Custom title input (shared) ──────────────────────────────────────────
  const renderCustomTitleInput = (htmlId: string) => (
    selectedEntryPoint?.requiresCustomTitle ? (
      <div className="space-y-2">
        <label htmlFor={htmlId} className="block text-sm font-medium text-foreground">
          {t('upload.documentTitle')} <span className="text-destructive">*</span>
        </label>
        <input
          id={htmlId}
          type="text"
          value={customTitle}
          onChange={(e) => onCustomTitleChange?.(e.target.value)}
          placeholder={t('upload.customTitlePlaceholder')}
          required
          className={cn(
            'w-full px-2 py-2 rounded-md border bg-background text-foreground',
            `placeholder:${colors.text.muted}`,
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'transition-colors',
            customTitle.trim() === '' ? 'border-destructive/50 focus:ring-destructive' : 'border-border'
          )}
          aria-required="true"
          aria-invalid={customTitle.trim() === ''}
        />
        <p className={cn("text-xs", colors.text.muted)}>{t('upload.customTitleHint')}</p>
      </div>
    ) : null
  );

  // ── Selected description footer (shared) ─────────────────────────────────
  const renderSelectedFooter = () => (
    selectedEntryPoint ? (
      <footer className="p-2 bg-muted/50 rounded-md border border-border">
        <p className={cn("text-xs", colors.text.muted)}>
          <strong className="text-foreground">{selectedEntryPoint.label[currentLanguage]}:</strong>{' '}
          {selectedEntryPoint.description?.[currentLanguage] || t('upload.documentForCategory')}
        </p>
      </footer>
    ) : null
  );

  // 🏢 ENTERPRISE: Whitelist mode
  if (allowedEntries) {
    return (
      <section className={cn('space-y-3', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
        <h3 className="text-sm font-semibold text-foreground">{t('upload.selectDocumentType')}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {allowedEntries.map((ep) => (
            <EntryCard key={ep.id} entryPoint={ep} isSelected={selectedEntryPointId === ep.id} currentLanguage={currentLanguage} onSelect={onSelect} freeTitleLabel={t('upload.freeTitle')} />
          ))}
        </div>
        {renderSelectedFooter()}
        {renderCustomTitleInput('custom-title-allowed')}
      </section>
    );
  }

  return (
    <section className={cn('space-y-3', className)} role="radiogroup" aria-label={t('upload.selectDocumentType')}>
      <SearchInput value={searchQuery} onChange={handleSearchChange} placeholder={t('studies.searchAcrossAll')} debounceMs={0} className="text-sm" />

      {/* SEARCH RESULTS VIEW */}
      {viewState === 'search' && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">{t('studies.searchResults')}</h3>
          {searchResults.length === 0 ? (
            <p className={cn("py-6 text-center text-sm", colors.text.muted)}>{t('upload.noSearchResults')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {searchResults.map((ep) => (
                <EntryCard key={ep.id} entryPoint={ep} isSelected={selectedEntryPointId === ep.id} currentLanguage={currentLanguage} showGroupBadge onSelect={onSelect} freeTitleLabel={t('upload.freeTitle')} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* GROUPS VIEW (Step 1) */}
      {viewState === 'groups' && (
        <div className="space-y-3">
          {ungroupedEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('studies.generalDocuments')}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {ungroupedEntries.map((ep) => (
                  <EntryCard key={ep.id} entryPoint={ep} isSelected={selectedEntryPointId === ep.id} currentLanguage={currentLanguage} onSelect={onSelect} freeTitleLabel={t('upload.freeTitle')} />
                ))}
              </div>
            </div>
          )}

          {visibleGroups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('studies.studyCategories')}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleGroups.map((group) => (
                  <GroupCard key={group.group} group={group} count={groupEntryCounts.get(group.group) ?? 0} currentLanguage={currentLanguage} onGroupClick={handleGroupClick} entriesCountLabel={t('studies.entriesCount', { count: groupEntryCounts.get(group.group) ?? 0 })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENTRIES VIEW (Step 2) */}
      {viewState === 'entries' && activeGroup && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToGroups}
              className={cn(`flex items-center gap-1 text-sm ${colors.text.muted}`, 'hover:text-foreground transition-colors', 'focus:outline-none focus:ring-2 focus:ring-ring rounded-md px-1')}
            >
              <LucideIcons.ArrowLeft className={iconSizes.sm} aria-hidden="true" />
              {t('studies.backToGroups')}
            </button>
          </div>

          {(() => {
            const meta = getStudyGroupMeta(activeGroup);
            if (!meta) return null;
            const GroupIcon = getIcon(meta.icon);
            return (
              <div className={cn('flex items-center gap-2 p-2 rounded-lg border-l-4', meta.borderClass, meta.bgClass)}>
                <GroupIcon className={cn(iconSizes.md, meta.colorClass)} aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{meta.label[currentLanguage]}</h3>
                  <p className={cn("text-xs", colors.text.muted)}>{meta.description[currentLanguage]}</p>
                </div>
              </div>
            );
          })()}

          {hasPerFloorTemplates && floors.length === 0 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"> {/* eslint-disable-line design-system/enforce-semantic-colors */}
              <LucideIcons.AlertTriangle className={cn(iconSizes.sm, 'text-yellow-600 mt-0.5 flex-shrink-0')} aria-hidden="true" /> {/* eslint-disable-line design-system/enforce-semantic-colors */}
              <p className="text-xs text-yellow-800 dark:text-yellow-300"> {/* eslint-disable-line design-system/enforce-semantic-colors */}
                {t('studies.noFloorsWarning')}
                {onNavigateToFloors && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={onNavigateToFloors}
                      className="inline-flex items-center gap-1 font-semibold text-yellow-700 underline underline-offset-2 hover:text-yellow-900 dark:text-yellow-200 dark:hover:text-yellow-100 transition-colors" // eslint-disable-line design-system/enforce-semantic-colors
                    >
                      {navigateToFloorsLabel || t('studies.goToFloors')}
                      <LucideIcons.ArrowRight className="inline h-3 w-3" aria-hidden="true" />
                    </button>
                  </>
                )}
              </p>
            </div>
          )}

          {activeGroupEntries.length === 0 ? (
            <p className={cn("py-6 text-center text-sm", colors.text.muted)}>{t('upload.noSearchResults')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {activeGroupEntries.map((ep) => (
                <EntryCard key={ep.id} entryPoint={ep} isSelected={selectedEntryPointId === ep.id} currentLanguage={currentLanguage} onSelect={onSelect} freeTitleLabel={t('upload.freeTitle')} />
              ))}
            </div>
          )}
        </div>
      )}

      {renderSelectedFooter()}
      {renderCustomTitleInput('custom-title-hierarchical')}
    </section>
  );
}
