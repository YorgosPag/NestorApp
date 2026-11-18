/**
 * =============================================================================
 * Μητρώο λήξεων — ΤΟ ΑΙΤΗΜΑ ΠΡΟΣΦΟΡΩΝ: έως 3 προσφορές → μία νικήτρια (ADR-945 §7.2)
 * =============================================================================
 *
 * **«Σε ποιους ζήτησα προσφορά, ποια κέρδισε, και τι έκλεισε;»** Ένα αίτημα ανά (κάτοχος, ακίνητο, είδος). Κάθε προσφορά
 * είναι **κανονική ανάθεση** (`./issuance-assignment.ts`) με τη δική της μηχανή σταδίων· εδώ ζει μόνο το **δεύτερο
 * επίπεδο**: ποιοι προσκλήθηκαν, ποια ανατέθηκε, πότε έκλεισε ο κύκλος (Fairmarkit · PeopleSoft Sourcing · Thumbtack).
 *
 * 🔑 **Όριο 3, ποτέ 4** — και **ένας επαγγελματίας μία φορά ανά κύκλο**: η ίδια πρόσκληση ξανά ⇒ `changed: false`.
 * 🔑 **Η ανάθεση είναι ατομική**: ο μειωτής λέει **ποιες** άλλες προσφορές κλείνουν («δεν επιλέχθηκε»)· ο διακομιστής τις
 *    κλείνει στην **ίδια** συναλλαγή με την απόφαση στη νικήτρια — ποτέ στιγμή με δύο «ανατέθηκε».
 * 🔑 **Νέος κύκλος** μόνο όταν ο προηγούμενος τελείωσε (ακυρώθηκε, ή η νικήτρια δεν είναι πια ανοιχτή): `cycle + 1`,
 *    καμία προσφορά από πάνω — κάθε κύκλος κρατά το ιστορικό του, γιατί το id της προσφοράς περιέχει τον κύκλο.
 * 🔑 Οι ταυτότητες (`issuanceRequestIdOf` · `bidIdOf`) ζουν στο σύνορο του δίσκου
 *    (`services/document-registry/issuance-request-schema.ts`)· εδώ φτάνει το `bidId` έτοιμο.
 *
 * **Layering**: leaf — καθαροί τύποι και συναρτήσεις, μηδέν I/O.
 *
 * @module lib/document-validity/issuance-bidding
 */

import { sameProfessional, type IssuanceProfessional } from './issuance-professional';
import type { IssuanceCancellationReason } from './issuance-stage';

export const ISSUANCE_REQUEST_POLICY = {
  /** Thumbtack · Airtasker: λίγοι, όχι πλειστηριασμός (ADR-945 §6.2). */
  maxBids: 3,
} as const;

/** Μία πρόσκληση για προσφορά — η ίδια η προσφορά είναι το έγγραφο ανάθεσης `bidId`. */
export interface IssuanceBid {
  readonly bidId: string;
  readonly professional: IssuanceProfessional;
  readonly invitedAt: string;
  readonly invitedByUid: string;
}

export interface IssuanceRequestAward {
  readonly bidId: string;
  readonly at: string;
  readonly byUid: string;
}

/** Το κλείσιμο του κύκλου χωρίς νικήτρια — η ολοκλήρωση **παράγεται** από το μητρώο, δεν γράφεται εδώ. */
export interface IssuanceRequestClosure {
  readonly kind: 'cancelled';
  readonly at: string;
  readonly byUid: string;
}

/** Τα γεγονότα ενός αιτήματος — ό,τι αποθηκεύεται πέρα από την ταυτότητα. */
export interface IssuanceRequestRecord {
  readonly cycle: number;
  readonly bids: readonly IssuanceBid[];
  readonly award: IssuanceRequestAward | null;
  readonly closure: IssuanceRequestClosure | null;
}

export type IssuanceRequestAction =
  /** Ζήτα προσφορά από έναν ακόμη επαγγελματία· το `bidId` = `bidIdOf(requestId, κύκλος, επαγγελματίας)` του καλούντα. */
  | { readonly kind: 'invite'; readonly professional: IssuanceProfessional; readonly bidId: string }
  /** Ανάθεση στη νικήτρια (μαζί με την απόφαση στη δική της ανάθεση, στην ίδια συναλλαγή). */
  | { readonly kind: 'award'; readonly bidId: string }
  /** Ακύρωση του αιτήματος — κλείνουν **όλες** οι προσφορές του κύκλου. */
  | { readonly kind: 'cancel' };

/**
 * Το πλαίσιο που κρίνει ο διακομιστής **πριν** από τον μειωτή.
 * `awardedBidOpen` — η ανάθεση της νικήτριας είναι ακόμη ανοιχτή (`issuanceStateOf(...).kind === 'open'`)· `false` ⇒ ο
 * κύκλος τελείωσε (εκδόθηκε, ή ακυρώθηκε μετά την ανάθεση) και η επόμενη πρόσκληση ανοίγει νέο.
 */
export interface IssuanceRequestContext {
  readonly uid: string;
  readonly nowIso: string;
  readonly awardedBidOpen: boolean;
}

