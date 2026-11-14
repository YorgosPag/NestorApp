/**
 * @fileoverview **ΠΟΥ ΠΑΕΙ Η ΔΗΛΩΣΗ ΤΟΥ ΙΔΙΟΥ ΣΤΗΝ ΕΠΑΦΗ ΤΟΥ ΓΡΑΦΕΙΟΥ** — ανά αρχή μητρώου (ADR-915 §40.6).
 * @related constants/professional-registries.ts (το λεξιλόγιο των αρχών) · config/professional-licences.ts (οι άδειες) ·
 *   types/contacts/personas.ts (τα πεδία μητρώου των persona) · lib/contacts/declared-credential-comparison.ts
 * @module config/declared-credential-adoption
 *
 * 🔑 **Ολικός πίνακας**: νέα αρχή μητρώου χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης, ποτέ σιωπηλό «δεν υιοθετείται».
 * 🔑 **ΑΔΕΙΑ ≠ ΕΠΑΓΓΕΛΜΑ** (§21): ΥΠΕΝ / Περιφέρεια ⇒ λίστα αδειών της επαφής · ΤΕΕ / ΟΕΕ / Σύλλογοι ⇒ πεδίο persona.
 * 🔑 **ΓΕΜΗ ⇒ `null`**: μητρώο **επιχειρήσεων** — δεν περιγράφει το πρόσωπο της επαφής.
 * Καθαρά δεδομένα — καμία λογική, καμία εισαγωγή SDK.
 */

import type { ProfessionalLicence } from '@/config/professional-licences';
import type { RegistryAuthorityId } from '@/constants/professional-registries';

/** Η υιοθέτηση γράφει άδεια στη λίστα `licences[]` της επαφής (με προέλευση `self-declared`). */
export interface LicenceAdoptionTarget {
  readonly kind: 'licence';
  readonly licence: ProfessionalLicence;
}

/** Η υιοθέτηση γράφει τα πεδία μητρώου μιας persona — ζεύγη `(persona, πεδίο αριθμού, πεδίο εκδότη)` κλειστά. */
export type PersonaAdoptionTarget =
  | { readonly kind: 'persona'; readonly persona: 'engineer'; readonly numberField: 'teeRegistryNumber'; readonly chapterField: null }
  | { readonly kind: 'persona'; readonly persona: 'accountant'; readonly numberField: 'oeeNumber'; readonly chapterField: null }
  | { readonly kind: 'persona'; readonly persona: 'lawyer'; readonly numberField: 'barAssociationNumber'; readonly chapterField: 'barAssociation' }
  | { readonly kind: 'persona'; readonly persona: 'notary'; readonly numberField: 'notaryRegistryNumber'; readonly chapterField: 'notaryDistrict' };

export type AdoptionTarget = LicenceAdoptionTarget | PersonaAdoptionTarget;

export const DECLARED_CREDENTIAL_ADOPTION: Readonly<Record<RegistryAuthorityId, AdoptionTarget | null>> = {
  ypen: { kind: 'licence', licence: 'energy-inspector' },
  'regional-authority': { kind: 'licence', licence: 'electrical-installer' },
  tee: { kind: 'persona', persona: 'engineer', numberField: 'teeRegistryNumber', chapterField: null },
  oee: { kind: 'persona', persona: 'accountant', numberField: 'oeeNumber', chapterField: null },
  'bar-association': { kind: 'persona', persona: 'lawyer', numberField: 'barAssociationNumber', chapterField: 'barAssociation' },
  'notary-association': { kind: 'persona', persona: 'notary', numberField: 'notaryRegistryNumber', chapterField: 'notaryDistrict' },
  gemi: null,
};
