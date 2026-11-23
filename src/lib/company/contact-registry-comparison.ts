/**
 * @fileoverview **ΕΠΑΦΗ ⇄ ΓΕΜΗ, ΑΝΑ ΠΕΔΙΟ** — τι λέει η επαφή, τι λέει το μητρώο (ADR-948 §8 Βήμα 2β).
 * @module lib/company/contact-registry-comparison
 *
 * Τέσσερις κρίσεις, καθεμία οδηγεί σε **άλλη** πράξη ανθρώπου (ADR-948 §8.2 #4 — ποτέ σιωπηλή αντικατάσταση):
 * - `match` — ίδια τιμή ⇒ σήμα «Επαληθευμένο από ΓΕΜΗ».
 * - `missing` — η επαφή είναι κενή, το μητρώο έχει τιμή ⇒ «Συμπλήρωσε».
 * - `differs` — διαφορετικές τιμές ⇒ «Το ΓΕΜΗ λέει άλλο — δέξου / αγνόησε».
 * - `not-comparable` — το μητρώο δεν έχει τιμή **ή** το λεξιλόγιο της επαφής δεν έχει λέξη γι' αυτήν
 *   **ή** ο κωδικός άλλαξε νόημα στον κατάλογο ⇒ καμία πρόταση. **Ποτέ** «διαφορά» ό,τι δεν συγκρίνεται.
 *
 * 🔑 Το `registry` κάθε πεδίου είναι **ήδη στη γλώσσα της επαφής** — αυτό ακριβώς γράφει το «Δέξου».
 * Το `contact` μένει **ωμό κείμενο**: η επαφή μπορεί να κρατά παλιά τιμή εκτός λεξιλογίου (⇒ `differs`).
 *
 * ⛔ Παίρνει ετυμηγορία `entity` του φράχτη (`classifyRegistryLegalForm`), όχι σκέτη νομική μορφή: ο τύπος
 * **δεν αφήνει** σύγκριση πριν από τον φράχτη «όχι φυσικό πρόσωπο» (ADR-948 §8.3).
 *
 * Κρίσεις που **δεν** ξαναγράφονται εδώ: επωνυμία/τίτλος → `sameLegalName` · Αρ. ΓΕΜΗ →
 * `canonicalGemiNumber` · μέρος διεύθυνσης → `sameAddressFieldValue` · ολίσθηση καταλόγου → `sameDescription`.
 *
 * **Layering**: καθαρή — καμία εισαγωγή I/O. Ο καλών αντιστοιχίζει το έγγραφο επαφής στο `ContactRegistryFields`
 * (έδρα = **θέση 0** της `companyAddresses`, `components/contacts/dynamic/contact-hq-state.ts`).
 */

import {
  findGemiCompanyStatus,
  type ContactGemiStatus,
  type ContactLegalForm,
} from '@/config/company-registry/gemi-legal-forms';
import { sameAddressFieldValue } from '@/lib/geocoding/field-match';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { sameLegalName } from '@/lib/company/legal-name-match';
import { sameDescription, type LegalSubjectVerdict } from '@/lib/company/registry-legal-person';
import type { RegistryCompanyRecord, RegistrySeat, RegistryStatus } from '@/types/company-registry';

export type FieldComparisonState = 'match' | 'missing' | 'differs' | 'not-comparable';

/** `R` = η τιμή του μητρώου στη γλώσσα της επαφής · `C` = η τιμή της επαφής όπως είναι αποθηκευμένη. */
export interface FieldComparison<R, C = string> {
  readonly state: FieldComparisonState;
  /** `null` = κενή. */
  readonly contact: C | null;
  /** `null` = τίποτα συγκρίσιμο. */
  readonly registry: R | null;
}

export const SEAT_PARTS = ['street', 'number', 'postalCode', 'city'] as const;
export type SeatPart = (typeof SEAT_PARTS)[number];
export type SeatFields = Readonly<Record<SeatPart, string | null>>;

