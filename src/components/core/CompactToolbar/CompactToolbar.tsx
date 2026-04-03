'use client';

import React from 'react';
import { SearchInput } from '@/components/ui/search';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

import type { CompactToolbarProps } from './types';
import { CompactToolbarActions } from './CompactToolbarActions';

const logger = createModuleLogger('CompactToolbar');

// ============================================================================
// TRANSLATION HELPERS
// ============================================================================

function useToolbarTranslation() {
  const { t, isNamespaceReady } = useTranslation('common');

  /** Translate search placeholder (handles i18n keys with dots) */
  const getTranslatedPlaceholder = (placeholder?: string): string => {
    if (!placeholder) return t('toolbar.search.placeholder');

    if (placeholder.includes('.')) {
      const translated = t(placeholder);
      const isSuccess = translated !== placeholder &&
        !translated.startsWith('common.') &&
        !translated.startsWith('common:');
      return isSuccess ? translated : placeholder;
    }

    return placeholder;
  };

  /** Translate tooltip key, return undefined if translation fails */
  const getTooltip = (tooltipKey?: string): string | undefined => {
    if (!tooltipKey) return undefined;

    const translated = t(tooltipKey);
    const isSuccess = translated !== tooltipKey &&
      !translated.startsWith('common.') &&
      !translated.startsWith('common:');

    if (isSuccess) return translated;

    // Only warn after ALL compat namespaces are confirmed loaded (ADR-280)
    if (process.env.NODE_ENV === 'development' && isNamespaceReady) {
      logger.warn('Translation missing for key', { tooltipKey });
    }

    return undefined;
  };

  return { t, getTranslatedPlaceholder, getTooltip };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompactToolbar({
  config,
  selectedItems = [],
  onSelectionChange: _onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  sortBy: _sortBy = 'name',
  onSortChange,
  hasSelectedContact = false,
  headerTitle,
  headerCount,
  headerIcon: HeaderIcon,
  headerIconColor,
  newItemIcon,
  deleteIcon,
  onNewItem,
  onEditItem,
  onDeleteItems,
  onExport,
  onImport,
  onRefresh,
  onPreview,
  onCopy,
  onShare,
  onReports,
  onSettings,
  onFavoritesManagement,
  onHelp
}: CompactToolbarProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const { t, getTranslatedPlaceholder, getTooltip } = useToolbarTranslation();

  return (
    <div className={`flex flex-col ${spacing.gap.sm} ${spacing.padding.sm} ${colors.bg.transparent}`}>

      {/* Action icons row with selection indicator */}
      <div className={`flex items-center justify-between flex-wrap ${spacing.gap.sm}`}>
        <div className={`flex items-center flex-wrap ${spacing.gap.sm}`}>
          <CompactToolbarActions
            config={config}
            selectedItems={selectedItems}
            activeFilters={activeFilters}
            onFiltersChange={onFiltersChange}
            onSortChange={onSortChange}
            hasSelectedContact={hasSelectedContact}
            newItemIcon={newItemIcon}
            deleteIcon={deleteIcon}
            onNewItem={onNewItem}
            onEditItem={onEditItem}
            onDeleteItems={onDeleteItems}
            onExport={onExport}
            onImport={onImport}
            onRefresh={onRefresh}
            onPreview={onPreview}
            onCopy={onCopy}
            onShare={onShare}
            onReports={onReports}
            onSettings={onSettings}
            onFavoritesManagement={onFavoritesManagement}
            onHelp={onHelp}
            getTooltip={getTooltip}
          />
        </div>

        {/* Selection indicator */}
        {selectedItems.length > 0 && (
          <div className={`text-xs whitespace-nowrap ${colors.text.muted}`}>
            {t('toolbar.ui.itemsSelected', { count: selectedItems.length })}
          </div>
        )}
      </div>

      {/* Search Row */}
      <div className={`flex items-center ${spacing.gap.sm} ${spacing.margin.top.sm}`}>
        {(headerTitle || headerCount !== undefined || HeaderIcon) && (
          <div className={`flex items-center ${spacing.gap.sm} flex-shrink-0`}>
            {HeaderIcon && (
              <HeaderIcon className={`${iconSizes.sm} ${headerIconColor || colors.text.info}`} />
            )}
            {headerTitle && (
              <span className="font-medium text-sm whitespace-nowrap">
                {headerTitle}{headerCount !== undefined ? ` (${headerCount})` : ''}
              </span>
            )}
          </div>
        )}

        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={getTranslatedPlaceholder(config.searchPlaceholder)}
          debounceMs={0}
          showClearButton
          className="h-8 text-sm flex-1"
        />
      </div>

    </div>
  );
}
