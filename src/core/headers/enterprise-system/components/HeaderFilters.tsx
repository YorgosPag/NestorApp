/**
 * 🏢 HEADER FILTERS COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο filters component για headers
 * Enterprise implementation με multiple filter types και responsive design
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Filter,
  X,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { HEADER_THEME } from '../constants';

// Local interfaces για compatibility με UnifiedHeaderSystem
interface HeaderFilterOption {
  label: string;
  value: string;
  count?: number;
}

interface UnifiedHeaderFiltersProps {
  filters?: Array<{
    key: string;
    value: string;
    onChange: (value: string) => void;
    options: HeaderFilterOption[];
    placeholder?: string;
  }>;
  dropdownFilters?: Array<{
    key: string;
    value: string;
    onChange: (value: string) => void;
    options: HeaderFilterOption[];
    label: string;
    icon?: LucideIcon;
  }>;
  checkboxFilters?: Array<{
    key: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    icon?: LucideIcon;
  }>;
  customFilters?: React.ReactNode[];
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

export const HeaderFilters: React.FC<UnifiedHeaderFiltersProps> = ({
  filters = [],
  dropdownFilters = [],
  checkboxFilters = [],
  customFilters = [],
  onClearFilters,
  hasActiveFilters = false,
  className
}) => {
  const iconSizes = useIconSizes();
  const filtersClasses = cn(
    HEADER_THEME.components.filters.container,
    className
  );

  return (
    <div className={filtersClasses}>
      {/* Select Filters */}
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-2">
          <Filter className={`${iconSizes.sm} text-muted-foreground`} />
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className="h-9 text-sm w-[180px]">
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* Dropdown Filters */}
      {dropdownFilters.map((filter) => (
        <DropdownMenu key={filter.key}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 h-9">
              {filter.icon && <filter.icon className="h-4 w-4" />}
              {filter.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {filter.options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => filter.onChange(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}

      {/* Checkbox Filters */}
      {checkboxFilters.map((filter) => (
        <div key={filter.key} className="flex items-center space-x-2">
          <Checkbox
            id={filter.key}
            checked={filter.checked}
            onCheckedChange={filter.onChange}
          />
          {filter.icon && <filter.icon className={`${iconSizes.sm} text-muted-foreground`} />}
          <Label htmlFor={filter.key} className="text-sm font-medium whitespace-nowrap">
            {filter.label}
          </Label>
        </div>
      ))}

      {/* Custom Filters */}
      {customFilters.map((filter, index) => (
        <React.Fragment key={index}>{filter}</React.Fragment>
      ))}

      {/* Clear Filters Button */}
      {hasActiveFilters && onClearFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs h-9">
          <X className={`${iconSizes.xs} mr-1`} />
          Καθαρισμός
        </Button>
      )}
    </div>
  );
};

export default HeaderFilters;