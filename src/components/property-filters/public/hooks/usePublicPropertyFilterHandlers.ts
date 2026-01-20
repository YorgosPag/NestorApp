'use client';

import * as React from 'react';
import type { FilterState } from '@/types/property-viewer';
import { PRICE_MAX, AREA_MAX } from '@/components/public-property-filters/constants';

export function usePublicPropertyFilterHandlers(
  filters: FilterState,
  onFiltersChange: (f: FilterState) => void
) {
  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, searchTerm: e.target.value });
    },
    [filters, onFiltersChange]
  );

  const handleTypeChange = React.useCallback(
    (type: string, checked: boolean) => {
      const newTypes = checked
        ? [...filters.propertyType, type]
        : filters.propertyType.filter((t) => t !== type);

      onFiltersChange({ ...filters, propertyType: newTypes });
    },
    [filters, onFiltersChange]
  );

  const handleStatusChange = React.useCallback(
    (status: string, checked: boolean) => {
      const newStatuses = checked
        ? [...filters.status, status]
        : filters.status.filter((s) => s !== status);

      onFiltersChange({ ...filters, status: newStatuses });
    },
    [filters, onFiltersChange]
  );

  const handlePriceRangeChange = React.useCallback(
    (values: number[]) => {
      onFiltersChange({
        ...filters,
        priceRange: {
          min: values[0] === 0 ? null : values[0],
          max: values[1] === PRICE_MAX ? null : values[1],
        },
      });
    },
    [filters, onFiltersChange]
  );

  const handleAreaRangeChange = React.useCallback(
    (values: number[]) => {
      onFiltersChange({
        ...filters,
        areaRange: {
          min: values[0] === 0 ? null : values[0],
          max: values[1] === AREA_MAX ? null : values[1],
        },
      });
    },
    [filters, onFiltersChange]
  );

  return {
    handleSearchChange,
    handleTypeChange,
    handleStatusChange,
    handlePriceRangeChange,
    handleAreaRangeChange,
  };
}
