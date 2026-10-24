'use client';

/**
 * **«Διαθέσιμο από» της μονάδας** — RESO `AvailabilityDate`, γεγονός της μονάδας (ADR-919 §7 · §11).
 *
 * @related components/properties/tabs/PropertyListingTab.tsx · lib/listings/listing-availability.ts (σκαλί 1)
 *
 * 🔑 Σκαλί **1** του επιλυτή: υπερισχύει της υπόσχεσης του κτιρίου (π.χ. ενοικιασμένη μονάδα σε παραδομένο κτίριο).
 * Γράφεται μέσω της **μίας** πύλης μεταλλάξεων του γραφείου· ίχνος + επαναπροβολή + ιστορικό τα κάνει η διαδρομή PATCH.
 * Η μονάδα δεν έχει χρονοδιάγραμμα, άρα ούτε πρόταση: μόνο δήλωση.
 */

import React, { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { todayLocalDate } from '@/lib/date-local';
import type { AvailabilityDeclarationIntent } from '@/lib/listings/availability-declaration-write';
import { updatePropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import type { Property } from '@/types/property';
import { AvailabilityDeclarationCard } from './AvailabilityDeclarationCard';
import { useAvailabilityDeclarationSave } from './useAvailabilityDeclarationSave';

export function UnitAvailabilityCard({ property }: { readonly property: Property }) {
  const { t } = useTranslation(['building']);
  const [today] = useState(todayLocalDate);
  const persist = useCallback(async (intent: AvailabilityDeclarationIntent) => {
    const result = await updatePropertyWithPolicy({
      propertyId: property.id,
      currentProperty: property,
      updates: { availabilityDeclaration: intent },
    });
    return result.success;
  }, [property]);
  const save = useAvailabilityDeclarationSave(property.availabilityDeclaration, persist);

  return (
    <AvailabilityDeclarationCard
      idPrefix={`property-${property.id}-availability`}
      title={t('building:availabilityPromise.unitTitle')}
      hint={t('building:availabilityPromise.unitHint')}
      save={save}
      today={today}
    />
  );
}
