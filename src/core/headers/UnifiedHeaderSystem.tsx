/**
 * 🏢 UNIFIED HEADER SYSTEM - ENTERPRISE PATTERN
 *
 * Κεντρικό React component για όλα τα headers
 * Single Source of Truth - Enterprise Implementation
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  BarChart3,
  Plus,
  Eye,
  EyeOff,
  X,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ===== TYPES & INTERFACES =====

export type ViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

export interface HeaderIconProps {
  icon: LucideIcon;
  className?: string;
  variant?: 'gradient' | 'simple';
}

export interface HeaderTitleProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  className?: string;
}

export interface HeaderSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export interface HeaderFilterOption {
  value: string;
  label: string;
}

export interface HeaderFiltersProps {
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
}

export interface HeaderActionsProps {
  showDashboard?: boolean;
  onDashboardToggle?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  viewModes?: ViewMode[];
  addButton?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  customActions?: React.ReactNode[];
}

export interface PageHeaderProps {
  // Layout & Styling
  variant?: 'sticky' | 'static' | 'floating';
  className?: string;

  // Title Section
  title: HeaderTitleProps;

  // Search Section
  search?: HeaderSearchProps;

  // Filters Section
  filters?: HeaderFiltersProps;

  // Actions Section
  actions?: HeaderActionsProps;

  // Layout Control
  layout?: 'single-row' | 'multi-row' | 'stacked';
  spacing?: 'tight' | 'normal' | 'loose';
}

// ===== HEADER ICON COMPONENT =====

export const HeaderIcon: React.FC<HeaderIconProps> = ({
  icon: Icon,
  className,
  variant = 'gradient'
}) => {
  const baseClasses = "flex items-center justify-center rounded-lg shadow-lg";
  const variantClasses = {
    gradient: "bg-gradient-to-br from-blue-500 to-purple-600 text-white h-10 w-10",
    simple: "bg-primary text-primary-foreground h-8 w-8"
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
};

// ===== HEADER TITLE COMPONENT =====

export const HeaderTitle: React.FC<HeaderTitleProps> = ({
  icon,
  title,
  subtitle,
  badge,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && <HeaderIcon icon={icon} />}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// ===== HEADER SEARCH COMPONENT =====

export const HeaderSearch: React.FC<HeaderSearchProps> = ({
  value,
  onChange,
  placeholder = "Αναζήτηση...",
  debounceMs = 250,
  className
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [localValue, onChange, debounceMs]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className={cn("relative flex-1 min-w-0 w-full sm:min-w-[300px]", className)}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-10 h-9"
      />
    </div>
  );
};

// ===== HEADER FILTERS COMPONENT =====

export const HeaderFilters: React.FC<HeaderFiltersProps> = ({
  filters = [],
  dropdownFilters = [],
  checkboxFilters = [],
  customFilters = [],
  onClearFilters,
  hasActiveFilters = false
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full">
      {/* Select Filters */}
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
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
          {filter.icon && <filter.icon className="w-4 h-4 text-muted-foreground" />}
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
          <X className="w-3 h-3 mr-1" />
          Καθαρισμός
        </Button>
      )}
    </div>
  );
};

// ===== HEADER VIEW TOGGLE COMPONENT =====

