/**
 * @fileoverview **Η ΦΟΡΜΑ ⇄ ΤΟ ΓΕΜΗ** — ζωντανή σύγκριση και «Δέξου» ανά πεδίο (ADR-948 §8 Βήμα 7).
 * @module lib/company/registry-form-acceptance
 *
 * Καθαρές συναρτήσεις, χωρίς I/O (άγκυρες). Η σύγκριση τρέχει **πάνω στη φόρμα**, όχι στο αποθηκευμένο έγγραφο:
 * το «Δέξου» πρασινίζει τη γραμμή αμέσως, και αν ο άνθρωπος αλλάξει την τιμή το σήμα «Επαληθευμένο» σβήνει μόνο
 * του — **καμία** αποθηκευμένη σημαία που μπορεί να πει ψέματα (§8.2 #5).
 *
 * 🔑 Ο φράχτης «όχι φυσικό πρόσωπο» ρωτιέται **ξανά** εδώ (`classifyRegistryLegalForm`): αποθηκευμένη απάντηση που
 *    δεν περνά πια (άλλαξε ο χάρτης) ⇒ καμία σύγκριση, ίδια κρίση με τον server.
 * 🔑 Το «Δέξου» **μόνο** γεμίζει τη φόρμα — η εγγραφή περνά από την υπάρχουσα αποθήκευση (φρουρός ADR-278,
 *    Ιστορικό CDC). Η έδρα **δεν** γράφεται εδώ: ανήκει στον επεξεργαστή διευθύνσεων (θέση χάρτη · `verifiedAt`)·
 *    από εδώ βγαίνει μόνο ως **πρόταση** (`registrySeatAsAddressFields`), που την εφαρμόζει ο ιδιοκτήτης της.
 */

import { canonicalLegalForm } from '@/lib/contact/legal-form-vocabulary';
import {
  compareContactWithRegistry,
  type ContactRegistryComparison,
  type ContactRegistryFields,
  type SeatFields,
} from '@/lib/company/contact-registry-comparison';
import { classifyRegistryLegalForm } from '@/lib/company/registry-legal-person';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import type { RegistryCheck } from '@/types/company-registry';
import type { ContactFormData } from '@/types/ContactFormTypes';

/** Τα πεδία που δέχεται η φόρμα **απευθείας** — η έδρα μένει έξω (βλ. κεφαλίδα). */
export const ACCEPTABLE_REGISTRY_FIELDS = ['legalName', 'distinctiveTitle', 'gemiNumber', 'legalForm', 'status'] as const;
export type AcceptableRegistryField = (typeof ACCEPTABLE_REGISTRY_FIELDS)[number];

/** Ποιο πεδίο της φόρμας γεμίζει κάθε γραμμή — ο **ένας** χάρτης. */
const FORM_FIELD_OF = {
  legalName: 'companyName',
  distinctiveTitle: 'tradeName',
  gemiNumber: 'gemiNumber',
  legalForm: 'legalForm',
  status: 'gemiStatus',
} as const satisfies Record<AcceptableRegistryField, keyof ContactFormData>;

