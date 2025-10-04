import type { FilterState } from "@/types/property-viewer";

export interface PublicPropertyFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export interface SearchFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface CheckboxRowProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

export interface RangeSliderProps {
  icon: React.ReactNode;
  label: string;
  values: [number, number];
  onValueChange: (values: number[]) => void;
  min: number;
  max: number;
  step: number;
  leftText: string;
  rightText: string;
}
