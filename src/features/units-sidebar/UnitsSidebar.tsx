'use client';

import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

import { UnitsList } from '@/components/units/UnitsList';
import { GenericUnitsTabsRenderer } from '@/components/generic';
import { getSortedUnitsTabs } from '@/config/units-tabs-config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { TRANSITION_PRESETS } from '@/components/ui/effects';

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

  // Details content component
  const detailsContent = (
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
  );

  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className="hidden md:flex flex-1 gap-4 min-h-0">
        <UnitsList
          units={units}
          selectedUnitIds={selectedUnitIds}
          onSelectUnit={onSelectUnit}
          onAssignmentSuccess={onAssignmentSuccess}
        />
        {selectedUnit && detailsContent}
      </div>

      {/* 📱 MOBILE: Show only UnitsList when no unit is selected */}
      <div className={`md:hidden w-full ${selectedUnit ? 'hidden' : 'block'}`}>
        <UnitsList
          units={units}
          selectedUnitIds={selectedUnitIds}
          onSelectUnit={onSelectUnit}
          onAssignmentSuccess={onAssignmentSuccess}
        />
      </div>

      {/* 📱 MOBILE: Slide-in UnitDetails when unit is selected */}
      <MobileDetailsSlideIn
        isOpen={!!selectedUnit}
        onClose={() => onSelectUnit(null)}
        title={selectedUnit?.title || 'Λεπτομέρειες Μονάδας'}
        actionButtons={
          <>
            <button
              onClick={() => {/* TODO: Edit unit handler */}}
              className={`p-2 rounded-md border bg-background border-border hover:bg-accent ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label="Επεξεργασία Μονάδας"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => {/* TODO: Delete unit handler */}}
              className={`p-2 rounded-md border bg-background border-border hover:bg-accent text-destructive hover:text-destructive ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label="Διαγραφή Μονάδας"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        }
      >
        {selectedUnit && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
