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
 * 🔑 **Προέλευση ανά άδεια** (πρακτική Salesforce/HubSpot «πηγή τιμής»): «το έγραψε το γραφείο» ≠ «το δήλωσε ο ίδιος
 *    σε ανάθεση». Πάντα `declared` — καμία σύνδεση με μητρώο (ADR-798 §7)· ο έλεγχος γίνεται από το `registryLookupUrl`.
 */

import type { ProfessionalLicence } from '@/config/professional-licences';
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
  readonly provenance: ContactLicenceProvenance;
}
