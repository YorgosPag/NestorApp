'use client';

import React from 'react';

import { UnitsList } from '@/components/units/UnitsList';
import { GenericUnitsTabsRenderer } from '@/components/generic';
import { getSortedUnitsTabs } from '@/config/units-tabs-config';

import { useUnitsSidebar } from './hooks/useUnitsSidebar';
import { UnitDetailsHeader } from './components/UnitDetailsHeader';
import type { UnitsSidebarProps } from './types';

export function UnitsSidebar({
  units,
  selectedUnit,
  viewerProps,
  setShowHistoryPanel,
  floors = [],
  onSelectUnit,
  selectedUnitIds,
  onAssignmentSuccess,
}: UnitsSidebarProps) {
  const {
    safeFloors,
    currentFloor,
    safeViewerPropsWithFloors,
    safeViewerProps,
  } = useUnitsSidebar(floors, viewerProps);

  // Get units tabs from centralized config
  const unitsTabs = getSortedUnitsTabs();

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      <UnitsList
        units={units}
        selectedUnitIds={selectedUnitIds}
        onSelectUnit={onSelectUnit}
        onAssignmentSuccess={onAssignmentSuccess}
      />

      <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-lg shadow-sm">
        <UnitDetailsHeader unit={selectedUnit} />

        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 border-b px-4">
            <GenericUnitsTabsRenderer
              tabs={unitsTabs}
              selectedUnit={selectedUnit}
              defaultTab="info"
              additionalData={{
                safeFloors,
                currentFloor,
                safeViewerProps,
                safeViewerPropsWithFloors,
                setShowHistoryPanel,
                units
              }}
              globalProps={{
                unitId: selectedUnit?.id
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
