/**
 * @fileoverview **Το ΠΕΑ μέσα στη φόρμα ακινήτου του γραφείου** (ADR-777 §8.94) — η κλάση στο πεδίο που ήδη υπήρχε,
 * τα υπόλοιπα δίπλα της, και **μία** μετάφραση προς και από το μπλοκ.
 * @related `./energy-certificate.ts` · `features/property-details/components/property-fields-form-types.ts` ·
 *   `services/property/property-form-sync.ts` · `features/property-details/components/property-fields-form-mapper.ts`
 * @module lib/energy-certificate/energy-certificate-form
 *
 * 🔑 **Γιατί η κλάση μένει `energyClass: string` και δεν μπαίνει ολόκληρο το μπλοκ στη φόρμα**: το πεδίο το διαβάζουν
 * ήδη ο δείκτης πληρότητας (`property-completion`) και τρεις έλεγχοι αληθοφάνειας, με το όνομά του. Δεύτερο αντίγραφο
 * της κλάσης μέσα σε μπλοκ θα ήταν δύο αλήθειες στην ίδια φόρμα. Έτσι **κάθε γεγονός ζει σε ένα πεδίο**, και το μπλοκ
 * συντίθεται — πάντα από τον ΕΝΑΝ αναγνώστη — τη στιγμή που χρειάζεται.
 */

import {
  UNDECLARED_ENERGY_CERTIFICATE,
  applyEnergyCertificatePatch,
  readEnergyCertificate,
  type EnergyCertificate,
  type EnergyCertificatePatch,
} from './energy-certificate';

/** Ό,τι γράφει το μπλοκ πέρα από την κλάση. */
export type EnergyCertificateDetails = Omit<EnergyCertificate, 'class'>;

/** Το κομμάτι της φόρμας που κρατά το ΠΕΑ. Το `''` στην κλάση είναι το «καμία επιλογή» των Select της φόρμας. */
export interface EnergyFormSlice {
  readonly energyClass: string;
  readonly energyDetails: EnergyCertificateDetails;
}

/** Μπλοκ → κομμάτι φόρμας. */
export function energyFormSliceOf(certificate: EnergyCertificate): EnergyFormSlice {
  const { class: energyClass, ...energyDetails } = certificate;
  return { energyClass: energyClass ?? '', energyDetails };
}

/** Το κομμάτι της φόρμας ενός ακινήτου χωρίς καμία δήλωση. */
export const UNDECLARED_ENERGY_FORM_SLICE: EnergyFormSlice = energyFormSliceOf(UNDECLARED_ENERGY_CERTIFICATE);

/** Κομμάτι φόρμας → κανονικοποιημένο μπλοκ (άγνωστη κλάση ⇒ καμία, και μαζί της φεύγουν οι αριθμοί). */
export function energyOfForm({ energyClass, energyDetails }: EnergyFormSlice): EnergyCertificate {
  return readEnergyCertificate({ ...energyDetails, class: energyClass === '' ? null : energyClass });
}

/** Η διόρθωση των πεδίων πάνω στο κομμάτι της φόρμας — με την **ίδια** συνάρτηση που εφαρμόζει και ο server. */
export function patchedEnergyFormSlice(slice: EnergyFormSlice, patch: EnergyCertificatePatch): EnergyFormSlice {
  return energyFormSliceOf(applyEnergyCertificatePatch(energyOfForm(slice), patch));
}
