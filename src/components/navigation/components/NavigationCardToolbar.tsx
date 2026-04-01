'use client';

/**
 * Navigation Card Toolbar Component
 * Compact toolbar for navigation cards using centralized CompactToolbar
 * Different actions per navigation level (companies, projects, buildings, floors)
 *
 * 🏢 ENTERPRISE: Full i18n support - ZERO HARDCODED STRINGS
 *
 * Helper functions and config extracted to NavigationCardToolbar.config.ts (ADR-261)
 */

import React from 'react';
import { CompactToolbar } from '@/components/core/CompactToolbar/CompactToolbar';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Helpers extracted for SRP compliance (ADR-261)
import {
  getLevelTitle,
  getLevelIcon,
  getDeleteIcon,
  getNewItemIcon,
  getLevelIconColor,
  getToolbarConfig,
} from './NavigationCardToolbar.config';
import type { NavigationLevel } from './NavigationCardToolbar.config';

interface NavigationCardToolbarProps {
  level: NavigationLevel;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  selectedItems?: string[];
  hasSelectedItems?: boolean;
  // 🏢 ENTERPRISE Header Display - Same as GenericListHeader
  itemCount?: number; // Count of items in this navigation level
  onNewItem?: () => void;
  onEditItem?: () => void;
  onDeleteItem?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSettings?: () => void;
  onReports?: () => void;
  onShare?: () => void;
  onHelp?: () => void;
}

export function NavigationCardToolbar({
  level,
  searchTerm,
  onSearchChange,
  activeFilters,
  onFiltersChange,
  selectedItems = [],
  hasSelectedItems = false,
  itemCount, // 🏢 NEW: Count of items for header display
  onNewItem,
  onEditItem,
  onDeleteItem,
  onRefresh,
  onExport,
  onImport,
  onSettings,
  onReports,
  onShare,
  onHelp
}: NavigationCardToolbarProps) {
  // 🏢 ENTERPRISE: i18n hooks - navigation for entity-specific labels, common for shared buttons
  const { t } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');

  // Get config with i18n translations
  const config = getToolbarConfig(level, t, tCommon);

  return (
    <CompactToolbar
      config={config}
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      activeFilters={activeFilters}
      onFiltersChange={onFiltersChange}
      selectedItems={selectedItems}
      hasSelectedContact={hasSelectedItems}
      // 🏢 ENTERPRISE Header Display - Same pattern as GenericListHeader
      // 🏢 ENTERPRISE: Uses i18n translations for fully localized titles
      headerTitle={getLevelTitle(level, t)}
      headerCount={itemCount}
      headerIcon={getLevelIcon(level)}
      headerIconColor={getLevelIconColor(level)}
      // 🏢 ENTERPRISE: Custom icons for semantic correctness
      newItemIcon={getNewItemIcon(level)}
      deleteIcon={getDeleteIcon(level)}
      onNewItem={onNewItem}
      onEditItem={() => onEditItem?.()}
      onDeleteItems={() => onDeleteItem?.()}
      onRefresh={onRefresh}
      onExport={onExport}
      onImport={onImport}
      onSettings={onSettings}
      onReports={onReports}
      onShare={onShare}
      onHelp={onHelp}
    />
  );
}

export default NavigationCardToolbar;

// 🏢 ENTERPRISE: Re-export types for backward compatibility
export type { NavigationLevel } from './NavigationCardToolbar.config';
