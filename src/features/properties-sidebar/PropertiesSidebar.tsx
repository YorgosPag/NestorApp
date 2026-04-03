// ?? i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback, useState } from 'react';
import type { Property } from '@/types/property-viewer';
import { Edit, Trash2 } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { PropertiesList } from '@/components/properties/PropertiesList';
import { UniversalTabsRenderer, convertToUniversalConfig, type PropertyTabAdditionalData, type PropertyTabComponentProps, type PropertyTabGlobalProps } from '@/components/generic/UniversalTabsRenderer';
import { PROPERTIES_COMPONENT_MAPPING } from '@/components/generic/mappings/propertiesMappings';
import { getSortedPropertiesTabs } from '@/config/properties-tabs-config';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { DetailsContainer } from '@/core/containers';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

import { usePropertiesSidebar } from './hooks/usePropertiesSidebar';
import { PropertyDetailsHeader } from './components/PropertyDetailsHeader';
import type { PropertiesSidebarProps } from './types';
import '@/lib/design-system';

export function PropertiesSidebar({
  units,
  selectedProperty,
  viewerProps,
  setShowHistoryPanel,
  floors = [],
  onSelectProperty,
  selectedPropertyIds,
  onAssignmentSuccess,
  onNewProperty,
  onDeleteProperty,
  isCreatingNewUnit = false,
  onPropertyCreated,
  onCancelCreate,
  defaultTab,
}: PropertiesSidebarProps) {
  const { t } = useTranslation('properties');
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const emptyStateMessages = useEmptyStateMessages();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const isMobile = useIsMobile();

  const {
    safeFloors,
    currentFloor,
    safeViewerPropsWithFloors,
    safeViewerProps,
    ImpactDialog,
  } = usePropertiesSidebar(floors, viewerProps, selectedProperty);

  const [isEditMode, setIsEditMode] = useState(false);
  const properties = units;
  const effectiveEditMode = isEditMode || isCreatingNewUnit;
  const handleToggleEditMode = useCallback(() => setIsEditMode((prev) => !prev), []);
  const handleExitEditMode = useCallback(() => {
    setIsEditMode(false);
    if (isCreatingNewUnit && onCancelCreate) {
      onCancelCreate();
    }
  }, [isCreatingNewUnit, onCancelCreate]);


  const handleDeleteProperty = useCallback(async () => {
    if (!selectedProperty || !onDeleteProperty) {
      return;
    }

    await onDeleteProperty(selectedProperty.id);
  }, [onDeleteProperty, selectedProperty]);

  const propertiesTabs = getSortedPropertiesTabs();

  const propertyTabAdditionalData: PropertyTabAdditionalData = {
    safeFloors,
    currentFloor,
    safeViewerProps,
    safeViewerPropsWithFloors,
    setShowHistoryPanel,
    units,
    onUpdateProperty: safeViewerPropsWithFloors.handleUpdateProperty,
    isEditMode: effectiveEditMode,
    onToggleEditMode: handleToggleEditMode,
    onExitEditMode: handleExitEditMode,
    isCreatingNewUnit,
    onPropertyCreated,
  };

  const propertyTabGlobalProps: PropertyTabGlobalProps = {
    propertyId: selectedProperty?.id,
  };

  const detailsContent = (
    <DetailsContainer
      selectedItem={selectedProperty}
      header={(
        <PropertyDetailsHeader
          property={selectedProperty}
          isEditMode={effectiveEditMode}
          isCreatingNewUnit={isCreatingNewUnit}
          onToggleEditMode={handleToggleEditMode}
          onExitEditMode={handleExitEditMode}
          onNewProperty={onNewProperty}
          onDeleteProperty={handleDeleteProperty}
        />
      )}
      tabsRenderer={(
        <UniversalTabsRenderer<Property | null, PropertyTabComponentProps, PropertyTabAdditionalData, PropertyTabGlobalProps>
          tabs={propertiesTabs.map(convertToUniversalConfig)}
          data={selectedProperty}
          componentMapping={PROPERTIES_COMPONENT_MAPPING}
          defaultTab={defaultTab || 'info'}
          theme="default"
          translationNamespace="building"
          additionalData={propertyTabAdditionalData}
          globalProps={propertyTabGlobalProps}
        />
      )}
      onCreateAction={onNewProperty}
      emptyStateProps={{
        icon: NAVIGATION_ENTITIES.property.icon,
        ...emptyStateMessages.unit,
      }}
    />
  );

  return (
    <>
      <div className={`hidden md:flex flex-1 ${layout.listItemsGap} min-h-0 min-w-0 overflow-hidden`}>
        <PropertiesList
          units={properties}
          selectedPropertyIds={selectedPropertyIds}
          onSelectProperty={onSelectProperty}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewProperty={onNewProperty}
          onEditProperty={handleToggleEditMode}
          onDeleteProperty={handleDeleteProperty}
        />
        {!isMobile && detailsContent}
      </div>

      <div className={`md:hidden w-full ${selectedProperty ? 'hidden' : 'block'}`}>
        <PropertiesList
          units={properties}
          selectedPropertyIds={selectedPropertyIds}
          onSelectProperty={onSelectProperty}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewProperty={onNewProperty}
          onEditProperty={handleToggleEditMode}
          onDeleteProperty={handleDeleteProperty}
        />
      </div>

      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedProperty}
        onClose={() => onSelectProperty('__none__', false)}
        title={selectedProperty?.name || t('mobile.unitDetails', { defaultValue: 'СлжаоЬхШ Абадулжм' })}
        actionButtons={(
          <>
            <button
              onClick={() => {}}
              className={`${spacing.padding.sm} rounded-md ${quick.input} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.editUnit', { defaultValue: 'ДзЬеЬиЪШйхШ Шбадулжм' })}
            >
              <Edit className={iconSizes.sm} />
            </button>
            <button
              onClick={() => {
                void handleDeleteProperty();
              }}
              className={`${spacing.padding.sm} rounded-md ${quick.error} ${colors.bg.primary} text-destructive ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.deleteUnit', { defaultValue: 'ГаШЪиШну Шбадулжм' })}
            >
              <Trash2 className={iconSizes.sm} />
            </button>
          </>
        )}
      >
        {isMobile && selectedProperty && detailsContent}
      </MobileDetailsSlideIn>

      {ImpactDialog}
    </>
  );
}
