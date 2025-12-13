
'use client';

import React, { useState } from 'react';
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
  Building,
  FileText,
  BarChart3,
  Archive,
  Star,
  HelpCircle
} from 'lucide-react';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface BuildingToolbarProps {
  selectedItems?: number[];
  onSelectionChange?: (items: number[]) => void;
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

  // Primary actions (main operations)
  const primaryActions: ToolbarAction[] = [
    {
      id: 'new-building',
      label: 'Νέο Κτίριο',
      icon: Plus,
      onClick: () => onNewBuilding?.(),
      variant: 'default',
      tooltip: 'Προσθήκη νέου κτιρίου (Ctrl+N)',
      shortcut: 'Ctrl+N'
    },
    {
      id: 'edit-building',
      label: 'Επεξεργασία',
      icon: Edit,
      onClick: () => selectedItems[0] && onEditBuilding?.(selectedItems[0]),
      variant: 'outline',
      disabled: selectedItems.length !== 1,
      tooltip: 'Επεξεργασία επιλεγμένου κτιρίου (Ctrl+E)',
      shortcut: 'Ctrl+E'
    },
    {
      id: 'delete-building',
      label: 'Διαγραφή',
      icon: Trash2,
      onClick: () => onDeleteBuilding?.(selectedItems),
      variant: 'destructive',
      disabled: selectedItems.length === 0,
      tooltip: `Διαγραφή ${selectedItems.length} κτιρίου/ων`,
      badge: selectedItems.length > 0 ? selectedItems.length : undefined
    }
  ];

  // Secondary actions (utility functions)
  const secondaryActions: ToolbarAction[] = [
    {
      id: 'export',
      label: 'Εξαγωγή',
      icon: Download,
      onClick: () => onExport?.(),
      variant: 'ghost',
      tooltip: 'Εξαγωγή δεδομένων'
    },
    {
      id: 'import',
      label: 'Εισαγωγή',
      icon: Upload,
      onClick: () => console.log('Import data...'),
      variant: 'ghost',
      tooltip: 'Εισαγωγή δεδομένων'
    },
    {
      id: 'refresh',
      label: 'Ανανέωση',
      icon: RefreshCw,
      onClick: () => onRefresh?.(),
      variant: 'ghost',
      tooltip: 'Ανανέωση δεδομένων (F5)',
      shortcut: 'F5'
    },
    {
      id: 'archive',
      label: 'Αρχειοθέτηση',
      icon: Archive,
      onClick: () => console.log('Archive selected...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Αρχειοθέτηση επιλεγμένων'
    },
    {
      id: 'favorite',
      label: 'Αγαπημένα',
      icon: Star,
      onClick: () => console.log('Add to favorites...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Προσθήκη στα αγαπημένα'
    },
    {
      id: 'help',
      label: 'Βοήθεια',
      icon: HelpCircle,
      onClick: () => console.log('Show help...'),
      variant: 'ghost',
      tooltip: 'Βοήθεια και οδηγίες (F1)',
      shortcut: 'F1'
    }
  ];

  // Search configuration
  const search: ToolbarSearch = {
    placeholder: 'Αναζήτηση κτιρίων...',
    value: searchTerm,
    onChange: onSearchChange,
    onClear: () => onSearchChange?.('')
  };

  // Filters configuration
  const filters: ToolbarFilter[] = [
    {
      id: 'status-filter',
      label: 'Κατάσταση',
      icon: Filter,
      active: activeFilters.some(f => ['active', 'inactive', 'maintenance'].includes(f)),
      count: activeFilters.filter(f => ['active', 'inactive', 'maintenance'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>Κατάσταση κτιρίου</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'active', label: 'Ενεργά' },
            { value: 'inactive', label: 'Ανενεργά' },
            { value: 'maintenance', label: 'Συντήρηση' },
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
      label: 'Τύπος',
      icon: Building,
      active: activeFilters.some(f => ['residential', 'commercial', 'mixed'].includes(f)),
      count: activeFilters.filter(f => ['residential', 'commercial', 'mixed'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>Τύπος κτιρίου</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'residential', label: 'Οικιστικό' },
            { value: 'commercial', label: 'Επαγγελματικό' },
            { value: 'mixed', label: 'Μεικτό' },
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
      label: `Ταξινόμηση ${sortDirection === 'asc' ? '↑' : '↓'}`,
      icon: ArrowUpDown,
      active: true,
      children: (
        <>
          <DropdownMenuLabel>Ταξινόμηση κτιρίων</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSortDirection('asc')}>
            Αύξουσα (A-Z)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortDirection('desc')}>
            Φθίνουσα (Z-A)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => console.log('Sort by date...')}>
            Κατά ημερομηνία
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by size...')}>
            Κατά μέγεθος
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
            {selectedItems.length} επιλεγμένα κτίρια
          </div>
        )
      }
      className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    />
  );
}
