'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types για το BaseToolbar system
export interface ToolbarAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
  tooltip?: string;
  badge?: number | string;
  shortcut?: string;
}

export interface ToolbarFilter {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  count?: number;
  children?: React.ReactNode; // Για dropdown content
}

export interface ToolbarSearch {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
}

export interface BaseToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  // Layout options
  variant?: 'default' | 'compact' | 'expanded';
  position?: 'top' | 'bottom' | 'sticky';
  
  // Actions section
  actions?: ToolbarAction[];
  primaryActions?: ToolbarAction[];
  secondaryActions?: ToolbarAction[];
  
  // Search functionality
  search?: ToolbarSearch;
  
  // Filters section
  filters?: ToolbarFilter[];
  activeFiltersCount?: number;
  onClearAllFilters?: () => void;
  
  // Content sections
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  
  // State
  loading?: boolean;
  disabled?: boolean;
}

export function BaseToolbar({
  className,
  variant = 'default',
  position = 'top',
  actions = [],
  primaryActions = [],
  secondaryActions = [],
  search,
  filters = [],
  activeFiltersCount = 0,
  onClearAllFilters,
  title,
  subtitle,
  leftContent,
  rightContent,
  centerContent,
  loading = false,
  disabled = false,
  ...props
}: BaseToolbarProps) {
  
  // Styling variants
  const toolbarVariants = {
    default: 'flex items-center justify-between p-4 bg-background border-b',
    compact: 'flex items-center justify-between p-2 bg-background border-b',
    expanded: 'flex flex-col gap-4 p-6 bg-background border-b',
  };

  const positionVariants = {
    top: '',
    bottom: 'border-t border-b-0',
    sticky: 'sticky top-0 z-10 backdrop-blur-sm bg-background/95',
  };

  // Συνδυασμός όλων των actions
  const allActions = [...primaryActions, ...actions, ...secondaryActions];

  return (
    <div
      className={cn(
        toolbarVariants[variant],
        positionVariants[position],
        {
          'opacity-60 pointer-events-none': loading || disabled,
        },
        className
      )}
      {...props}
    >
      {variant === 'expanded' ? (
        // Expanded layout - vertical stack
        <>
          {/* Title Section */}
          {(title || subtitle) && (
            <div className="flex flex-col gap-1">
              {title && (
                <h2 className="text-xl font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          )}
          
          {/* Main toolbar row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {leftContent}
              
              {/* Search */}
              {search && (
                <ToolbarSearchComponent search={search} />
              )}
              
              {/* Filters */}
              {filters.length > 0 && (
                <ToolbarFiltersComponent 
                  filters={filters}
                  activeCount={activeFiltersCount}
                  onClearAll={onClearAllFilters}
                />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {centerContent}
              {rightContent}
              
              {/* Actions */}
              {allActions.length > 0 && (
                <ToolbarActionsComponent actions={allActions} />
              )}
            </div>
          </div>
        </>
      ) : (
        // Default/Compact layout - horizontal
        <>
          {/* Left section */}
          <div className="flex items-center gap-4">
            {leftContent}
            
            {/* Title */}
            {title && (
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            
            {/* Search */}
            {search && (
              <ToolbarSearchComponent search={search} />
            )}
            
            {/* Filters */}
            {filters.length > 0 && (
              <ToolbarFiltersComponent 
                filters={filters}
                activeCount={activeFiltersCount}
                onClearAll={onClearAllFilters}
              />
            )}
          </div>
          
          {/* Center section */}
          {centerContent && (
            <div className="flex-1 flex justify-center">
              {centerContent}
            </div>
          )}
          
          {/* Right section */}
          <div className="flex items-center gap-2">
            {rightContent}
            
            {/* Actions */}
            {allActions.length > 0 && (
              <ToolbarActionsComponent actions={allActions} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Search component
function ToolbarSearchComponent({ search }: { search: ToolbarSearch }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={search.placeholder || 'Αναζήτηση...'}
        value={search.value || ''}
        onChange={(e) => search.onChange?.(e.target.value)}
        disabled={search.disabled}
        className="pl-10 pr-10 w-64"
      />
      {search.value && search.onClear && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          onClick={search.onClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// Filters component
function ToolbarFiltersComponent({
  filters,
  activeCount,
  onClearAll
}: {
  filters: ToolbarFilter[];
  activeCount: number;
  onClearAll?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        filter.children ? (
          // Dropdown filter
          <DropdownMenu key={filter.id}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filter.active ? 'default' : 'outline'}
                size="sm"
                className="relative"
              >
                {filter.icon && <filter.icon className="h-4 w-4 mr-1" />}
                {filter.label}
                {filter.count !== undefined && filter.count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                  >
                    {filter.count}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {filter.children}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Simple filter button
          <Button
            key={filter.id}
            variant={filter.active ? 'default' : 'outline'}
            size="sm"
          >
            {filter.icon && <filter.icon className="h-4 w-4 mr-1" />}
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
              >
                {filter.count}
              </Badge>
            )}
          </Button>
        )
      ))}
      
      {/* Clear all filters */}
      {activeCount > 0 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
        >
          <X className="h-4 w-4 mr-1" />
          Καθαρισμός ({activeCount})
        </Button>
      )}
    </div>
  );
}

// Actions component
function ToolbarActionsComponent({ actions }: { actions: ToolbarAction[] }) {
  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant || 'default'}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.tooltip}
          className="relative"
        >
          {action.icon && <action.icon className="h-4 w-4 mr-1" />}
          {action.label}
          {action.badge && (
            <Badge 
              variant="secondary" 
              className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {action.badge}
            </Badge>
          )}
          {action.shortcut && (
            <span className="ml-2 text-xs text-muted-foreground">
              {action.shortcut}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}