/**
 * - `bid-limit` — ήδη 3 προσφορές στον κύκλο·
 * - `already-awarded` — υπάρχει ανοιχτή νικήτρια: ούτε νέα πρόσκληση ούτε άλλη ανάθεση·
 * - `unknown-bid` — η προσφορά δεν ανήκει στον **τρέχοντα** κύκλο του αιτήματος·
 * - `request-closed` — δεν υπάρχει ανοιχτός κύκλος για ανάθεση ή ακύρωση.
 */
export type IssuanceRequestRefusal = 'bid-limit' | 'already-awarded' | 'unknown-bid' | 'request-closed';

/** Ποιες προσφορές πρέπει να κλείσουν **στην ίδια συναλλαγή**, και με ποιον λόγο. */
export interface IssuanceBidClosing {
  readonly bidIds: readonly string[];
  readonly reason: IssuanceCancellationReason;
}

export type IssuanceRequestReduction =
  | { readonly ok: true; readonly record: IssuanceRequestRecord; readonly changed: boolean; readonly closing: IssuanceBidClosing | null }
  | { readonly ok: false; readonly refusal: IssuanceRequestRefusal };

const unchanged = (record: IssuanceRequestRecord): IssuanceRequestReduction => ({ ok: true, record, changed: false, closing: null });
const refused = (refusal: IssuanceRequestRefusal): IssuanceRequestReduction => ({ ok: false, refusal });

/** Ο κύκλος δέχεται ακόμη πράξεις: δεν ακυρώθηκε, και δεν έχει νικήτρια που τελείωσε. */
function isCycleLive(record: IssuanceRequestRecord, ctx: IssuanceRequestContext): boolean {
  return record.closure === null && (record.award === null || ctx.awardedBidOpen);
}

/** Ο κύκλος στον οποίο πάει η επόμενη πρόσκληση — ο ίδιος όσο ζει, αλλιώς νέος και άδειος. */
function cycleForInvite(current: IssuanceRequestRecord | null, ctx: IssuanceRequestContext): IssuanceRequestRecord {
  if (current === null) return { cycle: 1, bids: [], award: null, closure: null };
  return isCycleLive(current, ctx) ? current : { cycle: current.cycle + 1, bids: [], award: null, closure: null };
}

/**
 * Ο κύκλος που θα δεχτεί την πρόσκληση — ο καλών τον χρειάζεται **πριν** από τον μειωτή, για να υπολογίσει το `bidId`
 * (`bidIdOf(requestId, κύκλος, επαγγελματίας)`). Ίδια κρίση με τον μειωτή, ποτέ δεύτερη.
 */
export function inviteCycleOf(current: IssuanceRequestRecord | null, ctx: IssuanceRequestContext): number {
  return cycleForInvite(current, ctx).cycle;
}

function invited(current: IssuanceRequestRecord | null, action: Extract<IssuanceRequestAction, { kind: 'invite' }>, ctx: IssuanceRequestContext): IssuanceRequestReduction {
  const base = cycleForInvite(current, ctx);
  if (base.award !== null) return refused('already-awarded');
  const existing = base.bids.find((bid) => sameProfessional(bid.professional, action.professional));
  if (existing !== undefined) return existing.bidId === action.bidId ? unchanged(base) : refused('unknown-bid');
  if (base.bids.length >= ISSUANCE_REQUEST_POLICY.maxBids) return refused('bid-limit');
  const bid: IssuanceBid = { bidId: action.bidId, professional: action.professional, invitedAt: ctx.nowIso, invitedByUid: ctx.uid };
  return { ok: true, record: { ...base, bids: [...base.bids, bid] }, changed: true, closing: null };
}

function awarded(current: IssuanceRequestRecord, bidId: string, ctx: IssuanceRequestContext): IssuanceRequestReduction {
  if (current.award !== null) return current.award.bidId === bidId ? unchanged(current) : refused('already-awarded');
  if (!current.bids.some((bid) => bid.bidId === bidId)) return refused('unknown-bid');
  const record: IssuanceRequestRecord = { ...current, award: { bidId, at: ctx.nowIso, byUid: ctx.uid } };
  const others = current.bids.filter((bid) => bid.bidId !== bidId).map((bid) => bid.bidId);
  return { ok: true, record, changed: true, closing: { bidIds: others, reason: 'not-awarded' } };
}

/**
 * **Η μία κρίση** κάθε πράξης αιτήματος. Η ακύρωση μετά την ανάθεση **δεν** είναι πράξη αιτήματος: ακυρώνεται η ίδια η
 * ανάθεση της νικήτριας (`reduceIssuance`), και ο κύκλος τελειώνει μόνος του (`awardedBidOpen: false`).
 */
export function reduceIssuanceRequest(
  current: IssuanceRequestRecord | null,
  action: IssuanceRequestAction,
  ctx: IssuanceRequestContext,
): IssuanceRequestReduction {
  if (action.kind === 'invite') return invited(current, action, ctx);
  if (current === null) return refused('request-closed');
  if (action.kind === 'cancel' && current.closure !== null) return unchanged(current);
  if (!isCycleLive(current, ctx)) return refused('request-closed');
  if (action.kind === 'award') return awarded(current, action.bidId, ctx);
  if (current.award !== null) return refused('already-awarded');
  const record: IssuanceRequestRecord = { ...current, closure: { kind: 'cancelled', at: ctx.nowIso, byUid: ctx.uid } };
  return { ok: true, record, changed: true, closing: { bidIds: current.bids.map((bid) => bid.bidId), reason: 'cancelled' } };
}
