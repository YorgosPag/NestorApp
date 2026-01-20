'use client';

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import {
  Plus, Edit, Trash2, Download, Upload, RefreshCw,
  Archive, Star, Share, MapPin, HelpCircle, ArrowUpDown
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
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
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
        {t('toolbar.new')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => selectedItems[0] && onEditProject?.(selectedItems[0])}
        disabled={selectedItems.length !== 1}
      >
        <Edit className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.edit')}
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDeleteProject?.(selectedItems)}
        disabled={selectedItems.length === 0}
      >
        <Trash2 className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.delete')}
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
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  return (
    <>
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.export')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Import projects...')}
      >
        <Upload className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.import')}
      </Button>
    </>
  );
}

// ⚙️ Διαχείριση (Management)
export function ManagementTabContent({
  selectedItems = [],
  onRefresh
}: TabContentProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  return (
    <>
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.refresh')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Archive selected projects...')}
        disabled={selectedItems.length === 0}
      >
        <Archive className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.archive')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Add to favorites...')}
        disabled={selectedItems.length === 0}
      >
        <Star className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.favorite')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Share projects...')}
        disabled={selectedItems.length === 0}
      >
        <Share className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.share')}
      </Button>
    </>
  );
}

// 🛠️ Εργαλεία (Tools)
export function ToolsTabContent({ selectedItems = [] }: TabContentProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
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
        {t('toolbar.mapView')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => console.log('Show help...')}
      >
        <HelpCircle className={`${iconSizes.sm} mr-1`} />
        {t('toolbar.help')}
      </Button>
    </>
  );
}

// 🔍 Φίλτρα (Filters)
export function SearchFiltersTabContent({
  getCurrentStatusFilter,
  getCurrentTypeFilter,
  handleStatusChange,
  handleTypeChange,
  statusTabs = [],
  typeTabs = []
}: TabContentProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  return (
    <>
      {/* Status Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            {t('toolbar.filters.status.label')}: {statusTabs.find(tab => tab.value === getCurrentStatusFilter?.())?.label || COMMON_FILTER_LABELS.ALL_STATUSES}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('toolbar.filters.status.title')}</DropdownMenuLabel>
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
            {t('toolbar.filters.type.label')}: {typeTabs.find(tab => tab.value === getCurrentTypeFilter?.())?.label || COMMON_FILTER_LABELS.ALL_TYPES}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('toolbar.filters.type.title')}</DropdownMenuLabel>
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
            {t('toolbar.filters.sort.label')} {sortDirection === 'asc' ? '↑' : '↓'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('toolbar.filters.sort.title')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSortDirection('asc')}>
            {t('toolbar.filters.sort.ascending')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortDirection('desc')}>
            {t('toolbar.filters.sort.descending')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => console.log('Sort by date...')}>
            {t('toolbar.filters.sort.byDate')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by completion...')}>
            {t('toolbar.filters.sort.byCompletion')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => console.log('Sort by priority...')}>
            {t('toolbar.filters.sort.byPriority')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}