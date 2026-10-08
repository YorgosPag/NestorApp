// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EntityDetailsHeader, createEntityAction, type EntityHeaderAction } from '@/core/entity-headers';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useRetiredKind } from '@/lib/firestore/retired-record-context';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PropertyIdentityFacts,
  PropertyIdentityStatus,
  usePropertyIdentityLine,
} from '@/components/properties/detail/property-identity-parts';
import type { Property } from '@/types/property-viewer';
import '@/lib/design-system';

/**
 * **Η γκαλερί φορτώνεται με όριο** (`React.lazy`) — ADR-744 §27. Με στατική εισαγωγή έβαζε το namespace
 * `listing-detail` στις αναμονές των διαδρομών Ακινήτων **και** Κτιρίων, όπου η κεφαλίδα είναι `compact` και η
 * γκαλερί δεν ζωγραφίζεται ποτέ. Ίδιο ιδίωμα με το `LazyPropertyTourTab` (`propertiesMappings`).
 */
const LazyPropertyHeaderGallery = React.lazy(() =>
  import('@/components/properties/detail/PropertyHeaderGallery').then((gallery) => ({
    default: gallery.PropertyHeaderGallery,
  })),
);

/** Ίδιο κουτί με τη γκαλερί (`h-32 w-full sm:w-48`) ⇒ καμία μετατόπιση διάταξης όταν φτάσει. */
const GALLERY_FALLBACK = <Skeleton className="h-32 w-full shrink-0 sm:w-48" />;

// 🏢 ENTERPRISE: Centralized Property Icon & Color (SSoT)
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

interface PropertyDetailsHeaderProps {
  property: Property | null;
  /** 🏢 ENTERPRISE: Edit mode state - Pattern A (entity header) */
  isEditMode?: boolean;
  /** Whether we are creating a new property (inline form) */
  isCreatingNewUnit?: boolean;
  /** 🏢 ENTERPRISE: Toggle edit mode callback (enters edit mode) */
  onToggleEditMode?: () => void;
  /** 🏢 ENTERPRISE: Exit edit mode callback (cancel without save) */
  onExitEditMode?: () => void;
  /** Callback for creating a new property */
  onNewProperty?: () => void;
  /** Callback for deleting the current property */
  onDeleteProperty?: () => void | Promise<void>;
  /** ADR-312: Callback for opening Property Showcase dialog */
  onShowcaseProperty?: () => void;
  /**
   * ADR-777 §8.30 — ενέργειες που ανήκουν στο **σημείο προσάρτησης**, όχι στην
   * καρτέλα: η δεξιά στήλη προσθέτει «Άνοιγμα σε σελίδα», η σελίδα δεν έχει πού
   * να ανοίξει. Μπαίνουν **πρώτες** ώστε η πλοήγηση να προηγείται της
   * επεξεργασίας, και **μόνο εκτός** λειτουργίας επεξεργασίας: μια μισοτελειωμένη
   * αλλαγή δεν πρέπει να έχει δίπλα της κουμπί που φεύγει από τη σελίδα.
   */
  extraActions?: readonly EntityHeaderAction[];
  /**
   * Πόση ταυτότητα δείχνει η κεφαλίδα (ADR-777 §8.87). `compact` (προεπιλογή): εικονίδιο + όνομα — η δεξιά
   * στήλη, όπου η λίστα δίπλα **είναι** η ταυτότητα. `full`: γκαλερί · υπότιτλος · κατάσταση · τιμή · εμβαδόν —
   * η σελίδα, όπου δεν υπάρχει τίποτα άλλο να πει ποιο ακίνητο κοιτάς. **Ίδιος τίτλος, ίδιες ενέργειες.**
   */
  identity?: 'compact' | 'full';
}

