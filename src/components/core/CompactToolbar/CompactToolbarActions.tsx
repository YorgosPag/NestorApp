'use client';

/**
 * =============================================================================
 * CompactToolbar — Action Buttons
 * =============================================================================
 *
 * All toolbar icon-action buttons extracted for file size compliance.
 *
 * @module components/core/CompactToolbar/CompactToolbarActions
 */

import '@/lib/design-system';
import React from 'react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import {
  Plus, Edit, Trash2, Filter, Download, Upload, RefreshCw, X,
  Archive, Star, HelpCircle, Heart, Settings, Eye, FileText,
  Copy, Share2, ArrowUpDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { getIconColor } from './icon-colors';
import type { CompactToolbarProps } from './types';

const logger = createModuleLogger('CompactToolbarActions');

type ActionsProps = Pick<CompactToolbarProps,
  'config' | 'selectedItems' | 'activeFilters' | 'onFiltersChange' | 'onSortChange' |
  'hasSelectedContact' | 'newItemIcon' | 'deleteIcon' |
  'onNewItem' | 'onEditItem' | 'onDeleteItems' | 'onExport' | 'onImport' |
  'onRefresh' | 'onPreview' | 'onCopy' | 'onShare' | 'onReports' |
  'onSettings' | 'onFavoritesManagement' | 'onHelp'
> & {
  getTooltip: (key?: string) => string | undefined;
};

export function CompactToolbarActions({
  config, selectedItems = [], activeFilters = [], onFiltersChange, onSortChange,
  hasSelectedContact = false, newItemIcon: NewItemIcon, deleteIcon: DeleteIcon,
  onNewItem, onEditItem, onDeleteItems, onExport, onImport, onRefresh,
  onPreview, onCopy, onShare, onReports, onSettings, onFavoritesManagement, onHelp,
  getTooltip,
}: ActionsProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const { t } = useTranslation('common');

  const handleFilterChange = (filter: string, checked: boolean) => {
    if (checked) {
      onFiltersChange?.([...activeFilters, filter]);
    } else {
      onFiltersChange?.(activeFilters.filter(f => f !== filter));
    }
  };

  return (
    <>
      {/* New Item */}
      {config.availableActions.newItem && (() => {
        const IconComponent = NewItemIcon || Plus;
        const tooltip = getTooltip(config.tooltips.newItem);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onNewItem} aria-label={tooltip || t('buttons.add')}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={() => hasSelectedContact && onEditItem?.('0')} disabled={!hasSelectedContact}
                aria-label={tooltip || t('buttons.edit')}>
                <Edit className={`${iconSizes.sm} ${!hasSelectedContact ? colors.text.muted : getIconColor('editItem')}`} />
              </Button>
            </TooltipTrigger>
            {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
          </Tooltip>
        );
      })()}

      {/* Delete Items */}
      {config.availableActions.deleteItems && (() => {
        const IconComponent = DeleteIcon || Trash2;
        const isDisabled = hasSelectedContact !== undefined ? !hasSelectedContact : selectedItems.length === 0;
        const tooltip = getTooltip(config.tooltips.deleteItems);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={() => onDeleteItems?.(selectedItems)} disabled={isDisabled}
                aria-label={tooltip || t('buttons.delete')}>
                <IconComponent className={`${iconSizes.sm} ${isDisabled ? colors.text.muted : getIconColor('deleteItems')}`} />
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
                <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0 relative`}
                  aria-label={getTooltip(config.tooltips.filters) || t('filters.title')}>
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
                  <DropdownMenuCheckboxItem key={option.value}
                    checked={activeFilters.includes(option.value)}
                    onCheckedChange={(checked) => handleFilterChange(option.value, !!checked)}>
                    {t(option.label, { ns: 'common' })}
                  </DropdownMenuCheckboxItem>
                ))}
                {categoryIndex < config.filterCategories.length - 1 && <DropdownMenuSeparator />}
              </React.Fragment>
            ))}
            {activeFilters.length > 0 && onFiltersChange && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onFiltersChange([])} className="text-destructive">
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={() => logger.info('Add to favorites')} disabled={selectedItems.length === 0}
                aria-label={tooltip || 'Favorites'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={() => logger.info('Archive selected')} disabled={selectedItems.length === 0}
                aria-label={tooltip || 'Archive'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onExport} aria-label={tooltip || t('buttons.export')}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onImport} aria-label={tooltip || t('buttons.import')}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onRefresh} aria-label={tooltip || t('buttons.refresh')}>
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
                <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                  aria-label={getTooltip(config.tooltips.sorting) || 'Sort'}>
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
                {index < config.sortOptions.length - 1 && <DropdownMenuSeparator />}
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onPreview} aria-label={tooltip || 'Preview'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onCopy} disabled={selectedItems.length === 0} aria-label={tooltip || 'Copy'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onShare} aria-label={tooltip || 'Share'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onReports} aria-label={tooltip || 'Reports'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onSettings} aria-label={tooltip || 'Settings'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onFavoritesManagement} aria-label={tooltip || 'Manage favorites'}>
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
              <Button variant="ghost" size="sm" className={`${iconSizes.xl} p-0`}
                onClick={onHelp} aria-label={tooltip || 'Help'}>
                <HelpCircle className={`${iconSizes.sm} ${getIconColor('help')}`} />
              </Button>
            </TooltipTrigger>
            {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
          </Tooltip>
        );
      })()}
    </>
  );
}
