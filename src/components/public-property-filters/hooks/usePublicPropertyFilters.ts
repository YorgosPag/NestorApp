"use client";

/**
 * 🏢 ADR-051: PUBLIC-FACING FILTER HANDLERS
 *
 * This hook is INTENTIONALLY SEPARATE from the centralized useGenericFilters because:
 * 1. It provides specialized slider handlers with null-on-boundary logic
 * 2. It's designed for public-facing UI (customer portal)
 * 3. It does NOT perform filtering - only provides UI state handlers
 *
 * The actual filtering is done by usePropertyFilters which uses centralized utilities.
 *
 * @see @/components/core/AdvancedFilters/useGenericFilters for internal admin filters
 * @see @/hooks/usePropertyFilters for centralized filtering logic
 */

import { useCallback } from "react";
import type { FilterState } from "@/types/property-viewer";
import { PRICE_MIN, PRICE_MAX, AREA_MIN, AREA_MAX } from "../constants";

export function usePublicPropertyFilters(
  filters: FilterState,
  onFiltersChange: (next: FilterState) => void
) {
  const set = useCallback((patch: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...patch });
  }, [filters, onFiltersChange]);

  const onSearch = useCallback((value: string) => {
    set({ searchTerm: value });
  }, [set]);

  const onTypeToggle = useCallback((type: string, checked: boolean) => {
    const next = checked
      ? [...filters.propertyType, type]
      : filters.propertyType.filter(t => t !== type);
    set({ propertyType: next });
  }, [filters.propertyType, set]);

  const onStatusToggle = useCallback((status: string, checked: boolean) => {
    const next = checked
      ? [...filters.status, status]
      : filters.status.filter(s => s !== status);
    set({ status: next });
  }, [filters.status, set]);

  // 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
  const onPriceRange = useCallback((vals: [number, number]) => {
    set({
      priceRange: {
        min: vals[0] === PRICE_MIN ? undefined : vals[0],
        max: vals[1] === PRICE_MAX ? undefined : vals[1],
      }
    });
  }, [set]);

  // 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
  const onAreaRange = useCallback((vals: [number, number]) => {
    set({
      areaRange: {
        min: vals[0] === AREA_MIN ? undefined : vals[0],
        max: vals[1] === AREA_MAX ? undefined : vals[1],
      }
    });
  }, [set]);

  return { onSearch, onTypeToggle, onStatusToggle, onPriceRange, onAreaRange };
}
