'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Edit,
  Trash2,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Search,
  X,
  Archive,
  Star,
  HelpCircle,
  Heart,
  Settings,
  Eye,
  FileText,
  Copy,
  Share2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface CompactToolbarProps {
  selectedItems?: number[];
  onSelectionChange?: (items: number[]) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  onNewBuilding?: () => void;
  onEditBuilding?: (id: number) => void;
  onDeleteBuilding?: (ids: number[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
}

export function CompactToolbar({
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
}: CompactToolbarProps) {

  const handleFilterChange = (filter: string, checked: boolean) => {
    if (checked) {
      onFiltersChange?.([...activeFilters, filter]);
    } else {
      onFiltersChange?.(activeFilters.filter(f => f !== filter));
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 border-b bg-muted/30">

      {/* First row - Search */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-64">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση κτιρίων..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-7 pr-7 h-8 text-xs"
          />
          {searchTerm && onSearchChange && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-8 w-8 p-0"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Selection indicator */}
        {selectedItems.length > 0 && (
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {selectedItems.length} επιλεγμένα
          </div>
        )}
      </div>

      {/* Second row - All action icons with wrapping */}
      <div className="flex items-center flex-wrap gap-1">

        {/* New Building */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onNewBuilding}
          title="Νέο Κτίριο (Ctrl+N)"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* Edit Building */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => selectedItems[0] && onEditBuilding?.(selectedItems[0])}
          disabled={selectedItems.length !== 1}
          title="Επεξεργασία επιλεγμένου"
        >
          <Edit className="h-4 w-4" />
        </Button>

        {/* Delete Building */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onDeleteBuilding?.(selectedItems)}
          disabled={selectedItems.length === 0}
          title={`Διαγραφή ${selectedItems.length} κτιρίου/ων`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        {/* Filters Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Φίλτρα"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Κατάσταση κτιρίου */}
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

            <DropdownMenuSeparator />

            {/* Τύπος κτιρίου */}
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

            <DropdownMenuSeparator />

            {/* Φίλτρα ονόματος */}
            <DropdownMenuLabel>Φίλτρα ονόματος</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { value: 'name-a-to-z', label: 'Όνομα A-Z' },
              { value: 'name-z-to-a', label: 'Όνομα Z-A' },
              { value: 'name-contains-tower', label: 'Περιέχει "Πύργο"' },
              { value: 'name-contains-complex', label: 'Περιέχει "Συγκρότημα"' },
            ].map(({ value, label }) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={activeFilters.includes(value)}
                onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            {/* Φίλτρα προόδου */}
            <DropdownMenuLabel>Πρόοδος έργου</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { value: 'progress-0-25', label: '0-25% (Έναρξη)' },
              { value: 'progress-25-50', label: '25-50% (Εξέλιξη)' },
              { value: 'progress-50-75', label: '50-75% (Προχωρημένο)' },
              { value: 'progress-75-100', label: '75-100% (Ολοκλήρωση)' },
              { value: 'progress-completed', label: 'Ολοκληρωμένα (100%)' },
            ].map(({ value, label }) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={activeFilters.includes(value)}
                onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            {/* Φίλτρα αξίας */}
            <DropdownMenuLabel>Αξία έργου</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { value: 'value-under-1m', label: '< 1M €' },
              { value: 'value-1m-5m', label: '1M - 5M €' },
              { value: 'value-5m-10m', label: '5M - 10M €' },
              { value: 'value-10m-50m', label: '10M - 50M €' },
              { value: 'value-over-50m', label: '> 50M €' },
              { value: 'value-premium', label: 'Premium (> 100M €)' },
            ].map(({ value, label }) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={activeFilters.includes(value)}
                onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            {/* Φίλτρα επιφάνειας */}
            <DropdownMenuLabel>Συνολική επιφάνεια</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { value: 'area-under-1k', label: '< 1.000 m²' },
              { value: 'area-1k-5k', label: '1.000 - 5.000 m²' },
              { value: 'area-5k-10k', label: '5.000 - 10.000 m²' },
              { value: 'area-10k-25k', label: '10.000 - 25.000 m²' },
              { value: 'area-25k-50k', label: '25.000 - 50.000 m²' },
              { value: 'area-over-50k', label: '> 50.000 m²' },
              { value: 'area-mega', label: 'Mega έργα (> 100.000 m²)' },
            ].map(({ value, label }) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={activeFilters.includes(value)}
                onCheckedChange={(checked) => handleFilterChange(value, !!checked)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            {/* Clear all filters */}
            {activeFilters.length > 0 && (
              <DropdownMenuItem
                onClick={() => onFiltersChange?.([])}
                className="text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Καθαρισμός όλων ({activeFilters.length})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Favorites */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Add to favorites...')}
          disabled={selectedItems.length === 0}
          title="Προσθήκη στα αγαπημένα"
        >
          <Star className="h-4 w-4" />
        </Button>

        {/* Archive */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Archive selected...')}
          disabled={selectedItems.length === 0}
          title="Αρχειοθέτηση επιλεγμένων"
        >
          <Archive className="h-4 w-4" />
        </Button>

        {/* Export */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onExport}
          title="Εξαγωγή δεδομένων"
        >
          <Download className="h-4 w-4" />
        </Button>

        {/* Import */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Import data...')}
          title="Εισαγωγή δεδομένων"
        >
          <Upload className="h-4 w-4" />
        </Button>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onRefresh}
          title="Ανανέωση δεδομένων (F5)"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Separator - visual divider */}
        <div className="w-px h-6 bg-border mx-1"></div>

        {/* View/Preview */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Preview mode...')}
          title="Προεπισκόπηση"
        >
          <Eye className="h-4 w-4" />
        </Button>

        {/* Copy */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Copy selection...')}
          disabled={selectedItems.length === 0}
          title="Αντιγραφή επιλεγμένων"
        >
          <Copy className="h-4 w-4" />
        </Button>

        {/* Share */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Share...')}
          title="Κοινοποίηση"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Reports */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Generate reports...')}
          title="Δημιουργία αναφορών"
        >
          <FileText className="h-4 w-4" />
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Settings...')}
          title="Ρυθμίσεις"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* Favorites Management */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Favorites management...')}
          title="Διαχείριση αγαπημένων"
        >
          <Heart className="h-4 w-4" />
        </Button>

        {/* Help */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => console.log('Show help...')}
          title="Βοήθεια και οδηγίες (F1)"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

      </div>
    </div>
  );
}