'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search'; // 🏢 ENTERPRISE centralized search
import { useIconSizes } from '@/hooks/useIconSizes';
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
  Share2,
  ArrowUpDown
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

import type { CompactToolbarProps } from './types';
import { getIconColor } from './icon-colors';

export function CompactToolbar({
  config,
  selectedItems = [],
  onSelectionChange,
  searchTerm = '',
  onSearchChange,
  activeFilters = [],
  onFiltersChange,
  sortBy = 'name',
  onSortChange,
  hasSelectedContact = false,
  headerTitle,
  headerCount,
  headerIcon: HeaderIcon,
  onNewItem,
  onEditItem,
  onDeleteItems,
  onExport,
  onImport,
  onRefresh,
  onPreview,
  onCopy,
  onShare,
  onReports,
  onSettings,
  onFavoritesManagement,
  onHelp
}: CompactToolbarProps) {
  const iconSizes = useIconSizes();

  const handleFilterChange = (filter: string, checked: boolean) => {
    if (checked) {
      onFiltersChange?.([...activeFilters, filter]);
    } else {
      onFiltersChange?.(activeFilters.filter(f => f !== filter));
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2 border-b bg-muted/30">

      {/* Action icons row with selection indicator */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center flex-wrap gap-1">

        {/* New Item */}
        {config.availableActions.newItem && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onNewItem}
            title={config.tooltips.newItem}
          >
            <Plus className={`${iconSizes.sm} ${getIconColor('newItem')}`} />
          </Button>
        )}

        {/* Edit Item */}
        {config.availableActions.editItem && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={() => hasSelectedContact && onEditItem?.(0)}
            disabled={!hasSelectedContact}
            title={config.tooltips.editItem}
          >
            <Edit className={`${iconSizes.sm} ${!hasSelectedContact ? 'text-gray-400' : getIconColor('editItem')}`} />
          </Button>
        )}

        {/* Delete Items */}
        {config.availableActions.deleteItems && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={() => onDeleteItems?.(selectedItems)}
            disabled={hasSelectedContact !== undefined ? !hasSelectedContact : selectedItems.length === 0}
            title={config.tooltips.deleteItems}
          >
            <Trash2 className={`${iconSizes.sm} ${hasSelectedContact !== undefined ? (!hasSelectedContact ? 'text-gray-400' : getIconColor('deleteItems')) : (selectedItems.length === 0 ? 'text-gray-400' : getIconColor('deleteItems'))}`} />
          </Button>
        )}

        {/* Filters Dropdown */}
        {config.availableActions.filters && config.filterCategories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${iconSizes.xl} p-0 relative`}
                title={config.tooltips.filters}
              >
                <Filter className={`${iconSizes.sm} ${getIconColor('filters')}`} />
                {activeFilters.length > 0 && (
                  <span className={`absolute -top-1 -right-1 ${iconSizes.sm} bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center`}>
                    {activeFilters.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {config.filterCategories.map((category, categoryIndex) => (
                <React.Fragment key={category.id}>
                  <DropdownMenuLabel>{category.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {category.options.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={activeFilters.includes(option.value)}
                      onCheckedChange={(checked) => handleFilterChange(option.value, !!checked)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {categoryIndex < config.filterCategories.length - 1 && (
                    <DropdownMenuSeparator />
                  )}
                </React.Fragment>
              ))}

              {/* Clear all filters */}
              {activeFilters.length > 0 && onFiltersChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onFiltersChange([])}
                    className="text-destructive"
                  >
                    <X className={`${iconSizes.sm} mr-2`} />
                    Καθαρισμός όλων ({activeFilters.length})
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Favorites */}
        {config.availableActions.favorites && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={() => console.log('Add to favorites...')}
            disabled={selectedItems.length === 0}
            title={config.tooltips.favorites}
          >
            <Star className={`${iconSizes.sm} ${selectedItems.length === 0 ? 'text-gray-400' : getIconColor('favorites')}`} />
          </Button>
        )}

        {/* Archive */}
        {config.availableActions.archive && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={() => console.log('Archive selected...')}
            disabled={selectedItems.length === 0}
            title={config.tooltips.archive}
          >
            <Archive className={`${iconSizes.sm} ${selectedItems.length === 0 ? 'text-gray-400' : getIconColor('archive')}`} />
          </Button>
        )}

        {/* Export */}
        {config.availableActions.export && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onExport}
            title={config.tooltips.export}
          >
            <Download className={`${iconSizes.sm} ${getIconColor('export')}`} />
          </Button>
        )}

        {/* Import */}
        {config.availableActions.import && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onImport}
            title={config.tooltips.import}
          >
            <Upload className={`${iconSizes.sm} ${getIconColor('import')}`} />
          </Button>
        )}

        {/* Refresh */}
        {config.availableActions.refresh && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onRefresh}
            title={config.tooltips.refresh}
          >
            <RefreshCw className={`${iconSizes.sm} ${getIconColor('refresh')}`} />
          </Button>
        )}

        {/* Sort Options Dropdown */}
        {config.availableActions.sorting && config.sortOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`${iconSizes.xl} p-0`}
                title={config.tooltips.sorting}
              >
                <ArrowUpDown className={`${iconSizes.sm} ${getIconColor('sorting')}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{config.labels.sorting}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {config.sortOptions.map((sortOption, index) => (
                <React.Fragment key={sortOption.field}>
                  <DropdownMenuItem onClick={() => onSortChange?.(sortOption.field, 'asc')}>
                    {sortOption.ascLabel}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSortChange?.(sortOption.field, 'desc')}>
                    {sortOption.descLabel}
                  </DropdownMenuItem>
                  {index < config.sortOptions.length - 1 && (
                    <DropdownMenuSeparator />
                  )}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Separator - visual divider */}
        <div className={`w-px ${iconSizes.lg} bg-border mx-1`}></div>

        {/* Preview */}
        {config.availableActions.preview && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onPreview}
            title={config.tooltips.preview}
          >
            <Eye className={`${iconSizes.sm} ${getIconColor('preview')}`} />
          </Button>
        )}

        {/* Copy */}
        {config.availableActions.copy && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onCopy}
            disabled={selectedItems.length === 0}
            title={config.tooltips.copy}
          >
            <Copy className={`${iconSizes.sm} ${selectedItems.length === 0 ? 'text-gray-400' : getIconColor('copy')}`} />
          </Button>
        )}

        {/* Share */}
        {config.availableActions.share && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onShare}
            title={config.tooltips.share}
          >
            <Share2 className={`${iconSizes.sm} ${getIconColor('share')}`} />
          </Button>
        )}

        {/* Reports */}
        {config.availableActions.reports && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onReports}
            title={config.tooltips.reports}
          >
            <FileText className={`${iconSizes.sm} ${getIconColor('reports')}`} />
          </Button>
        )}

        {/* Settings */}
        {config.availableActions.settings && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onSettings}
            title={config.tooltips.settings}
          >
            <Settings className={`${iconSizes.sm} ${getIconColor('settings')}`} />
          </Button>
        )}

        {/* Favorites Management */}
        {config.availableActions.favoritesManagement && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onFavoritesManagement}
            title={config.tooltips.favoritesManagement}
          >
            <Heart className={`${iconSizes.sm} ${getIconColor('favoritesManagement')}`} />
          </Button>
        )}

        {/* Help */}
        {config.availableActions.help && (
          <Button
            variant="ghost"
            size="sm"
            className={`${iconSizes.xl} p-0`}
            onClick={onHelp}
            title={config.tooltips.help}
          >
            <HelpCircle className={`${iconSizes.sm} ${getIconColor('help')}`} />
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

      {/* 🏢 ENTERPRISE Search Row - Same pattern as GenericListHeader */}
      <div className="flex items-center gap-2 mt-2">
        {/* Left: Icon + Title + Count - Same as lists */}
        {(headerTitle || headerCount !== undefined || HeaderIcon) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {HeaderIcon && (
              <HeaderIcon className={`${iconSizes.sm} text-blue-600`} />
            )}
            {headerTitle && (
              <span className="font-medium text-sm whitespace-nowrap">
                {headerTitle}{headerCount !== undefined ? ` (${headerCount})` : ''}
              </span>
            )}
          </div>
        )}

        {/* Right: Search Input - Same as lists */}
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={config.searchPlaceholder || 'Αναζήτηση...'}
          debounceMs={0} // Instant για navigation filters
          showClearButton={true}
          className="h-8 text-sm flex-1" // Same height as toolbar buttons
        />
      </div>

    </div>
  );
}