/**
 * =============================================================================
 * Άδειες επαγγελματιών — ό,τι έχει κάποιος **ΕΠΙΠΛΕΟΝ** από το επάγγελμά του (ADR-915 §21 · ADR-841 Α9)
 * =============================================================================
 *
 * **Δεδομένα, ποτέ λογική.**
 *
 * 🔑 **ΑΔΕΙΑ ≠ ΕΠΑΓΓΕΛΜΑ.** Ο ενεργειακός επιθεωρητής δεν είναι ειδικότητα: είναι μηχανικός *(αριθμός ΤΕΕ, δηλωμένος
 *    στα `credentials` της βιτρίνας)* με **επιπλέον** άδεια του ΥΠΕΝ. Γι' αυτό η άδεια ζει σε δικό της πεδίο της βιτρίνας
 *    (`PublicShowcase.licences`), ανεξάρτητα από το ISCO/ESCO — όπως το Houzz κρατά το «Verified License» χωριστά από την
 *    κατηγορία του επαγγελματία.
 * 🔑 **Η αρχή ΠΑΡΑΓΕΤΑΙ από την άδεια**, ποτέ δεν τη στέλνει ο πελάτης (ίδιο ιδίωμα με το `credentialFor`).
 * 🔑 **Δηλωμένο ≠ επαληθευμένο** (ADR-798 §7): καμία σύνδεση με το μητρώο σήμερα. Το `registryLookupUrl` δίνει στον
 *    πελάτη τον δρόμο να το ελέγξει ο ίδιος — ο ψεύτικος αριθμός **εκθέτει** αυτόν που τον έγραψε (ADR-841 Α9.2).
 * ⛔ **Καμία ετικέτα εδώ** — κλειδιά i18n (N.11), στο ίδιο namespace με τη βιτρίνα (`property-market`).
 *
 * @module config/professional-licences
 * @see ADR-915 §21 — Στάδιο 2α: άδειες στη βιτρίνα
 */

import type { NationalRegistryId } from '@/constants/professional-registries';

/** Η ρίζα του λεξιλογίου (CHECK 3.73). Νέα άδεια (π.χ. ελεγκτής δόμησης) = νέα γραμμή εδώ + στον πίνακα. */
export const PROFESSIONAL_LICENCES = ['energy-inspector'] as const;
export type ProfessionalLicence = (typeof PROFESSIONAL_LICENCES)[number];

export interface ProfessionalLicenceSpec {
  /** Ποιο μητρώο κρατά την άδεια — αρχή με **έναν** εκδότη, άρα αρκεί ο αριθμός (ADR-841 Α9.1). */
  readonly authority: NationalRegistryId;
  /** Η διάταξη, αυτολεξεί (εξαίρεση N.11 όπως το `statute` του καταλόγου εγγράφων). */
  readonly statute: string;
  /** Η δημόσια σελίδα του μητρώου, όπου ο καθένας ελέγχει έναν αριθμό. */
  readonly registryLookupUrl: string;
  /** Κλειδί i18n του ονόματος της άδειας (πλήρες, με namespace — ο τεμαχιστής του CHECK 3.34 το λύνει στατικά). */
  readonly nameKey: string;
}

export const PROFESSIONAL_LICENCE_SPECS: Readonly<Record<ProfessionalLicence, ProfessionalLicenceSpec>> = {
  // Μητρώο Ενεργειακών Επιθεωρητών της ΕΥΕΠΕΝ (buildingcert.gr): εγγραφή με αύξοντα αριθμό, που αναγράφεται στην άδεια
  // του επιθεωρητή και στο ΠΕΑ που εκδίδει (έρευνα 2026-10-16, ADR-915 §21).
  'energy-inspector': {
    authority: 'ypen',
    statute: 'ν.4122/2013',
    registryLookupUrl: 'https://www.buildingcert.gr',
    nameKey: 'property-market:licences.energyInspector.name',
  },
};

/** *«Ξέρει το σύστημα αυτή την άδεια;»* — ο φρουρός της εισόδου (σώμα αιτήματος · παλιό έγγραφο Firestore). */
export function isProfessionalLicence(value: unknown): value is ProfessionalLicence {
  return typeof value === 'string' && (PROFESSIONAL_LICENCES as readonly string[]).includes(value);
}
