'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search'; // 🏢 ENTERPRISE centralized search
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
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

// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  headerIconColor,
  newItemIcon: NewItemIcon,
  deleteIcon: DeleteIcon,
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
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');

  // 🏢 ENTERPRISE: Translate search placeholder if it's an i18n key
  const getTranslatedPlaceholder = (placeholder?: string): string => {
    if (!placeholder) return t('toolbar.search.placeholder');
    if (placeholder.includes('.')) {
      const translated = t(placeholder);
      return translated === placeholder ? placeholder : translated;
    }
    return placeholder;
  };

  const handleFilterChange = (filter: string, checked: boolean) => {
    if (checked) {
      onFiltersChange?.([...activeFilters, filter]);
    } else {
      onFiltersChange?.(activeFilters.filter(f => f !== filter));
    }
  };

  return (
    <div className={`flex flex-col ${spacing.gap.sm} ${spacing.padding.sm} ${colors.bg.transparent}`}>

      {/* Action icons row with selection indicator */}
      <div className={`flex items-center justify-between flex-wrap ${spacing.gap.sm}`}>
        <div className={`flex items-center flex-wrap ${spacing.gap.sm}`}>

        {/* New Item */}
        {config.availableActions.newItem && (() => {
          // 🏢 ENTERPRISE: Use custom icon if provided (e.g., Link2 for connect), fallback to Plus
          const IconComponent = NewItemIcon || Plus;
          return (
            <Button
              variant="ghost"
              size="sm"
              className={`${iconSizes.xl} p-0`}
              onClick={onNewItem}
              title={config.tooltips.newItem}
            >
              <IconComponent className={`${iconSizes.sm} ${getIconColor('newItem')}`} />
            </Button>
          );
        })()}

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
            <Edit className={`${iconSizes.sm} ${!hasSelectedContact ? colors.text.muted : getIconColor('editItem')}`} />
          </Button>
        )}

        {/* Delete Items */}
        {config.availableActions.deleteItems && (() => {
          // 🏢 ENTERPRISE: Use custom icon if provided (e.g., Unlink2 for disconnect), fallback to Trash2
          const IconComponent = DeleteIcon || Trash2;
          const isDisabled = hasSelectedContact !== undefined ? !hasSelectedContact : selectedItems.length === 0;
          const iconColor = isDisabled ? colors.text.muted : getIconColor('deleteItems');

          return (
            <Button
              variant="ghost"
              size="sm"
              className={`${iconSizes.xl} p-0`}
              onClick={() => onDeleteItems?.(selectedItems)}
              disabled={isDisabled}
              title={config.tooltips.deleteItems}
            >
              <IconComponent className={`${iconSizes.sm} ${iconColor}`} />
            </Button>
          );
        })()}

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
                  <span className={`absolute -top-1 -right-1 ${iconSizes.sm} ${colors.bg.error} ${colors.text.onError} text-xs font-medium rounded-full flex items-center justify-center`}>
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
                    <X className={`${iconSizes.sm} ${spacing.margin.right.sm}`} />
                    {t('toolbar.ui.clearAllCount', { count: activeFilters.length })}
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
            <Star className={`${iconSizes.sm} ${selectedItems.length === 0 ? colors.text.muted : getIconColor('favorites')}`} />
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
            <Archive className={`${iconSizes.sm} ${selectedItems.length === 0 ? colors.text.muted : getIconColor('archive')}`} />
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
            <Copy className={`${iconSizes.sm} ${selectedItems.length === 0 ? colors.text.muted : getIconColor('copy')}`} />
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

        {/* 🏢 ENTERPRISE: Selection indicator with i18n */}
        {selectedItems.length > 0 && (
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {t('toolbar.ui.itemsSelected', { count: selectedItems.length })}
          </div>
        )}

      </div>

      {/* 🏢 ENTERPRISE Search Row - Same pattern as GenericListHeader */}
      <div className={`flex items-center ${spacing.gap.sm} ${spacing.margin.top.sm}`}>
        {/* Left: Icon + Title + Count - Same as lists */}
        {(headerTitle || headerCount !== undefined || HeaderIcon) && (
          <div className={`flex items-center ${spacing.gap.sm} flex-shrink-0`}>
            {HeaderIcon && (
              <HeaderIcon className={`${iconSizes.sm} ${headerIconColor || colors.text.info}`} />
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
          placeholder={getTranslatedPlaceholder(config.searchPlaceholder)}
          debounceMs={0} // Instant για navigation filters
          showClearButton={true}
          className="h-8 text-sm flex-1" // Same height as toolbar buttons
        />
      </div>

    </div>
  );
}