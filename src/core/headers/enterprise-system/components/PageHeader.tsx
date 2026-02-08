/**
 * 🏢 PAGE HEADER COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο page header component με πολλαπλά layouts
 * Enterprise implementation με responsive design και modular composition
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized layout classes
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
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
  badge?: React.ReactNode; // 🏢 ENTERPRISE: Optional badge element
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
    icon?: React.ComponentType<{ className?: string }>;
  };
  customActions?: React.ReactNode[];
}

interface PageHeaderProps {
  // Layout & Styling
  variant?: 'sticky' | 'static' | 'floating' | 'sticky-rounded';
  className?: string;

  // Title Section
  title: HeaderTitleProps;

  // 🏢 ENTERPRISE: Breadcrumb Section (renders between Title and Actions)
  breadcrumb?: React.ReactNode;

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
  breadcrumb,
  search,
  filters,
  actions,
  layout = 'multi-row',
  spacing = 'normal'
}) => {
  // 🏢 ENTERPRISE: Centralized layout classes
  const layoutTokens = useLayoutClasses();

  // Base classes for different variants
  const variantClasses = {
    sticky: "border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50",
    static: "border-b bg-card",
    floating: "rounded-lg border bg-card shadow-sm",
    "sticky-rounded": `rounded-lg border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm ${layoutTokens.pageHeaderMargins}`
  };

  // Spacing classes - UNIFIED MOBILE-FIRST SYSTEM (using centralized tokens)
  const spacingClasses = {
    tight: layoutTokens.pageHeaderPaddingTight,    // px-1 py-2 sm:px-2 sm:py-2 (8px)
    normal: layoutTokens.pageHeaderPaddingNormal,  // px-1 py-4 sm:px-4 sm:py-4
    loose: "px-1 py-6 sm:px-6 sm:py-6",
    compact: layoutTokens.pageHeaderPaddingTight   // px-1 py-2 sm:px-2 sm:py-2 (8px)
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
            <div className="shrink-0">
              <HeaderTitle {...title} />
            </div>
            {/* 🏢 ENTERPRISE: Breadcrumb slot - flexible middle section */}
            {breadcrumb && (
              <div className="flex-1 min-w-0 hidden sm:block">
                <div className="truncate overflow-hidden whitespace-nowrap">
                  {breadcrumb}
                </div>
              </div>
            )}
            {actions && (
              <div className="shrink-0">
                <HeaderActions {...actions} />
              </div>
            )}
          </>
        )}

        {/* Compact Layout - Mobile First */}
        {layout === 'compact' && (
          <>
            <div className="flex items-center gap-2 min-w-0 sm:min-w-fit shrink-0">
              <HeaderTitle
                {...title}
                hideSubtitle={true}
              />
            </div>
            {/* 🏢 ENTERPRISE: Breadcrumb slot - flexible middle section */}
            {breadcrumb && (
              <div className="flex-1 min-w-0 hidden sm:block">
                <div className="truncate overflow-hidden whitespace-nowrap">
                  {breadcrumb}
                </div>
              </div>
            )}
            {actions && (
              <div className="shrink-0">
                <HeaderActions {...actions} />
              </div>
            )}
          </>
        )}

        {/* Multi Row Layout */}
        {layout === 'multi-row' && (
          <>
            {/* Top Row: Title + Breadcrumb + Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="shrink-0">
                <HeaderTitle {...title} />
              </div>
              {/* 🏢 ENTERPRISE: Breadcrumb slot - flexible middle section */}
              {breadcrumb && (
                <div className="flex-1 min-w-0 hidden sm:block px-4">
                  <div className="truncate overflow-hidden whitespace-nowrap">
                    {breadcrumb}
                  </div>
                </div>
              )}
              {actions && (
                <div className="shrink-0">
                  <HeaderActions {...actions} />
                </div>
              )}
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
            {/* 🏢 ENTERPRISE: Breadcrumb slot */}
            {breadcrumb && (
              <div className="truncate overflow-hidden whitespace-nowrap">
                {breadcrumb}
              </div>
            )}
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
