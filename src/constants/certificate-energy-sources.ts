/**
 * @fileoverview **Οι πηγές ενέργειας όπως τις τυπώνει το ΠΕΑ** — οι οκτώ γραμμές του πίνακα «Υπολογιζόμενη ετήσια
 * κατανάλωση τελικής ενέργειας ανά πηγή ενέργειας & τελική χρήση» (ΤΟΤΕΕ 20701-4/2017, ΦΕΚ Β΄ 4003/17.11.2017,
 * σελ. 49022), με τη σειρά του εντύπου.
 * @related ADR-777 §8.95 · `lib/energy-certificate/energy-certificate.ts` (`finalEnergy`) ·
 *   `lib/energy-cost/*` (ποια πηγή έχει τιμή αναφοράς)
 * @module constants/certificate-energy-sources
 *
 * ⚠️ **ΔΕΝ είναι το `FUEL_TYPES`** (`constants/property-features-enterprise.ts`), και δεν πρέπει να ενωθούν: εκείνο
 * περιγράφει **το σύστημα θέρμανσης** όπως το δηλώνει ο αγγελιοδότης (και περιέχει `heat-pump`, που δεν είναι πηγή
 * ενέργειας — η αντλία καίει ρεύμα). Αυτό είναι **αντιγραφή εντύπου**: ό,τι γράφει το πιστοποιητικό, με τα δικά του
 * ονόματα γραμμών. Μια αντιστοίχιση μεταξύ τους θα ήταν συμπερασμός, όχι δήλωση.
 *
 * **Layering**: φύλλο χωρίς εισαγωγές.
 */

export const CERTIFICATE_ENERGY_SOURCES = [
  'electricity',
  'oil',
  'natural-gas',
  'other-fossil',
  'solar',
  'biomass',
  'geothermal',
  'other-renewable',
] as const;

export type CertificateEnergySource = (typeof CERTIFICATE_ENERGY_SOURCES)[number];

/** Είναι γραμμή του εντύπου; Άγνωστη συμβολοσειρά ⇒ `false`, ποτέ «η πιο κοντινή». */
export function isCertificateEnergySource(raw: unknown): raw is CertificateEnergySource {
  return CERTIFICATE_ENERGY_SOURCES.some((source) => source === raw);
}

/** Η θέση της γραμμής στο έντυπο — η κανονική σειρά κάθε αποθηκευμένου πίνακα. */
export function certificateEnergySourceRank(source: CertificateEnergySource): number {
  return CERTIFICATE_ENERGY_SOURCES.indexOf(source);
}
