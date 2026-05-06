'use client';

/**
 * UnitQuickCreateSheet — Sheet wrapping the canonical PropertiesSidebar create
 * mode, identical to the creation panel in /spaces/properties.
 *
 * SSoT: renders DetailsContainer + PropertyDetailsHeader + UniversalTabsRenderer
 * exactly as PropertiesSidebar does when isCreatingNewUnit=true, without the
 * PropertiesList (the list is not needed in a Sheet context).
 */

import React, { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import { DetailsContainer } from '@/core/containers';
import { PropertyDetailsHeader } from '@/features/properties-sidebar/components/PropertyDetailsHeader';
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
import type { PropertyTabAdditionalData, PropertyTabComponentProps, PropertyTabGlobalProps } from '@/components/generic/UniversalTabsRenderer';
import { PROPERTIES_COMPONENT_MAPPING } from '@/components/generic/mappings/propertiesMappings';
import { getSortedPropertiesTabs } from '@/config/properties-tabs-config';
import { usePropertiesSidebar } from '@/features/properties-sidebar/hooks/usePropertiesSidebar';
import type { Property } from '@/types/property-viewer';
import type { FloorData, ViewerPassthroughProps } from '@/features/properties-sidebar/types';
import type { Building } from '@/types/building/contracts';
import type { FloorRecord } from '@/components/building-management/tabs/property-tab-constants';

export interface UnitQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly building: Building;
  readonly floors: FloorRecord[];
  readonly onCreated?: () => void;
}

const NOOP_UPDATE = async () => {};

export function UnitQuickCreateSheet({
  open,
  onOpenChange,
  building,
  floors,
  onCreated,
}: UnitQuickCreateSheetProps) {
  const { t } = useTranslation('building');
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleCreated = useCallback(() => {
    onCreated?.();
    onOpenChange(false);
  }, [onCreated, onOpenChange]);

  const blankUnit = useMemo<Property>(() => ({
    id: '__new__',
    name: '',
    type: '',
    status: 'reserved',
    operationalStatus: 'draft',
    floor: 0,
    area: 0,
    layout: { bedrooms: 0, bathrooms: 0, wc: 0 },
    areas: { gross: 0 },
    orientations: [],
    buildingId: building.id,
    floorId: '',
    projectId: building.projectId || '',
    vertices: [],
    building: building.name || '',
    project: '',
  }), [building.id, building.projectId, building.name]);

  const floorData = useMemo<FloorData[]>(
    () => floors.map(f => ({
      id: f.id,
      name: f.name,
      level: f.number,
      buildingId: building.id,
      properties: [],
    })),
    [floors, building.id],
  );

  const minimalViewerProps = useMemo<ViewerPassthroughProps>(
    () => ({ properties: [], handleUpdateProperty: NOOP_UPDATE }),
    [],
  );

  const { safeFloors, currentFloor, safeViewerProps, safeViewerPropsWithFloors } =
    usePropertiesSidebar(floorData, minimalViewerProps, blankUnit);

  const propertiesTabs = useMemo(() => getSortedPropertiesTabs(), []);

  const additionalData = useMemo<PropertyTabAdditionalData>(() => ({
    safeFloors,
    currentFloor,
    safeViewerProps,
    safeViewerPropsWithFloors,
    setShowHistoryPanel: () => {},
    units: [],
    onUpdateProperty: NOOP_UPDATE,
    isEditMode: true,
    onToggleEditMode: () => {},
    onExitEditMode: handleClose,
    isCreatingNewUnit: true,
    onPropertyCreated: handleCreated,
  }), [safeFloors, currentFloor, safeViewerProps, safeViewerPropsWithFloors, handleClose, handleCreated]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col overflow-hidden',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetTitle className="sr-only">{t('details.addUnitTitle')}</SheetTitle>
        <DetailsContainer
          selectedItem={blankUnit}
          header={
            <PropertyDetailsHeader
              property={blankUnit}
              isEditMode
              isCreatingNewUnit
              onExitEditMode={handleClose}
            />
          }
          tabsRenderer={
            open ? (
              <UniversalTabsRenderer<Property | null, PropertyTabComponentProps, PropertyTabAdditionalData, PropertyTabGlobalProps>
                tabs={propertiesTabs.map(convertToUniversalConfig)}
                data={blankUnit}
                componentMapping={PROPERTIES_COMPONENT_MAPPING}
                defaultTab="info"
                theme="default"
                translationNamespace="building"
                additionalData={additionalData}
                globalProps={{ propertyId: '__new__' }}
              />
            ) : undefined
          }
        />
      </SheetContent>
    </Sheet>
  );
}
