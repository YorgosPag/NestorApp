/**
 * @fileoverview **ΤΟ ΕΓΓΡΑΦΟ ΛΕΕΙ / Η ΕΠΑΦΗ ΛΕΕΙ** — η ζωντανή σύγκριση ανά γραμμή (ADR-950 §4.3 · §8).
 * @module lib/contacts/contact-evidence-comparison
 *
 * Τρέχει **πάνω στη φόρμα** (όπως το `liveRegistryComparison` του ADR-948): το «Αποδοχή» πρασινίζει τη γραμμή αμέσως,
 * και η διαφορά ξαναφαίνεται μόνη της αν αλλάξει η επαφή — **καμία** αποθηκευμένη σημαία που λέει ψέματα.
 *
 * Κρίσεις = οι 4 του `lib/comparison/field-judgment` **+ `partial`** (Yoti PARTIAL): μόνο για ονόματα, όταν το
 * `personNameMatch` λέει `fuzzy`. Ανάγνωση που **δεν γειώθηκε** ⇒ `not-comparable`, ποτέ `differs`.
 *
 * ADR-950 §8 — τα **τεκμήρια διακομιστή** (`EvidenceCorroborationView`) μπαίνουν εδώ, σε **ένα** σημείο, ώστε πίνακας
 * (πελάτης) και «Αγνόηση» (διακομιστής) να βλέπουν την ίδια τιμή:
 * - διαφωνία δεύτερης ανάγνωσης ⇒ `disputed` (καμία αποδοχή, φαίνονται και οι δύο τιμές)·
 * - διεύθυνση: `confirmed` ⇒ κανονικά · `corrected` ⇒ η υπαρκτή οδός («Μήπως…») · αλλιώς ⇒ `unverified`, καμία πρόταση.
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
import type { DocumentEvidenceField, EvidenceAddressVerification, EvidenceFieldConsensus } from '@/schemas/ai-analysis';
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

/** Τα τεκμήρια διακομιστή της ανάγνωσης (ADR-950 §8) — όπως αποθηκεύονται στο `ingestion.analysis`. */
export interface EvidenceCorroborationView {
  readonly fieldConsensus?: readonly EvidenceFieldConsensus[];
  readonly addressVerification?: EvidenceAddressVerification;
  readonly phoneLineType?: string;
}

/** Η αποθηκευμένη ανάγνωση: πεδία + τεκμήρια. */
export interface EvidenceReading extends EvidenceCorroborationView {
  readonly fields: readonly DocumentEvidenceField[];
}

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
  /** `disputed`: ό,τι διάβασε η **δεύτερη** ανάγνωση (`null` = ένα ψηφίο δεν διαβαζόταν καθαρά). */
  readonly documentAlternate: string | null;
  /** Διεύθυνση `corrected`: η οδός **όπως τυπώθηκε** — το `documentDisplay` φέρει την υπαρκτή («Μήπως…»). */
  readonly correctedFrom: string | null;
  /** Τηλέφωνο: τύπος γραμμής κατά libphonenumber, από τον διακομιστή (ADR-950 §8.5). */
  readonly phoneLineType: string | null;
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
  readonly reading: EvidenceReading;
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

const disputeOf = (reading: EvidenceReading, key: EvidenceFieldKey): EvidenceFieldConsensus | null =>
  reading.fieldConsensus?.find((c) => c.field === key && c.state === 'disputed') ?? null;

/** Γείωση **και** τεκμήρια: διαφωνία δεύτερης ανάγνωσης ⇒ `disputed`, όσο καθαρή κι αν φαίνεται η πρώτη. */
function readingOf(reading: EvidenceReading, spec: EvidenceFieldSpec): GroundedValue {
  const field = reading.fields.find((f) => f.field === spec.key);
  const places = reading.addressVerification?.places;
  const grounded = groundEvidence(spec.kind, field?.printed ?? null, field?.confidence ?? 0, spec.minConfidence, { places });
  if (grounded.ok && disputeOf(reading, spec.key) !== null) return { ok: false, printed: grounded.printed, reason: 'disputed' };
  return grounded;
}

function valueRow(spec: EvidenceFieldSpec, key: EvidenceValueKey, target: EvidenceTarget, input: EvidenceComparisonInput): EvidenceRow {
  const grounded = readingOf(input.reading, spec);
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
    documentAlternate: grounded.ok ? null : disputeOf(input.reading, key)?.alternate ?? null,
    correctedFrom: null,
    phoneLineType: spec.kind === 'phone' ? input.reading.phoneLineType ?? null : null,
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
  /** Ό,τι διαβάστηκε (γειωμένο ανά μέρος) — για την οθόνη. */
  readonly printed: SeatFields;
  /** Ό,τι προτείνεται — με την υπαρκτή οδό όταν ο χάρτης τη διόρθωσε. */
  readonly document: SeatFields;
  readonly documentKey: string | null;
  readonly printedAny: boolean;
  readonly ungrounded: UngroundedReason | null;
  readonly correctedFrom: string | null;
}

/** Γειωμένα μέρη + αν κάποιο αμφισβητήθηκε από τη δεύτερη ανάγνωση. */
function groundParts(specs: readonly AddressSpec[], reading: EvidenceReading) {
  const parts: Record<SeatPart, GroundedValue | null> = { street: null, number: null, postalCode: null, city: null };
  for (const { spec, part } of specs) parts[part] = readingOf(reading, spec);
  const pick = (part: SeatPart, which: 'display' | 'key'): string | null => {
    const grounded = parts[part];
    return grounded !== null && grounded.ok ? grounded[which] : null;
  };
  const value = (part: SeatPart): string | null => pick(part, 'display');
  const key = (part: SeatPart): string | null => pick(part, 'key');
  const printed: SeatFields = { street: value('street'), number: value('number'), postalCode: value('postalCode'), city: value('city') };
  const disputed = SEAT_PARTS.some((part) => {
    const grounded = parts[part];
    return grounded !== null && !grounded.ok && grounded.reason === 'disputed';
  });
  const printedAny = SEAT_PARTS.some((part) => parts[part] !== null && parts[part]?.printed !== null);
  return { printed, key, disputed, printedAny };
}

