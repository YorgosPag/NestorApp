'use client';

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Edit, Trash2, Download, Upload, RefreshCw,
  Archive, Star, Share, MapPin, HelpCircle, Search, ArrowUpDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { COMMON_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

interface TabContentProps {
  selectedItems?: string[];
  onNewProject?: () => void;
  onEditProject?: (id: string) => void;
  onDeleteProject?: (ids: string[]) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  activeFilters?: string[];
  onFiltersChange?: (filters: string[]) => void;
  getCurrentStatusFilter?: () => string;
  getCurrentTypeFilter?: () => string;
  handleStatusChange?: (value: string) => void;
  handleTypeChange?: (value: string) => void;
  statusTabs?: Array<{ value: string; label: string }>;
  typeTabs?: Array<{ value: string; label: string }>;
}

// 🎯 Βασικές Ενέργειες (Actions)
export function ActionsTabContent({
  selectedItems = [],
  onNewProject,
  onEditProject,
  onDeleteProject
}: TabContentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={onNewProject}
        className="relative"
      >
        <Plus className={`${iconSizes.sm} mr-1`} />
        Νέο Έργο
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => selectedItems[0] && onEditProject?.(selectedItems[0])}
        disabled={selectedItems.length !== 1}
      >
        <Edit className={`${iconSizes.sm} mr-1`} />
        Επεξεργασία
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDeleteProject?.(selectedItems)}
        disabled={selectedItems.length === 0}
      >
        <Trash2 className={`${iconSizes.sm} mr-1`} />
        Διαγραφή
        {selectedItems.length > 0 && (
          <span className={`ml-1 ${colors.bg.primary} text-destructive px-1 rounded text-xs`}>
            {selectedItems.length}
          </span>
        )}
      </Button>
    </>
  );
}

// 📂 Εισαγωγή/Εξαγωγή (Import/Export)
export function ImportExportTabContent({ onExport }: TabContentProps) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className={`${iconSizes.sm} mr-1`} />
        Εξαγωγή
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Import projects...')}
      >
        <Upload className={`${iconSizes.sm} mr-1`} />
        Εισαγωγή
      </Button>
    </>
  );
}

// ⚙️ Διαχείριση (Management)
export function ManagementTabContent({
  selectedItems = [],
  onRefresh
}: TabContentProps) {
  const iconSizes = useIconSizes();
  return (
    <>
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw className={`${iconSizes.sm} mr-1`} />
        Ανανέωση
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Archive selected projects...')}
        disabled={selectedItems.length === 0}
      >
        <Archive className={`${iconSizes.sm} mr-1`} />
        Αρχειοθέτηση
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Add to favorites...')}
        disabled={selectedItems.length === 0}
      >
        <Star className={`${iconSizes.sm} mr-1`} />
        Αγαπημένα
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Share projects...')}
        disabled={selectedItems.length === 0}
      >
        <Share className={`${iconSizes.sm} mr-1`} />
        Κοινοποίηση
      </Button>
    </>
  );
}

// 🛠️ Εργαλεία (Tools)
export function ToolsTabContent({ selectedItems = [] }: TabContentProps) {
  const iconSizes = useIconSizes();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('View on map...')}
        disabled={selectedItems.length === 0}
      >
        <MapPin className={`${iconSizes.sm} mr-1`} />
        Χάρτης
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Show help...')}
      >
        <HelpCircle className={`${iconSizes.sm} mr-1`} />
        Βοήθεια
      </Button>
    </>
  );
}

// 🔍 Αναζήτηση/Φίλτρα (Search/Filters)
export function SearchFiltersTabContent({
  searchTerm = '',
  onSearchChange,
  getCurrentStatusFilter,
  getCurrentTypeFilter,
  handleStatusChange,
  handleTypeChange,
  statusTabs = [],
  typeTabs = []
}: TabContentProps) {
  const iconSizes = useIconSizes();
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  return (
    <>
      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} text-muted-foreground`} />
        <Input
          placeholder="Αναζήτηση έργων..."
          value={searchTerm}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-10 w-64"
        />
      </div>

      {/* Status Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            Κατάσταση: {statusTabs.find(tab => tab.value === getCurrentStatusFilter?.())?.label || COMMON_FILTER_LABELS.ALL_STATUSES}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Κατάσταση έργου</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {statusTabs.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => handleStatusChange?.(value)}
              className={getCurrentStatusFilter?.() === value ? "bg-orange-100 text-orange-700" : ""}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Type Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            Τύπος: {typeTabs.find(tab => tab.value === getCurrentTypeFilter?.())?.label || COMMON_FILTER_LABELS.ALL_TYPES}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Τύπος έργου</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {typeTabs.map(({ value, label }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => handleTypeChange?.(value)}
              className={getCurrentTypeFilter?.() === value ? "bg-orange-100 text-orange-700" : ""}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <ArrowUpDown className={`${iconSizes.sm} mr-1`} />
            Ταξινόμηση {sortDirection === 'asc' ? '↑' : '↓'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}