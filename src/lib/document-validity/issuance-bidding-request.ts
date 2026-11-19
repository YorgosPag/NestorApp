/**
 * =============================================================================
 * Μητρώο λήξεων — το ΣΥΡΜΑ του αιτήματος προσφορών (ADR-945 §7.5)
 * =============================================================================
 *
 * **Τι στέλνει ο πελάτης** για πρόσκληση · ανάθεση · ακύρωση, και **τι του απαντά** ο διακομιστής όταν αρνείται. Ο ΕΝΑΣ
 * πίνακας αρνήσεων ({@link ISSUANCE_REQUEST_ERROR_CODES}) τον διαβάζουν η πύλη (HTTP) **και** η οθόνη (κλειδί μηνύματος).
 *
 * 🔑 **CAS σε δύο επίπεδα** — όπως το μοντέλο (Coupa · PeopleSoft Sourcing): ο **κύκλος** που είδε ο άνθρωπος
 *    (`expectedCycle`, `null` = κανένα αίτημα) **και** το στάδιο **κάθε** προσφοράς που θα αγγίξει η πράξη
 *    (`expectedStages`). Ό,τι άλλαξε στο μεταξύ ⇒ `stale`, ποτέ ανάθεση ή ακύρωση πάνω σε κάτι που δεν είδε.
 * 🔑 **Ο επαγγελματίας είναι βιτρίνα του `/pro`** (`professionalCompanyId`): το προσόν **παράγεται** στον διακομιστή από
 *    τη δηλωμένη άδεια της βιτρίνας — ο πελάτης δεν δηλώνει προσόν (ADR-945 §7.1 Δ4).
 * 🔒 Ο ιδιώτης δεν δηλώνει ποτέ βιβλίο, κάτοχο ή `bidId` νέας προσφοράς: τα παράγει ο κριτής υποκειμένου.
 *
 * **Layering**: leaf — σχήματα και σταθερές, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-bidding-request
 */

import { z } from 'zod';

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import type { IssuanceAssignmentRecord } from './issuance-assignment';
import { ISSUANCE_REQUEST_POLICY, type IssuanceRequestRecord } from './issuance-bidding';
import { ISSUANCE_STAGES, type IssuanceStage } from './issuance-stage';

const nonEmpty = z.string().trim().min(1);

const target = {
  propertyId: nonEmpty,
  documentKind: z.enum(DOCUMENT_KINDS),
};

/** Το στάδιο **κάθε** προσφοράς του κύκλου όπως το είδε ο άνθρωπος — `null` = κλειστή (ή καμία). */
const expectedStages = z.record(nonEmpty, z.enum(ISSUANCE_STAGES).nullable())
  .refine((stages) => Object.keys(stages).length <= ISSUANCE_REQUEST_POLICY.maxBids);

const cycle = z.number().int().min(1);

export const issuanceRequestBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), ...target, professionalCompanyId: nonEmpty, expectedCycle: cycle.nullable() }),
  z.object({
    action: z.literal('award'),
    ...target,
    bidId: nonEmpty,
    expectedCycle: cycle,
    /** §42 — η αναθεώρηση της προσφοράς που **είδε** ο ιδιώτης (ποτέ «ναι» σε τιμή που δεν είδε). */
    quoteRevision: z.number().int().min(1),
    expectedStages,
  }),
  z.object({ action: z.literal('cancel'), ...target, expectedCycle: cycle, expectedStages }),
]);

export type IssuanceRequestBody = z.infer<typeof issuanceRequestBody>;

export const issuanceRequestQuery = z.object(target);

/**
 * Μία προσφορά όπως τη βλέπει η οθόνη — το στάδιο το κρίνει ο διακομιστής με τον ΙΔΙΟ πυρήνα (`issuanceStateOf`).
 * Ζει **εδώ**, στο σύρμα, ώστε ο διακομιστής που τη γράφει και η οθόνη που τη διαβάζει να μοιράζονται **έναν** ορισμό.
 */
export interface IssuanceBidView {
  readonly bidId: string;
  /** `null` = κλειστή (απορρίφθηκε · ακυρώθηκε · ολοκληρώθηκε) ή δεν γράφτηκε ακόμη. */
  readonly stage: IssuanceStage | null;
  readonly record: IssuanceAssignmentRecord | null;
}

/** Το αίτημα και οι προσφορές του **τρέχοντος** κύκλου (`null` = κανένα αίτημα ακόμη). */
export interface IssuanceBiddingView {
  readonly request: IssuanceRequestRecord | null;
  readonly bids: readonly IssuanceBidView[];
}

