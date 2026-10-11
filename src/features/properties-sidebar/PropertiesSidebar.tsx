// ?? i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ENTITY_LIST_TOKENS } from '@/styles/design-tokens';
import { useRouter } from '@/lib/workspace/navigation';
import { ExternalLink } from 'lucide-react';
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
  const layout = useLayoutClasses();
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

  // 🔴 Προς τη ΛΙΣΤΑ φεύγει μόνο ό,τι έδωσε ο γονιός (ADR-329 §3.9). Σε κάδο/αρχείο ο γονιός δεν δίνει
  //    ούτε δημιουργία ούτε διαγραφή ⇒ η γραμμή εργαλείων τις δείχνει ανενεργές αντί για σιωπηλά no-op.
  //    Η επεξεργασία ακολουθεί τη διαγραφή: όπου δεν σβήνεις, δεν γράφεις.
  const listDeleteAction = onDeleteProperty ? handleDeleteProperty : undefined;
  const listEditAction = onDeleteProperty ? handleToggleEditMode : undefined;

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
      onDeleteProperty={listDeleteAction}
      defaultTab={defaultTab}
      headerActions={openInPageActions}
      onCreateAction={onNewProperty}
      // «Κτίρια χωρίς μονάδες» καλεί σε δημιουργία: χωρίς δημιουργία (κάδος · αρχείο) δεν έχει τι να προσφέρει.
      warningBanner={hasBuildingsWithNoUnits && onNewProperty ? (
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
          onEditProperty={listEditAction}
          onDeleteProperty={listDeleteAction}
        />
        {!isMobile && detailsContent}
      </div>

      <div className={selectedProperty ? ENTITY_LIST_TOKENS.mobileRegion.hidden : ENTITY_LIST_TOKENS.mobileRegion.shown}>
        <PropertiesList
          units={properties}
          selectedPropertyIds={selectedPropertyIds}
          onSelectProperty={onSelectProperty}
          onAssignmentSuccess={onAssignmentSuccess}
          onNewProperty={onNewProperty}
          onEditProperty={listEditAction}
          onDeleteProperty={listDeleteAction}
        />
      </div>

      <MobileDetailsSlideIn
        isOpen={isMobile && !!selectedProperty}
        onClose={() => onSelectProperty('__none__', false)}
        title={selectedProperty?.name || t('mobile.unitDetails')}
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
