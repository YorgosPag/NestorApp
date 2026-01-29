'use client';

import type { NumericRange, DateFromToRange, DateRange } from '../types';
import { hasActiveNumericRange, hasActiveDateRange, normalizeNumericRange } from '../types';

// ============================================================================
// ADR-051: ENTERPRISE APPLY FILTERS UTILITY
// Centralized filtering logic for all entity types
// ============================================================================

/**
 * 🏢 ENTERPRISE: Base interface for filterable entities
 * Any entity that can be filtered should extend this interface
 */
export interface FilterableEntity {
  id: string;
  [key: string]: unknown;
}

/**
 * 🏢 ENTERPRISE: Base filter state interface
 * Common filter properties shared across all filter implementations
 */
export interface BaseFilterState {
  searchTerm?: string;
  [key: string]: unknown;
}

/**
 * 🏢 ENTERPRISE: Filter options for customizing behavior
 */
export interface ApplyFiltersOptions {
  /** Fields to search in when searchTerm is provided */
  searchFields?: string[];
  /** Whether search should be case-sensitive (default: false) */
  caseSensitive?: boolean;
  /** Custom matchers for specific filter keys */
  customMatchers?: Record<string, (entity: FilterableEntity, filterValue: unknown) => boolean>;
}

/**
 * 🏢 ENTERPRISE: Check if a value matches a search term
 * Searches in multiple fields of an entity
 */
export function matchesSearchTerm(
  entity: FilterableEntity,
  searchTerm: string,
  searchFields: string[] = ['name', 'title', 'code', 'description'],
  caseSensitive = false
): boolean {
  if (!searchTerm || searchTerm.trim() === '') return true;

  const normalizedTerm = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return searchFields.some(field => {
    const value = entity[field];
    if (value === undefined || value === null) return false;

    const stringValue = String(value);
    const normalizedValue = caseSensitive ? stringValue : stringValue.toLowerCase();

    return normalizedValue.includes(normalizedTerm);
  });
}

/**
 * 🏢 ENTERPRISE: Check if a numeric value is within a range
 */
export function matchesNumericRange(
  value: number | undefined | null,
  range: NumericRange | { min?: number | null; max?: number | null } | undefined | null
): boolean {
  if (!range) return true;

  const normalizedRange = normalizeNumericRange(range);
  if (!hasActiveNumericRange(normalizedRange)) return true;

  if (value === undefined || value === null) return false;

  const { min, max } = normalizedRange;

  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;

  return true;
}

/**
 * 🏢 ENTERPRISE: Check if a date is within a date range (from/to pattern)
 */
export function matchesDateFromToRange(
  date: Date | string | undefined | null,
  range: DateFromToRange | undefined | null
): boolean {
  if (!range || !hasActiveDateRange(range)) return true;
  if (date === undefined || date === null) return false;

  const dateValue = date instanceof Date ? date : new Date(date);
  if (isNaN(dateValue.getTime())) return false;

  const { from, to } = range;

  if (from && dateValue < from) return false;
  if (to && dateValue > to) return false;

  return true;
}

/**
 * 🏢 ENTERPRISE: Check if a date is within a date range (start/end pattern)
 */
export function matchesDateRange(
  date: Date | string | undefined | null,
  range: DateRange | undefined | null
): boolean {
  if (!range) return true;
  if (!range.start && !range.end) return true;
  if (date === undefined || date === null) return false;

  const dateValue = date instanceof Date ? date : new Date(date);
  if (isNaN(dateValue.getTime())) return false;

  if (range.start && dateValue < range.start) return false;
  if (range.end && dateValue > range.end) return false;

  return true;
}

/**
 * 🏢 ENTERPRISE: Check if a value matches an array filter (multiselect)
 * Returns true if the filter array is empty (no filter) or if the value is in the array
 */
export function matchesArrayFilter(
  value: string | undefined | null,
  filterValues: string[] | undefined | null
): boolean {
  if (!filterValues || filterValues.length === 0) return true;
  if (value === undefined || value === null) return false;

  return filterValues.includes(value);
}

/**
 * 🏢 ENTERPRISE: Check if entity has any of the required tags/features
 */
export function matchesFeatures(
  entityFeatures: string[] | undefined | null,
  requiredFeatures: string[] | undefined | null
): boolean {
  if (!requiredFeatures || requiredFeatures.length === 0) return true;
  if (!entityFeatures || entityFeatures.length === 0) return false;

  return requiredFeatures.every(feature => entityFeatures.includes(feature));
}

