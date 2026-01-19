'use client';

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useIconSizes } from '@/hooks/useIconSizes';
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { FilterState } from '@/types/property-viewer';
import { useFilterState } from '@/hooks/useFilterState';
import { FilterControls } from './filters/FilterControls';
import { AdvancedFilters } from './filters/AdvancedFilters';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';


interface PropertyViewerFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function PropertyViewerFilters({ filters, onFiltersChange }: PropertyViewerFiltersProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');
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
                  <RotateCcw className={`${iconSizes.sm} mr-2`} />
                  {t('viewerFilters.resetFilters')}
              </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
