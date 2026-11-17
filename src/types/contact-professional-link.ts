/**
 * @fileoverview **Η ΕΠΑΦΗ ΤΟΥ ΓΡΑΦΕΙΟΥ ↔ Ο ΛΟΓΑΡΙΑΣΜΟΣ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — ό,τι βλέπει το γραφείο πάνω στην επαφή του.
 * @related ADR-915 §40 · ADR-862 §5.3.11 (μητρώο οικοδεσποτών)
 * @module types/contact-professional-link
 *
 * 🔑 **Παράγεται, δεν αποθηκεύεται**: η μία αλήθεια είναι η συμμετοχή (`origin.contactId` + `uid`), που τη γράφει ο ΕΝΑΣ
 *    γραφέας. Κανένα πεδίο `uid` στην επαφή, καμία δίδυμη καρτέλα (πρακτική Slack Connect / Procore: ο οικοδεσπότης
 *    **διαβάζει**, ο επαγγελματίας **κατέχει**).
 * 🔒 **GDPR 5(1)(γ)**: χωρίς `uid`, χωρίς email λογαριασμού — μόνο γεγονότα που το γραφείο ήδη γνωρίζει ή που του
 *    δήλωσε ο ίδιος ο επαγγελματίας για **αυτή** τη συνεργασία. Το **όνομα** του λογαριασμού εκτίθεται **μόνο** για
 *    συνεργασία που ο ίδιος **αποδέχτηκε** (ADR-915 §40.8, πρότυπο Slack Connect «basic details» / Box): ο οικοδεσπότης
 *    βλέπει με ποια ταυτότητα δουλεύει μαζί του, όχι μόνο ό,τι έγραψε ο ίδιος στο ευρετήριό του.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { RegistryAuthorityId } from '@/constants/professional-registries';
import type { EngagementRole, EngagementState, EngagementSubjectKind } from '@/types/engagement';

/** Ποιο ακίνητο και (για ανάθεση έκδοσης) ποιο έγγραφο — η **μία** περιγραφή που δίνει ο οικοδεσπότης κάθε είδους. */
export interface EngagementHostLine {
  /** Το ακίνητο της υπόθεσης — για σύνδεσμο προς τη σελίδα του (ADR-915 §41.4)· `null` όταν η υπόθεση δεν διαβάζεται. */
  readonly propertyId: string | null;
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

/**
 * ADR-915 §40.8 — συμφωνεί το όνομα της επαφής με το όνομα του λογαριασμού;
 * - `match`   — ίδιες λέξεις, ανεξαρτήτως τόνων, κεφαλαίων, σειράς και γραφής (Γιώργος ≡ GIORGOS)
 * - `differs` — και οι δύο πλευρές έχουν όνομα και **δεν** ταιριάζουν
 * - `unknown` — λείπει η μία πλευρά: **ποτέ** ψευδές «διαφέρει»
 */
export const CONTACT_ACCOUNT_NAME_MATCHES = ['match', 'differs', 'unknown'] as const;
export type ContactAccountNameMatch = (typeof CONTACT_ACCOUNT_NAME_MATCHES)[number];

/**
 * Ο λογαριασμός που **αποδέχτηκε** συνεργασία ως αυτή η επαφή — μόνο όνομα, ποτέ `uid` ή email.
 *
 * 🔑 **Δεδομένα πηγής, όχι ετυμηγορία** (ADR-915 §40.10): ο server στέλνει το όνομα του λογαριασμού και ο πελάτης
 *    κρίνει «ίδιο / διαφορετικό» (`compareContactToAccount`) και προτείνει (`accountNameProposalOf`) πάνω στη **ζωντανή**
 *    επαφή. Ετυμηγορία υπολογισμένη στον server πάλιωνε τη στιγμή που άλλαζε το όνομα της επαφής (υιοθέτηση **ή**
 *    χειροκίνητη επεξεργασία) — το σήμα έμενε «διαφορετικό» μέχρι ανανέωση.
 * 🔑 Όλα `null` ⇒ ο λογαριασμός δεν διαβάστηκε («άγνωστος λογαριασμός»), ποτέ κενό σαν να ήταν γνωστό.
 */
export interface ContactLinkedAccount {
  readonly displayName: string | null;
  /** Το **δομημένο** όνομα — ίδιο προσωπικό δεδομένο με το `displayName`, σε μέρη. */
  readonly givenName: string | null;
  readonly familyName: string | null;
}

export interface ContactProfessionalLink {
  readonly status: ContactLinkStatus;
  readonly assignments: readonly ContactProfessionalAssignment[];
  /** Διακριτοί λογαριασμοί με **αποδεκτή** συνεργασία· κενό σε `offered`/`none` (δεν έχει συναινέσει ακόμη). */
  readonly accounts: readonly ContactLinkedAccount[];
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

/**
 * ADR-915 §40.9 — το σώμα της «Υιοθέτησης ονόματος»: **μόνο** το όνομα που είδε το γραφείο στην επαφή (CAS). Το νέο
 * όνομα **δεν** ταξιδεύει από τον πελάτη — ο server το ξαναδιαβάζει από τον λογαριασμό.
 */
export interface AdoptAccountNameRequest {
  readonly expectedCurrent: { readonly firstName: string | null; readonly lastName: string | null };
}

/**
 * - `complete`   — τα αποκανονικοποιημένα αντίγραφα του ονόματος (ADR-249) ενημερώθηκαν
 * - `failed`     — η επαφή γράφτηκε, τα αντίγραφα **όχι** (ο άνθρωπος ειδοποιείται· ποτέ σιωπηλά)
 * - `not-needed` — καμία εγγραφή (`unchanged`)
 */
export const NAME_CASCADE_OUTCOMES = ['complete', 'failed', 'not-needed'] as const;
export type NameCascadeOutcome = (typeof NAME_CASCADE_OUTCOMES)[number];

export interface AdoptAccountNameResponse {
  readonly outcome: 'adopted' | 'unchanged';
  readonly nameCascade: NameCascadeOutcome;
}
