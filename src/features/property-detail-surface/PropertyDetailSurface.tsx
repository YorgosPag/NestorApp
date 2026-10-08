'use client';

/**
 * @fileoverview **Η ΕΠΙΦΑΝΕΙΑ ΛΕΠΤΟΜΕΡΕΙΑΣ ΕΝΟΣ ΑΚΙΝΗΤΟΥ** — μία, με δύο σημεία προσάρτησης.
 * @related ADR-777 §8.30 · ADR-312 §9.17 · config/unified-tabs-factory (properties)
 * @module features/property-detail-surface/PropertyDetailSurface
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΗΧΘΗ — ΤΟ ΔΕΥΤΕΡΟ ΣΗΜΕΙΟ ΠΡΟΣΑΡΤΗΣΗΣ ΓΕΝΝΗΣΕ ΤΗΝ ΕΥΘΥΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι το §8.30 η καρτέλα ενός ακινήτου ζούσε **μόνο** στη δεξιά στήλη του
 * `/spaces/properties`, οπότε η σύνθεσή της ήταν νόμιμα μέρος του
 * `PropertiesSidebar`. Η σελίδα `/properties/[id]` έδωσε **δεύτερο** σημείο
 * προσάρτησης, και τότε το ερώτημα *«τι είναι η καρτέλα ενός ακινήτου;»* απέκτησε
 * **δύο υποψήφιους απαντητές**.
 *
 * ⚠️ **ΑΝΤΙΓΡΑΦΗ ΘΑ ΗΤΑΝ ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ ΤΟ §8.30, ΞΑΝΑΓΡΑΜΜΕΝΟ.** Η
 * ίδια η δουλειά υπάρχει επειδή **δύο συμβάσεις διαδρομής** δεν συναντήθηκαν ποτέ
 * (ADR-749). Δύο συνθέσεις καρτέλας θα ήταν το ίδιο σχήμα μια στάση πιο μέσα: η
 * μέρα που κάποιος προσθέτει έβδομη καρτέλα, **η μία** από τις δύο οθόνες θα την
 * αποκτούσε — και **και οι δύο θα φαίνονταν σωστές**.
 *
 * 🔑 **ΕΙΝΑΙ ΕΛΕΓΧΟΜΕΝΗ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Η κατάσταση επεξεργασίας
 * **δεν** ζει εδώ: στη δεξιά στήλη τη μοιράζεται με τη **λίστα** (το μολύβι κάθε
 * γραμμής) και με τα κουμπιά της κινητής προβολής, ενώ στη σελίδα δεν υπάρχει
 * τίποτα άλλο να τη μοιραστεί. Ένας κοινός ιδιοκτήτης θα υποχρέωνε τη λίστα να
 * περνά μέσα από την καρτέλα για να μπει σε επεξεργασία — δηλαδή θα έλυνε ένα
 * διπλότυπο γεννώντας μια εξάρτηση προς τα πάνω.
 *
 * ⚠️ **Δεν αποδίδει ΤΙΠΟΤΑ όταν δεν υπάρχει ακίνητο** πέρα από την κενή κατάσταση
 * του `DetailsContainer`: η απάντηση «δεν βρέθηκε» ανήκει στο σημείο προσάρτησης,
 * γιατί **μόνο εκείνο** ξέρει αν το ακίνητο λείπει (σελίδα) ή απλώς δεν έχει
 * επιλεγεί ακόμη (λίστα) — δύο πολύ διαφορετικά πράγματα για τον άνθρωπο μπροστά.
 *
 * 🗄️ **ΑΠΟΣΥΡΜΕΝΟ ΑΚΙΝΗΤΟ ⇒ ΠΛΗΡΕΣ ΚΑΙ ΚΛΕΙΔΩΜΕΝΟ** (ADR-329 §3.9). Εδώ είναι το **ένα** σημείο που
 * θέτει το `RetiredRecordProvider`: κεφαλίδα, tabs και κάθε φύλλο τους **ρωτούν** `useRetiredKind()`.
 * Η επιφάνεια κάνει μόνο ό,τι δεν μπορεί να ρωτηθεί από φύλλο: αγνοεί τη λειτουργία επεξεργασίας του
 * σημείου προσάρτησης, δεν προσαρτά τη βιτρίνα, και δείχνει την ταινία που εξηγεί.
 */

