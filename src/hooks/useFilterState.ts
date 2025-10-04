'use client';

import { useCallback, useMemo } from 'react';
import type { FilterState } from '@/types/property-viewer';

const defaultFilters: FilterState = {
  searchTerm: '',
  project: [],
  building: [],
  floor: [],
  propertyType: [],
  status: [],
  priceRange: { min: null, max: null },
  areaRange: { min: null, max: null },
  features: [],
};

export function useFilterState(filters: FilterState, onFiltersChange: (filters: FilterState) => void) {
  const handleFilterChange = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  }, [filters, onFiltersChange]);

  const handleRangeChange = useCallback((
    key: 'priceRange' | 'areaRange',
    subKey: 'min' | 'max',
    value: string
  ) => {
    const numericValue = value ? parseFloat(value) : null;
    handleFilterChange(key, { ...filters[key], [subKey]: numericValue });
  }, [filters, handleFilterChange]);
  
  const handleFeatureChange = useCallback((featureId: string, checked: boolean | 'indeterminate') => {
    const currentFeatures = filters.features || [];
    const newFeatures = checked
      ? [...currentFeatures, featureId]
      : currentFeatures.filter(id => id !== featureId);
    handleFilterChange('features', newFeatures);
  }, [filters, handleFilterChange]);
  
  const clearAllFilters = useCallback(() => {
    onFiltersChange(defaultFilters);
  }, [onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchTerm ||
      filters.project.length > 0 ||
      filters.building.length > 0 ||
      filters.floor.length > 0 ||
      filters.propertyType.length > 0 ||
      filters.status.length > 0 ||
      filters.priceRange.min !== null ||
      filters.priceRange.max !== null ||
      filters.areaRange.min !== null ||
      filters.areaRange.max !== null ||
      filters.features.length > 0
    );
  }, [filters]);

  return {
    handleFilterChange,
    handleRangeChange,
    handleFeatureChange,
    clearAllFilters,
    hasActiveFilters,
  };
}
