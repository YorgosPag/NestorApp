import React from 'react';
import { Search } from 'lucide-react';
import type { LayerFiltersProps } from './types';

export function LayerFilters({
  searchQuery,
  selectedCategory,
  categories,
  onSearchChange,
  onCategoryChange
}: LayerFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
        <input
          type="text"
          placeholder="Αναζήτηση layers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-7 h-8 text-sm bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </div>
      
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full h-8 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
      >
        {categories.map(category => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
}