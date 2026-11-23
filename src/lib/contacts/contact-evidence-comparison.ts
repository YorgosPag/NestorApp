/**
 * @fileoverview **ΤΟ ΕΓΓΡΑΦΟ ΛΕΕΙ / Η ΕΠΑΦΗ ΛΕΕΙ** — η ζωντανή σύγκριση ανά γραμμή (ADR-950 §4.3).
 * @module lib/contacts/contact-evidence-comparison
 *
 * Τρέχει **πάνω στη φόρμα** (όπως το `liveRegistryComparison` του ADR-948): το «Αποδοχή» πρασινίζει τη γραμμή αμέσως,
 * και η διαφορά ξαναφαίνεται μόνη της αν αλλάξει η επαφή — **καμία** αποθηκευμένη σημαία που λέει ψέματα.
 *
 * Κρίσεις = οι 4 του `lib/comparison/field-judgment` **+ `partial`** (Yoti PARTIAL): μόνο για ονόματα, όταν το
 * `personNameMatch` λέει `fuzzy`. Ανάγνωση που **δεν γειώθηκε** ⇒ `not-comparable`, ποτέ `differs`.
 *
 * Η «Αγνόηση» (`EvidenceDismissal`) κρίνεται με το σχήμα του ADR-759: ισχύει **μόνο** όσο η τιμή του εγγράφου είναι
 * αυτή για την οποία αποφάσισε ο άνθρωπος· αλλιώς `reopened` — ξανά προς κρίση.
 *
 * **Layering**: καθαρή — καμία I/O.
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  CONTACT_DOCUMENT_EVIDENCE,
  evidenceSpecsFor,
  isEvidenceAddressField,
  purposeHasEvidence,
  type EvidenceAcceptance,
  type EvidenceAddressField,
  type EvidenceFieldKey,
  type EvidenceFieldSpec,
  type EvidenceRowKey,
  type EvidenceTarget,
} from '@/config/contact-document-evidence';
import { judge, present, type FieldComparisonState } from '@/lib/comparison/field-judgment';
import { SEAT_PARTS, seatState, type SeatFields, type SeatPart } from '@/lib/company/contact-registry-comparison';
import { sameLegalName } from '@/lib/company/legal-name-match';
import { formHeadquarters } from '@/lib/company/registry-form-acceptance';
import { contactValueKey, groundEvidence, type GroundedValue, type UngroundedReason } from '@/lib/contacts/contact-evidence-grounding';
import { sameAddressFieldValue } from '@/lib/geocoding/field-match';
import type { DocumentEvidenceField } from '@/schemas/ai-analysis';
import { getTaxOfficeDisplayName } from '@/subapps/accounting/data/greek-tax-offices';
import type { ContactType } from '@/types/contacts/contracts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { EvidenceDismissal, FileRecord } from '@/types/file-record';
import { personNameMatch } from '@/utils/greek-person-name';

export type EvidenceComparisonState = FieldComparisonState | 'partial';

/** Κλειδί γραμμής που **δεν** είναι διεύθυνση — ένα πεδίο, μία γραμμή. */
type EvidenceValueKey = Exclude<EvidenceFieldKey, EvidenceAddressField>;

/** `none` = καμία απόφαση · `dismissed` = αγνοήθηκε **αυτή** η τιμή · `reopened` = αγνοήθηκε άλλη τιμή. */
export type EvidenceDecisionState = 'none' | 'dismissed' | 'reopened';

