'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  Users,
  Phone,
  Mail,
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

interface ContactsToolbarProps {
  selectedItems?: string[];
  onSelectionChange?: (items: string[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewContact?: () => void;
  onEditContact?: () => void;
  onDeleteContact?: (ids?: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  hasSelectedContact?: boolean;
  showOnlyFavorites?: boolean;
  onToggleFavoritesFilter?: () => void;
}

export function ContactsToolbar({
  selectedItems = [],
  onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  onNewContact,
  onEditContact,
  onDeleteContact,
  onExport,
  onRefresh,
  hasSelectedContact = false,
  showOnlyFavorites = false,
  onToggleFavoritesFilter
}: ContactsToolbarProps) {
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
      id: 'new-contact',
      label: 'Νέα Επαφή',
      icon: Plus,
      onClick: () => onNewContact?.(),
      variant: 'default',
      tooltip: 'Προσθήκη νέας επαφής'
    },
    {
      id: 'edit-contact',
      label: 'Επεξεργασία',
      icon: Edit,
      onClick: () => hasSelectedContact && onEditContact?.(),
      variant: 'outline',
      disabled: !hasSelectedContact,
      tooltip: 'Επεξεργασία επιλεγμένης επαφής (Ctrl+E)',
      shortcut: 'Ctrl+E'
    },
    {
      id: 'delete-contact',
      label: 'Διαγραφή',
      icon: Trash2,
      onClick: () => {
        // Αν υπάρχουν selectedItems, περνάμε αυτά
        // Αλλιώς περνάμε undefined για να χρησιμοποιηθεί το selectedContact
        if (selectedItems.length > 0) {
          onDeleteContact?.(selectedItems);
        } else if (hasSelectedContact) {
          onDeleteContact?.();
        }
      },
      variant: 'destructive',
      disabled: selectedItems.length === 0 && !hasSelectedContact,
      tooltip: selectedItems.length > 0
        ? `Διαγραφή ${selectedItems.length} επαφής/ών`
        : hasSelectedContact
          ? 'Διαγραφή επιλεγμένης επαφής'
          : 'Επιλέξτε επαφή για διαγραφή',
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
      tooltip: 'Εξαγωγή λίστας επαφών'
    },
    {
      id: 'import',
      label: 'Εισαγωγή',
      icon: Upload,
      onClick: () => console.log('Import contacts...'),
      variant: 'ghost',
      tooltip: 'Εισαγωγή επαφών από αρχείο'
    },
    {
      id: 'refresh',
      label: 'Ανανέωση',
      icon: RefreshCw,
      onClick: () => onRefresh?.(),
      variant: 'ghost',
      tooltip: 'Ανανέωση λίστας επαφών (F5)',
      shortcut: 'F5'
    },
    {
      id: 'call',
      label: 'Κλήση',
      icon: Phone,
      onClick: () => console.log('Call selected contacts...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Κλήση επιλεγμένων επαφών'
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      onClick: () => console.log('Email selected contacts...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Αποστολή email στις επιλεγμένες επαφές'
    },
    {
      id: 'archive',
      label: 'Αρχειοθέτηση',
      icon: Archive,
      onClick: () => console.log('Archive selected contacts...'),
      variant: 'ghost',
      disabled: selectedItems.length === 0,
      tooltip: 'Αρχειοθέτηση επιλεγμένων επαφών'
    },
    {
      id: 'favorite',
      label: 'Αγαπημένα',
      icon: Star,
      onClick: () => onToggleFavoritesFilter?.(),
      variant: showOnlyFavorites ? 'default' : 'ghost',
      disabled: false,
      tooltip: showOnlyFavorites ? 'Εμφάνιση όλων των επαφών' : 'Φιλτράρισμα μόνο αγαπημένων επαφών'
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
    placeholder: 'Αναζήτηση επαφών...',
    value: searchTerm,
    onChange: onSearchChange,
    onClear: () => onSearchChange?.('')
  };

  // Filters configuration
  const filters: ToolbarFilter[] = [
    {
      id: 'type-filter',
      label: 'Τύπος',
      icon: Filter,
      active: activeFilters.some(f => ['individual', 'company', 'organization'].includes(f)),
      count: activeFilters.filter(f => ['individual', 'company', 'organization'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>Τύπος επαφής</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'individual', label: 'Άτομο' },
            { value: 'company', label: 'Εταιρεία' },
            { value: 'organization', label: 'Οργανισμός' },
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
      id: 'status-filter',
      label: 'Κατάσταση',
      icon: Users,
      active: activeFilters.some(f => ['active', 'inactive', 'potential'].includes(f)),
      count: activeFilters.filter(f => ['active', 'inactive', 'potential'].includes(f)).length,
      children: (
        <>
          <DropdownMenuLabel>Κατάσταση επαφής</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { value: 'active', label: 'Ενεργές' },
            { value: 'inactive', label: 'Ανενεργές' },
            { value: 'potential', label: 'Πιθανοί πελάτες' },
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
          <DropdownMenuLabel>Ταξινόμηση επαφών</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSortDirection('asc')}>
            Αύξουσα (A-Z)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortDirection('desc')}>
            Φθίνουσα (Z-A)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => console.log('Sort by date...')}>
            Κατά ημερομηνία δημιουργίας
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by last contact...')}>
            Κατά τελευταία επικοινωνία
          </DropdownMenuItem>
        </>
      )
    }
  ];

  return (
    <BaseToolbar
      variant="narrow"
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
            {selectedItems.length} επιλεγμένες επαφές
          </div>
        )
      }
      className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    />
  );
}