import React from 'react';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { RetiredRecordBanner } from '@/components/shared/trash/RetiredRecordBanner';
import { UnifiedShareDialog } from '@/components/sharing/UnifiedShareDialog';
import {
  UniversalTabsRenderer,
  convertToUniversalConfig,
  type PropertyTabAdditionalData,
  type PropertyTabComponentProps,
  type PropertyTabGlobalProps,
} from '@/components/generic/UniversalTabsRenderer';
import { PROPERTIES_COMPONENT_MAPPING } from '@/components/generic/mappings/propertiesMappings';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getSortedPropertiesTabs } from '@/config/properties-tabs-config';
import { DetailsContainer } from '@/core/containers';
import type { EntityHeaderAction } from '@/core/entity-headers';
import { useAuth } from '@/auth/hooks/useAuth';
import { useEmptyStateMessages } from '@/hooks/useEnterpriseMessages';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RetiredRecordProvider } from '@/lib/firestore/retired-record-context';
import { isRetired } from '@/lib/firestore/trashed-status';
import type { Property } from '@/types/property-viewer';

import { usePropertiesSidebar } from '@/features/properties-sidebar/hooks/usePropertiesSidebar';
import { PropertyDetailsHeader } from '@/features/properties-sidebar/components/PropertyDetailsHeader';
import type { FloorData, ViewerPassthroughProps } from '@/features/properties-sidebar/types';

import { usePropertyShowcase } from './usePropertyShowcase';

export interface PropertyDetailSurfaceProps {
  /** Το ακίνητο που δείχνει η επιφάνεια. `null` ⇒ κενή κατάσταση. */
  readonly property: Property | null;
  /** Όλα τα ακίνητα του πλαισίου — τα χρειάζονται οι καρτέλες για συσχετίσεις. */
  readonly units: Property[];
  readonly viewerProps: ViewerPassthroughProps;
  readonly floors: FloorData[];
  readonly setShowHistoryPanel: (show: boolean) => void;

  /** Κατάσταση επεξεργασίας — **ελεγχόμενη από το σημείο προσάρτησης** (δες κεφαλίδα). */
  readonly isEditMode: boolean;
  readonly onToggleEditMode: () => void;
  readonly onExitEditMode: () => void;

  readonly isCreatingNewUnit?: boolean;
  readonly onPropertyCreated?: (propertyId: string) => void;
  readonly onNewProperty?: () => void;
  /** Ήδη δεμένη στο τρέχον ακίνητο: η επιφάνεια δεν αποφασίζει **ποιο** διαγράφεται. */
  readonly onDeleteProperty?: () => void | Promise<void>;

  /** Ποια καρτέλα ανοίγει πρώτη (από τη διεύθυνση). */
  readonly defaultTab?: string;
  /** Μπάνερ πάνω από την κενή κατάσταση — ανήκει στο σημείο προσάρτησης. */
  readonly warningBanner?: React.ReactNode;
  /** Πρόσθετες ενέργειες κεφαλίδας (π.χ. «Άνοιγμα σε σελίδα» από τη λίστα). */
  readonly headerActions?: readonly EntityHeaderAction[];
  /** Τι κάνει το κουμπί της κενής κατάστασης. */
  readonly onCreateAction?: () => void;
  /**
   * Η πράξη επιστροφής μέσα στην ταινία ενός αποσυρμένου ακινήτου. Ανήκει στο σημείο προσάρτησης: η
   * λίστα έχει ήδη τη μπάρα της από πάνω και **δεν** τη δίνει· η σελίδα δεν έχει μπάρα και τη δίνει.
   */
  readonly retiredAction?: React.ReactNode;
  /**
   * Πόση ταυτότητα δείχνει η ΜΙΑ κεφαλίδα (ADR-777 §8.87). Ανήκει στο σημείο προσάρτησης: η δεξιά στήλη έχει τη
   * λίστα δίπλα της (`compact`)· η σελίδα δεν έχει τίποτα άλλο να πει ποιο ακίνητο κοιτάς (`full`).
   */
  readonly headerIdentity?: 'compact' | 'full';
}