export const HeaderViewToggle: React.FC<{
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  viewModes?: ViewMode[];
}> = ({
  viewMode,
  onViewModeChange,
  viewModes = ['list', 'grid']
}) => {
  const getViewIcon = (mode: ViewMode) => {
    switch (mode) {
      case 'list': return List;
      case 'grid': return LayoutGrid;
      case 'byType': return Filter;
      case 'byStatus': return BarChart3;
      default: return List;
    }
  };

  const getViewLabel = (mode: ViewMode) => {
    switch (mode) {
      case 'list': return 'Λίστα';
      case 'grid': return 'Πλέγμα';
      case 'byType': return 'Ανά Τύπο';
      case 'byStatus': return 'Ανά Κατάσταση';
      default: return mode;
    }
  };

  return (
    <div className="flex border rounded-md bg-background">
      {viewModes.map((mode, index) => {
        const Icon = getViewIcon(mode);
        const isFirst = index === 0;
        const isLast = index === viewModes.length - 1;

        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  "h-8 border-0",
                  !isFirst && "rounded-l-none",
                  !isLast && "rounded-r-none"
                )}
              >
                <Icon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{getViewLabel(mode)}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

// ===== HEADER ACTIONS COMPONENT =====

export const HeaderActions: React.FC<HeaderActionsProps> = ({
  showDashboard,
  onDashboardToggle,
  viewMode,
  onViewModeChange,
  viewModes,
  addButton,
  customActions = []
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
      {/* Dashboard Toggle */}
      {onDashboardToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showDashboard ? "default" : "outline"}
              size="sm"
              onClick={onDashboardToggle}
              className="h-8"
            >
              {showDashboard ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showDashboard ? 'Απόκρυψη' : 'Εμφάνιση'} Dashboard
            </Button>
          </TooltipTrigger>
          <TooltipContent>Εναλλαγή Dashboard</TooltipContent>
        </Tooltip>
      )}

      {/* View Mode Toggle */}
      {viewMode && onViewModeChange && (
        <HeaderViewToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          viewModes={viewModes}
        />
      )}

      {/* Custom Actions */}
      {customActions.map((action, index) => (
        <React.Fragment key={index}>{action}</React.Fragment>
      ))}

      {/* Add Button */}
      {addButton && (
        <Button size="sm" onClick={addButton.onClick} className="h-8">
          {addButton.icon ? (
            <addButton.icon className="w-4 h-4 mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {addButton.label}
        </Button>
      )}
    </div>
  );
};

// ===== MAIN PAGE HEADER COMPONENT =====

export const PageHeader: React.FC<PageHeaderProps> = ({
  variant = 'sticky',
  className,
  title,
  search,
  filters,
  actions,
  layout = 'multi-row',
  spacing = 'normal'
}) => {
  // Base classes for different variants
  const variantClasses = {
    sticky: "border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40",
    static: "border-b bg-card",
    floating: "rounded-lg border bg-card shadow-sm"
  };

  // Spacing classes - UNIFIED MOBILE-FIRST SYSTEM
  const spacingClasses = {
    tight: "px-1 py-2 sm:px-2 sm:py-2",
    normal: "px-1 py-4 sm:px-4 sm:py-4",
    loose: "px-1 py-6 sm:px-6 sm:py-6"
  };

  // Layout classes with mobile-first responsive design
  const layoutClasses = {
    'single-row': "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
    'multi-row': "space-y-4",
    'stacked': "space-y-6"
  };

  return (
    <div className={cn(
      variantClasses[variant],
      spacingClasses[spacing],
      "overflow-hidden", // UNIFIED: Prevent overflow
      className
    )}>
      <div className={layoutClasses[layout]}>

        {/* Single Row Layout */}
        {layout === 'single-row' && (
          <>
            <HeaderTitle {...title} />
            {actions && <HeaderActions {...actions} />}
          </>
        )}

        {/* Multi Row Layout */}
        {layout === 'multi-row' && (
          <>
            {/* Top Row: Title + Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <HeaderTitle {...title} />
              {actions && <HeaderActions {...actions} />}
            </div>

            {/* Bottom Row: Search + Filters */}
            {(search || filters) && (
              <div className="flex flex-col gap-3">
                {/* Search Row */}
                {search && (
                  <div className="flex flex-wrap items-center gap-3">
                    <HeaderSearch {...search} />
                  </div>
                )}

                {/* Filters Row */}
                {filters && (
                  <div className="w-full overflow-hidden">
                    <HeaderFilters {...filters} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Stacked Layout */}
        {layout === 'stacked' && (
          <>
            <HeaderTitle {...title} />
            {search && <HeaderSearch {...search} />}
            {filters && <HeaderFilters {...filters} />}
            {actions && <HeaderActions {...actions} />}
          </>
        )}
      </div>
    </div>
  );
};

// ===== SECTION HEADER COMPONENT =====

export interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  count?: number;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  count,
  className
}) => {
  const displaySubtitle = subtitle || (count !== undefined ? `${count} ${title.toLowerCase()} συνολικά` : undefined);

  return (
    <div className={cn(
      "p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20",
      className
    )}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
            <Icon className="w-4 h-4 text-white" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {displaySubtitle && (
            <p className="text-xs text-muted-foreground">
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== CONVENIENCE EXPORTS =====

export default PageHeader;

// Additional alias for main component
export { PageHeader as UnifiedHeader };