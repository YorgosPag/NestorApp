/**
 * 🏢 PAGE HEADER COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο page header component με πολλαπλά layouts
 * Enterprise implementation με responsive design και modular composition
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { HEADER_THEME } from '../constants';
import { HeaderTitle } from './HeaderTitle';
import { HeaderSearch } from './HeaderSearch';
import { HeaderFilters } from './HeaderFilters';
import { HeaderActions } from './HeaderActions';
import { LucideIcon } from 'lucide-react';

// Local interfaces για compatibility με UnifiedHeaderSystem
interface HeaderTitleProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  variant?: 'large' | 'medium' | 'small';
  hideSubtitle?: boolean;
}

interface HeaderSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

interface HeaderFilterOption {
  label: string;
  value: string;
  count?: number;
}

interface HeaderFiltersProps {
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

interface HeaderActionsProps {
  showDashboard?: boolean;
  onDashboardToggle?: () => void;
  viewMode?: 'list' | 'grid' | 'byType' | 'byStatus';
  onViewModeChange?: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
  viewModes?: ('list' | 'grid' | 'byType' | 'byStatus')[];
  addButton?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<any>;
  };
  customActions?: React.ReactNode[];
}

interface PageHeaderProps {
  // Layout & Styling
  variant?: 'sticky' | 'static' | 'floating' | 'sticky-rounded';
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
  layout?: 'single-row' | 'multi-row' | 'stacked' | 'compact';
  spacing?: 'tight' | 'normal' | 'loose' | 'compact';
}

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
    sticky: "border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50",
    static: "border-b bg-card",
    floating: "rounded-lg border bg-card shadow-sm",
    "sticky-rounded": "rounded-lg border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm mx-1 mt-1 sm:mx-4 sm:mt-4"
  };

  // Spacing classes - UNIFIED MOBILE-FIRST SYSTEM
  const spacingClasses = {
    tight: "px-1 py-2 sm:px-2 sm:py-2",
    normal: "px-1 py-4 sm:px-4 sm:py-4",
    loose: "px-1 py-6 sm:px-6 sm:py-6",
    compact: "px-3 py-2 sm:px-4 sm:py-3"
  };

  // Layout classes with mobile-first responsive design
  const layoutClasses = {
    'single-row': "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
    'compact': "flex flex-row items-center justify-between gap-2",
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

        {/* Compact Layout - Mobile First */}
        {layout === 'compact' && (
          <>
            <div className="flex items-center gap-2 min-w-0 sm:min-w-fit">
              <HeaderTitle
                {...title}
                hideSubtitle={true}
              />
            </div>
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

export default PageHeader;