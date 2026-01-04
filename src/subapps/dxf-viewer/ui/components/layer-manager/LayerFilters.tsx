import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
    <div className="space-y-2">
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Αναζήτηση layers..."
        className={`h-8 ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary} ${colors.text.muted}`}
        debounceMs={300}
      />
      
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className={`h-8 ${colors.bg.hover} ${getStatusBorder('muted')} ${colors.text.primary} ${getFocusBorder('input')}`}>
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