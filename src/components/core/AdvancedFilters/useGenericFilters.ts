'use client';

import { useCallback, useMemo } from 'react';
import type { GenericFilterState, NumericRange, DateFromToRange } from './types';
import { normalizeNumericRange, hasActiveNumericRange, hasActiveDateRange } from './types';

// ============================================================================
// ADR-051: ENTERPRISE GENERIC FILTERS HOOK
// Centralized filter management with type-safe operations
// ============================================================================

/**
 * 🏢 ENTERPRISE: Return type for useGenericFilters hook
 * Provides comprehensive filter management capabilities
 */
export interface UseGenericFiltersReturn<T extends GenericFilterState> {
  /** Update a single filter value */
  handleFilterChange: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Update a numeric range filter (min/max) */
  handleRangeChange: (rangeKey: string, subKey: 'min' | 'max', value: string) => void;
  /** Toggle a feature in features array (configurable key, default: 'advancedFeatures') */
  handleFeatureChange: (featureId: string, checked: boolean | 'indeterminate', featureKey?: string) => void;
  /** Toggle a value in a multiselect array */
  handleMultiSelectChange: (key: string, value: string) => void;
  /** Set a single-select value (converts to array) */
  handleSelectChange: (key: string, value: string) => void;
  /** Reset all filters to default values */
  clearAllFilters: () => void;
  /** Whether any filters are currently active */
  hasActiveFilters: boolean;
  /** Count of active filter fields */
  activeFilterCount: number;

  // ============================================================================
  // ADR-051: NEW ENTERPRISE METHODS
  // ============================================================================

  /** 🏢 ENTERPRISE: Set a complete numeric range at once */
  setNumericRange: (key: string, range: NumericRange) => void;
  /** 🏢 ENTERPRISE: Set a complete date range at once (from/to pattern) */
  setDateRange: (key: string, range: DateFromToRange) => void;
  /** 🏢 ENTERPRISE: Toggle a value in any string array field */
  toggleArrayValue: (key: string, value: string) => void;
  /** 🏢 ENTERPRISE: Set search term directly */
  setSearchTerm: (term: string) => void;
  /** 🏢 ENTERPRISE: Batch update multiple filters at once */
  batchUpdate: (updates: Partial<T>) => void;
}

