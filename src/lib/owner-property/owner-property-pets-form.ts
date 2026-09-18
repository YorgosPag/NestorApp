/**
 * @fileoverview **Η ΠΟΛΙΤΙΚΗ ΚΑΤΟΙΚΙΔΙΩΝ ΣΤΗ ΦΟΡΜΑ ΤΟΥ ΚΑΤΟΧΟΥ** — επίπεδα πεδία ⇄ διακριτή ένωση.
 * @related ADR-777 §8.60.21 · lib/owner-property/owner-property-form-values.ts ·
 *   types/property-offers.ts (`StayPetPolicy`)
 * @module lib/owner-property/owner-property-pets-form
 *
 * 🔑 **Γιατί χωριστό αρχείο**: η γέφυρα έχει **δύο** κατευθύνσεις και έναν κανόνα απώλειας
 * («όχι» ⇒ όριο/χρέωση **δεν** ταξιδεύουν), δηλαδή δική της ευθύνη. Το
 * `owner-property-form-values.ts` απλώς **απλώνει** το σχήμα και καλεί τις δύο συναρτήσεις.
 *
 * 🔑 **Το «δεν το ορίζω» είναι ΕΠΙΛΟΓΗ ΣΤΗΝ ΟΘΟΝΗ** (`unset`), όπως το `declined` της θέσης
 * (Α5 §3): μια ομάδα ραδιοπλήκτρων δεν «ξε-επιλέγεται», και το «δεν δηλώθηκε» είναι
 * **υπαρκτή, διαφορετική** απάντηση από το «όχι» (schema.org `petsAllowed`: άγνωστο).
 *
 * ⚠️ **Οι τιμές των κρυμμένων πεδίων ΜΕΝΟΥΝ στη μνήμη της φόρμας** (ίδιο δόγμα με τα ποσά
 * των ξετσεκαρισμένων διαθέσεων): ο κάτοχος που περνά από «ναι» σε «όχι» και πίσω βρίσκει
 * το όριο και τη χρέωσή του εκεί. Απλώς **δεν γράφονται** όσο η απάντηση είναι «όχι».
 */

import { z } from 'zod';

import { optionalNumberSchema } from '@/lib/forms/form-primitives';
import {
  PET_ACCEPTANCE,
  PET_FEE_BASES,
  type PetFeeBasis,
  type StayPetPolicy,
} from '@/types/property-offers';

/** Οι απαντήσεις της οθόνης: οι τρεις του λεξιλογίου **και** «δεν το ορίζω τώρα». */
export const PET_FORM_ANSWERS = [...PET_ACCEPTANCE, 'unset'] as const;
export type PetFormAnswer = (typeof PET_FORM_ANSWERS)[number];

/** Τα τέσσερα επίπεδα πεδία — απλώνονται στο `ownerPropertyFormSchema`. */
export const petFormShape = {
  petsAccepts: z.enum(PET_FORM_ANSWERS as unknown as [PetFormAnswer, ...PetFormAnswer[]]),
  maxPets: optionalNumberSchema,
  petFeeAmount: optionalNumberSchema,
  petFeePer: z.enum(PET_FEE_BASES as unknown as [PetFeeBasis, ...PetFeeBasis[]]),
};

const petFormSchema = z.object(petFormShape);
export type PetFormValues = z.input<typeof petFormSchema>;
type PetFormParsed = z.output<typeof petFormSchema>;

/** Κενή φόρμα: **καμία** απάντηση προ-επιλεγμένη — η πολιτική είναι ερώτηση, όχι μαντεψιά. */
export const EMPTY_PET_FORM: PetFormValues = {
  petsAccepts: 'unset',
  maxPets: null,
  petFeeAmount: null,
  // Ο τρόπος χρέωσης **χωρίς** ποσό δεν γράφεται — η προεπιλογή είναι μόνο η θέση του κουμπιού.
  petFeePer: 'stay',
};

/**
 * Φόρμα → πολιτική, ή `null` («δεν δηλώθηκε»).
 *
 * 🔑 Ποσό κενό ⇒ `fee: null` = **χωρίς χρέωση** (Airbnb: χωρίς ορισμένη χρέωση δεν χρεώνεται).
 * ⚠️ Ποσό `0` **περνά αυτούσιο** και το ονομάζει το invariant — η σιωπηλή μετατροπή του σε
 * «δωρεάν» θα έκρυβε από τον κάτοχο ότι έγραψε κάτι που δεν εννοούσε.
 */
export function petPolicyFromForm(values: PetFormParsed): StayPetPolicy | null {
  switch (values.petsAccepts) {
    case 'unset':
      return null;
    case 'no':
      return { accepts: 'no' };
    case 'yes':
    case 'onRequest':
      return {
        accepts: values.petsAccepts,
        maxPets: values.maxPets,
        fee: values.petFeeAmount === null ? null : { amount: values.petFeeAmount, per: values.petFeePer },
      };
  }
}

/** Πολιτική → φόρμα (επεξεργασία). Απούσα πολιτική ⇒ «δεν το ορίζω». */
export function petFormOf(policy: StayPetPolicy | null | undefined): PetFormValues {
  if (policy === null || policy === undefined) return EMPTY_PET_FORM;
  if (policy.accepts === 'no') return { ...EMPTY_PET_FORM, petsAccepts: 'no' };
  return {
    petsAccepts: policy.accepts,
    maxPets: policy.maxPets,
    petFeeAmount: policy.fee?.amount ?? null,
    petFeePer: policy.fee?.per ?? EMPTY_PET_FORM.petFeePer,
  };
}
