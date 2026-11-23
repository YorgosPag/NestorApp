/**
 * @fileoverview **ΤΙ ΔΙΑΒΑΖΟΥΜΕ ΣΕ ΚΑΘΕ ΕΓΓΡΑΦΟ ΕΠΑΦΗΣ** — ο ΕΝΑΣ χάρτης `purpose → πεδία` (ADR-950 §4.1).
 * @module config/contact-document-evidence
 * @related config/upload-entry-points/entries-contact.ts (τα `purpose`) · lib/contacts/contact-evidence-comparison.ts
 *
 * Κάθε πεδίο δηλώνει **τέσσερα** πράγματα, και κανένας καταναλωτής δεν τα ξαναγράφει:
 * 1. **είδος** (`kind`) — ποιος ελεγκτής **γειώνει** την ανάγνωση και ποιος κρίνει ισότητα,
 * 2. **στόχο** στη φόρμα ανά είδος επαφής (`target`) — λείπει ⇒ το πεδίο δεν αφορά αυτό το είδος επαφής,
 * 3. **πολιτική αποδοχής** (`acceptance`) — τι κάνει το «Αποδοχή»,
 * 4. **ελάχιστη εμπιστοσύνη** της ανάγνωσης — κάτω από αυτήν ⇒ «δυσανάγνωστο», ποτέ «διαφορά».
 *
 * 🔑 Η AI ζητά **μόνο** τα πεδία του `purpose` (enum στο schema) και τα δίνει **όπως τυπώνονται**· η κανονικοποίηση
 *    είναι δική μας, ντετερμινιστική (ADR-950 §3: η λεκτική εμπιστοσύνη LLM είναι υπερβολική).
 * 🔑 Κατώφλια: κωδικοί με ψηφίο ελέγχου/σχήμα **χαμηλότερα** (η γείωση πιάνει την κακή ανάγνωση), ελεύθερο κείμενο
 *    **υψηλότερα** (καμία γείωση). Αρχικές τιμές — βαθμονόμηση στα πραγματικά έγγραφα (ADR-950 §5.3).
 */

import type { ContactType } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';

/** Η ρίζα του λεξιλογίου πεδίων εγγράφου (CHECK 3.73). */
export const EVIDENCE_FIELD_KEYS = [
  'fullName',
  'lastName',
  'firstName',
  'fatherName',
  'birthDate',
  'documentNumber',
  'documentIssuer',
  'vatNumber',
  'taxOffice',
  'addressStreet',
  'addressNumber',
  'addressPostalCode',
  'addressCity',
  'phone',
  'teeRegistryNumber',
] as const;
export type EvidenceFieldKey = (typeof EVIDENCE_FIELD_KEYS)[number];

/** Τα τέσσερα μέρη διεύθυνσης κρίνονται **μαζί**, ως μία γραμμή έδρας (ίδια σύμβαση με ADR-948 `SEAT_PARTS`). */
export const EVIDENCE_ADDRESS_FIELDS = ['addressStreet', 'addressNumber', 'addressPostalCode', 'addressCity'] as const;
export type EvidenceAddressField = (typeof EVIDENCE_ADDRESS_FIELDS)[number];

const ADDRESS_FIELD_SET: ReadonlySet<EvidenceFieldKey> = new Set(EVIDENCE_ADDRESS_FIELDS);

export function isEvidenceAddressField(key: EvidenceFieldKey): key is EvidenceAddressField {
  return ADDRESS_FIELD_SET.has(key);
}

/** Μία γραμμή του πίνακα «Το έγγραφο λέει / Η επαφή λέει»: κάθε πεδίο, εκτός από τα μέρη διεύθυνσης που γίνονται `address`. */
export type EvidenceRowKey = Exclude<EvidenceFieldKey, EvidenceAddressField> | 'address';

