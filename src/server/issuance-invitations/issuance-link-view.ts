import 'server-only';

/**
 * @fileoverview ADR-915 §28 · §42 — **τι βλέπει ο κάτοχος του συνδέσμου**: ποιο βήμα του ζητείται, και ό,τι χρειάζεται
 *   για αυτό — ο φάκελος προσφοράς για τον επαγγελματία, η προσφορά για τον υπεύθυνο. Τίποτα παραπάνω.
 * @related issuance-invitation-answer.ts (ο καλών) · issuance-quote-brief.ts (ο φάκελος)
 * @module server/issuance-invitations/issuance-link-view
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceSigningDayOf } from '@/lib/document-validity/document-registry-view';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { isLegacyIssuance } from '@/lib/document-validity/issuance-stage';
import { quoteTotalsOf, type IssuanceQuote } from '@/lib/document-validity/issuance-quote';
import type { IssuanceAudience } from '@/lib/document-validity/issuance-request';
import type { IssuanceLinkStep, IssuanceQuoteView } from '@/types/issuance-invitation';

import { linkOwnersOf } from './issuance-link-owners';
import { readIssuanceQuoteBrief } from './issuance-quote-brief';
import type { ResolvedLink } from './issuance-invitation-answer';

/** Το βήμα — από το ακροατήριο και το **είδος** της ανάθεσης (παλιά §27 ή με προσφορά §42). */
export function linkStepOf(audience: IssuanceAudience, record: IssuanceAssignmentRecord): IssuanceLinkStep {
  if (audience === 'owner') return 'approve-quote';
  return isLegacyIssuance(record) ? 'legacy-accept' : 'give-quote';
}

/**
 * Η προσφορά για τον υπεύθυνο — οι όροι, η αναθεώρηση, το σύνολο της αρχικής όταν αναθεωρήθηκε, και (§45) η ημέρα
 * υπογραφής, ώστε η σελίδα να πει «η παράδοση πέφτει μετά την υπογραφή» πριν από την έγκριση.
 */
export function quoteViewOf(quote: IssuanceQuote, signingDay: string | null): IssuanceQuoteView {
  const { basis, amountMinor, vatRatePercent, vatIncluded, validUntil, scope, note, deliveryBusinessDays, advance, revision, previous } = quote;
  return {
    // ADR-943 Κ-3 — η προκαταβολή εγκρίνεται μαζί με την τιμή: ο υπεύθυνος τη βλέπει, με τον πίνακα ακύρωσης.
    basis, amountMinor, vatRatePercent, vatIncluded, validUntil, scope, note, deliveryBusinessDays, advance, revision,
    previousTotalMinor: previous === null ? null : quoteTotalsOf(previous).totalMinor,
    signingDay,
  };
}

/** Τα §42 πεδία της όψης: βήμα · φάκελος (μόνο επαγγελματίας) · προσφορά + (§45.15) ιδιοκτήτες (μόνο υπεύθυνος). */
export async function quoteFacetsOf(db: Firestore, link: ResolvedLink) {
  const { invitation, record, label, registry } = link;
  const step = linkStepOf(invitation.audience, record);
  const brief = step === 'give-quote'
    ? await readIssuanceQuoteBrief(db, { companyId: invitation.companyId, propertyId: invitation.propertyId, scope: label.scope, actorUid: invitation.invitedByUid })
    : null;
  // §45 — από το ΙΔΙΟ μητρώο που ήδη διαβάστηκε για τον σύνδεσμο (καμία δεύτερη ανάγνωση).
  const signingDay = issuanceSigningDayOf(registry.rows, invitation.propertyId, invitation.documentKind, registry.asOf);
  const quote = step === 'approve-quote' && record.quote !== null ? quoteViewOf(record.quote, signingDay) : null;
  const owners = step === 'approve-quote' ? await linkOwnersOf(db, link) : null;
  return { step, brief, quote, owners } as const;
}