export function PropertyDetailsHeader({
  property,
  isEditMode = false,
  isCreatingNewUnit = false,
  onToggleEditMode,
  onExitEditMode,
  onNewProperty,
  onDeleteProperty,
  onShowcaseProperty,
  extraActions,
  identity = 'compact',
}: PropertyDetailsHeaderProps) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const retiredKind = useRetiredKind();
  const identityLine = usePropertyIdentityLine(property);

  const handleHeaderSave = useCallback(() => {
    const form = document.getElementById('property-fields-form') as HTMLFormElement | null;
    if (form) {
      form.requestSubmit();
    } else {
      onExitEditMode?.();
    }
  }, [onExitEditMode]);

  const handleHeaderCancel = useCallback(() => {
    onExitEditMode?.();
  }, [onExitEditMode]);

  if (!property) {
    return (
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={PropertyIcon}
          iconColor={propertyColor}
          title={t('details.selectProperty')}
          subtitle={t('details.noUnitSelected')}
          variant="detailed"
          className="h-[81px] flex items-center"
        />
      </div>
    );
  }

  // 🗄️ Αποσυρμένο ακίνητο (ADR-329 §3.9): μένει μόνο ό,τι **πλοηγεί** («Άνοιγμα σε σελίδα»). Επεξεργασία,
  //    νέο, επίδειξη και κάδος είναι πράξεις που ο διακομιστής αρνείται ⇒ δεν ζωγραφίζονται.
  const actions = retiredKind !== null
    ? [...(extraActions ?? [])]
    : isEditMode
    ? [
        createEntityAction(
          'save',
          isCreatingNewUnit
            ? t('navigation.actions.newUnit.create')
            : t('buildingSelector.save'),
          handleHeaderSave
        ),
        createEntityAction('cancel', t('buttons.cancel', { ns: 'common' }), handleHeaderCancel),
      ]
    : [
        ...(extraActions ?? []),
        createEntityAction('edit', t('navigation.actions.edit.label'), () => onToggleEditMode?.()),
        // 🔴 **ΚΟΥΜΠΙ ΧΩΡΙΣ ΧΕΙΡΙΣΤΗ ΔΕΝ ΖΩΓΡΑΦΙΖΕΤΑΙ** — μετρημένο 2026-09-18 στην παραγωγή:
        //    η `/properties/[id]` δεν περνούσε `onNewProperty`/`onDeleteProperty`, και το `?.()`
        //    κατάπινε το κλικ **σιωπηλά**: κανένα σφάλμα, καμία ένδειξη, κουμπί που κοροϊδεύει.
        //    Ο φρουρός είναι **δομικός**: όποια οθόνη ξεχάσει τη σύνδεση δείχνει ένα κουμπί
        //    λιγότερο, αντί για ένα κουμπί που δεν κάνει τίποτα.
        ...(onNewProperty
          ? [createEntityAction('new', t('navigation.actions.newUnit.label'), onNewProperty)]
          : []),
        createEntityAction('showcase', t('navigation.actions.showcase.label'), () => onShowcaseProperty?.()),
        ...(onDeleteProperty
          ? [createEntityAction('delete', t('navigation.actions.delete.label'), () => { void onDeleteProperty(); })]
          : []),
      ];

  const headerTitle = isCreatingNewUnit
    ? t('navigation.actions.newUnit.label')
    : property.name;

  // 🔑 **Κεφαλίδα σελίδας εγγραφής** (ADR-777 §8.87): η ταυτότητα γεμίζει τις θυρίδες της ΙΔΙΑΣ κεφαλίδας — ίδιος
  //    τίτλος, ίδιες ενέργειες, μία φορά. Ορατή **και** σε κινητό: εκεί είναι ο μόνος τίτλος της σελίδας.
  if (identity === 'full' && !isCreatingNewUnit) {
    return (
      <EntityDetailsHeader
        icon={PropertyIcon}
        iconColor={propertyColor}
        title={headerTitle}
        headingLevel={1}
        subtitle={identityLine}
        titleAdornment={<PropertyIdentityStatus property={property} />}
        media={
          <React.Suspense fallback={GALLERY_FALLBACK}>
            <LazyPropertyHeaderGallery property={property} />
          </React.Suspense>
        }
        details={<PropertyIdentityFacts property={property} />}
        actions={actions}
        variant="detailed"
        className="p-4"
      />
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <EntityDetailsHeader
          icon={PropertyIcon}
          iconColor={propertyColor}
          title={headerTitle}
          actions={actions}
          variant="detailed"
        />
      </div>
    </>
  );
}