/** Η ρίζα του λεξιλογίου αιτιών «Αγνόησης» (σχήμα GitHub code scanning: η απόφαση λέει **γιατί**). */
export const EVIDENCE_DISMISS_REASONS = ['outdated-document', 'misread', 'other'] as const;
export type EvidenceDismissReason = (typeof EVIDENCE_DISMISS_REASONS)[number];

export type EvidenceFieldKind =
  | 'personName'
  | 'organisationName'
  | 'nameToken'
  | 'vat'
  | 'taxOffice'
  | 'text'
  | 'code'
  | 'date'
  | 'postalCode'
  | 'addressPart'
  | 'phone';

/**
 * - `form-field` — γεμίζει **ένα** πεδίο της φόρμας.
 * - `append-phone` — **προσθέτει** τηλέφωνο, ποτέ δεν αντικαθιστά (η επαφή μπορεί να έχει πολλά).
 * - `propose-address` — πρόταση στον editor διευθύνσεων (ιδιοκτήτης της έδρας), ποτέ απευθείας εγγραφή.
 * - `persona-field` — γεμίζει πεδίο persona (ADR-121) **μόνο** αν η persona είναι ενεργή (αρ. ΤΕΕ ⇒ `engineer`).
 * - `compare-only` — μόνο σύγκριση: ονοματεπώνυμο σφραγίδας. Ένα «ενιαίο» όνομα δεν σπάει με ασφάλεια σε
 *   όνομα/επώνυμο, και η αλλαγή ονόματος προσώπου είναι αλλαγή **ταυτότητας** (φρουρός ADR-249)· τη διορθώνει η ταυτότητα.
 */
export type EvidenceAcceptance = 'form-field' | 'persona-field' | 'append-phone' | 'propose-address' | 'compare-only';

/** Πεδίο της φόρμας που γράφεται ως απλό κείμενο. */
export type EvidenceFormTextField = {
  [K in keyof ContactFormData]: ContactFormData[K] extends string ? K : never;
}[keyof ContactFormData];

/**
 * Τι της επαφής συγκρίνεται: απλό πεδίο κειμένου, ή ένας από τους **σύνθετους** στόχους
 * (`personFullName` = όνομα + επώνυμο · `phones` = όλα τα τηλέφωνα · `headquarters` = θέση 0 της `companyAddresses` ·
 * `engineerTeeRegistryNumber` = `personaData.engineer.teeRegistryNumber`).
 */
export type EvidenceTarget = EvidenceFormTextField | 'personFullName' | 'phones' | 'headquarters' | 'engineerTeeRegistryNumber';

export interface EvidenceFieldSpec {
  readonly key: EvidenceFieldKey;
  readonly kind: EvidenceFieldKind;
  readonly acceptance: EvidenceAcceptance;
  /** Ανά είδος επαφής: το κείμενο της φόρμας που συγκρίνεται. Απών ⇒ το πεδίο δεν αφορά αυτό το είδος. */
  readonly target: Readonly<Partial<Record<ContactType, EvidenceTarget>>>;
  readonly minConfidence: number;
}

const CODE_CONFIDENCE = 0.6;
const TEXT_CONFIDENCE = 0.8;

function spec(key: EvidenceFieldKey, kind: EvidenceFieldKind, acceptance: EvidenceAcceptance, target: EvidenceFieldSpec['target'], minConfidence: number): EvidenceFieldSpec {
  return { key, kind, acceptance, target, minConfidence };
}

const VAT = spec('vatNumber', 'vat', 'form-field', { individual: 'vatNumber', company: 'companyVatNumber', service: 'serviceVatNumber' }, CODE_CONFIDENCE);
// Η ΔΟΥ γειώνεται στον ΚΛΕΙΣΤΟ κατάλογο (`GREEK_TAX_OFFICES`) ⇒ κωδικός, άρα κατώφλι κωδικού.
const TAX_OFFICE = spec('taxOffice', 'taxOffice', 'form-field', { individual: 'taxOffice', company: 'taxOffice', service: 'taxOffice' }, CODE_CONFIDENCE);
const FULL_NAME = spec('fullName', 'personName', 'compare-only', { individual: 'personFullName' }, TEXT_CONFIDENCE);
const ORGANISATION_NAME = spec('fullName', 'organisationName', 'form-field', { company: 'companyName', service: 'serviceName' }, TEXT_CONFIDENCE);

