
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
  Folder,
  FileText,
  BarChart3,
  Calendar,
  Archive,
  Star,
  Share,
  MapPin,
  HelpCircle
} from 'lucide-react';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface ProjectToolbarProps {
  selectedItems?: number[];
  onSelectionChange?: (items: number[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewProject?: () => void;
  onEditProject?: (id: number) => void;
  onDeleteProject?: (ids: number[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

export function ProjectToolbar({
  selectedItems = [],
  onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onExport,
  onRefresh
}: ProjectToolbarProps) {
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
      id: 'new-project',
      label: 'Νέο Έργο',
      icon: Plus,
      onClick: () => onNewProject?.(),
      variant: 'default',
      tooltip: 'Δημιουργία νέου έργου (Ctrl+N)',
      shortcut: 'Ctrl+N'
    },
    {
      id: 'edit-project',
      label: 'Επεξεργασία',
      icon: Edit,
      onClick: () => selectedItems[0] && onEditProject?.(selectedItems[0]),
      variant: 'outline',
      disabled: selectedItems.length !== 1,
      tooltip: 'Επεξεργασία επιλεγμένου έργου (Ctrl+E)',
      shortcut: 'Ctrl+E'
    },
    {
      id: 'delete-project',
      label: 'Διαγραφή',
      icon: Trash2,
      onClick: () => onDeleteProject?.(selectedItems),
      variant: 'destructive',
      disabled: selectedItems.length === 0,
      tooltip: `Διαγραφή ${selectedItems.length} έργου/ων`,
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
      tooltip: 'Εξαγωγή δεδομένων έργων'
    },
    {
      id: 'import',
      label: 'Εισαγωγή',
      icon: Upload,
      onClick: () => console.log('Import projects...'),
      variant: 'ghost',
      tooltip: 'Εισαγωγή δεδομένων έργων'
    },
    {
      id: 'refresh',
      label: 'Ανανέωση',
      icon: RefreshCw,
      onClick: () => onRefresh?.(),
      variant: 'ghost',
      tooltip: 'Ανανέωση λίστας έργων (F5)',
      shortcut: 'F5'
    },
    {
      id: 'archive',
      label: 'Αρχειοθέτηση',
      icon: Archive,
      onClick: () => console.log('Archive selected projects...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Αρχειοθέτηση επιλεγμένων έργων'
    },
    {
      id: 'favorite',
      label: 'Αγαπημένα',
      icon: Star,
      onClick: () => console.log('Add to favorites...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Προσθήκη στα αγαπημένα έργα'
    },
    {
      id: 'share',
      label: 'Κοινοποίηση',
      icon: Share,
      onClick: () => console.log('Share projects...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Κοινοποίηση επιλεγμένων έργων'
    },
    {
      id: 'map-view',
      label: 'Χάρτης',
      icon: MapPin,
      onClick: () => console.log('View on map...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Προβολή έργων σε χάρτη'
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
    placeholder: 'Αναζήτηση έργων...',
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
      active: activeFilters.some(f => ['in_progress', 'planning', 'completed', 'on_hold'].includes(f)),
      count: activeFilters.filter(f => ['in_progress', 'planning', 'completed', 'on_hold'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>Κατάσταση έργου</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'in_progress', label: 'Σε εξέλιξη' },
            { value: 'planning', label: 'Σχεδιασμένα' },
            { value: 'completed', label: 'Ολοκληρωμένα' },
            { value: 'on_hold', label: 'Σε αναμονή' },
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
      icon: Folder,
      active: activeFilters.some(f => ['residential', 'commercial', 'infrastructure'].includes(f)),
      count: activeFilters.filter(f => ['residential', 'commercial', 'infrastructure'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>Τύπος έργου</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'residential', label: 'Οικιστικό' },
            { value: 'commercial', label: 'Επαγγελματικό' },
            { value: 'infrastructure', label: 'Υποδομές' },
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
          <DropdownMenuLabel>Ταξινόμηση έργων</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSortDirection('asc')}>
            Αύξουσα (A-Z)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortDirection('desc')}>
            Φθίνουσα (Z-A)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => console.log('Sort by date...')}>
            Κατά ημερομηνία έναρξης
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by completion...')}>
            Κατά πρόοδο
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by priority...')}>
            Κατά προτεραιότητα
          </DropdownMenuItem>
        </>
      )
    }
  ];

  return (
    <BaseToolbar
      variant="default"
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
            {selectedItems.length} επιλεγμένα έργα
          </div>
        )
      }
      className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    />
  );
}
