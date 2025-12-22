'use client';

import React from 'react';
import { Edit, Trash2, Home } from 'lucide-react';

import { UnitsList } from '@/components/units/UnitsList';
import { UniversalTabsRenderer, UNITS_COMPONENT_MAPPING, convertToUniversalConfig } from '@/components/generic';
import { getSortedUnitsTabs } from '@/config/units-tabs-config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { DetailsContainer } from '@/core/containers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

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

  // Details content component using centralized DetailsContainer
  const detailsContent = (
    <DetailsContainer
      selectedItem={selectedUnit}
      header={<UnitDetailsHeader unit={selectedUnit} />}
      tabsRenderer={
        <UniversalTabsRenderer
          tabs={unitsTabs.map(convertToUniversalConfig)}
          data={selectedUnit}
          componentMapping={UNITS_COMPONENT_MAPPING}
          defaultTab="info"
          theme="default"
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
      }
      emptyStateProps={{
        icon: Home,
        title: "Επιλέξτε μια μονάδα",
        description: "Επιλέξτε μια μονάδα από τη λίστα για να δείτε τις λεπτομέρειές της."
      }}
    />
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
              className={`p-2 rounded-md border bg-background border-border ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label="Επεξεργασία Μονάδας"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => {/* TODO: Delete unit handler */}}
              className={`p-2 rounded-md border bg-background border-border text-destructive ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
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
