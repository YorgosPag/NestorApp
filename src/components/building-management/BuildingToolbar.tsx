'use client';

/**
 * 🏢 ENTERPRISE: BuildingToolbar with full i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import React, { useState } from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { BaseToolbar } from '@/components/core/BaseToolbar/BaseToolbar';
import type { ToolbarAction, ToolbarFilter, ToolbarSearch } from '@/components/core/BaseToolbar/BaseToolbar';
import {
  Plus,
  Edit,
  Trash2,
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  RefreshCw,
  Archive,
  Star,
  HelpCircle
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { UNIFIED_STATUS_FILTER_LABELS, PROPERTY_BUILDING_TYPE_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface BuildingToolbarProps {
  selectedItems?: string[];
  onSelectionChange?: (items: string[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewBuilding?: () => void;
  onEditBuilding?: (id: string) => void;
  onDeleteBuilding?: (ids: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

export function BuildingToolbar({
  selectedItems = [],
  onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  onNewBuilding,
  onEditBuilding,
  onDeleteBuilding,
  onExport,
  onRefresh
}: BuildingToolbarProps) {
  // 🏢 ENTERPRISE: i18n hooks
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleClearFilters = () => {
    onFiltersChange?.([]);
  };

  const handleFilterChange = (filter: string, checked: boolean) => {
    if (checked) {
      onFiltersChange?.([...activeFilters, filter]);
    } else {
      onFiltersChange?.(activeFilters.filter(f => f !== filter));
    }
  };

  // Primary actions (main operations) - 🏢 ENTERPRISE: Using i18n translations
  const primaryActions: ToolbarAction[] = [
    {
      id: 'new-building',
      label: t('toolbar.actions.new'),
      icon: Plus,
      onClick: () => onNewBuilding?.(),
      variant: 'default',
      tooltip: t('toolbar.tooltips.new'),
      shortcut: 'Ctrl+N'
    },
    {
      id: 'edit-building',
      label: t('toolbar.actions.edit'),
      icon: Edit,
      onClick: () => selectedItems[0] && onEditBuilding?.(selectedItems[0]),
      variant: 'outline',
      disabled: selectedItems.length !== 1,
      tooltip: t('toolbar.tooltips.edit'),
      shortcut: 'Ctrl+E'
    },
    {
      id: 'delete-building',
      label: t('toolbar.actions.delete'),
      icon: Trash2,
      onClick: () => onDeleteBuilding?.(selectedItems),
      variant: 'destructive',
      disabled: selectedItems.length === 0,
      tooltip: t('toolbar.tooltips.deleteCount', { count: selectedItems.length }),
      badge: selectedItems.length > 0 ? selectedItems.length : undefined
    }
  ];

  // Secondary actions (utility functions) - 🏢 ENTERPRISE: Using i18n translations
  const secondaryActions: ToolbarAction[] = [
    {
      id: 'export',
      label: t('toolbar.actions.export'),
      icon: Download,
      onClick: () => onExport?.(),
      variant: 'ghost',
      tooltip: t('toolbar.tooltips.export')
    },
    {
      id: 'import',
      label: t('toolbar.actions.import'),
      icon: Upload,
      onClick: () => console.log('Import data...'),
      variant: 'ghost',
      tooltip: t('toolbar.tooltips.import')
    },
    {
      id: 'refresh',
      label: t('toolbar.actions.refresh'),
      icon: RefreshCw,
      onClick: () => onRefresh?.(),
      variant: 'ghost',
      tooltip: t('toolbar.tooltips.refresh'),
      shortcut: 'F5'
    },
    {
      id: 'archive',
      label: t('toolbar.actions.archive'),
      icon: Archive,
      onClick: () => console.log('Archive selected...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: t('toolbar.tooltips.archive')
    },
    {
      id: 'favorite',
      label: t('toolbar.actions.favorite'),
      icon: Star,
      onClick: () => console.log('Add to favorites...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: t('toolbar.tooltips.favorite')
    },
    {
      id: 'help',
      label: t('toolbar.actions.help'),
      icon: HelpCircle,
      onClick: () => console.log('Show help...'),
      variant: 'ghost',
      tooltip: t('toolbar.tooltips.help'),
      shortcut: 'F1'
    }
  ];

  // Search configuration - 🏢 ENTERPRISE: Using i18n translations
  const search: ToolbarSearch = {
    placeholder: t('toolbar.search.placeholder'),
    value: searchTerm,
    onChange: onSearchChange,
    onClear: () => onSearchChange?.('')
  };

  // Filters configuration - 🏢 ENTERPRISE: Using i18n translations
  const filters: ToolbarFilter[] = [
    {
      id: 'status-filter',
      label: t('toolbar.filters.status'),
      icon: Filter,
      active: activeFilters.some(f => ['active', 'inactive', 'maintenance'].includes(f)),
      count: activeFilters.filter(f => ['active', 'inactive', 'maintenance'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>{t('toolbar.filters.statusLabel')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'active', label: t(UNIFIED_STATUS_FILTER_LABELS.ACTIVE, { ns: 'common' }) },
            { value: 'inactive', label: t(UNIFIED_STATUS_FILTER_LABELS.INACTIVE, { ns: 'common' }) },
            { value: 'maintenance', label: t(UNIFIED_STATUS_FILTER_LABELS.MAINTENANCE, { ns: 'common' }) },
          ].map(({ value, label }) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={activeFilters.includes(value)}
              onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </>
      )
    },
    {
      id: 'type-filter',
      label: t('toolbar.filters.type'),
      icon: NAVIGATION_ENTITIES.building.icon,
      active: activeFilters.some(f => ['residential', 'commercial', 'mixed'].includes(f)),
      count: activeFilters.filter(f => ['residential', 'commercial', 'mixed'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>{t('toolbar.filters.typeLabel')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'residential', label: PROPERTY_BUILDING_TYPE_LABELS.residential },
            { value: 'commercial', label: PROPERTY_BUILDING_TYPE_LABELS.commercial },
            { value: 'mixed', label: PROPERTY_BUILDING_TYPE_LABELS.mixed },
          ].map(({ value, label }) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={activeFilters.includes(value)}
              onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </>
      )
    },
    {
      id: 'sort',
      label: `${t('toolbar.sort.label')} ${sortDirection === 'asc' ? '↑' : '↓'}`,
      icon: ArrowUpDown,
      active: true,
      children: (
        <>
          <DropdownMenuLabel>{t('toolbar.sort.sortBuildings')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSortDirection('asc')}>
            {t('toolbar.sort.ascending')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortDirection('desc')}>
            {t('toolbar.sort.descending')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => console.log('Sort by date...')}>
            {t('toolbar.sort.byDate')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by size...')}>
            {t('toolbar.sort.bySize')}
          </DropdownMenuItem>
        </>
      )
    }
  ];

  return (
    <BaseToolbar
      variant="compact"
      position="sticky"
      primaryActions={primaryActions}
      secondaryActions={secondaryActions}
      search={search}
      filters={filters}
      activeFiltersCount={activeFilters.length}
      onClearAllFilters={handleClearFilters}
      leftContent={
        selectedItems.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {t('toolbar.selection.selected', { count: selectedItems.length })}
          </div>
        )
      }
      className={`${colors.bg.primary}/95 backdrop-blur supports-[backdrop-filter]:${colors.bg.primary}/60`}
    />
  );
}
