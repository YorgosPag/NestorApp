'use client';

/**
 * 📋 PropertyPageBody
 *
 * Renders the list/grid/trash variants of the properties page main body.
 * Extracted from `UnitsPageContent` to keep the page component under the
 * Google 500-line limit (N.7.1) and to isolate the tri-state rendering
 * (trash vs list vs grid) into one SRP unit.
 *
 * @module components/properties/page/PropertyPageBody
 */

import { PropertiesSidebar } from '@/components/properties/PropertiesSidebar';
import { PropertyGridViewCompatible as PropertyGridView } from '@/components/property-viewer/PropertyGrid';
import { PageLoadingState } from '@/core/states';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property-viewer';
import type { FloorData, ViewerPassthroughProps } from '@/features/properties-sidebar/types';

interface PropertyPageBodyProps {
  showTrash: boolean;
  loadingTrash: boolean;
  trashedProperties: Property[];
  searchFilteredProperties: Property[];
  viewMode: 'list' | 'grid';
  selectedProperty: Property | null;
  selectedPropertyIds: string[];
  isCreatingNewUnit: boolean;
  newUnitTemplate: Property | null;
  viewerProps: ViewerPassthroughProps;
  safeFloors: FloorData[];
  urlTab: string | null;
  onSelectProperty: (propertyId: string, isShiftClick: boolean) => void;
  setShowHistoryPanel: (show: boolean) => void;
  onAssignmentSuccess: () => void;
  onPropertyCreated: (propertyId: string) => void;
  onCancelCreate: () => void;
  onNewProperty?: () => void;
  onDeleteProperty?: (propertyId: string) => Promise<void>;
}

export function PropertyPageBody(props: PropertyPageBodyProps) {
  const { t } = useTranslation(['properties']);
  const {
    showTrash, loadingTrash, trashedProperties, searchFilteredProperties,
    viewMode, selectedProperty, selectedPropertyIds, isCreatingNewUnit,
    newUnitTemplate, viewerProps, safeFloors, urlTab,
    onSelectProperty, setShowHistoryPanel, onAssignmentSuccess,
    onPropertyCreated, onCancelCreate, onNewProperty, onDeleteProperty,
  } = props;

  if (showTrash) {
    if (loadingTrash) {
      return <PageLoadingState icon={NAVIGATION_ENTITIES.property.icon} message={t('page.loading')} layout="contained" />;
    }
    return (
      <PropertiesSidebar
        units={trashedProperties}
        selectedProperty={selectedProperty}
        onSelectProperty={onSelectProperty}
        selectedPropertyIds={selectedPropertyIds}
        viewerProps={viewerProps}
        floors={safeFloors}
        setShowHistoryPanel={setShowHistoryPanel}
        onAssignmentSuccess={onAssignmentSuccess}
        isCreatingNewUnit={false}
        onPropertyCreated={onPropertyCreated}
        onCancelCreate={onCancelCreate}
        defaultTab={urlTab || undefined}
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <PropertiesSidebar
        units={searchFilteredProperties}
        selectedProperty={isCreatingNewUnit ? newUnitTemplate : selectedProperty}
        onSelectProperty={onSelectProperty}
        selectedPropertyIds={selectedPropertyIds}
        viewerProps={viewerProps}
        floors={safeFloors}
        setShowHistoryPanel={setShowHistoryPanel}
        onAssignmentSuccess={onAssignmentSuccess}
        onNewProperty={onNewProperty}
        onDeleteProperty={onDeleteProperty}
        isCreatingNewUnit={isCreatingNewUnit}
        onPropertyCreated={onPropertyCreated}
        onCancelCreate={onCancelCreate}
        defaultTab={urlTab || undefined}
      />
    );
  }

  return (
    <PropertyGridView
      properties={searchFilteredProperties}
      selectedPropertyIds={selectedPropertyIds}
      onSelect={onSelectProperty}
    />
  );
}
