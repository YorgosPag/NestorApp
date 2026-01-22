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