export interface EvidenceRow {
  readonly key: EvidenceRowKey;
  readonly acceptance: EvidenceAcceptance;
  readonly target: EvidenceTarget;
  readonly state: EvidenceComparisonState;
  /** Όπως τυπώνεται στο έγγραφο — `null` = δεν βρέθηκε. Φαίνεται **πάντα**, ακόμη κι αν δεν συγκρίνεται. */
  readonly documentPrinted: string | null;
  /** Ό,τι γράφει το «Αποδοχή» — `null` = η ανάγνωση δεν γειώθηκε. */
  readonly documentDisplay: string | null;
  /** Κανονική μορφή — το κλειδί της «Αγνόησης». */
  readonly documentKey: string | null;
  readonly ungrounded: UngroundedReason | null;
  readonly contact: string | null;
  readonly decision: EvidenceDecisionState;
  readonly dismissal: EvidenceDismissal | null;
  /** Μόνο στη γραμμή `address`: κρίση ανά μέρος + οι δύο πλευρές. */
  readonly seat: EvidenceSeat | null;
}

export interface EvidenceSeat {
  readonly parts: Readonly<Record<SeatPart, FieldComparisonState>>;
  readonly document: SeatFields;
  readonly contact: SeatFields | null;
}

export interface EvidenceComparisonInput {
  readonly fields: readonly DocumentEvidenceField[];
  readonly purpose: string | null;
  readonly formData: ContactFormData;
  readonly contactType: ContactType;
  readonly dismissals: readonly EvidenceDismissal[];
}

const SEAT_PART_OF: Readonly<Record<EvidenceAddressField, SeatPart>> = {
  addressStreet: 'street',
  addressNumber: 'number',
  addressPostalCode: 'postalCode',
  addressCity: 'city',
};

const ACTIONABLE: ReadonlySet<EvidenceComparisonState> = new Set(['missing', 'differs', 'partial']);

/** Θέλει κρίση ανθρώπου; Διαφορά/κενό/μερικό **και** όχι ήδη αγνοημένο για αυτήν την τιμή. */
export function isEvidenceActionable(row: EvidenceRow): boolean {
  return ACTIONABLE.has(row.state) && row.decision !== 'dismissed';
}

function textField(formData: ContactFormData, target: EvidenceTarget): string | null {
  if (target === 'personFullName') return present(`${formData.firstName ?? ''} ${formData.lastName ?? ''}`);
  if (target === 'engineerTeeRegistryNumber') {
    const value = formData.personaData?.engineer?.teeRegistryNumber;
    return value === null || value === undefined ? null : present(String(value));
  }
  if (target === 'phones' || target === 'headquarters') return null;
  const value: unknown = formData[target];
  return typeof value === 'string' ? present(value) : null;
}

/** Όλα τα τηλέφωνα της επαφής σε μορφή που καταλαβαίνει το `normalisePhone` (εθνικός αριθμός + κωδικός χώρας). */
function contactPhones(formData: ContactFormData): readonly string[] {
  const listed = (formData.phones ?? []).map((p) => (p.number.trim().startsWith('+') ? p.number : `${p.countryCode ?? ''}${p.number}`));
  return [...listed, formData.phone].map((value) => present(value)).filter((value): value is string => value !== null);
}

function nameState(spec: EvidenceFieldSpec, contact: string, grounded: Extract<GroundedValue, { ok: true }>): EvidenceComparisonState {
  if (spec.kind === 'personName') {
    const match = personNameMatch(grounded.printed, contact);
    return match === null ? 'differs' : match === 'fuzzy' ? 'partial' : 'match';
  }
  if (spec.kind === 'organisationName') return sameLegalName(contact, grounded.printed) ? 'match' : 'differs';
  return contactValueKey(spec.kind, contact) === grounded.key ? 'match' : 'differs';
}

function judgeValue(spec: EvidenceFieldSpec, contacts: readonly string[], grounded: GroundedValue): EvidenceComparisonState {
  if (!grounded.ok) return 'not-comparable';
  if (contacts.length === 0) return 'missing';
  const states = contacts.map((contact) => nameState(spec, contact, grounded));
  if (states.includes('match')) return 'match';
  return states.includes('partial') ? 'partial' : 'differs';
}

