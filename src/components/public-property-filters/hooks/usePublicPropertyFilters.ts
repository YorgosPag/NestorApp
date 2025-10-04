"use client";
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

  const onPriceRange = useCallback((vals: [number, number]) => {
    set({
      priceRange: {
        min: vals[0] === PRICE_MIN ? null : vals[0],
        max: vals[1] === PRICE_MAX ? null : vals[1],
      }
    });
  }, [set]);

  const onAreaRange = useCallback((vals: [number, number]) => {
    set({
      areaRange: {
        min: vals[0] === AREA_MIN ? null : vals[0],
        max: vals[1] === AREA_MAX ? null : vals[1],
      }
    });
  }, [set]);

  return { onSearch, onTypeToggle, onStatusToggle, onPriceRange, onAreaRange };
}
