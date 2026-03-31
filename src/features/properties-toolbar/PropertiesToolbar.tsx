// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import React from 'react';

import { HelpCircle, Zap } from 'lucide-react';
import { QuickSearch } from '@/components/ui/QuickSearch';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { ToolbarFiltersMenu } from './components/ToolbarFiltersMenu';
import { ToolbarExportMenu } from './components/ToolbarExportMenu';
import { ToolbarMainActions } from './components/ToolbarMainActions';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkAssignToolbar } from './BulkAssignToolbar';
import { usePropertiesToolbarState } from './hooks/usePropertiesToolbarState';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';

export function PropertiesToolbar({
  selectedPropertyIds,
  onSelectAll,
  onClearSelection,
  onAssignmentSuccess,
  totalProperties,
}: {
  selectedPropertyIds: string[];
  onSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onAssignmentSuccess: () => void;
  totalProperties: number;
}) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    isAdvancedMode,
    sortDirection,
    activeFilters,
    searchTerm,
    setActiveFilters,
    handleSearch,
    handleExport,
    toggleSort,
    toggleAdvancedMode,
    allSelected,
  } = usePropertiesToolbarState(totalProperties, selectedPropertyIds);

  return (
      <div className={`${quick.separatorH} bg-muted/30 backdrop-blur-sm`}>
        <div className="p-2 flex items-center gap-1">
          <div className="flex items-center gap-2 pl-2">
            <Checkbox
              id="select-all-properties"
              checked={allSelected}
              onCheckedChange={(checked) => onSelectAll(!!checked)}
            />
            <Label htmlFor="select-all-properties" className="text-xs font-normal">
              {selectedPropertyIds.length > 0
                ? t('toolbar.selectedCount', { count: selectedPropertyIds.length })
                : t('toolbar.selectAll')}
            </Label>
          </div>

          <div className={`w-px h-6 ${quick.separatorV} mx-1`} />

          <ToolbarMainActions selectedItemsCount={selectedPropertyIds.length} />

          <div className={`w-px h-6 ${quick.separatorV} mx-1`} />

          <QuickSearch
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            placeholder={t('toolbar.quickSearchPlaceholder')}
          />

          <div className={`w-px h-6 ${quick.separatorV} mx-1`} />

          <ToolbarFiltersMenu
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            activeFilters={activeFilters}
            onActiveFiltersChange={setActiveFilters}
          />

          <div className={`w-px h-6 ${quick.separatorV} mx-1`} />

          <ToolbarExportMenu onExport={handleExport} />

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              tooltip={t('toolbar.advancedTools')}
              onClick={toggleAdvancedMode}
              variant={isAdvancedMode ? 'default' : 'ghost'}
              className={
                isAdvancedMode
                  ? `${colors.bg.info} ${colors.text.info}` // ✅ SEMANTIC: blue -> info semantic
                  : ''
              }
            >
              <Zap className={iconSizes.sm} />
            </ToolbarButton>
            <ToolbarButton tooltip={t('toolbar.helpAndGuides')}>
              <HelpCircle className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </div>

        {selectedPropertyIds.length > 0 && (
          <BulkAssignToolbar
            selectedIds={selectedPropertyIds}
            onClearSelection={onClearSelection}
            onAssignmentSuccess={onAssignmentSuccess}
          />
        )}
      </div>
  );
}