export function useGenericFilters<T extends GenericFilterState>(
  filters: T,
  onFiltersChange: (filters: T) => void,
  defaultFilters?: T
): UseGenericFiltersReturn<T> {
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
    const filtersRecord = filters as Record<string, unknown>;

    // 🔧 ENTERPRISE FIX: Handle both nested ranges and direct range properties
    if (filtersRecord[rangeKey] !== undefined) {
      // Direct range property (e.g., areaRange, priceRange)
      const currentRange = (filtersRecord[rangeKey] || {}) as Record<string, unknown>;
      const newRange = {
        ...currentRange,
        [subKey]: value === '' ? undefined : Number(value)
      };

      onFiltersChange({
        ...filters,
        [rangeKey]: newRange
      } as T);
    } else {
      // Nested ranges property (legacy support)
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
    }
  }, [filters, onFiltersChange]);

  /**
   * 🏢 ENTERPRISE: Handle feature toggle with configurable key
   * @param featureId - The feature ID to toggle
   * @param checked - Whether the feature is checked
   * @param featureKey - The key in filters object (default: 'advancedFeatures', can be 'features' for FilterState)
   */
  const handleFeatureChange = useCallback((
    featureId: string,
    checked: boolean | 'indeterminate',
    featureKey: string = 'advancedFeatures'
  ) => {
    const filtersRecord = filters as Record<string, unknown>;
    const currentFeatures = (Array.isArray(filtersRecord[featureKey]) ? filtersRecord[featureKey] : []) as string[];
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
      [featureKey]: newFeatures
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
    // 🏢 ENTERPRISE: If defaultFilters provided, reset to those (supports string-based defaults like 'all')
    if (defaultFilters) {
      onFiltersChange({ ...defaultFilters });
      return;
    }

    // Fallback: generic reset for backward compatibility (array-based filter states)
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
  }, [filters, onFiltersChange, defaultFilters]);

  // ============================================================================
  // ADR-051: NEW ENTERPRISE METHODS
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Set a complete numeric range at once
   * Normalizes null → undefined for consistency
   */
  const setNumericRange = useCallback((key: string, range: NumericRange) => {
    const normalized = normalizeNumericRange(range);
    onFiltersChange({
      ...filters,
      [key]: normalized
    } as T);
  }, [filters, onFiltersChange]);

  /**
   * 🏢 ENTERPRISE: Set a complete date range at once (from/to pattern)
   */
  const setDateRange = useCallback((key: string, range: DateFromToRange) => {
    onFiltersChange({
      ...filters,
      [key]: range
    } as T);
  }, [filters, onFiltersChange]);

  /**
   * 🏢 ENTERPRISE: Toggle a value in any string array field
   * Generic version of handleMultiSelectChange without 'all' handling
   */
  const toggleArrayValue = useCallback((key: string, value: string) => {
    const filtersRecord = filters as Record<string, unknown>;
    const currentValues = (Array.isArray(filtersRecord[key]) ? filtersRecord[key] : []) as string[];

    const newValues = currentValues.includes(value)
      ? currentValues.filter((v: string) => v !== value)
      : [...currentValues, value];

    onFiltersChange({
      ...filters,
      [key]: newValues
    } as T);
  }, [filters, onFiltersChange]);

  /**
   * 🏢 ENTERPRISE: Set search term directly
   */
  const setSearchTerm = useCallback((term: string) => {
    onFiltersChange({
      ...filters,
      searchTerm: term
    } as T);
  }, [filters, onFiltersChange]);

  /**
   * 🏢 ENTERPRISE: Batch update multiple filters at once
   * Useful for resetting to a preset or applying saved filter sets
   */
  const batchUpdate = useCallback((updates: Partial<T>) => {
    onFiltersChange({
      ...filters,
      ...updates
    });
  }, [filters, onFiltersChange]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const { hasActiveFilters, activeFilterCount } = useMemo(() => {
    const filtersRecord = filters as Record<string, unknown>;
    let count = 0;
    let hasActive = false;

    Object.keys(filters).forEach(key => {
      const value = filtersRecord[key];
      let isActive = false;

      if (key === 'searchTerm') {
        isActive = typeof value === 'string' && value !== '';
      } else if (Array.isArray(value)) {
        isActive = value.length > 0;
      } else if (key === 'ranges') {
        const rangesValue = value as Record<string, NumericRange> | undefined;
        if (rangesValue) {
          isActive = Object.keys(rangesValue).some(rangeKey => {
            const range = rangesValue[rangeKey];
            return hasActiveNumericRange(range);
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        // Check for range objects or date ranges
        const objValue = value as Record<string, unknown>;

        // Check numeric range (min/max)
        if ('min' in objValue || 'max' in objValue) {
          isActive = hasActiveNumericRange(objValue as NumericRange);
        }
        // Check date range (from/to)
        else if ('from' in objValue || 'to' in objValue) {
          isActive = hasActiveDateRange(objValue as DateFromToRange);
        }
        // Check date range (start/end)
        else if ('start' in objValue || 'end' in objValue) {
          isActive = objValue.start !== undefined || objValue.end !== undefined;
        }
        // Generic object check
        else {
          isActive = Object.values(objValue).some(
            subValue => subValue !== undefined && subValue !== null && subValue !== ''
          );
        }
      } else if (typeof value === 'boolean') {
        isActive = value === true;
      } else {
        isActive = value !== undefined && value !== null && value !== '';
      }

      if (isActive) {
        count++;
        hasActive = true;
      }
    });

    return { hasActiveFilters: hasActive, activeFilterCount: count };
  }, [filters]);

  return {
    // Original methods
    handleFilterChange,
    handleRangeChange,
    handleFeatureChange,
    handleMultiSelectChange,
    handleSelectChange,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,

    // ADR-051: New enterprise methods
    setNumericRange,
    setDateRange,
    toggleArrayValue,
    setSearchTerm,
    batchUpdate,
  };
}

// ============================================================================
// ADR-051: CENTRALIZED PROPERTY GRID FILTERS HOOK
// TypeScript function overloads for type-safe return based on options
// ============================================================================

import { useState } from 'react';
import { applyPropertyFilters } from './utils/applyFilters';

/**
 * 🏢 ENTERPRISE: Generic property type for filtering
 * Extends the minimum requirements for property filtering
 */
interface PropertyForFiltering {
  id: string;
  name?: string;
  type?: string;
  price?: number;
  area?: number;
}

/**
 * 🏢 ENTERPRISE: Options for usePropertyGridFilters
 */
interface UsePropertyGridFiltersOptions {
  /** Include viewMode state management (default: true) */
  includeViewMode?: boolean;
}

/**
 * 🏢 ENTERPRISE: Base return type (without viewMode)
 */
interface PropertyGridFiltersBaseReturn<T> {
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  priceRange: { min: string; max: string };
  setPriceRange: React.Dispatch<React.SetStateAction<{ min: string; max: string }>>;
  areaRange: { min: string; max: string };
  setAreaRange: React.Dispatch<React.SetStateAction<{ min: string; max: string }>>;
  availableProperties: T[];
  filteredProperties: T[];
}

/**
 * 🏢 ENTERPRISE: Return type WITH viewMode
 */
interface PropertyGridFiltersWithViewMode<T> extends PropertyGridFiltersBaseReturn<T> {
  viewMode: 'grid' | 'list';
  setViewMode: React.Dispatch<React.SetStateAction<'grid' | 'list'>>;
}

/**
 * 🏢 ENTERPRISE: Return type WITHOUT viewMode
 */
type PropertyGridFiltersWithoutViewMode<T> = PropertyGridFiltersBaseReturn<T>;

// Function overloads for type-safe returns
/**
 * 🏢 ENTERPRISE: Property Grid Filters Hook (ADR-051 Compliant)
 *
 * Centralized hook that uses applyPropertyFilters utility.
 * Supports optional viewMode state based on options parameter.
 *
 * @example
 * // With viewMode (default)
 * const { viewMode, setViewMode, filteredProperties } = usePropertyGridFilters(properties, filters);
 *
 * @example
 * // Without viewMode (for Single Source of Truth pages)
 * const { filteredProperties } = usePropertyGridFilters(properties, filters, { includeViewMode: false });
 */
export function usePropertyGridFilters<T extends PropertyForFiltering>(
  allProperties: T[],
  filters: { propertyType: string[] },
  options?: { includeViewMode: true }
): PropertyGridFiltersWithViewMode<T>;

export function usePropertyGridFilters<T extends PropertyForFiltering>(
  allProperties: T[],
  filters: { propertyType: string[] },
  options: { includeViewMode: false }
): PropertyGridFiltersWithoutViewMode<T>;

export function usePropertyGridFilters<T extends PropertyForFiltering>(
  allProperties: T[],
  filters: { propertyType: string[] },
  options?: UsePropertyGridFiltersOptions
): PropertyGridFiltersWithViewMode<T> | PropertyGridFiltersWithoutViewMode<T>;

export function usePropertyGridFilters<T extends PropertyForFiltering>(
  allProperties: T[],
  filters: { propertyType: string[] },
  options: UsePropertyGridFiltersOptions = { includeViewMode: true }
): PropertyGridFiltersWithViewMode<T> | PropertyGridFiltersWithoutViewMode<T> {
  // Default includeViewMode to true for backward compatibility
  const includeViewMode = options.includeViewMode !== false;

  // 🏢 ENTERPRISE: Optional viewMode state (only created if needed)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [areaRange, setAreaRange] = useState({ min: '', max: '' });

  // 🏢 ENTERPRISE: Use centralized applyPropertyFilters (ADR-051)
  // Type assertion via unknown needed for generic type compatibility
  const filteredProperties = useMemo(() => {
    const filtered = applyPropertyFilters(
      allProperties as unknown as Array<{ id: string; [key: string]: unknown }>,
      filters,
      searchTerm,
      { priceRange, areaRange }
    );
    return filtered as unknown as T[];
  }, [allProperties, filters, searchTerm, priceRange, areaRange]);

  // 🏢 ENTERPRISE: Base return object
  const baseReturn: PropertyGridFiltersBaseReturn<T> = {
    showFilters,
    setShowFilters,
    searchTerm,
    setSearchTerm,
    priceRange,
    setPriceRange,
    areaRange,
    setAreaRange,
    availableProperties: allProperties,
    filteredProperties,
  };

  // 🏢 ENTERPRISE: Return with or without viewMode based on options
  if (includeViewMode) {
    return {
      ...baseReturn,
      viewMode,
      setViewMode,
    } as PropertyGridFiltersWithViewMode<T>;
  }

  return baseReturn as PropertyGridFiltersWithoutViewMode<T>;
}