function decisionOf(key: EvidenceRowKey, documentKey: string | null, dismissals: readonly EvidenceDismissal[]): Pick<EvidenceRow, 'decision' | 'dismissal'> {
  const dismissal = dismissals.find((d) => d.row === key) ?? null;
  if (dismissal === null) return { decision: 'none', dismissal: null };
  return { decision: dismissal.documentValueAtDecision === documentKey ? 'dismissed' : 'reopened', dismissal };
}

function readingOf(fields: readonly DocumentEvidenceField[], spec: EvidenceFieldSpec): GroundedValue {
  const reading = fields.find((field) => field.field === spec.key);
  return groundEvidence(spec.kind, reading?.printed ?? null, reading?.confidence ?? 0, spec.minConfidence);
}

function valueRow(spec: EvidenceFieldSpec, key: EvidenceValueKey, target: EvidenceTarget, input: EvidenceComparisonInput): EvidenceRow {
  const grounded = readingOf(input.fields, spec);
  const contacts = target === 'phones' ? contactPhones(input.formData) : [textField(input.formData, target)].filter((v): v is string => v !== null);
  const documentKey = grounded.ok ? grounded.key : null;
  return {
    key,
    acceptance: spec.acceptance,
    target,
    state: judgeValue(spec, contacts, grounded),
    documentPrinted: grounded.printed,
    documentDisplay: grounded.ok ? grounded.display : null,
    documentKey,
    ungrounded: grounded.ok ? null : grounded.reason,
    // Η ΔΟΥ της επαφής είναι συνήθως κωδικός (`DoyPicker`) — ο άνθρωπος βλέπει το όνομα.
    contact: contacts.map((c) => (spec.kind === 'taxOffice' ? getTaxOfficeDisplayName(c) : c)).join(' · ') || null,
    ...decisionOf(key, documentKey, input.dismissals),
    seat: null,
  };
}

const joinSeat = (seat: SeatFields): string | null => present(SEAT_PARTS.map((part) => seat[part] ?? '').join(' ').replace(/\s+/g, ' '));

interface AddressSpec {
  readonly spec: EvidenceFieldSpec;
  readonly part: SeatPart;
}

function seatParts(contact: SeatFields | null, document: SeatFields): Readonly<Record<SeatPart, FieldComparisonState>> {
  const judgePart = (part: SeatPart): FieldComparisonState =>
    judge(contact?.[part] ?? null, document[part], (a, b) => sameAddressFieldValue(part, a, b));
  return { street: judgePart('street'), number: judgePart('number'), postalCode: judgePart('postalCode'), city: judgePart('city') };
}

interface GroundedAddress {
  readonly document: SeatFields;
  readonly documentKey: string | null;
  readonly printedAny: boolean;
}

/** Η διεύθυνση του εγγράφου, γειωμένη ανά μέρος — **ένας** υπολογισμός για τον πίνακα **και** τον διακομιστή. */
function groundAddress(specs: readonly AddressSpec[], fields: readonly DocumentEvidenceField[]): GroundedAddress {
  const document: Record<SeatPart, string | null> = { street: null, number: null, postalCode: null, city: null };
  const keys: Record<SeatPart, string | null> = { ...document };
  let printedAny = false;
  for (const { spec, part } of specs) {
    const grounded = readingOf(fields, spec);
    printedAny ||= grounded.printed !== null;
    document[part] = grounded.ok ? grounded.display : null;
    keys[part] = grounded.ok ? grounded.key : null;
  }
  const documentKey = SEAT_PARTS.some((part) => keys[part] !== null) ? SEAT_PARTS.map((part) => keys[part] ?? '').join('|') : null;
  return { document, documentKey, printedAny };
}

