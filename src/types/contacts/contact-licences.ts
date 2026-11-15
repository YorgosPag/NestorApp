/**
 * @fileoverview **ΟΙ ΑΔΕΙΕΣ ΤΗΣ ΕΠΑΦΗΣ** — ό,τι ξέρει το γραφείο για τις άδειες ενός ανθρώπου, με την ΠΡΟΕΛΕΥΣΗ τους
 * (ADR-915 §40.5).
 * @related config/professional-licences.ts (το λεξιλόγιο) · types/agency-profile.ts (`ShowcaseLicence` — ίδιο σχήμα) ·
 *   lib/contacts/contact-licences.ts (ανάγνωση · σχηματισμός)
 * @module types/contacts/contact-licences
 *
 * 🔑 **ΑΔΕΙΑ ≠ ΕΠΑΓΓΕΛΜΑ**: ο ενεργειακός επιθεωρητής είναι μηχανικός (persona `engineer`, ΤΕΕ) με **επιπλέον** άδεια
 *    ΥΠΕΝ. Γι' αυτό η άδεια ζει σε **δική της** λίστα, όχι σε πεδίο persona — ίδια απόφαση με τη βιτρίνα (§21).
 * 🔑 **Ίδιο σχήμα με το `ShowcaseLicence`** + προέλευση: ο ίδιος αναγνώστης απόδειξης, η ίδια παραγωγή αρχής από την
 *    άδεια· καμία δεύτερη αναπαράσταση αριθμού μητρώου.
 * 🔑 **Προέλευση ανά ΠΕΔΙΟ, όχι ανά άδεια** (ADR-915 §40.5 · πρακτική HubSpot property history / Salesforce Field
 *    History: κάθε ιδιότητα κρατά τη δική της πηγή και ώρα). Η **εγγραφή** (αριθμός + εκδότης) και οι **τάξεις** είναι
 *    δύο πεδία με χωριστή ζωή: όταν το γραφείο συμπληρώνει τάξεις, ο αριθμός που δήλωσε ο ίδιος **μένει** «Δηλωμένο από
 *    τον ίδιο» (εύρημα ζωντανής δοκιμής 2026-11-15). Πάντα `declared` — καμία σύνδεση με μητρώο (ADR-798 §7)· ο
 *    έλεγχος γίνεται από το `registryLookupUrl`.
 */

import type { LicenceGrades, ProfessionalLicence } from '@/config/professional-licences';
import type { RegulatedAttestation } from '@/types/agency-profile';

/** Η ρίζα του λεξιλογίου (CHECK 3.73): ποιος έγραψε την τιμή στην επαφή. */
export const CONTACT_LICENCE_SOURCES = ['office', 'self-declared'] as const;
export type ContactLicenceSource = (typeof CONTACT_LICENCE_SOURCES)[number];

export interface ContactLicenceProvenance {
  /** `office` = χειρόγραφα από το γραφείο · `self-declared` = υιοθετήθηκε από τη δήλωση του ίδιου σε ανάθεση. */
  readonly source: ContactLicenceSource;
  /** Πότε γράφτηκε η **τρέχουσα** τιμή (ISO). Η ίδια τιμή που ξανασώζεται κρατά την αρχική της ώρα. */
  readonly recordedAt: string;
  /** Η συμμετοχή από την οποία υιοθετήθηκε — μόνο σε `self-declared`, αλλιώς `null`. */
  readonly engagementId: string | null;
}

export interface ContactLicence {
  readonly licence: ProfessionalLicence;
  readonly attestation: RegulatedAttestation;
  /** Οι δηλωμένες τάξεις (ADR-915 §40.7) — ίδιο πεδίο με το `ShowcaseLicence.grades`. */
  readonly grades?: LicenceGrades;
  /** Η προέλευση της **εγγραφής** (αριθμός μητρώου + εκδότης). */
  readonly provenance: ContactLicenceProvenance;
  /**
   * Η προέλευση των **τάξεων** — υπάρχει **αν και μόνο αν** υπάρχουν `grades` (ποτέ `undefined` στον δίσκο).
   * Γραμμή γραμμένη πριν από τη διάσπαση (μία προέλευση για όλη την άδεια) διαβάζεται με την προέλευση της εγγραφής:
   * τότε **όντως** μία πράξη είχε γράψει και τα δύο.
   */
  readonly gradesProvenance?: ContactLicenceProvenance;
}

/** Η προέλευση **ανά πεδίο** της άδειας όπως τη δείχνει η φόρμα — `null` = το πεδίο δεν είναι (ακόμη) αποθηκευμένο. */
export interface ContactLicenceFieldProvenance {
  readonly registration: ContactLicenceProvenance | null;
  readonly grades: ContactLicenceProvenance | null;
}
