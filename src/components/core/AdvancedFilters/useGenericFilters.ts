'use client';

import { useCallback } from 'react';
import type { GenericFilterState } from './types';

export function useGenericFilters<T extends GenericFilterState>(
  filters: T,
  onFiltersChange: (filters: T) => void
) {
  const handleFilterChange = useCallback(<K extends keyof T>(
    key: K,
    value: T[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const handleRangeChange = useCallback((
    rangeKey: string,
    subKey: 'min' | 'max',
    value: string
  ) => {
    const ranges = filters.ranges || {};
    const currentRange = ranges[rangeKey] || {};

    onFiltersChange({
      ...filters,
      ranges: {
        ...ranges,
        [rangeKey]: {
          ...currentRange,
          [subKey]: value === '' ? undefined : Number(value)
        }
      }
    } as T);
  }, [filters, onFiltersChange]);

  const handleFeatureChange = useCallback((
    featureId: string,
    checked: boolean | 'indeterminate'
  ) => {
    const currentFeatures = filters.advancedFeatures || [];
    let newFeatures: string[];

    if (checked === true) {
      newFeatures = currentFeatures.includes(featureId)
        ? currentFeatures
        : [...currentFeatures, featureId];
    } else {
      newFeatures = currentFeatures.filter(id => id !== featureId);
    }

    onFiltersChange({
      ...filters,
      advancedFeatures: newFeatures
    } as T);
  }, [filters, onFiltersChange]);

  const handleMultiSelectChange = useCallback((
    key: string,
    value: string
  ) => {
    const filtersRecord = filters as Record<string, unknown>;
    const currentValues = (Array.isArray(filtersRecord[key]) ? filtersRecord[key] : []) as string[];
    let newValues: string[];

    if (value === 'all') {
      newValues = [];
    } else {
      newValues = currentValues.includes(value)
        ? currentValues.filter((v: string) => v !== value)
        : [...currentValues, value];
    }

    onFiltersChange({
      ...filters,
      [key]: newValues
    } as T);
  }, [filters, onFiltersChange]);

  const handleSelectChange = useCallback((
    key: string,
    value: string
  ) => {
    const newValue = value === 'all' ? [] : [value];
    onFiltersChange({
      ...filters,
      [key]: newValue
    } as T);
  }, [filters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    const filtersRecord = filters as Record<string, unknown>;
    const clearedFilters = Object.keys(filters).reduce<Record<string, unknown>>((acc, key) => {
      if (key === 'searchTerm') {
        acc[key] = '';
      } else if (key === 'ranges') {
        acc[key] = {};
      } else if (key === 'advancedFeatures') {
        acc[key] = [];
      } else if (Array.isArray(filtersRecord[key])) {
        acc[key] = [];
      } else if (typeof filtersRecord[key] === 'object' && filtersRecord[key] !== null) {
        acc[key] = {};
      } else {
        acc[key] = '';
      }
      return acc;
    }, {});

    onFiltersChange(clearedFilters as T);
  }, [filters, onFiltersChange]);

  const hasActiveFilters = useCallback(() => {
    const filtersRecord = filters as Record<string, unknown>;
    return Object.keys(filters).some(key => {
      const value = filtersRecord[key];

      if (key === 'searchTerm') {
        return value !== '';
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (key === 'ranges') {
        const rangesValue = value as Record<string, { min?: number; max?: number }> | undefined;
        return Object.keys(rangesValue || {}).some(rangeKey => {
          const range = rangesValue?.[rangeKey];
          return range?.min !== undefined || range?.max !== undefined;
        });
      }
      if (typeof value === 'object' && value !== null) {
        const objectValue = value as Record<string, unknown>;
        return Object.keys(objectValue).some(subKey => {
          const subValue = objectValue[subKey];
          return subValue !== undefined && subValue !== null && subValue !== '';
        });
      }

      return value !== undefined && value !== null && value !== '';
    });
  }, [filters]);

  return {
    handleFilterChange,
    handleRangeChange,
    handleFeatureChange,
    handleMultiSelectChange,
    handleSelectChange,
    clearAllFilters,
    hasActiveFilters: hasActiveFilters()
  };
}