function addressRow(specs: readonly AddressSpec[], input: EvidenceComparisonInput): EvidenceRow {
  const { document, documentKey, printedAny } = groundAddress(specs, input.fields);
  const contact = formHeadquarters(input.formData);
  const parts = seatParts(contact, document);
  return {
    key: 'address',
    acceptance: 'propose-address',
    target: 'headquarters',
    state: seatState(parts),
    documentPrinted: printedAny ? joinSeat(document) : null,
    documentDisplay: documentKey === null ? null : joinSeat(document),
    documentKey,
    ungrounded: documentKey === null ? (printedAny ? 'failed-check' : 'absent') : null,
    contact: contact === null ? null : joinSeat(contact),
    ...decisionOf('address', documentKey, input.dismissals),
    seat: { parts, document, contact },
  };
}

/** **Η σύγκριση.** Μία γραμμή ανά πεδίο του `purpose` που αφορά αυτό το είδος επαφής· η διεύθυνση = **μία** γραμμή. */
export function compareEvidenceWithForm(input: EvidenceComparisonInput): readonly EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  const addressSpecs: AddressSpec[] = [];
  for (const spec of evidenceSpecsFor(input.purpose, input.contactType)) {
    const target = spec.target[input.contactType];
    const key = spec.key;
    if (target === undefined) continue;
    if (isEvidenceAddressField(key)) addressSpecs.push({ spec, part: SEAT_PART_OF[key] });
    else rows.push(valueRow(spec, key, target, input));
  }
  if (addressSpecs.length > 0) rows.push(addressRow(addressSpecs, input));
  return rows;
}

/**
 * Το κλειδί της τιμής του **εγγράφου** για μία γραμμή — ό,τι θα κρατήσει μια «Αγνόηση». Το υπολογίζει ο **διακομιστής**
 * από την αποθηκευμένη ανάγνωση (ποτέ ο πελάτης): κανείς δεν «αγνοεί» τιμή που το έγγραφο δεν είπε. Ανεξάρτητο από
 * το είδος επαφής — η πλευρά του εγγράφου γειώνεται ίδια για όλους. `null` ⇒ τίποτα γειωμένο να αγνοηθεί.
 */
export function evidenceDocumentKey(
  fields: readonly DocumentEvidenceField[],
  purpose: string | null,
  row: EvidenceRowKey,
): string | null {
  const specs = purpose ? CONTACT_DOCUMENT_EVIDENCE[purpose] ?? [] : [];
  if (row === 'address') {
    const addressSpecs: AddressSpec[] = [];
    for (const spec of specs) {
      const key = spec.key;
      if (isEvidenceAddressField(key) && !addressSpecs.some((s) => s.spec.key === key)) addressSpecs.push({ spec, part: SEAT_PART_OF[key] });
    }
    return addressSpecs.length === 0 ? null : groundAddress(addressSpecs, fields).documentKey;
  }
  const spec = specs.find((s) => s.key === row);
  if (spec === undefined) return null;
  const grounded = readingOf(fields, spec);
  return grounded.ok ? grounded.key : null;
}

/**
 * Χρειάζεται «Ανάγνωση στοιχείων»; Αρχείο **επαφής**, ταξινομημένο, με `purpose` που έχει χάρτη πεδίων, και ανάγνωση
 * που **λείπει** ή ανήκει σε **άλλο** `purpose` (ο άνθρωπος άλλαξε τον τύπο εγγράφου μετά το ανέβασμα).
 */
export function needsEvidenceReading(file: Pick<FileRecord, 'entityType' | 'purpose' | 'ingestion'>): boolean {
  if (file.entityType !== ENTITY_TYPES.CONTACT || !purposeHasEvidence(file.purpose)) return false;
  const ingestion = file.ingestion;
  if (ingestion?.state !== 'classified') return false;
  return ingestion.analysis?.fields === undefined || ingestion.analysis.evidencePurpose !== file.purpose;
}

/** Πόσες γραμμές θέλουν κρίση — ο αριθμός του σήματος στη λίστα αρχείων. */
export function countActionableEvidence(rows: readonly EvidenceRow[]): number {
  return rows.filter(isEvidenceActionable).length;
}
