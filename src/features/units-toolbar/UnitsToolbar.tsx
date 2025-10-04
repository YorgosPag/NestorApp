'use client';
import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelpCircle, Zap } from 'lucide-react';
import { QuickSearch } from '@/components/ui/QuickSearch';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { ToolbarFiltersMenu } from './components/ToolbarFiltersMenu';
import { ToolbarExportMenu } from './components/ToolbarExportMenu';
import { ToolbarMainActions } from './components/ToolbarMainActions';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkAssignToolbar } from './BulkAssignToolbar';
import { useUnitsToolbarState } from './hooks/useUnitsToolbarState';

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
      <div className="border-b bg-muted/30 backdrop-blur-sm">
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

          <div className="w-px h-6 bg-border mx-1" />

          <ToolbarMainActions selectedItemsCount={selectedUnitIds.length} />

          <div className="w-px h-6 bg-border mx-1" />

          <QuickSearch
            searchTerm={searchTerm}
            onSearchChange={handleSearch}
            placeholder="Γρήγορη αναζήτηση μονάδων..."
          />

          <div className="w-px h-6 bg-border mx-1" />

          <ToolbarFiltersMenu
            sortDirection={sortDirection}
            onToggleSort={toggleSort}
            activeFilters={activeFilters}
            onActiveFiltersChange={setActiveFilters}
          />

          <div className="w-px h-6 bg-border mx-1" />

          <ToolbarExportMenu onExport={handleExport} />

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              tooltip="Προχωρημένα Εργαλεία"
              onClick={toggleAdvancedMode}
              variant={isAdvancedMode ? 'default' : 'ghost'}
              className={
                isAdvancedMode
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : ''
              }
            >
              <Zap className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton tooltip="Βοήθεια και Οδηγίες (F1)">
              <HelpCircle className="w-4 h-4" />
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
