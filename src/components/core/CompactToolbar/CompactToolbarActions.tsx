'use client';

/**
 * =============================================================================
 * CompactToolbar — Action Buttons
 * =============================================================================
 *
 * All toolbar icon-action buttons extracted for file size compliance.
 *
 * 🔴 **ADR-823 §14.5** — τα δεκατρία εικονιδιακά κουμπιά ήταν **δεκατρία
 * αντίγραφα** του ίδιου δεκάγραμμου μπλοκ *(μετρημένο: 13 κλώνοι, 117 γραμμές,
 * 29,5% του αρχείου)*. Ζουν πλέον στο `./ToolbarIconButton`.
 * ⛔ Τα **δύο dropdown** (φίλτρα · ταξινόμηση) **δεν** ενοποιήθηκαν: παρεμβάλλουν
 * `DropdownMenuTrigger asChild` και είναι **άλλο σχήμα** — δες το σχόλιο εκεί.
 *
 * @module components/core/CompactToolbar/CompactToolbarActions
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
// 🔴 ADR-823 §14 — ο ΜΟΝΟΣ αποκωδικοποιητής ετικέτας φίλτρου. Πριν, αυτό το αρχείο
// έγραφε `t(label, { ns: 'common' })` και έψαχνε στο `common` κλειδιά που ζουν στο
// `parking`/`filters`/`building` ⇒ ωμά κλειδιά στο μενού φίλτρων, ζωντανά μετρημένα.
import { translateFilterLabel } from '@/i18n/filter-label';
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
import { ToolbarIconButton } from './ToolbarIconButton';
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
  const { t } = useTranslation(COMMON_NAMESPACES);

  const handleFilterChange = (filter: string, checked: boolean) => {
    if (checked) {
      onFiltersChange?.([...activeFilters, filter]);
    } else {
      onFiltersChange?.(activeFilters.filter(f => f !== filter));
    }
  };

  /** Το κενό επιλογής — δύο κουμπιά το μοιράζονται, τρία το εξειδικεύουν. */
  const nothingSelected = selectedItems.length === 0;

  return (
    <>
      {/* New Item */}
      {config.availableActions.newItem && (
        <ToolbarIconButton
          icon={NewItemIcon || Plus}
          colorKey="newItem"
          tooltip={getTooltip(config.tooltips.newItem)}
          fallbackLabel={t('buttons.add')}
          onClick={onNewItem}
        />
      )}

      {/* Edit Item */}
      {config.availableActions.editItem && (
        <ToolbarIconButton
          icon={Edit}
          colorKey="editItem"
          tooltip={getTooltip(config.tooltips.editItem)}
          fallbackLabel={t('buttons.edit')}
          onClick={() => hasSelectedContact && onEditItem?.('0')}
          disabled={!hasSelectedContact}
        />
      )}

      {/* Delete Items */}
      {config.availableActions.deleteItems && (
        <ToolbarIconButton
          icon={DeleteIcon || Trash2}
          colorKey="deleteItems"
          tooltip={getTooltip(config.tooltips.deleteItems)}
          fallbackLabel={t('buttons.delete')}
          onClick={() => onDeleteItems?.(selectedItems)}
          // ⚠️ Διατηρείται ΑΚΡΙΒΩΣ η αρχική τριαδική: το `hasSelectedContact` έχει
          // προεπιλογή `false`, άρα δεν είναι ποτέ `undefined` — ο έλεγχος μένει
          // ως έχει ώστε η αλλαγή να είναι αναδιάταξη, όχι απόφαση.
          disabled={hasSelectedContact !== undefined ? !hasSelectedContact : nothingSelected}
        />
      )}

      {/* Filters Dropdown */}
      {/* ⛔ ΔΕΝ ενοποιείται με το ToolbarIconButton: `DropdownMenuTrigger asChild`
          παρεμβάλλεται, και το κουμπί κουβαλά σήμα πλήθους ενεργών φίλτρων. */}
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
                <DropdownMenuLabel>{translateFilterLabel(t, category.label)}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {category.options.map((option) => (
                  <DropdownMenuCheckboxItem key={option.value}
                    checked={activeFilters.includes(option.value)}
                    onCheckedChange={(checked) => handleFilterChange(option.value, !!checked)}>
                    {translateFilterLabel(t, option.label)}
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
      {config.availableActions.favorites && (
        <ToolbarIconButton
          icon={Star}
          colorKey="favorites"
          tooltip={getTooltip(config.tooltips.favorites)}
          fallbackLabel="Favorites"
          onClick={() => logger.info('Add to favorites')}
          disabled={nothingSelected}
        />
      )}

      {/* Archive */}
      {config.availableActions.archive && (
        <ToolbarIconButton
          icon={Archive}
          colorKey="archive"
          tooltip={getTooltip(config.tooltips.archive)}
          fallbackLabel="Archive"
          onClick={() => logger.info('Archive selected')}
          disabled={nothingSelected}
        />
      )}

      {/* Export */}
      {config.availableActions.export && (
        <ToolbarIconButton
          icon={Download}
          colorKey="export"
          tooltip={getTooltip(config.tooltips.export)}
          fallbackLabel={t('buttons.export')}
          onClick={onExport}
        />
      )}

      {/* Import */}
      {config.availableActions.import && (
        <ToolbarIconButton
          icon={Upload}
          colorKey="import"
          tooltip={getTooltip(config.tooltips.import)}
          fallbackLabel={t('buttons.import')}
          onClick={onImport}
        />
      )}

      {/* Refresh */}
      {config.availableActions.refresh && (
        <ToolbarIconButton
          icon={RefreshCw}
          colorKey="refresh"
          tooltip={getTooltip(config.tooltips.refresh)}
          fallbackLabel={t('buttons.refresh')}
          onClick={onRefresh}
        />
      )}

      {/* Sort Options Dropdown */}
      {/* ⛔ ΔΕΝ ενοποιείται — δες το σχόλιο στο dropdown φίλτρων. */}
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
      {config.availableActions.preview && (
        <ToolbarIconButton
          icon={Eye}
          colorKey="preview"
          tooltip={getTooltip(config.tooltips.preview)}
          fallbackLabel="Preview"
          onClick={onPreview}
        />
      )}

      {/* Copy */}
      {config.availableActions.copy && (
        <ToolbarIconButton
          icon={Copy}
          colorKey="copy"
          tooltip={getTooltip(config.tooltips.copy)}
          fallbackLabel="Copy"
          onClick={onCopy}
          disabled={nothingSelected}
        />
      )}

      {/* Share */}
      {config.availableActions.share && (
        <ToolbarIconButton
          icon={Share2}
          colorKey="share"
          tooltip={getTooltip(config.tooltips.share)}
          fallbackLabel="Share"
          onClick={onShare}
        />
      )}

      {/* Reports */}
      {config.availableActions.reports && (
        <ToolbarIconButton
          icon={FileText}
          colorKey="reports"
          tooltip={getTooltip(config.tooltips.reports)}
          fallbackLabel="Reports"
          onClick={onReports}
        />
      )}

      {/* Settings */}
      {config.availableActions.settings && (
        <ToolbarIconButton
          icon={Settings}
          colorKey="settings"
          tooltip={getTooltip(config.tooltips.settings)}
          fallbackLabel="Settings"
          onClick={onSettings}
        />
      )}

      {/* Favorites Management */}
      {config.availableActions.favoritesManagement && (
        <ToolbarIconButton
          icon={Heart}
          colorKey="favoritesManagement"
          tooltip={getTooltip(config.tooltips.favoritesManagement)}
          fallbackLabel="Manage favorites"
          onClick={onFavoritesManagement}
        />
      )}

      {/* Help */}
      {config.availableActions.help && (
        <ToolbarIconButton
          icon={HelpCircle}
          colorKey="help"
          tooltip={getTooltip(config.tooltips.help)}
          fallbackLabel="Help"
          onClick={onHelp}
        />
      )}
    </>
  );
}
