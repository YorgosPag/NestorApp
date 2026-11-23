/**
 * @fileoverview **ΤΕΚΜΗΡΙΑ ΔΙΑΚΟΜΙΣΤΗ ΓΙΑ ΜΙΑ ΑΝΑΓΝΩΣΗ** — ό,τι δεν μπορεί να πει το LLM για τον εαυτό του (ADR-950 §8).
 * @module server/files/evidence-corroboration
 *
 * Τρία τεκμήρια, όλα σφραγισμένα **τη στιγμή της ανάγνωσης** και αποθηκευμένα μαζί με τα `fields`:
 * 1. **consensus ψηφίων** — δεύτερη, ανεξάρτητη ανάγνωση των ψηφιακών πεδίων· διαφωνία ⇒ «Αβέβαιο» (§8.3)·
 * 2. **επαλήθευση διεύθυνσης** ως συνόλου στον χάρτη (§8.2, `evidence-address-verification`)·
 * 3. **τύπος γραμμής τηλεφώνου** (libphonenumber `/max`, μόνο στον διακομιστή) ⇒ «Οικίας» αντί «Κινητό» για σταθερό (§8.5).
 *
 * 🔑 Η αυτοδηλωμένη εμπιστοσύνη ενός LLM **δεν** είναι απόδειξη· η συμφωνία δύο ανεξάρτητων αναγνώσεων είναι το
 *    ισχυρότερο φθηνό σήμα που πιάνει «ψηφίο που διαβάστηκε αλλιώς» (self-consistency).
 * 🔑 Κανένα τεκμήριο δεν ρίχνει την ανάγνωση: αποτυχία ⇒ το τεκμήριο απλώς **λείπει** (ή `unavailable`).
 */

import 'server-only';

import { evidenceSpecOf, type EvidenceFieldKey } from '@/config/contact-document-evidence';
import { evidenceReadingKey, groundEvidence } from '@/lib/contacts/contact-evidence-grounding';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  DocumentEvidenceField,
  EvidenceAddressVerification,
  EvidenceFieldConsensus,
} from '@/schemas/ai-analysis';
import { phoneLineTypeOf } from '@/server/lib/phone-line-type';

import { verifyEvidenceAddress, type EvidenceAddressReading } from './evidence-address-verification';

const logger = createModuleLogger('evidence-corroboration');

export interface EvidenceCorroboration {
  readonly fieldConsensus?: readonly EvidenceFieldConsensus[];
  readonly addressVerification?: EvidenceAddressVerification;
  readonly phoneLineType?: string;
}

export interface EvidenceCorroborationInput {
  readonly purpose: string;
  readonly fields: readonly DocumentEvidenceField[];
  readonly recheckFields: readonly EvidenceFieldKey[];
  /** Η δεύτερη ανάγνωση — ο καλών ξέρει τον provider και το αρχείο. `null` ⇒ δεν έγινε. */
  readonly rereadDigits: (fields: readonly EvidenceFieldKey[]) => Promise<readonly DocumentEvidenceField[] | null>;
}

/** Η γειωμένη τιμή ενός πεδίου του εγγράφου (με τον ίδιο ελεγκτή και κατώφλι που θα δει ο πίνακας) — ή `null`. */
function groundedValue(purpose: string, fields: readonly DocumentEvidenceField[], key: EvidenceFieldKey): string | null {
  const spec = evidenceSpecOf(purpose, key);
  const reading = fields.find((field) => field.field === key);
  if (spec === null || reading === undefined) return null;
  const grounded = groundEvidence(spec.kind, reading.printed, reading.confidence, spec.minConfidence);
  return grounded.ok ? grounded.display : null;
}

function compareReadings(
  purpose: string,
  first: readonly DocumentEvidenceField[],
  second: readonly DocumentEvidenceField[],
  keys: readonly EvidenceFieldKey[],
): EvidenceFieldConsensus[] {
  const consensus: EvidenceFieldConsensus[] = [];
  for (const key of keys) {
    const kind = evidenceSpecOf(purpose, key)?.kind;
    const primary = first.find((f) => f.field === key)?.printed ?? null;
    const primaryKey = kind === undefined ? null : evidenceReadingKey(kind, primary);
    if (kind === undefined || primaryKey === null) continue;
    const alternate = second.find((f) => f.field === key)?.printed ?? null;
    const agreed = evidenceReadingKey(kind, alternate) === primaryKey;
    consensus.push({ field: key, state: agreed ? 'agreed' : 'disputed', alternate: agreed ? null : alternate });
  }
  return consensus;
}

async function digitConsensus(input: EvidenceCorroborationInput): Promise<readonly EvidenceFieldConsensus[] | undefined> {
  if (input.recheckFields.length === 0) return undefined;
  try {
    const second = await input.rereadDigits(input.recheckFields);
    return second === null ? undefined : compareReadings(input.purpose, input.fields, second, input.recheckFields);
  } catch (cause: unknown) {
    logger.warn('Digit re-read failed — single reading kept', { cause });
    return undefined;
  }
}

function addressReading(purpose: string, fields: readonly DocumentEvidenceField[]): EvidenceAddressReading | null {
  const street = groundedValue(purpose, fields, 'addressStreet');
  const postalCode = groundedValue(purpose, fields, 'addressPostalCode');
  if (street === null || postalCode === null) return null;
  return {
    street,
    postalCode,
    number: groundedValue(purpose, fields, 'addressNumber'),
    city: groundedValue(purpose, fields, 'addressCity'),
  };
}

/** **Τα τεκμήρια.** Παράλληλα: η δεύτερη ανάγνωση (AI) και ο χάρτης δεν εξαρτώνται ο ένας από τον άλλον. */
export async function corroborateEvidence(input: EvidenceCorroborationInput): Promise<EvidenceCorroboration> {
  const address = addressReading(input.purpose, input.fields);
  const phone = groundedValue(input.purpose, input.fields, 'phone');
  const [fieldConsensus, addressVerification] = await Promise.all([
    digitConsensus(input),
    address === null ? Promise.resolve(undefined) : verifyEvidenceAddress(address),
  ]);
  const phoneLineType = phone === null ? undefined : phoneLineTypeOf(phone);
  return {
    ...(fieldConsensus !== undefined ? { fieldConsensus } : {}),
    ...(addressVerification !== undefined ? { addressVerification } : {}),
    ...(phoneLineType !== undefined ? { phoneLineType } : {}),
  };
}
