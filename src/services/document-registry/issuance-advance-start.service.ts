/**
 * @fileoverview ADR-943 Φ5α — **«Έγινε η αυτοψία»**: η πράξη του μηχανικού που ανοίγει το παράθυρο αντίρρησης (48ω, Κ-4)
 *   και **προγραμματίζει** την αυτόματη αποδέσμευση της κρατημένης προκαταβολής στο τέλος του.
 * @related issuance-engagement-action.server.ts (ο ΕΝΑΣ δρόμος πράξης μηχανικού) · server/payments/payment-settlement.ts
 *   (ο ΕΝΑΣ εκτελεστής χρημάτων) · issuance-advance-settlement.server.ts (η κρίση πριν από τα χρήματα)
 * @module services/document-registry/issuance-advance-start.service
 *
 * 🔑 **Πρώτα η πρόθεση, μετά η εντολή**: το γεγονός `work-started` γράφεται από τον μειωτή (μόνο από `held`)· η εντολή
 *    αποδέσμευσης γράφεται στη συνεδρία πληρωμής **μετά**, με `dueAt` = το τέλος του παραθύρου. Βλάβη ανάμεσα ⇒ ο
 *    μηχανικός ξαναπατά: ο μειωτής λέει `unchanged`, ο προγραμματισμός ξανατρέχει (ιδεμποτικός) — καμία αποδέσμευση δεν
 *    ξεχνιέται.
 * 🔑 **Καμία κίνηση χρημάτων εδώ**: η αποδέσμευση γίνεται από το cron όταν λήξει το παράθυρο, αφού ο τομέας ξαναρωτηθεί.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { advanceCollectedMinor, advanceStateOf } from '@/lib/document-validity/issuance-advance';
import { issuanceKeyOf, type IssuanceAssignmentRecord, type IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { createModuleLogger } from '@/lib/telemetry';
import { issueAdvanceLink } from '@/server/issuance-invitations/issuance-advance-link';
import { announceAdvanceMilestone, latestAdvanceMilestone } from '@/server/issuance-invitations/issuance-advance-notifier';
import { findFundedAdvanceCheckout } from '@/server/payments/payment-checkout-store';
import { scheduleSettlement, type ScheduleOutcome } from '@/server/payments/payment-settlement';

import { fundedPaymentReferenceOf } from './issuance-advance-settlement.server';
import { writeEngagementIssuanceAction, type EngagementIssuanceRefusal } from './issuance-engagement-action.server';

const logger = createModuleLogger('IssuanceAdvanceStart');

export interface AdvanceStartInput {
  readonly uid: string;
  readonly name: string | null;
  readonly engagementId: string;
  /** Το στάδιο που **είδε** ο μηχανικός (CAS). */
  readonly expectedStage: IssuanceStage | null;
  readonly now: Date;
}

/** + `settlement-unavailable`: η αυτοψία γράφτηκε, η εντολή αποδέσμευσης όχι ακόμη — ξαναπάτημα την ολοκληρώνει. */
export type AdvanceStartRefusal = EngagementIssuanceRefusal | 'settlement-unavailable';

export type AdvanceStartResult =
  | { readonly ok: true; readonly outcome: 'changed' | 'unchanged'; readonly releaseAt: string }
  | { readonly ok: false; readonly refusal: AdvanceStartRefusal };

/** Η εντολή αυτόματης αποδέσμευσης: ολόκληρο το εισπραχθέν, στο τέλος του παραθύρου (`null` ⇒ όχι `release-pending`). */
async function scheduleAutoRelease(db: Firestore, companyId: string, assignmentId: string, record: IssuanceAssignmentRecord, nowMs: number): Promise<{ readonly releaseAt: string; readonly scheduled: ScheduleOutcome } | null> {
  const state = advanceStateOf(record);
  if (state.kind !== 'release-pending') return null;
  const paymentReference = fundedPaymentReferenceOf(record);
  const checkout = paymentReference === null ? null : await findFundedAdvanceCheckout(db, companyId, assignmentId, paymentReference);
  if (checkout === null) {
    logger.error('Advance in release-pending without its funded checkout — needs a human', { assignmentId });
    return { releaseAt: state.objectionUntil, scheduled: 'refused' };
  }
  const scheduled = await scheduleSettlement(db, checkout.checkoutId, {
    refundMinor: 0, releaseMinor: advanceCollectedMinor(state), basis: 'window-elapsed', dueAt: state.objectionUntil,
  }, nowMs);
  return { releaseAt: state.objectionUntil, scheduled };
}

/** **«Έγινε η αυτοψία»** — βλ. κεφαλίδα. */
export async function declareIssuanceWorkStarted(db: Firestore, input: AdvanceStartInput): Promise<AdvanceStartResult> {
  const written = await writeEngagementIssuanceAction(db, { ...input, action: { kind: 'start-work' } });
  if (!written.ok) return written;
  const { outcome, assignment, registry, companyId } = written;
  const schedule = await scheduleAutoRelease(db, companyId, assignment.id, outcome.record, input.now.getTime());
  if (schedule === null) return { ok: false, refusal: 'transition-refused' };
  if (schedule.scheduled === 'busy' || schedule.scheduled === 'refused') return { ok: false, refusal: 'settlement-unavailable' };
  const milestone = latestAdvanceMilestone(outcome.record, 'work-started');
  const label = registry.properties[assignment.propertyId];
  if (outcome.outcome === 'changed' && milestone !== null && label !== undefined) {
    await announceAdvanceMilestone(db, { context: { assignment, registry, label }, record: outcome.record, milestone, now: input.now });
    // Φ5β (Ζ-1) — ο ιδιοκτήτης μαθαίνει **με email**, με νέο σύνδεσμο προς τη σελίδα του (πότε φεύγουν · αντίρρηση).
    const latestIssuedOn = registry.issuance[issuanceKeyOf(assignment.propertyId, assignment.documentKind)]?.latestIssuedOn ?? null;
    const told = await issueAdvanceLink(db, {
      context: { assignment, registry, label, latestIssuedOn }, record: outcome.record, moment: 'work-started',
      actorUid: outcome.record.approvalRequest?.byUid ?? outcome.record.proposedByUid, requireAccessCode: false, now: input.now,
    });
    if (!told.ok) logger.warn('Owner not emailed about the site visit', { assignmentId: assignment.id, refusal: told.refusal });
  }
  return { ok: true, outcome: outcome.outcome, releaseAt: schedule.releaseAt };
}
