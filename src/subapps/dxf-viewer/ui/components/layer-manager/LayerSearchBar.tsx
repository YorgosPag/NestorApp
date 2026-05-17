'use client';

/**
 * LayerSearchBar — quick search + category dropdown for the layer list.
 *
 * Renamed from `LayerFilters` (ADR-358 Phase 11) to free the canonical
 * `LayerFilters*` name space for the rule-based Q11 filters system. This
 * component is the lightweight top-of-list quick filter; the full filter
 * builder lives in `LayerFiltersSidebar`.
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { SearchInput } from '@/components/ui/search/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LayerSearchBarProps } from './types';
import { useTranslation } from '@/i18n';

export function LayerSearchBar({
  searchQuery,
  selectedCategory,
  categories,
  onSearchChange,
  onCategoryChange,
}: LayerSearchBarProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const { getFocusBorder, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={t('layerManager.labels.searchLayers')}
        className={`${PANEL_LAYOUT.HEIGHT.XL} ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary} ${colors.text.muted}`}
        debounceMs={300}
      />

      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className={`${PANEL_LAYOUT.HEIGHT.XL} ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary} ${getFocusBorder('input')}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.value} value={category.value}>
              {t(category.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