/**
 * 🏢 ENTERPRISE: Generic apply filters function
 * Applies a set of filters to an array of entities
 *
 * @param entities - Array of entities to filter
 * @param filters - Filter state object
 * @param options - Optional configuration
 * @returns Filtered array of entities
 *
 * @example
 * const filtered = applyFilters(properties, {
 *   searchTerm: 'apartment',
 *   propertyType: ['apartment', 'studio'],
 *   priceRange: { min: 50000, max: 200000 }
 * }, {
 *   searchFields: ['name', 'address', 'description']
 * });
 */
export function applyFilters<T extends FilterableEntity>(
  entities: T[],
  filters: BaseFilterState,
  options: ApplyFiltersOptions = {}
): T[] {
  const {
    searchFields = ['name', 'title', 'code', 'description'],
    caseSensitive = false,
    customMatchers = {}
  } = options;

  return entities.filter(entity => {
    // Check each filter
    for (const [key, filterValue] of Object.entries(filters)) {
      // Skip empty filters
      if (filterValue === undefined || filterValue === null || filterValue === '') {
        continue;
      }

      // Custom matcher takes precedence
      if (customMatchers[key]) {
        if (!customMatchers[key](entity, filterValue)) {
          return false;
        }
        continue;
      }

      // Handle searchTerm
      if (key === 'searchTerm' && typeof filterValue === 'string') {
        if (!matchesSearchTerm(entity, filterValue, searchFields, caseSensitive)) {
          return false;
        }
        continue;
      }

      // Handle array filters (multiselect)
      if (Array.isArray(filterValue)) {
        if (filterValue.length === 0) continue;

        const entityValue = entity[key];

        // Check if entity has a matching value
        if (Array.isArray(entityValue)) {
          // Entity value is also an array (e.g., features, tags)
          if (!filterValue.some(v => entityValue.includes(v))) {
            return false;
          }
        } else {
          // Entity value is a single value
          if (!filterValue.includes(entityValue as string)) {
            return false;
          }
        }
        continue;
      }

      // Handle range filters (by naming convention: *Range)
      if (key.endsWith('Range') && typeof filterValue === 'object') {
        const rangeFilter = filterValue as Record<string, unknown>;

        // Determine which field this range applies to
        const fieldName = key.replace('Range', '');
        const entityValue = entity[fieldName];

        // Numeric range (min/max)
        if ('min' in rangeFilter || 'max' in rangeFilter) {
          if (!matchesNumericRange(entityValue as number | undefined, rangeFilter as NumericRange)) {
            return false;
          }
        }
        // Date range (from/to)
        else if ('from' in rangeFilter || 'to' in rangeFilter) {
          if (!matchesDateFromToRange(entityValue as Date | string | undefined, rangeFilter as DateFromToRange)) {
            return false;
          }
        }
        // Date range (start/end)
        else if ('start' in rangeFilter || 'end' in rangeFilter) {
          if (!matchesDateRange(entityValue as Date | string | undefined, rangeFilter as DateRange)) {
            return false;
          }
        }
        continue;
      }

      // Handle boolean filters
      if (typeof filterValue === 'boolean' && filterValue === true) {
        const entityValue = entity[key];
        if (entityValue !== true) {
          return false;
        }
        continue;
      }

      // Handle direct string comparison
      if (typeof filterValue === 'string' && filterValue !== 'all') {
        const entityValue = entity[key];
        if (entityValue !== filterValue) {
          return false;
        }
        continue;
      }
    }

    return true;
  });
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// For backward compatibility with existing code
// ============================================================================

/**
 * @deprecated Use applyFilters from @/components/core/AdvancedFilters/utils/applyFilters
 * Legacy property-specific filter function
 */
export function applyPropertyFilters(
  properties: FilterableEntity[],
  filters: { propertyType: string[] },
  searchTerm: string,
  ranges: { priceRange: { min: string; max: string }; areaRange: { min: string; max: string } }
): FilterableEntity[] {
  const { priceRange, areaRange } = ranges;

  return properties.filter((property) => {
    // Type filter
    if (filters.propertyType.length > 0 && !filters.propertyType.includes(property.type as string)) {
      return false;
    }

    // Search term
    if (searchTerm && !matchesSearchTerm(property, searchTerm, ['name'])) {
      return false;
    }

    // Price range
    if (priceRange.min && (property.price as number) < parseInt(priceRange.min)) return false;
    if (priceRange.max && (property.price as number) > parseInt(priceRange.max)) return false;

    // Area range
    if (areaRange.min && (property.area as number) < parseInt(areaRange.min)) return false;
    if (areaRange.max && (property.area as number) > parseInt(areaRange.max)) return false;

    return true;
  });
}
