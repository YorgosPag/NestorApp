'use client';

/**
 * @fileoverview **«Δέχεστε κατοικίδια;»** — η πολιτική κατοικιδίων της βραχυχρόνιας διάθεσης.
 * @related ADR-777 §8.60.21 · lib/owner-property/owner-property-pets-form.ts
 *
 * 🏆 **Υπερσύνολο των μεγάλων**: οι τρεις απαντήσεις του Booking (`PetsAllowedCode`) + όριο
 * 1–5 και χρέωση με τέσσερις τρόπους του Airbnb (Help 3623) + **ρητό** «δεν το ορίζω τώρα».
 *
 * 🔑 **Όριο και χρέωση εμφανίζονται ΜΟΝΟ όταν έχουν νόημα** («ναι»/«κατόπιν συνεννόησης»):
 * το «όχι» δεν φέρει κανένα από τα δύο — ο τύπος δεν το επιτρέπει, και η οθόνη δεν το ζητά.
 *
 * ⛔ **Η γραμμή του σκύλου βοήθειας εμφανίζεται ΠΑΝΤΑ, ανεξάρτητα από την απάντηση**: ο
 * κάτοχος που επιλέγει «όχι» πρέπει να ξέρει **τη στιγμή που το επιλέγει** ότι δεν αφορά
 * τους σκύλους βοήθειας (Ν.3868/2010 άρθ.16 §7).
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FormFieldset,
  FormInputField,
  FormOptionsField,
} from '@/components/shared/forms/form-field-primitives';
import { STAY_LIMIT_MIN_INCLUSIVE, STAY_PETS_CEILING } from '@/lib/offers/offer-amount';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import { PET_FORM_ANSWERS, type PetFormAnswer } from '@/lib/owner-property/owner-property-pets-form';
import { PET_FEE_BASES, type PetFeeBasis } from '@/types/property-offers';

const K = 'property-market:offer.pets';

/** Κλειδιά **ολόκληρα** (CHECK 3.13/3.34 — κανένα δυναμικό `t()`), κλειστά στο λεξιλόγιο. */
const ANSWER_KEYS: Readonly<Record<PetFormAnswer, string>> = {
  yes: 'property-market:offer.pets.accepts.yes',
  onRequest: 'property-market:offer.pets.accepts.onRequest',
  no: 'property-market:offer.pets.accepts.no',
  unset: 'property-market:offer.pets.accepts.unset',
};

const FEE_BASIS_KEYS: Readonly<Record<PetFeeBasis, string>> = {
  stay: 'property-market:offer.pets.feePer.stay',
  night: 'property-market:offer.pets.feePer.night',
  pet: 'property-market:offer.pets.feePer.pet',
  petNight: 'property-market:offer.pets.feePer.petNight',
};

/** Οι απαντήσεις που **δέχονται** κατοικίδια — μόνο τότε ζητούνται όριο και χρέωση. */
function acceptsPets(answer: PetFormAnswer | undefined): boolean {
  return answer === 'yes' || answer === 'onRequest';
}

export function OwnerStayPetsField(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const { control, watch } = useFormContext<OwnerPropertyFormValues>();
  const answer = watch('petsAccepts');

  return (
    <FormFieldset legend={t(`${K}.legend`)} help={t(`${K}.help`)}>
      <FormOptionsField<OwnerPropertyFormValues, PetFormAnswer>
        control={control}
        name="petsAccepts"
        mode="single"
        options={PET_FORM_ANSWERS}
        labelOf={(option) => t(ANSWER_KEYS[option])}
      />

      {acceptsPets(answer) && (
        <>
          <FormInputField<OwnerPropertyFormValues>
            control={control}
            name="maxPets"
            kind="number"
            label={t(`${K}.maxPetsLabel`, { max: STAY_PETS_CEILING })}
            min={STAY_LIMIT_MIN_INCLUSIVE}
            max={STAY_PETS_CEILING}
          />
          <FormInputField<OwnerPropertyFormValues>
            control={control}
            name="petFeeAmount"
            kind="number"
            label={t(`${K}.feeAmountLabel`)}
            min={STAY_LIMIT_MIN_INCLUSIVE}
          />
          <FormOptionsField<OwnerPropertyFormValues, PetFeeBasis>
            control={control}
            name="petFeePer"
            mode="single"
            options={PET_FEE_BASES}
            labelOf={(basis) => t(FEE_BASIS_KEYS[basis])}
          />
          <p className="text-sm text-muted-foreground">{t(`${K}.feeHelp`)}</p>
        </>
      )}

      <p className="text-sm text-muted-foreground">{t(`${K}.assistanceAnimals`)}</p>
    </FormFieldset>
  );
}
