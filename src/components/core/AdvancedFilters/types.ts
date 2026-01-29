'use client';

// Generic filter field types
export type FilterFieldType =
  | 'search'
  | 'select'
  | 'range'
  | 'checkbox'
  | 'multiselect'
  | 'date'
  | 'daterange';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterFieldConfig {
  id: string;
  type: FilterFieldType;
  label: string;
  placeholder?: string | { min?: string; max?: string; start?: string; end?: string };
  options?: FilterOption[];
  required?: boolean;
  width?: number; // 1-4 columns in grid
  ariaLabel?: string;
  min?: number;
  max?: number;
  range?: { min: number; max: number; step?: number };
  // 🏢 ENTERPRISE: Range dropdown mode with predefined values + custom option
  dropdownMode?: boolean; // When true, range fields render as dropdown + custom input
}

export interface FilterRowConfig {
  id: string;
  fields: FilterFieldConfig[];
}

export interface AdvancedFilterOption {
  id: string;
  label: string;
  category?: string;
}

export interface AdvancedFiltersConfig {
  show: boolean;
  title: string;
  options: AdvancedFilterOption[];
  categories?: string[];
}

export interface FilterPanelConfig {
  title: string;
  searchPlaceholder?: string;
  rows: FilterRowConfig[];
  advancedFilters?: AdvancedFiltersConfig;
  // 🏢 ENTERPRISE: Configurable i18n namespace (PR1.2 - Domain separation)
  i18nNamespace?: string; // Default: 'building', Units: 'units', etc.
}

// Range types for filters
export interface NumericRange {
  min?: number;
  max?: number;
}

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface DateFromToRange {
  from?: Date;
  to?: Date;
}

// Union type for all range types
export type FilterRange = NumericRange | DateRange | DateFromToRange;

// ============================================================================
// ADR-051: ENTERPRISE TYPE GUARDS & NORMALIZATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Type guard for NumericRange
 * Validates that an object conforms to the NumericRange interface
 * @param value - Unknown value to validate
 * @returns True if value is a valid NumericRange
 */
export function isNumericRange(value: unknown): value is NumericRange {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  const hasMin = 'min' in obj && (obj.min === undefined || typeof obj.min === 'number');
  const hasMax = 'max' in obj && (obj.max === undefined || typeof obj.max === 'number');

  // Must have at least one range property (min or max)
  return hasMin || hasMax;
}

/**
 * 🏢 ENTERPRISE: Type guard for DateRange (start/end pattern)
 * @param value - Unknown value to validate
 * @returns True if value is a valid DateRange
 */
export function isDateRange(value: unknown): value is DateRange {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  const hasStart = 'start' in obj && (obj.start === undefined || obj.start instanceof Date);
  const hasEnd = 'end' in obj && (obj.end === undefined || obj.end instanceof Date);

  return hasStart || hasEnd;
}

/**
 * 🏢 ENTERPRISE: Type guard for DateFromToRange (from/to pattern)
 * @param value - Unknown value to validate
 * @returns True if value is a valid DateFromToRange
 */
export function isDateFromToRange(value: unknown): value is DateFromToRange {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  const hasFrom = 'from' in obj && (obj.from === undefined || obj.from instanceof Date);
  const hasTo = 'to' in obj && (obj.to === undefined || obj.to instanceof Date);

  return hasFrom || hasTo;
}

/**
 * 🏢 ENTERPRISE: Normalize range values (null → undefined)
 * Converts null values to undefined for consistent handling
 * This addresses the type inconsistency between FilterState (null) and GenericFilterState (undefined)
 *
 * @param range - Range object with potentially null values
 * @returns Normalized range with undefined instead of null
 *
 * @example
 * // Input: { min: null, max: 100 }
 * // Output: { min: undefined, max: 100 }
 */
export function normalizeNumericRange(range: { min?: number | null; max?: number | null } | null | undefined): NumericRange {
  if (!range) return { min: undefined, max: undefined };

  return {
    min: range.min === null ? undefined : range.min,
    max: range.max === null ? undefined : range.max,
  };
}

/**
 * 🏢 ENTERPRISE: Normalize date range (from/to → from/to, null → undefined)
 * @param range - Date range with potentially null values
 * @returns Normalized date range
 */
