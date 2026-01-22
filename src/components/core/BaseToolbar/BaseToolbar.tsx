'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommonBadge } from '@/core/badges';
import { Search, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

export interface BaseToolbarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  // Layout options
  variant?: 'default' | 'compact' | 'expanded' | 'narrow';
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
  const colors = useSemanticColors();

  // Styling variants
  const toolbarVariants = {
    default: `flex items-center justify-between p-4 ${colors.bg.primary} border-b`,
    compact: `flex flex-wrap items-center justify-between gap-2 p-2 ${colors.bg.primary} border-b min-h-[3rem]`,
    expanded: `flex flex-col gap-4 p-6 ${colors.bg.primary} border-b`,
    narrow: `flex flex-wrap items-center gap-2 p-2 ${colors.bg.primary} border-b`,
  };

  const positionVariants = {
    top: '',
    bottom: 'border-t border-b-0',
    sticky: `sticky top-0 z-10 backdrop-blur-sm ${colors.bg.primary}/95`,
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
      {variant === 'narrow' ? (
        // Narrow layout - everything flows and wraps
        <>
          {/* All items in flow with wrapping */}
          {leftContent}
          {title && (
            <span className="text-sm font-medium text-foreground">
              {title}
            </span>
          )}
          {search && <ToolbarSearchComponent search={search} compact={false} />}
          {filters.length > 0 && (
            <ToolbarFiltersComponent
              filters={filters}
              activeCount={activeFiltersCount}
              onClearAll={onClearAllFilters}
            />
          )}
          {allActions.length > 0 && (
            <ToolbarActionsComponent actions={allActions} />
          )}
          {rightContent}
        </>
      ) : variant === 'expanded' ? (
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
                <ToolbarSearchComponent search={search} compact={false} />
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
        // Default/Compact layout - single row, all content directly in main container
        <>
          {/* All content flows directly without extra containers */}
          {leftContent}

          {/* Title */}
          {title && (
            <div className="flex flex-col">
              <h2 className={cn(
                "font-semibold text-foreground",
                variant === 'compact' ? "text-sm" : "text-lg"
              )}>
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
            <ToolbarSearchComponent search={search} compact={variant === 'compact'} />
          )}

          {/* Filters */}
          {filters.length > 0 && (
            <ToolbarFiltersComponent
              filters={filters}
              activeCount={activeFiltersCount}
              onClearAll={onClearAllFilters}
            />
          )}

          {/* Center content - only for non-compact */}
          {centerContent && variant !== 'compact' && (
            <div className="flex-1 flex justify-center">
              {centerContent}
            </div>
          )}

          {/* Actions */}
          {allActions.length > 0 && (
            <ToolbarActionsComponent actions={allActions} />
          )}

          {/* Right content */}
          {rightContent}
        </>
      )}
    </div>
  );
}

// Search component
function ToolbarSearchComponent({ search, compact }: { search: ToolbarSearch; compact?: boolean }) {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  return (
    <div className="relative">
      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} text-muted-foreground`} />
      <Input
        placeholder={search.placeholder || t('placeholders.search')}
        value={search.value || ''}
        onChange={(e) => search.onChange?.(e.target.value)}
        disabled={search.disabled}
        className={cn(
          "pl-10 pr-10",
          compact ? "w-48" : "w-64"
        )}
      />
      {search.value && search.onClear && (
        <Button
          variant="ghost"
          size="sm"
          className={`absolute right-1 top-1/2 transform -translate-y-1/2 ${iconSizes.lg} p-0`}
          onClick={search.onClear}
        >
          <X className={iconSizes.xs} />
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
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook for clear all button
  const { t } = useTranslation('common');
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
                {filter.icon && <filter.icon className={`${iconSizes.sm} mr-1`} />}
                {filter.label}
                {filter.count !== undefined && filter.count > 0 && (
                  <CommonBadge
                    status="company"
                    customLabel={filter.count.toString()}
                    variant="secondary"
                    className={`ml-1 ${iconSizes.md} p-0 text-xs flex items-center justify-center`}
                  />
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
            {filter.icon && <filter.icon className={`${iconSizes.sm} mr-1`} />}
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <CommonBadge
                status="company"
                customLabel={filter.count.toString()}
                variant="secondary"
                className={`ml-1 ${iconSizes.md} p-0 text-xs flex items-center justify-center`}
              />
            )}
          </Button>
        )
      ))}
      
      {/* 🏢 ENTERPRISE: Clear all filters with i18n */}
      {activeCount > 0 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
        >
          <X className={`${iconSizes.sm} mr-1`} />
          {t('buttons.clearAllCount', { count: activeCount })}
        </Button>
      )}
    </div>
  );
}

// Actions component
function ToolbarActionsComponent({ actions }: { actions: ToolbarAction[] }) {
  const iconSizes = useIconSizes();

  const renderButton = (action: ToolbarAction) => (
    <Button
      variant={action.variant || 'default'}
      size="sm"
      onClick={action.onClick}
      disabled={action.disabled}
      className="relative"
    >
      {action.icon && <action.icon className={`${iconSizes.sm} mr-1`} />}
      {action.label}
      {action.badge && (
        <CommonBadge
          status="company"
          customLabel={action.badge.toString()}
          variant="secondary"
          className={`ml-1 ${iconSizes.md} p-0 text-xs flex items-center justify-center`}
        />
      )}
      {action.shortcut && (
        <span className="ml-2 text-xs text-muted-foreground">
          {action.shortcut}
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actions.map((action) => (
        action.tooltip ? (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              {renderButton(action)}
            </TooltipTrigger>
            <TooltipContent>{action.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <React.Fragment key={action.id}>
            {renderButton(action)}
          </React.Fragment>
        )
      ))}
    </div>
  );
}