function textOrNull(value: string | undefined | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Η έδρα της φόρμας = **θέση 0** της λίστας — ίδια σύμβαση με τον server (`contactRegistryFieldsOf`). */
function formHeadquarters(formData: ContactFormData): SeatFields | null {
  const hq = formData.companyAddresses?.[0];
  if (hq === undefined) return null;
  return {
    street: textOrNull(hq.street),
    number: textOrNull(hq.number),
    postalCode: textOrNull(hq.postalCode),
    city: textOrNull(hq.city),
  };
}

/** Η φόρμα ⇒ τα έξι πεδία της φάσης 1, με την **ίδια** ανεκτική ανάγνωση νομικής μορφής που έχει ο server. */
export function formRegistryFieldsOf(formData: ContactFormData): ContactRegistryFields {
  return {
    companyName: textOrNull(formData.companyName),
    tradeName: textOrNull(formData.tradeName),
    gemiNumber: textOrNull(formData.gemiNumber),
    legalForm: canonicalLegalForm(formData.legalForm) ?? textOrNull(formData.legalForm),
    gemiStatus: textOrNull(formData.gemiStatus),
    headquarters: formHeadquarters(formData),
  };
}

/** Η σύγκριση **τώρα**: φόρμα ⇄ αποθηκευμένη απάντηση. `null` ⇒ καμία απάντηση ή δεν περνά πια τον φράχτη. */
export function liveRegistryComparison(formData: ContactFormData, check: RegistryCheck | null): ContactRegistryComparison | null {
  if (check === null) return null;
  const verdict = classifyRegistryLegalForm(check.record.legalForm);
  if (verdict.kind !== 'entity') return null;
  return compareContactWithRegistry(formRegistryFieldsOf(formData), check.record, verdict);
}

/** Αξίζει «Δέξου»; Μόνο όταν το ΓΕΜΗ έχει τιμή **και** η φόρμα λείπει ή διαφέρει. */
export function canAcceptRegistryField(comparison: ContactRegistryComparison, field: AcceptableRegistryField): boolean {
  const row = comparison[field];
  return row.registry !== null && (row.state === 'missing' || row.state === 'differs');
}

/** «Δέξου»: νέα `formData` με την τιμή του ΓΕΜΗ στο **ένα** πεδίο — τίποτα άλλο δεν αγγίζεται. */
export function acceptRegistryField(
  formData: ContactFormData,
  comparison: ContactRegistryComparison,
  field: AcceptableRegistryField,
): ContactFormData {
  if (!canAcceptRegistryField(comparison, field)) return formData;
  return { ...formData, [FORM_FIELD_OF[field]]: comparison[field].registry };
}

/**
 * Αξίζει πρόταση έδρας; Ίδιος κανόνας με τα πεδία: το ΓΕΜΗ έχει έδρα **και** η φόρμα λείπει ή διαφέρει.
 * Η έδρα **δεν** γράφεται από εδώ — πηγαίνει ως πρόταση στον ιδιοκτήτη της (`hq-address-proposal-store`).
 */
export function canProposeRegistrySeat(comparison: ContactRegistryComparison): boolean {
  const { seat } = comparison;
  return seat.registry !== null && (seat.state === 'missing' || seat.state === 'differs');
}

/**
 * **Πώς εφαρμόζεται η έδρα του ΓΕΜΗ** (ADR-948 §8.7.4):
 * - `complete` — η **ίδια** διεύθυνση με κενά (`seat.state === 'missing'`): το ΓΕΜΗ συμπληρώνει, ό,τι δεν ξέρει
 *   μένει της φόρμας.
 * - `replace` — **άλλη** διεύθυνση (`seat.state === 'differs'`): αντικαθίσταται **ολόκληρη**. Ό,τι δεν ξέρει το ΓΕΜΗ
 *   **αδειάζει**, γιατί ανήκε στην παλιά διεύθυνση (ο αριθμός «10» της Ερμού δεν είναι αριθμός της Κάλβου).
 *
 * 🔑 Η κρίση «ίδια ή άλλη» **δεν** ξαναγίνεται εδώ: είναι η κρίση της σύγκρισης (`seatState` · μία διαφορά αρκεί).
 */
export type RegistrySeatApplication = 'complete' | 'replace';

export function registrySeatApplicationOf(comparison: ContactRegistryComparison): RegistrySeatApplication {
  return comparison.seat.state === 'differs' ? 'replace' : 'complete';
}

/**
 * Η έδρα του ΓΕΜΗ στο λεξιλόγιο του `AddressEditor`. `undefined` = απών ⇒ ο γραφέας κρατά ό,τι έχει η φόρμα
 * (`applyResolvedToContactAddress`: `resolved.x ?? existing.x`) · `''` = καθαρίζει.
 * Η «Περιοχή / Συνοικία» δεν υπάρχει στο ΓΕΜΗ: στην αντικατάσταση αδειάζει κι αυτή (ανήκε στην παλιά διεύθυνση).
 */
export function registrySeatAsAddressFields(seat: SeatFields, application: RegistrySeatApplication): ResolvedAddressFields {
  const unknown = application === 'replace' ? '' : undefined;
  return {
    street: seat.street ?? unknown,
    number: seat.number ?? unknown,
    postalCode: seat.postalCode ?? unknown,
    city: seat.city ?? unknown,
    neighborhood: unknown,
  };
}
