/**
 * @fileoverview **Η ΕΠΑΦΗ ΤΟΥ ΓΡΑΦΕΙΟΥ ↔ Ο ΛΟΓΑΡΙΑΣΜΟΣ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — ό,τι βλέπει το γραφείο πάνω στην επαφή του.
 * @related ADR-915 §40 · ADR-862 §5.3.11 (μητρώο οικοδεσποτών)
 * @module types/contact-professional-link
 *
 * 🔑 **Παράγεται, δεν αποθηκεύεται**: η μία αλήθεια είναι η συμμετοχή (`origin.contactId` + `uid`), που τη γράφει ο ΕΝΑΣ
 *    γραφέας. Κανένα πεδίο `uid` στην επαφή, καμία δίδυμη καρτέλα (πρακτική Slack Connect / Procore: ο οικοδεσπότης
 *    **διαβάζει**, ο επαγγελματίας **κατέχει**).
 * 🔒 **GDPR 5(1)(γ)**: χωρίς `uid`, χωρίς email λογαριασμού — μόνο γεγονότα που το γραφείο ήδη γνωρίζει ή που του
 *    δήλωσε ο ίδιος ο επαγγελματίας για **αυτή** τη συνεργασία.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryAuthorityId } from '@/constants/professional-registries';
import type { EngagementRole, EngagementState, EngagementSubjectKind } from '@/types/engagement';

/** Ποιο ακίνητο και (για ανάθεση έκδοσης) ποιο έγγραφο — η **μία** περιγραφή που δίνει ο οικοδεσπότης κάθε είδους. */
export interface EngagementHostLine {
  readonly propertyName: string | null;
  /** Μόνο σε ανάθεση έκδοσης· `null` στη μεταβίβαση ή όταν η ανάθεση δεν διαβάζεται. */
  readonly documentKind: DocumentKind | null;
}

/** Μία υπόθεση που γέννησε αυτή η επαφή — η **τρέχουσα** συμμετοχή της, κριμένη τώρα. */
export interface ContactProfessionalAssignment extends EngagementHostLine {
  readonly engagementId: string;
  readonly kind: EngagementSubjectKind;
  readonly role: EngagementRole;
  /** Η κατάσταση **όπως ισχύει τώρα** (`shownStateOf`): ενεργή αλλά ληγμένη ⇒ `expired`, ποτέ «ενεργή». */
  readonly state: EngagementState;
  readonly offeredAt: string;
}

/** Η δήλωση ιδιότητας **του ίδιου**, από ενεργή συμμετοχή — ποτέ «επαληθευμένο». */
export interface ContactDeclaredCredential {
  readonly authority: RegistryAuthorityId;
  readonly number: string;
  /** Σύλλογος / Περιφερειακή Ενότητα — `null` σε εθνική αρχή (ίδιο δόγμα με το `DeclaredCredential`). */
  readonly chapter: string | null;
  readonly declaredAt: string;
  /** Η συμμετοχή όπου δηλώθηκε — η προέλευση της υιοθέτησης (ADR-915 §40.6). */
  readonly engagementId: string;
}

/**
 * - `linked`  — ο άνθρωπος της επαφής έχει αποδεχτεί με **δικό του** λογαριασμό (ενεργή ή ολοκληρωμένη συμμετοχή)
 * - `offered` — μόνο προτάσεις σε αναμονή
 * - `none`    — καμία ζωντανή ή αποδεκτή συμμετοχή (η οθόνη δεν δείχνει τίποτα)
 */
export const CONTACT_LINK_STATUSES = ['linked', 'offered', 'none'] as const;
export type ContactLinkStatus = (typeof CONTACT_LINK_STATUSES)[number];

export interface ContactProfessionalLink {
  readonly status: ContactLinkStatus;
  readonly assignments: readonly ContactProfessionalAssignment[];
  readonly declared: ContactDeclaredCredential | null;
  /** Ανέλαβε για λογαριασμό του **γραφείου** του (νομικό πρόσωπο) — μόνο ένδειξη, ποτέ αυτόματη επαφή εταιρείας. */
  readonly actingForOffice: boolean;
}

/**
 * ADR-915 §40.6 — το σώμα της υιοθέτησης: **μόνο** η τιμή που είδε το γραφείο στην επαφή (CAS). Η δήλωση **δεν**
 * ταξιδεύει από τον πελάτη — ο server την ξαναδιαβάζει από τη συμμετοχή.
 */
export interface AdoptDeclaredCredentialRequest {
  readonly expectedCurrent: { readonly number: string; readonly chapter: string | null } | null;
}

/** `adopted` = γράφτηκε · `unchanged` = η επαφή είχε ήδη την ίδια τιμή (ιδεμπότητα, καμία εγγραφή). */
export interface AdoptDeclaredCredentialResponse {
  readonly outcome: 'adopted' | 'unchanged';
}
