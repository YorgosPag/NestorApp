import type { FilterState } from "@/types/property-viewer";

export interface PublicPropertyFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export interface TypeCheckboxesProps {
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}

export interface StatusCheckboxesProps {
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}

export interface RangeSliderProps {
  label: React.ReactNode;
  icon?: React.ElementType;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatLeft?: (n: number) => string;
  formatRight?: (n: number) => string;
}
