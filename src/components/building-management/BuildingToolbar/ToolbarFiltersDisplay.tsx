'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ToolbarFiltersDisplayProps {
  activeFilters: string[];
  onActiveFiltersChange: (filters: string[]) => void;
}

export function ToolbarFiltersDisplay({
  activeFilters,
  onActiveFiltersChange
}: ToolbarFiltersDisplayProps) {
  const handleRemoveFilter = (filterToRemove: string) => {
    onActiveFiltersChange(activeFilters.filter(f => f !== filterToRemove));
  };

  const handleClearAll = () => {
    onActiveFiltersChange([]);
  };

  return (
    <div className="px-2 pb-2 border-t border-border/50">
      <div className="flex items-center gap-2 pt-2">
        <span className="text-xs text-muted-foreground">Ενεργά φίλτρα:</span>
        <div className="flex flex-wrap gap-1">
          {activeFilters.map((filter) => (
            <CommonBadge
              key={filter}
              status="building"
              customLabel={
                <div className="flex items-center gap-1">
                  {filter}
                  <button
                    onClick={() => handleRemoveFilter(filter)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              }
              variant="secondary"
              className="text-xs px-2 py-0.5"
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-6 px-2 text-xs"
          >
            Καθαρισμός όλων
          </Button>
        </div>
      </div>
    </div>
  );
}