/** Ο χάρτης κρίνει: καμία επαλήθευση (παλιά ανάγνωση · χάρτης εκτός) ή «δεν βρέθηκε» ⇒ `unverified`. */
function mapVerdict(verification: EvidenceAddressVerification | undefined): 'confirmed' | 'corrected' | 'unverified' {
  if (verification?.verdict === 'confirmed') return 'confirmed';
  return verification?.verdict === 'corrected' && verification.correctedStreet !== undefined ? 'corrected' : 'unverified';
}

/** Η διεύθυνση του εγγράφου — **ένας** υπολογισμός για τον πίνακα **και** τον διακομιστή. */
function groundAddress(specs: readonly AddressSpec[], reading: EvidenceReading): GroundedAddress {
  const { printed, key, disputed, printedAny } = groundParts(specs, reading);
  const failed = (ungrounded: UngroundedReason): GroundedAddress =>
    ({ printed, document: printed, documentKey: null, printedAny, ungrounded, correctedFrom: null });
  if (!SEAT_PARTS.some((part) => printed[part] !== null)) return failed(printedAny ? 'failed-check' : 'absent');
  if (disputed) return failed('disputed');
  const verdict = mapVerdict(reading.addressVerification);
  if (verdict === 'unverified') return failed('unverified');
  const corrected = verdict === 'corrected' ? reading.addressVerification?.correctedStreet ?? null : null;
  const document: SeatFields = corrected === null ? printed : { ...printed, street: corrected };
  const streetKey = corrected === null ? key('street') : contactValueKey('addressPart', corrected);
  const keys = SEAT_PARTS.map((part) => (part === 'street' ? streetKey : key(part)) ?? '');
  return { printed, document, documentKey: keys.join('|'), printedAny, ungrounded: null, correctedFrom: corrected === null ? null : printed.street };
}

function addressRow(specs: readonly AddressSpec[], input: EvidenceComparisonInput): EvidenceRow {
  const grounded = groundAddress(specs, input.reading);
  const contact = formHeadquarters(input.formData);
  const parts = seatParts(contact, grounded.document);
  return {
    key: 'address',
    acceptance: 'propose-address',
    target: 'headquarters',
    state: grounded.documentKey === null ? 'not-comparable' : seatState(parts),
    documentPrinted: grounded.printedAny ? joinSeat(grounded.printed) : null,
    documentDisplay: grounded.documentKey === null ? null : joinSeat(grounded.document),
    documentKey: grounded.documentKey,
    ungrounded: grounded.ungrounded,
    documentAlternate: null,
    correctedFrom: grounded.correctedFrom,
    phoneLineType: null,
    contact: contact === null ? null : joinSeat(contact),
    ...decisionOf('address', grounded.documentKey, input.dismissals),
    seat: { parts, document: grounded.document, contact },
  };
}

function addressSpecsOf(specs: readonly EvidenceFieldSpec[]): AddressSpec[] {
  const result: AddressSpec[] = [];
  for (const spec of specs) {
    const key = spec.key;
    if (isEvidenceAddressField(key) && !result.some((s) => s.spec.key === key)) result.push({ spec, part: SEAT_PART_OF[key] });
  }
  return result;
}

/** **Η σύγκριση.** Μία γραμμή ανά πεδίο του `purpose` που αφορά αυτό το είδος επαφής· η διεύθυνση = **μία** γραμμή. */
export function compareEvidenceWithForm(input: EvidenceComparisonInput): readonly EvidenceRow[] {
  const specs = evidenceSpecsFor(input.purpose, input.contactType);
  const rows: EvidenceRow[] = [];
  for (const spec of specs) {
    const target = spec.target[input.contactType];
    const key = spec.key;
    if (target !== undefined && !isEvidenceAddressField(key)) rows.push(valueRow(spec, key, target, input));
  }
  const addressSpecs = addressSpecsOf(specs);
  if (addressSpecs.length > 0) rows.push(addressRow(addressSpecs, input));
  return rows;
}

/**
 * Το κλειδί της τιμής του **εγγράφου** για μία γραμμή — ό,τι θα κρατήσει μια «Αγνόηση». Το υπολογίζει ο **διακομιστής**
 * από την αποθηκευμένη ανάγνωση **και τα τεκμήριά της** (ποτέ ο πελάτης): κανείς δεν «αγνοεί» τιμή που το έγγραφο δεν
 * είπε. Ανεξάρτητο από το είδος επαφής — η πλευρά του εγγράφου γειώνεται ίδια για όλους. `null` ⇒ τίποτα γειωμένο.
 */
export function evidenceDocumentKey(reading: EvidenceReading, purpose: string | null, row: EvidenceRowKey): string | null {
  const specs = purpose ? CONTACT_DOCUMENT_EVIDENCE[purpose] ?? [] : [];
  if (row === 'address') {
    const addressSpecs = addressSpecsOf(specs);
    return addressSpecs.length === 0 ? null : groundAddress(addressSpecs, reading).documentKey;
  }
  const spec = specs.find((s) => s.key === row);
  if (spec === undefined) return null;
  const grounded = readingOf(reading, spec);
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
