// ?? i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, ExternalLink, Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIsMobile } from '@/hooks/useMobile';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { PropertiesList } from '@/components/properties/PropertiesList';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { createEntityAction } from '@/core/entity-headers';
import { ENTITY_ROUTES } from '@/lib/routes';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

/**
 * 🔑 **Η καρτέλα ΔΕΝ συντίθεται εδώ πια** (ADR-777 §8.30). Απέκτησε **δεύτερο**
 * σημείο προσάρτησης — τη σελίδα `/properties/[id]` — και μια δεύτερη σύνθεση θα
 * σήμαινε ότι η έβδομη καρτέλα θα προσγειωνόταν σε **μία** από τις δύο οθόνες,
 * με **και τις δύο** να φαίνονται σωστές. Εδώ μένει ό,τι είναι όντως της λίστας:
 * η διάταξη δύο στηλών, η κινητή προβολή, και η **κατάσταση επεξεργασίας** — που
 * τη μοιράζεται με το μολύβι κάθε γραμμής.
 */
import { PropertyDetailSurface } from '@/features/property-detail-surface/PropertyDetailSurface';
import { BuildingSpaceWarningBanner } from '@/components/building-management/shared/BuildingSpaceWarningBanner';
import { useBuildingsNoUnits } from '@/contexts/BuildingsNoUnitsContext';
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
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();
  const isMobile = useIsMobile();
  const router = useRouter();

  const hasBuildingsWithNoUnits = useBuildingsNoUnits();
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

  /**
   * **«Άνοιγμα σε σελίδα»** (ADR-777 §8.30) — η δεξιά στήλη κρατά τη σειρά σου
   * όταν κοιτάς είκοσι ακίνητα στη σειρά· η σελίδα είναι για όταν θέλεις να
   * δουλέψεις σε **ένα**. Η ενέργεια ζει **εδώ** και όχι μέσα στην επιφάνεια:
   * είναι ιδιότητα του **σημείου προσάρτησης** (η σελίδα δεν έχει πού να ανοίξει).
   *
   * ⚠️ Δεν εμφανίζεται σε λειτουργία δημιουργίας: ένα ακίνητο που δεν έχει γραφτεί
   * ακόμη **δεν έχει διεύθυνση**, και το κουμπί θα οδηγούσε σε «δεν βρέθηκε».
   */
  const openInPageActions = useMemo(() => {
    if (!selectedProperty || isCreatingNewUnit) return undefined;
    return [
      createEntityAction(
        'view',
        t('properties-detail:navigation.actions.openPage.label'),
        () => router.push(ENTITY_ROUTES.properties.withId(selectedProperty.id)),
        { icon: ExternalLink },
      ),
    ];
  }, [isCreatingNewUnit, router, selectedProperty, t]);

  const detailsContent = (
    <PropertyDetailSurface
      property={selectedProperty}
      units={units}
      viewerProps={viewerProps}
      floors={floors ?? []}
      setShowHistoryPanel={setShowHistoryPanel}
      isEditMode={effectiveEditMode}
      onToggleEditMode={handleToggleEditMode}
      onExitEditMode={handleExitEditMode}
      isCreatingNewUnit={isCreatingNewUnit}
      onPropertyCreated={onPropertyCreated}
      onNewProperty={onNewProperty}
      onDeleteProperty={handleDeleteProperty}
      defaultTab={defaultTab}
      headerActions={openInPageActions}
      onCreateAction={onNewProperty}
      warningBanner={hasBuildingsWithNoUnits ? (
        <BuildingSpaceWarningBanner
          title={t('warningNoBuildingUnits.title')}
          hint={t('warningNoBuildingUnits.hint')}
          addLabel={t('warningNoBuildingUnits.add')}
          onAdd={() => onNewProperty?.()}
        />
      ) : undefined}
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
        title={selectedProperty?.name || t('mobile.unitDetails')}
        actionButtons={(
          <>
            <button
              onClick={() => {}}
              className={`${spacing.padding.sm} rounded-md ${quick.input} ${colors.bg.primary} ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.editUnit')}
            >
              <Edit className={iconSizes.sm} />
            </button>
            <button
              onClick={() => {
                void handleDeleteProperty();
              }}
              className={`${spacing.padding.sm} rounded-md ${quick.error} ${colors.bg.primary} text-destructive ${INTERACTIVE_PATTERNS.ACCENT_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
              aria-label={t('mobile.deleteUnit')}
            >
              <Trash2 className={iconSizes.sm} />
            </button>
          </>
        )}
      >
        {/*
          ⚠️ Το `detailsContent` αποδίδεται σε **δύο** θέσεις (επιτραπέζιο /
          κινητό) αλλά **ποτέ ταυτόχρονα** — οι δύο κλάδοι είναι αποκλειστικοί
          μέσω `isMobile`. Αυτό είναι που κρατά τα διαλογικά της επιφάνειας
          (βιτρίνα · επίπτωση) σε **ένα** αντίτυπο, τώρα που ζουν μέσα της.
        */}
        {isMobile && selectedProperty && detailsContent}
      </MobileDetailsSlideIn>
    </>
  );
}