const ADDRESS: readonly EvidenceFieldSpec[] = [
  spec('addressStreet', 'addressPart', 'propose-address', headquartersOfAll(), TEXT_CONFIDENCE),
  spec('addressNumber', 'addressPart', 'propose-address', headquartersOfAll(), TEXT_CONFIDENCE),
  spec('addressPostalCode', 'postalCode', 'propose-address', headquartersOfAll(), CODE_CONFIDENCE),
  spec('addressCity', 'addressPart', 'propose-address', headquartersOfAll(), TEXT_CONFIDENCE),
];

function headquartersOfAll(): EvidenceFieldSpec['target'] {
  return { individual: 'headquarters', company: 'headquarters', service: 'headquarters' };
}

/** Ο χάρτης. `purpose` χωρίς γραμμή ⇒ η AI **δεν** ζητά πεδία ⇒ τίποτα δεν συγκρίνεται. */
export const CONTACT_DOCUMENT_EVIDENCE: Readonly<Record<string, readonly EvidenceFieldSpec[]>> = {
  'stamp-signature': [
    FULL_NAME,
    ORGANISATION_NAME,
    VAT,
    TAX_OFFICE,
    ...ADDRESS,
    spec('phone', 'phone', 'append-phone', { individual: 'phones', company: 'phones', service: 'phones' }, CODE_CONFIDENCE),
    spec('teeRegistryNumber', 'code', 'persona-field', { individual: 'engineerTeeRegistryNumber' }, CODE_CONFIDENCE),
  ],
  id: [
    spec('lastName', 'nameToken', 'form-field', { individual: 'lastName' }, TEXT_CONFIDENCE),
    spec('firstName', 'nameToken', 'form-field', { individual: 'firstName' }, TEXT_CONFIDENCE),
    spec('fatherName', 'nameToken', 'form-field', { individual: 'fatherName' }, TEXT_CONFIDENCE),
    spec('birthDate', 'date', 'form-field', { individual: 'birthDate' }, CODE_CONFIDENCE),
    spec('documentNumber', 'code', 'form-field', { individual: 'documentNumber' }, CODE_CONFIDENCE),
    spec('documentIssuer', 'text', 'form-field', { individual: 'documentIssuer' }, TEXT_CONFIDENCE),
  ],
  tax: [FULL_NAME, ORGANISATION_NAME, VAT, TAX_OFFICE],
};

/** Τα πεδία που ζητάμε από την AI για ένα `purpose` — μοναδικά, με τη σειρά του χάρτη. `[]` ⇒ καμία ανάγνωση. */
export function evidenceFieldKeysFor(purpose: string | null | undefined): readonly EvidenceFieldKey[] {
  const specs = purpose ? CONTACT_DOCUMENT_EVIDENCE[purpose] : undefined;
  if (specs === undefined) return [];
  return [...new Set(specs.map((s) => s.key))];
}

/** Οι γραμμές που αφορούν **αυτό** το είδος επαφής (π.χ. `fullName` = πρόσωπο σε φυσικό, επωνυμία σε εταιρεία). */
export function evidenceSpecsFor(purpose: string | null | undefined, contactType: ContactType): readonly EvidenceFieldSpec[] {
  const specs = purpose ? CONTACT_DOCUMENT_EVIDENCE[purpose] : undefined;
  return (specs ?? []).filter((s) => s.target[contactType] !== undefined);
}

/** Έχει νόημα η ανάγνωση στοιχείων για αυτό το `purpose`; */
export function purposeHasEvidence(purpose: string | null | undefined): boolean {
  return evidenceFieldKeysFor(purpose).length > 0;
}