/**
 * Η απόκριση του `GET` — `canAct` = ο διακομιστής λέει αν το `PUT` θα επιτραπεί, με τον ΙΔΙΟ κανόνα (Google Drive
 * `capabilities`)· η οθόνη δεν το κρίνει.
 */
export interface IssuanceBiddingResponse extends IssuanceBiddingView {
  readonly canAct: boolean;
}

/**
 * Κάθε άρνηση λέει στον άνθρωπο κάτι διαφορετικό — **κλειστό** σύνολο, χωρίς `default` πουθενά:
 * - `absent` · `retired` — το ακίνητο δεν είναι δικό του (≡ ανύπαρκτο) ή είναι αποσυρμένο (ADR-281)·
 * - `not-assignable` — στο μητρώο του γραφείου αυτή η γραμμή δεν ζητά ανάθεση·
 * - `office-ledger` — αίτημα προσφορών σε βιβλίο **γραφείου**: εκτός Φ1 (το γραφείο έχει την απευθείας ανάθεση §27)·
 * - `unavailable` — κάτι που χρειάζεται η κρίση δεν διαβάστηκε τώρα (ποτέ πράξη από άγνοια)·
 * - `professional-unavailable` — η βιτρίνα δεν υπάρχει ή δεν είναι δημόσια· `unqualified` — δεν εκδίδει αυτό το είδος·
 * - `stale` — ο κύκλος ή κάποια προσφορά άλλαξε από ό,τι είδε ο άνθρωπος·
 * - του μειωτή του αιτήματος: `bid-limit` · `already-awarded` · `unknown-bid` · `request-closed`·
 * - του μειωτή της ανάθεσης: `transition-refused` · `actor-refused` · `terms-refused` · `receipt-mismatch`.
 */
export const ISSUANCE_REQUEST_REFUSALS = [
  'absent', 'retired', 'not-assignable', 'office-ledger', 'unavailable', 'professional-unavailable', 'unqualified', 'stale',
  'bid-limit', 'already-awarded', 'unknown-bid', 'request-closed',
  'transition-refused', 'actor-refused', 'terms-refused', 'receipt-mismatch',
] as const;
export type IssuanceRequestServiceRefusal = (typeof ISSUANCE_REQUEST_REFUSALS)[number];

/** Άρνηση → (HTTP, κωδικός). Οι κωδικοί είναι και τα κλειδιά μηνυμάτων της οθόνης· ίδιες λέξεις με την ανάθεση §27. */
export const ISSUANCE_REQUEST_ERROR_CODES: Readonly<Record<IssuanceRequestServiceRefusal, readonly [number, string]>> = {
  absent: [404, 'NOT_FOUND'],
  // Ο ίδιος κωδικός με τον φρουρό ακινήτου (`assertNotRetired`, ADR-281).
  retired: [409, 'ENTITY_RETIRED'],
  'not-assignable': [409, 'NOT_ASSIGNABLE'],
  'office-ledger': [409, 'OFFICE_LEDGER'],
  unavailable: [503, 'ASSIGNMENTS_UNAVAILABLE'],
  'professional-unavailable': [422, 'PROFESSIONAL_UNAVAILABLE'],
  unqualified: [422, 'UNQUALIFIED'],
  stale: [409, 'STALE'],
  'bid-limit': [409, 'BID_LIMIT'],
  'already-awarded': [409, 'ALREADY_AWARDED'],
  'unknown-bid': [409, 'UNKNOWN_BID'],
  'request-closed': [409, 'REQUEST_CLOSED'],
  'transition-refused': [409, 'TRANSITION_REFUSED'],
  'actor-refused': [422, 'ACTOR_REFUSED'],
  'terms-refused': [409, 'TERMS_REFUSED'],
  'receipt-mismatch': [422, 'RECEIPT_MISMATCH'],
};

/** Ο κωδικός της απόκρισης → η άρνηση· άγνωστος κωδικός ή δίκτυο ⇒ `null` («δεν ολοκληρώθηκε»). Ιδίωμα `upkeep`. */
export function issuanceRequestRefusalOfCode(code: string | null): IssuanceRequestServiceRefusal | null {
  return ISSUANCE_REQUEST_REFUSALS.find((refusal) => ISSUANCE_REQUEST_ERROR_CODES[refusal][1] === code) ?? null;
}
