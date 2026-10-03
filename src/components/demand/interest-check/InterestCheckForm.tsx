'use client';

/**
 * **Η ΦΟΡΜΑ ΤΟΥ «ΔΕΣ ΑΝ ΚΑΠΟΙΟΣ ΕΝΔΙΑΦΕΡΕΤΑΙ»** — ποιο κτίριο, τι ακίνητο.
 *
 * @related ADR-900 · lib/demand/prospect-interest.ts · components/geo/PlaceIdentityField
 * @module components/demand/interest-check/InterestCheckForm
 *
 * 🔑 **Κανένα νέο πεδίο UI.** Το κτίριο το δείχνει ο **ίδιος** επιλογέας με τη ζήτηση και την
 * καταχώριση (`PlaceIdentityField`)· τα είδη έρχονται από το **ίδιο** SSoT (`PROPERTY_TYPES` +
 * `PROPERTY_TYPE_I18N_KEYS`)· τα πεδία είναι τα **κοινά** primitives της φόρμας του κατόχου. Ο άνθρωπος
 * που θα πατήσει μετά «Καταχώριση» βλέπει τις ίδιες ερωτήσεις, με τις ίδιες λέξεις.
 *
 * ⚠️ **Τρία πεδία, όχι περισσότερα** — όσα κρίνει η μηχανή για ακίνητο **χωρίς** διάθεση (τι είναι,
 * πόσο, ποιος όροφος). Τιμή και είδος συμφωνίας **δεν** ρωτιούνται: θα ήταν σκοπός πριν την απάντηση.
 */

import React from 'react';
import type { Control } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROPERTY_TYPES, PROPERTY_TYPE_I18N_KEYS, type PropertyTypeCanonical } from '@/constants/property-types';
import { isLandProperty } from '@/constants/property-classification';
import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import { AddressFocusFinder, type AddressFocus } from '@/components/geo/AddressFocusFinder';
import {
  FormFieldset,
  FormInputField,
  FormOptionsField,
} from '@/components/shared/forms/form-field-primitives';
import { DeclaredFloorSelectField } from '@/components/shared/forms/DeclaredFloorSelectField';
import { PROSPECT_LIMITS, type ProspectFormValues } from '@/lib/demand/prospect-interest';
import type { PlaceRef } from '@/types/geo/public-place';

const NS = 'property-market';
const K = `${NS}:interestCheck`;

/** Βήμα 1 — **ποιο** κτίριο. */
export function InterestCheckPlaceStep({
  place,
  onPlace,
  initialAddress,
}: {
  place: PlaceRef | null;
  onPlace: (ref: PlaceRef) => void;
  /** Από δημόσια πόρτα (ADR-900 §3.7): το πεδίο ξεκινά γεμάτο και ο χάρτης πάει ήδη εκεί. */
  initialAddress: string | null;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  // 🔑 Διεύθυνση ΠΡΩΤΑ, κτίριο ΜΕΤΑ — ίδια σειρά με τη φόρμα του κατόχου (και τη Zillow). Η εστίαση πάει στον
  //    επιλογέα, που κεντράρει τον χάρτη και προσφέρει τη διεύθυνση ως τόπο· ο τόπος αποφασίζεται ΜΟΝΟ εκεί.
  const [found, setFound] = React.useState<AddressFocus | null>(null);
  return (
    <FormFieldset legend={t(`${K}.place.legend`)} help={t(`${K}.place.help`)}>
      <AddressFocusFinder onFocus={setFound} initialQuery={initialAddress} />
      <PlaceIdentityField
        chosen={place}
        onChosen={onPlace}
        focus={found?.focus ?? null}
        addressQuery={found?.query ?? null}
      />
    </FormFieldset>
  );
}

/** Βήμα 2 — **τι** ακίνητο. Ο όροφος αποσύρεται για γη (ADR-777 §8.32), όπως στη φόρμα του κατόχου. */
export function InterestCheckDescriptionStep({
  control,
  type,
}: {
  control: Control<ProspectFormValues>;
  type: ProspectFormValues['type'];
}): React.ReactElement {
  const { t } = useTranslation([NS, 'properties-enums']);
  return (
    <FormFieldset legend={t(`${K}.description.legend`)} help={t(`${K}.description.help`)}>
      <p className="text-sm text-foreground">{t(`${K}.description.typeLabel`)}</p>
      <FormOptionsField<ProspectFormValues, PropertyTypeCanonical>
        control={control}
        name="type"
        mode="single"
        options={PROPERTY_TYPES}
        labelOf={(option) => t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[option]}`)}
      />
      <FormInputField<ProspectFormValues>
        control={control}
        name="areaSqm"
        kind="number"
        label={t(`${K}.description.areaLabel`)}
        min={1}
        max={PROSPECT_LIMITS.areaSqmMax}
      />
      {/* ADR-903 §9 (2β.3) — ο ΙΔΙΟΣ επιλογέας στάθμης με τη δήλωση ιδιοκτήτη: η πυλωτή δεν είναι «0». */}
      {!isLandProperty(type) && (
        <DeclaredFloorSelectField<ProspectFormValues>
          control={control}
          name="floorLevel"
          label={t(`${NS}:offer.form.floorLabel`)}
          placeholder={t(`${NS}:offer.form.floorPlaceholder`)}
        />
      )}
    </FormFieldset>
  );
}
