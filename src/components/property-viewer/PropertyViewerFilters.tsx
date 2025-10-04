'use client';

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import type { FilterState } from '@/types/property-viewer';
import { useFilterState } from '@/hooks/useFilterState';
import { FilterControls } from './filters/FilterControls';
import { AdvancedFilters } from './filters/AdvancedFilters';


interface PropertyViewerFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function PropertyViewerFilters({ filters, onFiltersChange }: PropertyViewerFiltersProps) {
  const {
    handleFilterChange,
    handleRangeChange,
    handleFeatureChange,
    clearAllFilters,
    hasActiveFilters,
  } = useFilterState(filters, onFiltersChange);

  return (
    <Card className="w-full bg-card/50 border-none shadow-none">
      <CardContent className="space-y-4 p-2">
        <FilterControls
          filters={filters}
          onFilterChange={handleFilterChange}
          onRangeChange={handleRangeChange}
        />
        <AdvancedFilters
          features={filters.features}
          onFeatureChange={handleFeatureChange}
        />
        {hasActiveFilters && (
          <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Επαναφορά Φίλτρων
              </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
