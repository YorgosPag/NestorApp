'use client';
import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
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
import { useUnitsToolbarState } from './hooks/useUnitsToolbarState';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function UnitsToolbar({
  selectedUnitIds,
  onSelectAll,
  onClearSelection,
  onAssignmentSuccess,
  totalUnits,
}: {
  selectedUnitIds: string[];
  onSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onAssignmentSuccess: () => void;
  totalUnits: number;
}) {
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
  } = useUnitsToolbarState(totalUnits, selectedUnitIds);

  return (
    <TooltipProvider>
      <div className={`${quick.separatorH} bg-muted/30 backdrop-blur-sm`}>
        <div className="p-2 flex items-center gap-1">
          <div className="flex items-center gap-2 pl-2">
            <Checkbox
              id="select-all-units"
              checked={allSelected}
              onCheckedChange={(checked) => onSelectAll(!!checked)}
            />
            <Label htmlFor="select-all-units" className="text-xs font-normal">
              {selectedUnitIds.length > 0
                ? `${selectedUnitIds.length} επιλεγμένα`
                : 'Επιλογή όλων'}
            </Label>
          </div>

          <div className={`w-px h-6 ${quick.separatorV} mx-1`} />

          <ToolbarMainActions selectedItemsCount={selectedUnitIds.length} />

          <div className={`w-px h-6 ${quick.separatorV} mx-1`} />

          <QuickSearch
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            placeholder="Γρήγορη αναζήτηση μονάδων..."
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
              tooltip="Προχωρημένα Εργαλεία"
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
            <ToolbarButton tooltip="Βοήθεια και Οδηγίες (F1)">
              <HelpCircle className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </div>

        {selectedUnitIds.length > 0 && (
          <BulkAssignToolbar
            selectedIds={selectedUnitIds}
            onClearSelection={onClearSelection}
            onAssignmentSuccess={onAssignmentSuccess}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