export function normalizeDateFromToRange(range: { from?: Date | null; to?: Date | null } | null | undefined): DateFromToRange {
  if (!range) return { from: undefined, to: undefined };

  return {
    from: range.from === null ? undefined : range.from,
    to: range.to === null ? undefined : range.to,
  };
}

/**
 * 🏢 ENTERPRISE: Check if a numeric range has any active values
 * @param range - NumericRange to check
 * @returns True if either min or max is defined
 */
export function hasActiveNumericRange(range: NumericRange | null | undefined): boolean {
  if (!range) return false;
  return range.min !== undefined || range.max !== undefined;
}

/**
 * 🏢 ENTERPRISE: Check if a date range has any active values
 * @param range - DateFromToRange to check
 * @returns True if either from or to is defined
 */
export function hasActiveDateRange(range: DateFromToRange | null | undefined): boolean {
  if (!range) return false;
  return range.from !== undefined || range.to !== undefined;
}

/**
 * 🏢 ENTERPRISE: Create empty numeric range
 * Factory function for consistent range initialization
 */
export function createEmptyNumericRange(): NumericRange {
  return { min: undefined, max: undefined };
}

/**
 * 🏢 ENTERPRISE: Create empty date range
 * Factory function for consistent range initialization
 */
export function createEmptyDateRange(): DateFromToRange {
  return { from: undefined, to: undefined };
}

// Generic filter state
export interface GenericFilterState {
  [key: string]: unknown;
  searchTerm?: string;
  selectedOptions?: string[];
  advancedFeatures?: string[];
  ranges?: {
    [key: string]: FilterRange;
  };
}

// Specialized filter states for different modules
export interface ContactFilterState extends GenericFilterState {
  searchTerm: string;
  company: string[];
  status: string[];
  contactType: string; // 'all' | 'individual' | 'company' | 'service'
  unitsCount: string; // 'all' | '1-2' | '3-5' | '6+'
  totalArea: string; // 'all' | '0-100' | '101-300' | '301+'
  hasProperties: boolean; // Μόνο με ιδιοκτησίες
  isFavorite: boolean; // Αγαπημένα
  showArchived: boolean; // Αρχειοθετημένα
  tags: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
}

export interface UnitFilterState extends GenericFilterState {
  searchTerm: string;
  project: string[];
  building: string[];
  floor: string[];
  type: string[];
  status: string[];
  priceRange: {
    min?: number | null;
    max?: number | null;
  };
  areaRange: {
    min?: number | null;
    max?: number | null;
  };
  features: string[];
}

export interface BuildingFilterState extends GenericFilterState {
  searchTerm: string;
  project: string[];
  status: string[];
  type: string[];
  location: string[];
  company: string[];
  priority: string[];
  energyClass: string[];
  renovation: string[];
  ranges?: {
    valueRange?: {
      min?: number;
      max?: number;
    };
    areaRange?: {
      min?: number;
      max?: number;
    };
    unitsRange?: {
      min?: number;
      max?: number;
    };
    yearRange?: {
      min?: number;
      max?: number;
    };
  };
  // Boolean feature filters
  hasParking?: boolean;
  hasElevator?: boolean;
  hasGarden?: boolean;
  hasPool?: boolean;
  accessibility?: boolean;
  furnished?: boolean;
}

export interface ProjectFilterState extends GenericFilterState {
  searchTerm: string;
  status: string[];
  type: string[];
  company: string[];
  location: string[];
  client: string[];
  priority: string[];
  riskLevel: string[];
  complexity: string[];
  budgetRange: {
    min?: number;
    max?: number;
  };
  durationRange: {
    min?: number;
    max?: number;
  };
  progressRange: {
    min?: number;
    max?: number;
  };
  yearRange: {
    min?: number;
    max?: number;
  };
  dateRange: {
    from?: Date;
    to?: Date;
  };
  // Boolean feature filters
  hasPermits?: boolean;
  hasFinancing?: boolean;
  isEcological?: boolean;
  hasSubcontractors?: boolean;
  isActive?: boolean;
  hasIssues?: boolean;
}

// 🏢 ENTERPRISE: Property Filter State for public property viewer
// Used in /properties page for customer-facing property search
export interface PropertyFilterState extends GenericFilterState {
  searchTerm: string;
  propertyType: string[];
  status: string[];
  priceRange: {
    min?: number;
    max?: number;
  };
  areaRange: {
    min?: number;
    max?: number;
  };
  floor: string[];
  features: string[];
}