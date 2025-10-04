'use client';

import React from 'react';
import { SortToggleButton } from './SortToggleButton';
import { BuildingFiltersMenu } from './BuildingFiltersMenu';
import { RefreshButton } from './RefreshButton';

interface ToolbarFiltersMenuProps {
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
  activeFilters: string[];
  onActiveFiltersChange: (filters: string[]) => void;
}

export function ToolbarFiltersMenu({
  sortDirection,
  onToggleSort,
  activeFilters,
  onActiveFiltersChange
}: ToolbarFiltersMenuProps) {
  
  return (
    <div className="flex items-center gap-1">
      <SortToggleButton sortDirection={sortDirection} onToggleSort={onToggleSort} />
      <BuildingFiltersMenu activeFilters={activeFilters} onActiveFiltersChange={onActiveFiltersChange} />
      <RefreshButton onRefresh={() => console.log('Refreshing...')} />
    </div>
  );
}
