
'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Filter, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { SortToggleButton } from './SortToggleButton';
import { RefreshButton } from './RefreshButton';
// 🏢 ENTERPRISE: Import centralized unit filter options - NO MORE HARDCODED VALUES
import { getUnitFilterOptions } from '@/subapps/dxf-viewer/config/modal-select';

// --- UnitFiltersMenu Logic ---
function UnitFiltersMenu({ activeFilters, onActiveFiltersChange }: {
  activeFilters: string[];
  onActiveFiltersChange: (filters: string[]) => void;
}) {
  const iconSizes = useIconSizes();
  const handleFilterChange = (filter: string, checked: boolean) => {
    onActiveFiltersChange(
      checked ? [...activeFilters, filter] : activeFilters.filter((f) => f !== filter)
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div>
          <ToolbarButton
            tooltip="Φίλτρα και Προβολή"
            badge={activeFilters.length > 0 ? activeFilters.length : undefined}
          >
            <Filter className={iconSizes.sm} />
          </ToolbarButton>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Φίλτρα Μονάδων</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {getUnitFilterOptions().map(({ value, label }) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={activeFilters.includes(value)}
            onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onActiveFiltersChange([])}>
          <X className={`${iconSizes.sm} mr-2`} />
          Καθαρισμός Φίλτρων
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


// --- Main ToolbarFiltersMenu Component ---
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
      <UnitFiltersMenu activeFilters={activeFilters} onActiveFiltersChange={onActiveFiltersChange} />
      <RefreshButton onRefresh={() => console.log('Refreshing...')} />
    </div>
  );
}
