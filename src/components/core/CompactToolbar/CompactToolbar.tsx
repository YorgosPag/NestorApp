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
// 🏢 ENTERPRISE: Centralized Tooltip for consistent styling across all toolbars
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  const { t } = useTranslation('common');

  // 🏢 ENTERPRISE: Translate search placeholder if it's an i18n key
  // Clean implementation - relies on centralized i18n system
  const getTranslatedPlaceholder = (placeholder?: string): string => {
    if (!placeholder) return t('toolbar.search.placeholder');

    // If placeholder looks like an i18n key (contains dots)
    if (placeholder.includes('.')) {
      const translated = t(placeholder);

      // Check if translation succeeded (not a raw key)
      const isTranslationSuccessful =
        translated !== placeholder &&
        !translated.startsWith('common.') &&
        !translated.startsWith('common:');

      return isTranslationSuccessful ? translated : placeholder;
    }

    return placeholder;
  };

  // 🏢 ENTERPRISE: Helper to translate tooltip keys
  // Clean implementation - relies on centralized i18n system
  const getTooltip = (tooltipKey?: string): string | undefined => {
    if (!tooltipKey) return undefined;

    const translated = t(tooltipKey);

    // 🏢 ENTERPRISE: Check if translation succeeded
    // A successful translation will NOT equal the key
    // Failed translations return the key itself or namespace-prefixed key
    // NOTE: Removed `.includes(' ')` check - single-word translations like "Φίλτρα" are valid
    const isTranslationSuccessful =
      translated !== tooltipKey &&
      !translated.startsWith('common.') &&
      !translated.startsWith('common:');

    if (isTranslationSuccessful) {
      return translated;
    }

    // 🏢 ENTERPRISE: If translation failed, return undefined (no tooltip)
    // This prevents showing raw i18n keys to users
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[i18n] Translation missing for key: ${tooltipKey}`);
    }

    return undefined;
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
          const tooltip = getTooltip(config.tooltips.newItem);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onNewItem}
                >
                  <IconComponent className={`${iconSizes.sm} ${getIconColor('newItem')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Edit Item */}
        {config.availableActions.editItem && (() => {
          const tooltip = getTooltip(config.tooltips.editItem);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={() => hasSelectedContact && onEditItem?.('0')}
                  disabled={!hasSelectedContact}
                >
                  <Edit className={`${iconSizes.sm} ${!hasSelectedContact ? colors.text.muted : getIconColor('editItem')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Delete Items */}
        {config.availableActions.deleteItems && (() => {
          // 🏢 ENTERPRISE: Use custom icon if provided (e.g., Unlink2 for disconnect), fallback to Trash2
          const IconComponent = DeleteIcon || Trash2;
          const isDisabled = hasSelectedContact !== undefined ? !hasSelectedContact : selectedItems.length === 0;
          const iconColor = isDisabled ? colors.text.muted : getIconColor('deleteItems');
          const tooltip = getTooltip(config.tooltips.deleteItems);

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={() => onDeleteItems?.(selectedItems)}
                  disabled={isDisabled}
                >
                  <IconComponent className={`${iconSizes.sm} ${iconColor}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Filters Dropdown */}
        {config.availableActions.filters && config.filterCategories.length > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${iconSizes.xl} p-0 relative`}
                  >
                    <Filter className={`${iconSizes.sm} ${getIconColor('filters')}`} />
                    {activeFilters.length > 0 && (
                      <span className={`absolute -top-1 -right-1 ${iconSizes.sm} ${colors.bg.error} ${colors.text.inverted} text-xs font-medium rounded-full flex items-center justify-center`}>
                        {activeFilters.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{getTooltip(config.tooltips.filters)}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              {config.filterCategories.map((category, categoryIndex) => (
                <React.Fragment key={category.id}>
                  <DropdownMenuLabel>{t(category.label, { ns: 'common' })}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {category.options.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={activeFilters.includes(option.value)}
                      onCheckedChange={(checked) => handleFilterChange(option.value, !!checked)}
                    >
                      {t(option.label, { ns: 'common' })}
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
        {config.availableActions.favorites && (() => {
          const tooltip = getTooltip(config.tooltips.favorites);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={() => console.log('Add to favorites...')}
                  disabled={selectedItems.length === 0}
                >
                  <Star className={`${iconSizes.sm} ${selectedItems.length === 0 ? colors.text.muted : getIconColor('favorites')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Archive */}
        {config.availableActions.archive && (() => {
          const tooltip = getTooltip(config.tooltips.archive);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={() => console.log('Archive selected...')}
                  disabled={selectedItems.length === 0}
                >
                  <Archive className={`${iconSizes.sm} ${selectedItems.length === 0 ? colors.text.muted : getIconColor('archive')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Export */}
        {config.availableActions.export && (() => {
          const tooltip = getTooltip(config.tooltips.export);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onExport}
                >
                  <Download className={`${iconSizes.sm} ${getIconColor('export')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Import */}
        {config.availableActions.import && (() => {
          const tooltip = getTooltip(config.tooltips.import);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onImport}
                >
                  <Upload className={`${iconSizes.sm} ${getIconColor('import')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Refresh */}
        {config.availableActions.refresh && (() => {
          const tooltip = getTooltip(config.tooltips.refresh);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onRefresh}
                >
                  <RefreshCw className={`${iconSizes.sm} ${getIconColor('refresh')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Sort Options Dropdown */}
        {config.availableActions.sorting && config.sortOptions.length > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${iconSizes.xl} p-0`}
                  >
                    <ArrowUpDown className={`${iconSizes.sm} ${getIconColor('sorting')}`} />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{getTooltip(config.tooltips.sorting)}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{config.labels.sorting}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {config.sortOptions.map((sortOption, index) => (
                <React.Fragment key={sortOption.field}>
                  <DropdownMenuItem onClick={() => onSortChange?.(sortOption.field, 'asc')}>
                    {t(sortOption.ascLabel)}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSortChange?.(sortOption.field, 'desc')}>
                    {t(sortOption.descLabel)}
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
        {config.availableActions.preview && (() => {
          const tooltip = getTooltip(config.tooltips.preview);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onPreview}
                >
                  <Eye className={`${iconSizes.sm} ${getIconColor('preview')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Copy */}
        {config.availableActions.copy && (() => {
          const tooltip = getTooltip(config.tooltips.copy);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onCopy}
                  disabled={selectedItems.length === 0}
                >
                  <Copy className={`${iconSizes.sm} ${selectedItems.length === 0 ? colors.text.muted : getIconColor('copy')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Share */}
        {config.availableActions.share && (() => {
          const tooltip = getTooltip(config.tooltips.share);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onShare}
                >
                  <Share2 className={`${iconSizes.sm} ${getIconColor('share')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Reports */}
        {config.availableActions.reports && (() => {
          const tooltip = getTooltip(config.tooltips.reports);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onReports}
                >
                  <FileText className={`${iconSizes.sm} ${getIconColor('reports')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Settings */}
        {config.availableActions.settings && (() => {
          const tooltip = getTooltip(config.tooltips.settings);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onSettings}
                >
                  <Settings className={`${iconSizes.sm} ${getIconColor('settings')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Favorites Management */}
        {config.availableActions.favoritesManagement && (() => {
          const tooltip = getTooltip(config.tooltips.favoritesManagement);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onFavoritesManagement}
                >
                  <Heart className={`${iconSizes.sm} ${getIconColor('favoritesManagement')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

        {/* Help */}
        {config.availableActions.help && (() => {
          const tooltip = getTooltip(config.tooltips.help);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${iconSizes.xl} p-0`}
                  onClick={onHelp}
                >
                  <HelpCircle className={`${iconSizes.sm} ${getIconColor('help')}`} />
                </Button>
              </TooltipTrigger>
              {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
          );
        })()}

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