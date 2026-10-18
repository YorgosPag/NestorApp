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
 * @see ADR-915 §34 — Φ1δ: άδεια ηλεκτρολόγου εγκαταστάτη ανά Περιφερειακή Ενότητα
 */

import { ELECTRICAL_INSTALLER_ESCO_URIS } from '@/config/electrical-installer-occupations';
import type { RegistryAuthorityId } from '@/constants/professional-registries';

/** Η ρίζα του λεξιλογίου (CHECK 3.73). Νέα άδεια (π.χ. ελεγκτής δόμησης) = νέα γραμμή εδώ + στον πίνακα. */
export const PROFESSIONAL_LICENCES = ['energy-inspector', 'electrical-installer'] as const;
export type ProfessionalLicence = (typeof PROFESSIONAL_LICENCES)[number];

export interface ProfessionalLicenceSpec {
  /**
   * Ποιο μητρώο κρατά την άδεια. Εθνική αρχή ⇒ αρκεί ο αριθμός· αρχή **με παραρτήματα** (`regional-authority`) ⇒ ο
   * εκδότης (Περιφερειακή Ενότητα) δηλώνεται **πάντα** δίπλα στον αριθμό (ADR-841 Α9.1 · ADR-915 §34).
   */
  readonly authority: RegistryAuthorityId;
  /** Η διάταξη, αυτολεξεί (εξαίρεση N.11 όπως το `statute` του καταλόγου εγγράφων). */
  readonly statute: string;
  /**
   * Η δημόσια σελίδα του μητρώου, όπου ο καθένας ελέγχει έναν αριθμό — `null` = **δεν υπάρχει** δημόσια αναζήτηση
   * (ελέγχθηκε, με ημερομηνία στο σχόλιο της γραμμής). Ποτέ σύνδεσμος σε σελίδα που δεν απαντά στο ερώτημα.
   */
  readonly registryLookupUrl: string | null;
  /** Κλειδί i18n του ονόματος της άδειας (πλήρες, με namespace — ο τεμαχιστής του CHECK 3.34 το λύνει στατικά). */
  readonly nameKey: string;
  /**
   * 🔑 **Η ειδικότητα ΕΙΝΑΙ η άδεια** (ADR-915 §34 Λ3): ειδικότητες ESCO των οποίων η εγγραφή στην **ίδια** αρχή είναι
   * αυτή ακριβώς η άδεια — ο ηλεκτρολόγος 7411 με αριθμό Περιφέρειας **δεν** τη δηλώνει δεύτερη φορά. Κενό = η άδεια
   * αποδεικνύεται **μόνο** ρητά (ο επιθεωρητής είναι μηχανικός ΤΕΕ — η εγγραφή του στο ΤΕΕ δεν είναι η άδεια ΥΠΕΝ).
   */
  readonly heldThroughOccupations: readonly string[];
}

export const PROFESSIONAL_LICENCE_SPECS: Readonly<Record<ProfessionalLicence, ProfessionalLicenceSpec>> = {
  // Μητρώο Ενεργειακών Επιθεωρητών της ΕΥΕΠΕΝ (buildingcert.gr): εγγραφή με αύξοντα αριθμό, που αναγράφεται στην άδεια
  // του επιθεωρητή και στο ΠΕΑ που εκδίδει (έρευνα 2026-10-16, ADR-915 §21).
  'energy-inspector': {
    authority: 'ypen',
    statute: 'ν.4122/2013',
    registryLookupUrl: 'https://www.buildingcert.gr',
    nameKey: 'property-market:licences.energyInspector.name',
    heldThroughOccupations: [],
  },
  // Άδεια ηλεκτρολόγου εγκαταστάτη (Α' ειδικότητα, ομάδες 1–4 — ΟΛΕΣ εκδίδουν ΥΔΕ, π.δ. 108/2013 άρθ. 4) ή βεβαίωση
  // αναγγελίας μηχανικού/πτυχιούχου (άρθ. 10): την εκδίδει η υπηρεσία της Περιφέρειας «του τόπου επαγγελματικής
  // εγκατάστασης» (ν.3982/2011 άρθ. 5) ⇒ αρχή ανά Περιφερειακή Ενότητα. Το Ενιαίο Μητρώο (άρθ. 9) τηρείται στη ΓΓ
  // Βιομηχανίας χωρίς δημόσια αναζήτηση (έρευνα 2026-10-18· μόνο αρχεία ανά έτος σε ορισμένες ΠΕ) ⇒ `null`.
  'electrical-installer': {
    authority: 'regional-authority',
    statute: 'ν.3982/2011 · π.δ. 108/2013',
    registryLookupUrl: null,
    nameKey: 'property-market:licences.electricalInstaller.name',
    heldThroughOccupations: ELECTRICAL_INSTALLER_ESCO_URIS,
  },
};

/** *«Ξέρει το σύστημα αυτή την άδεια;»* — ο φρουρός της εισόδου (σώμα αιτήματος · παλιό έγγραφο Firestore). */
export function isProfessionalLicence(value: unknown): value is ProfessionalLicence {
  return typeof value === 'string' && (PROFESSIONAL_LICENCES as readonly string[]).includes(value);
}
