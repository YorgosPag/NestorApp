// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from 'react-i18next';

import { UnitsList } from '@/components/units/UnitsList';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
// UniversalTabsRenderer from generic (renderer only, no mappings)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
// UNITS_COMPONENT_MAPPING from domain-scoped file (not master barrel)
import { UNITS_COMPONENT_MAPPING } from '@/components/generic/mappings/unitsMappings';
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
  // 🗨️ ENTERPRISE: Centralized systems
  const { t } = useTranslation('units');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const emptyStateMessages = useEmptyStateMessages();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();

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
          theme="clean"
          // 🏢 ENTERPRISE: i18n - Use building namespace for tab labels
          translationNamespace="building"
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
        icon: NAVIGATION_ENTITIES.unit.icon,
        ...emptyStateMessages.unit
      }}
    />
  );

  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className={`hidden md:flex flex-1 ${layout.listItemsGap} min-h-0`}>
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
        title={selectedUnit?.title || t('mobile.unitDetails')}
        actionButtons={
          <>
            <button
              onClick={() => {/* TODO: Edit unit handler */}}
              className={`${spacing.padding.sm} rounded-md ${quick.input} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.editUnit')}
            >
              <Edit className={iconSizes.sm} />
            </button>
            <button
              onClick={() => {/* TODO: Delete unit handler */}}
              className={`${spacing.padding.sm} rounded-md ${quick.error} ${colors.bg.primary} text-destructive ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.deleteUnit')}
            >
              <Trash2 className={iconSizes.sm} />
            </button>
          </>
        }
      >
        {selectedUnit && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
