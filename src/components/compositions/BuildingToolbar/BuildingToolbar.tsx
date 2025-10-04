'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BaseToolbar, ToolbarAction, ToolbarFilter } from '@/components/core/BaseToolbar';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Filter,
  BarChart3,
  Timeline,
  FileText 
} from 'lucide-react';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface BuildingToolbarProps {
  // Selection state
  selectedCount?: number;
  totalCount?: number;
  
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  
  // Filters
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  
  // Actions
  onCreateNew?: () => void;
  onEditSelected?: () => void;
  onDeleteSelected?: () => void;
  onExport?: (type: 'pdf' | 'stats' | 'timeline') => void;
  
  // State
  loading?: boolean;
  disabled?: boolean;
}

export function BuildingToolbar({
  selectedCount = 0,
  totalCount = 0,
  searchValue = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  onCreateNew,
  onEditSelected,
  onDeleteSelected,
  onExport,
  loading = false,
  disabled = false,
}: BuildingToolbarProps) {
  const { t } = useTranslation('building');
  
  // Primary actions (always visible)
  const primaryActions: ToolbarAction[] = [];
  
  if (onCreateNew) {
    primaryActions.push({
      id: 'create',
      label: t('toolbar.actions.new', { ns: 'properties' }),
      icon: Plus,
      onClick: onCreateNew,
      variant: 'default',
      shortcut: 'Ctrl+N',
    });
  }
  
  // Actions that appear when items are selected
  const selectedActions: ToolbarAction[] = [];
  
  if (selectedCount > 0) {
    if (onEditSelected && selectedCount === 1) {
      selectedActions.push({
        id: 'edit',
        label: t('toolbar.actions.edit', { ns: 'properties' }),
        icon: Edit,
        onClick: onEditSelected,
        variant: 'outline',
        shortcut: 'Ctrl+E',
      });
    }
    
    if (onDeleteSelected) {
      selectedActions.push({
        id: 'delete',
        label: t('toolbar.actions.delete', { ns: 'properties' }),
        icon: Trash2,
        onClick: onDeleteSelected,
        variant: 'destructive',
        shortcut: 'Delete',
      });
    }
  }
  
  // Export actions
  const exportActions: ToolbarAction[] = [];
  
  if (onExport) {
    exportActions.push({
      id: 'export',
      label: t('toolbar.export.title', { ns: 'properties' }),
      icon: Download,
      onClick: () => {}, // Handled in dropdown
      variant: 'outline',
    });
  }
  
  // Filter configuration
  const filters: ToolbarFilter[] = [
    {
      id: 'status-filter',
      label: t('filters.title'),
      icon: Filter,
      active: activeFilters.length > 0,
      count: activeFilters.length,
      children: (
        <>
          <DropdownMenuLabel>{t('filters.title')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Building States */}
          {[
            { value: 'active', label: t('filters.states.active') },
            { value: 'construction', label: t('filters.states.construction') },
            { value: 'planned', label: t('filters.states.planned') },
            { value: 'completed', label: t('filters.states.completed') },
          ].map(({ value, label }) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={activeFilters.includes(value)}
              onCheckedChange={(checked) => {
                if (onFiltersChange) {
                  const newFilters = checked
                    ? [...activeFilters, value]
                    : activeFilters.filter(f => f !== value);
                  onFiltersChange(newFilters);
                }
              }}
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
          
          <DropdownMenuSeparator />
          
          {/* Building Types */}
          {[
            { value: 'residential', label: t('filters.types.residential') },
            { value: 'commercial', label: t('filters.types.commercial') },
            { value: 'mixed', label: t('filters.types.mixed') },
          ].map(({ value, label }) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={activeFilters.includes(value)}
              onCheckedChange={(checked) => {
                if (onFiltersChange) {
                  const newFilters = checked
                    ? [...activeFilters, value]
                    : activeFilters.filter(f => f !== value);
                  onFiltersChange(newFilters);
                }
              }}
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
          
          <DropdownMenuSeparator />
          
          {/* Clear all */}
          <DropdownMenuItem 
            onClick={() => onFiltersChange?.([])}
            disabled={activeFilters.length === 0}
          >
            {t('filters.clearAll')}
          </DropdownMenuItem>
        </>
      ),
    },
  ];
  
  // Export dropdown if export is available
  if (onExport) {
    filters.push({
      id: 'export-menu',
      label: t('toolbar.export.title', { ns: 'properties' }),
      icon: Download,
      children: (
        <>
          <DropdownMenuLabel>{t('toolbar.export.title', { ns: 'properties' })}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            {t('toolbar.export.pdf', { ns: 'properties' })}
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => onExport('stats')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            {t('toolbar.export.stats', { ns: 'properties' })}
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => onExport('timeline')}>
            <Timeline className="h-4 w-4 mr-2" />
            {t('toolbar.export.timeline', { ns: 'properties' })}
          </DropdownMenuItem>
        </>
      ),
    });
  }
  
  // Title with selection info
  const getTitle = () => {
    if (selectedCount > 0) {
      return `${selectedCount} από ${totalCount} επιλεγμένα`;
    }
    return `${totalCount} Κτίρια`;
  };
  
  return (
    <BaseToolbar
      variant="default"
      position="sticky"
      title={getTitle()}
      subtitle={selectedCount > 0 ? 'Επιλέξτε ενέργεια για τα επιλεγμένα στοιχεία' : undefined}
      
      search={{
        placeholder: 'Αναζήτηση κτιρίων...',
        value: searchValue,
        onChange: onSearchChange,
        onClear: () => onSearchChange?.(''),
        disabled: disabled || loading,
      }}
      
      filters={filters}
      activeFiltersCount={activeFilters.length}
      onClearAllFilters={() => onFiltersChange?.([])}
      
      primaryActions={primaryActions}
      actions={[...selectedActions, ...exportActions]}
      
      loading={loading}
      disabled={disabled}
    />
  );
}