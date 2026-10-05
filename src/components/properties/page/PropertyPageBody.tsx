'use client';

/**
 * 📋 PropertyPageBody
 *
 * Renders the list/grid/retired variants of the properties page main body.
 * Extracted from `UnitsPageContent` to keep the page component under the
 * Google 500-line limit (N.7.1) and to isolate the tri-state rendering
 * (retired view — trash or archive — vs list vs grid) into one SRP unit.
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

/**
 * Μια προβολή «αποσυρμένων» ακινήτων — ο κάδος ή το αρχείο (ADR-281 · ADR-329 §3.9).
 *
 * ΕΝΑ σχήμα αντί για τρία props ανά κάδο: το σώμα της σελίδας δεν χρειάζεται να ξέρει
 * ΠΟΙΟΣ κάδος είναι ανοιχτός — μόνο ότι δείχνει άλλες γραμμές από τις ενεργές, και αν
 * φορτώνουν ακόμη. Οι δύο προβολές είναι αμοιβαία αποκλειόμενες, άρα ένα πεδίο αρκεί
 * και η κατάσταση «και οι δύο ανοιχτές» δεν μπορεί καν να εκφραστεί.
 */
export interface PropertyRetiredView {
  loading: boolean;
  properties: Property[];
}

interface PropertyPageBodyProps {
  /** `null` ⇒ η κανονική λίστα/πλέγμα. */
  retiredView: PropertyRetiredView | null;
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
    retiredView, searchFilteredProperties,
    viewMode, selectedProperty, selectedPropertyIds, isCreatingNewUnit,
    newUnitTemplate, viewerProps, safeFloors, urlTab,
    onSelectProperty, setShowHistoryPanel, onAssignmentSuccess,
    onPropertyCreated, onCancelCreate, onNewProperty, onDeleteProperty,
  } = props;

  if (retiredView) {
    if (retiredView.loading) {
      return <PageLoadingState icon={NAVIGATION_ENTITIES.property.icon} message={t('page.loading')} layout="contained" />;
    }
    return (
      <PropertiesSidebar
        units={retiredView.properties}
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
