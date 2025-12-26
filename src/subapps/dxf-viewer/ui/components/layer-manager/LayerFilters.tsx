import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
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
  return (
    <div className="space-y-2">
      <SearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Αναζήτηση layers..."
        className={`h-8 bg-gray-700 ${getStatusBorder('muted')} text-white placeholder-gray-400`}
        debounceMs={300}
      />
      
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className={`h-8 bg-gray-700 ${getStatusBorder('muted')} text-white ${getFocusBorder('input')}`}>
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