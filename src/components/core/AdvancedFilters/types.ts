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
  placeholder?: string;
  options?: FilterOption[];
  required?: boolean;
  width?: number; // 1-4 columns in grid
  ariaLabel?: string;
  min?: number;
  max?: number;
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
}

// Generic filter state
export interface GenericFilterState {
  [key: string]: any;
  searchTerm?: string;
  selectedOptions?: string[];
  advancedFeatures?: string[];
  ranges?: {
    [key: string]: {
      min?: number;
      max?: number;
    }
  };
}

// Specialized filter states for different modules
export interface ContactFilterState extends GenericFilterState {
  searchTerm: string;
  company: string[];
  status: string[];
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
    min?: number;
    max?: number;
  };
  areaRange: {
    min?: number;
    max?: number;
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