export function PropertyDetailSurface({
  property,
  units,
  viewerProps,
  floors,
  setShowHistoryPanel,
  isEditMode,
  onToggleEditMode,
  onExitEditMode,
  isCreatingNewUnit = false,
  onPropertyCreated,
  onNewProperty,
  onDeleteProperty,
  defaultTab,
  warningBanner,
  headerActions,
  onCreateAction,
  retiredAction,
  headerIdentity = 'compact',
}: PropertyDetailSurfaceProps): React.ReactElement {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const emptyStateMessages = useEmptyStateMessages();
  const { user } = useAuth();

  const {
    safeFloors,
    currentFloor,
    safeViewerPropsWithFloors,
    safeViewerProps,
    ImpactDialog,
  } = usePropertiesSidebar(floors, viewerProps, property);

  const showcase = usePropertyShowcase(property);

  // 🗄️ Το σημείο προσάρτησης κρατά τη λειτουργία επεξεργασίας (τη μοιράζεται με τη λίστα)· για αποσυρμένο
  //    ακίνητο η επιφάνεια την αγνοεί — ένα μολύβι που πατήθηκε πριν την αλλαγή προβολής δεν ξεκλειδώνει τίποτα.
  const locked = isRetired(property);
  const effectiveEditMode = isEditMode && !locked;
  // Αγγελία · αντικειμενική · περιήγηση είναι καλέσματα σε ενέργεια πάνω σε **ζωντανή εγγραφή**: ο διακομιστής τα
  // αρνείται σε αποσυρμένο ακίνητο (409) και δεν έχουν σε τι να γράψουν πριν δημιουργηθεί. Η καρτέλα δεν
  // ζωγραφίζεται καθόλου — ίδιος κανόνας με το κουμπί χωρίς χειριστή.
  const offersLiveActs = !locked && !isCreatingNewUnit;

  const propertyTabAdditionalData: PropertyTabAdditionalData = {
    safeFloors,
    currentFloor,
    safeViewerProps,
    safeViewerPropsWithFloors,
    setShowHistoryPanel,
    units,
    onUpdateProperty: safeViewerPropsWithFloors.handleUpdateProperty,
    isEditMode: effectiveEditMode,
    onToggleEditMode,
    onExitEditMode,
    isCreatingNewUnit,
    onPropertyCreated,
  };

  const propertyTabGlobalProps: PropertyTabGlobalProps = {
    propertyId: property?.id,
  };

  return (
    <RetiredRecordProvider record={property}>
      <DetailsContainer
        selectedItem={property}
        warningBanner={warningBanner}
        header={(
          <>
            <PropertyDetailsHeader
              property={property}
              isEditMode={effectiveEditMode}
              isCreatingNewUnit={isCreatingNewUnit}
              onToggleEditMode={onToggleEditMode}
              onExitEditMode={onExitEditMode}
              onNewProperty={onNewProperty}
              onDeleteProperty={onDeleteProperty}
              onShowcaseProperty={() => showcase.setOpen(true)}
              extraActions={headerActions}
              identity={headerIdentity}
            />
            {/* Στη σταθερή ζώνη της κεφαλίδας: η εξήγηση δεν κυλά μαζί με τα tabs. Ζωντανό ακίνητο ⇒ τίποτα. */}
            {property && (
              <RetiredRecordBanner entityType={ENTITY_TYPES.PROPERTY} record={property} action={retiredAction} />
            )}
          </>
        )}
        tabsRenderer={(
          <UniversalTabsRenderer<Property | null, PropertyTabComponentProps, PropertyTabAdditionalData, PropertyTabGlobalProps>
            tabs={getSortedPropertiesTabs()
              .filter((tab) => offersLiveActs || !tab.liveRecordOnly)
              .map(convertToUniversalConfig)}
            data={property}
            componentMapping={PROPERTIES_COMPONENT_MAPPING}
            defaultTab={defaultTab || 'info'}
            theme="default"
            translationNamespace="building"
            additionalData={propertyTabAdditionalData}
            globalProps={propertyTabGlobalProps}
          />
        )}
        onCreateAction={onCreateAction}
        emptyStateProps={{
          icon: NAVIGATION_ENTITIES.property.icon,
          // Χωρίς δημιουργία (κάδος · αρχείο) η κενή κατάσταση δεν καλεί σε «Δημιουργία»: ζητά επιλογή.
          ...(onCreateAction
            ? emptyStateMessages.unit
            : { title: t('details.selectProperty'), description: t('details.noUnitSelected') }),
        }}
      />

      {ImpactDialog}

      {/* Η βιτρίνα είναι δημόσια προσφορά: για αποσυρμένο ακίνητο ο διάλογος δεν προσαρτάται καν. */}
      {property && !locked && user?.uid && user?.companyId && (
        <UnifiedShareDialog
          open={showcase.isOpen}
          onOpenChange={showcase.setOpen}
          entityType="property_showcase"
          entityId={property.id}
          entityTitle={t('properties-detail:showcase.title')}
          entitySubtitle={property.name ?? ''}
          companyId={user.companyId}
          preSubmit={showcase.preSubmit}
          contactShareContent={{
            title: property.name ?? t('properties-detail:showcase.title'),
            text: '',
            isPhoto: showcase.photos.length > 0,
            photoUrl: showcase.photos[0],
            galleryPhotos: [...showcase.photos],
          }}
        />
      )}
    </RetiredRecordProvider>
  );
}