export interface SeatComparison extends FieldComparison<SeatFields, SeatFields> {
  /** Ανά μέρος — ο άνθρωπος βλέπει **ποιο** μέρος της έδρας διαφέρει. */
  readonly parts: Readonly<Record<SeatPart, FieldComparisonState>>;
}

/** Ό,τι κρατά η επαφή για τα έξι πεδία της φάσης 1 (ADR-948 §8.5). */
export interface ContactRegistryFields {
  readonly companyName: string | null;
  readonly tradeName: string | null;
  readonly gemiNumber: string | null;
  readonly legalForm: string | null;
  readonly gemiStatus: string | null;
  /** Η έδρα (θέση 0) — `null` όταν η επαφή δεν έχει διεύθυνση. */
  readonly headquarters: SeatFields | null;
}

export interface ContactRegistryComparison {
  readonly legalName: FieldComparison<string>;
  readonly distinctiveTitle: FieldComparison<string>;
  readonly gemiNumber: FieldComparison<string>;
  readonly legalForm: FieldComparison<ContactLegalForm>;
  readonly status: FieldComparison<ContactGemiStatus>;
  readonly seat: SeatComparison;
}

export type EntityVerdict = Extract<LegalSubjectVerdict, { kind: 'entity' }>;

type Same = (contact: string, registry: string) => boolean;

/** Κενό κείμενο = απουσία. */
function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Ο ένας κανόνας των τεσσάρων κρίσεων — το μητρώο πρώτα: χωρίς δική του τιμή, τίποτα δεν συγκρίνεται. */
function judge(contact: string | null, registry: string | null, same: Same): FieldComparisonState {
  if (registry === null) return 'not-comparable';
  if (contact === null) return 'missing';
  return same(contact, registry) ? 'match' : 'differs';
}

function compareValue<R extends string>(contactValue: string | null, registry: R | null, same: Same): FieldComparison<R> {
  const contact = present(contactValue);
  return { state: judge(contact, registry, same), contact, registry };
}

const sameCode: Same = (contact, registry) => contact === registry;

/** Ο τίτλος ταιριάζει με **οποιονδήποτε** του μητρώου (`coTitlesEl` = πίνακας). Πρόταση = ο ταιριαστός, αλλιώς ο πρώτος. */
function compareDistinctiveTitle(contactValue: string | null, titles: readonly string[]): FieldComparison<string> {
  const contact = present(contactValue);
  const candidates = titles.map(present).filter((title): title is string => title !== null);
  const matched = contact === null ? undefined : candidates.find((title) => sameLegalName(contact, title));
  return compareValue(contactValue, matched ?? candidates[0] ?? null, sameLegalName);
}

/** Αρ. ΓΕΜΗ σε κανονική μορφή· μη αριθμός στην επαφή ⇒ `differs` (το μητρώο τον διορθώνει). */
function compareGemiNumber(contactValue: string | null, registryValue: string): FieldComparison<string> {
  const registry = canonicalGemiNumber(registryValue);
  return compareValue(contactValue, registry, (contact) => canonicalGemiNumber(contact) === registry);
}

/**
 * Κατάσταση: `match` αν η τιμή της επαφής **ανήκει** στο σύνολο που λέει το ίδιο (π.χ. «Λύση - Εκκαθάριση» ⇒
 * `liquidation` **ή** `dissolution`). Πρόταση = η πρώτη του συνόλου. Άγνωστος κωδικός, ολίσθηση περιγραφής
 * ή κενό σύνολο ⇒ `not-comparable` — ποτέ μαντεψιά.
 */
function comparableStatuses(status: RegistryStatus): readonly ContactGemiStatus[] {
  if (status.code === null) return [];
  const entry = findGemiCompanyStatus(status.code.id);
  if (entry === null || !sameDescription(status.code.label, entry.descr)) return [];
  return entry.contactStatuses;
}

function compareStatus(contactValue: string | null, status: RegistryStatus): FieldComparison<ContactGemiStatus> {
  const statuses = comparableStatuses(status);
  const accepted: readonly string[] = statuses;
  const registry = statuses[0] ?? null;
  return compareValue(contactValue, registry, (contact) => accepted.includes(contact));
}

