import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { SearchInput } from '@/components/ui/search/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LayerFiltersProps } from './types';

export function LayerFilters({
  searchQuery,
  selectedCategory,
  categories,
  onSearchChange,
  onCategoryChange
}: LayerFiltersProps) {
  const { getFocusBorder, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Αναζήτηση layers..."
        className={`${PANEL_LAYOUT.HEIGHT.XL} ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary} ${colors.text.muted}`}
        debounceMs={300}
      />
      
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className={`${PANEL_LAYOUT.HEIGHT.XL} ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary} ${getFocusBorder('input')}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map(category => (
            <SelectItem key={category.value} value={category.value}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}