function seatOf(source: Readonly<Record<SeatPart, string | null>> | null): SeatFields {
  return {
    street: present(source?.street),
    number: present(source?.number),
    postalCode: present(source?.postalCode),
    city: present(source?.city),
  };
}

/**
 * **Ο αριθμός «0» του ΓΕΜΗ σημαίνει «χωρίς αριθμό»** (ADR-948 §8.7.1 — ζωντανή μέτρηση 2026-11-23, ARIES Α.Ε.:
 * «ΚΑΛΒΟΥ ΚΑΙ ΙΠΠΟΔΡΟΜΙΟΥ · Αριθμός 0»). Ελληνική διεύθυνση δεν έχει αριθμό μηδέν· αν περνούσε, θα γινόταν
 * «Λείπει από την επαφή» + πρόταση έδρας με αριθμό που κανείς δεν είπε, και ο geocoder θα έψαχνε κτίριο «0».
 * 🔑 Εδώ, όχι στον parser: η εγγραφή κρατά **ό,τι είπε** το μητρώο· η **ερμηνεία** ζει στη σύγκριση — και
 *    καλύπτει έτσι και τους ήδη αποθηκευμένους ελέγχους (μοναδικός καταναλωτής του `RegistrySeat.streetNumber`).
 */
const REGISTRY_NO_STREET_NUMBER = /^0+$/;

function registryStreetNumber(value: string | null): string | null {
  const number = present(value);
  return number !== null && REGISTRY_NO_STREET_NUMBER.test(number) ? null : number;
}

function registrySeatFields(seat: RegistrySeat): SeatFields {
  return seatOf({ street: seat.street, number: registryStreetNumber(seat.streetNumber), postalCode: seat.postalCode, city: seat.city });
}

/** Συνολική κρίση έδρας: μία διαφορά αρκεί· αλλιώς ένα κενό· αλλιώς ταύτιση. */
function seatState(parts: Readonly<Record<SeatPart, FieldComparisonState>>): FieldComparisonState {
  const states = SEAT_PARTS.map((part) => parts[part]);
  if (states.every((state) => state === 'not-comparable')) return 'not-comparable';
  if (states.includes('differs')) return 'differs';
  return states.includes('missing') ? 'missing' : 'match';
}

/** Έδρα ανά μέρος, με την **ίδια** κρίση πεδίου που έχει ο γεωκωδικοποιητής (Τ.Κ. «546 24» = «54624», οικισμοί). */
function compareSeat(headquarters: SeatFields | null, seat: RegistrySeat): SeatComparison {
  const contact = seatOf(headquarters);
  const registry = registrySeatFields(seat);
  const judgePart = (part: SeatPart): FieldComparisonState =>
    judge(contact[part], registry[part], (a, b) => sameAddressFieldValue(part, a, b));
  const parts = {
    street: judgePart('street'),
    number: judgePart('number'),
    postalCode: judgePart('postalCode'),
    city: judgePart('city'),
  };
  const empty = (fields: SeatFields): boolean => SEAT_PARTS.every((part) => fields[part] === null);
  return { state: seatState(parts), parts, contact: empty(contact) ? null : contact, registry: empty(registry) ? null : registry };
}

/** **Η σύγκριση.** Τρέχει μόνο πάνω σε απάντηση που πέρασε τον φράχτη (`verdict.kind === 'entity'`). */
export function compareContactWithRegistry(
  contact: ContactRegistryFields,
  record: RegistryCompanyRecord,
  verdict: EntityVerdict,
): ContactRegistryComparison {
  return {
    legalName: compareValue(contact.companyName, present(record.legalName), sameLegalName),
    distinctiveTitle: compareDistinctiveTitle(contact.tradeName, record.distinctiveTitles),
    gemiNumber: compareGemiNumber(contact.gemiNumber, record.registrationNumber),
    legalForm: compareValue(contact.legalForm, verdict.entry.contactLegalForm, sameCode),
    status: compareStatus(contact.gemiStatus, record.status),
    seat: compareSeat(contact.headquarters, record.seat),
  };
}
