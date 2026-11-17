import 'server-only';

/**
 * @fileoverview ADR-943 Φ5β (Ζ-3) — **η αντίρρηση του ιδιοκτήτη** στην αυτοψία, από τη σελίδα της προκαταβολής, χωρίς
 *   λογαριασμό.
 * @related issuance-advance-payer.ts (ποιος είναι ο πληρωτής · κωδικός §29) · services/document-registry/issuance-assignments.server.ts
 *   (ο ΙΔΙΟΣ γραφέας, ο ΙΔΙΟΣ μειωτής) · server/payments/payment-settlement.ts (ο εκτελεστής που σβήνει την εντολή)
 * @module server/issuance-invitations/issuance-advance-objection
 *
 * 🔑 **Η αντίρρηση ανήκει σε όποιον πλήρωσε** (Κ-4): ο ιδιοκτήτης της ισχύουσας απόφασης (Ζ-2), με τον κωδικό του φακέλου
 *    όπου τον ζήτησε το γραφείο. Ο μειωτής ξανακρίνει παράθυρο και αιτιολογία (`canObjectToStart`) μέσα στη συναλλαγή.
 * 🔑 **Καμία κίνηση χρημάτων εδώ, καμία ακύρωση εντολής**: η εντολή αυτόματης αποδέσμευσης μένει· όταν έρθει η ώρα της, ο
 *    εκτελεστής ξαναρωτά τον τομέα, βλέπει `disputed` και τη σβήνει (`void`, Ζ-7). Δεν υπάρχει «ξέχασα να την ακυρώσω».
 * 🔒 Ε-9′: η ειδοποίηση προς τον μηχανικό **δεν** φέρει την αιτιολογία.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { LinkVerification } from '@/lib/document-validity/issuance-assignment';
import { advanceStateOf, canObjectToStart } from '@/lib/document-validity/issuance-advance';
import type { IssuanceAdvanceObjectionBody } from '@/lib/document-validity/issuance-request';
import { stageIssuanceAction, type StagedIssuanceWrite } from '@/services/document-registry/issuance-assignments.server';
import type { IssuanceAdvanceObjectionResult } from '@/types/issuance-invitation';

import { advanceViewOf } from './issuance-advance-checkout';
import { announceAdvanceMilestone, latestAdvanceMilestone } from './issuance-advance-notifier';
import { checkPayerAccess, resolveAdvancePayer, type AdvancePayer } from './issuance-advance-payer';
import type { LinkRefused } from './issuance-invitation-answer';

export type AdvanceObjectionOutcome =
  | { readonly kind: 'result'; readonly result: IssuanceAdvanceObjectionResult }
  | LinkRefused
  | { readonly kind: 'unavailable' };

const NOT_OBJECTABLE: AdvanceObjectionOutcome = { kind: 'result', result: { status: 'refused', reason: 'not-objectable' } };

/** Η αντίρρηση γράφεται από τον ΕΝΑ γραφέα, με δράστη τον **σύνδεσμο** (ο μειωτής γράφει `owner-link`). */
function stageObjection(db: Firestore, payer: AdvancePayer, reason: string, verifiedBy: LinkVerification, nowIso: string): Promise<StagedIssuanceWrite> {
  const { invitation, context } = payer;
  return db.runTransaction(async (tx) => {
    const next = await stageIssuanceAction(tx, db, {
      companyId: invitation.companyId,
      writer: { kind: 'link', invitationId: invitation.id, name: context.registry.people[invitation.contactId]?.name ?? null, verifiedBy },
      property: { id: context.assignment.propertyId, scope: context.label.scope, name: context.label.name },
      documentKind: context.assignment.documentKind,
      latestIssuedOn: context.latestIssuedOn,
      action: { kind: 'object-start', reason },
      names: {},
      nowIso,
    });
    next.commit();
    return next;
  });
}

/** **Η αντίρρηση** — βλ. κεφαλίδα. Επιστρέφει την όψη **όπως τη βλέπει τώρα ο διακομιστής**. */
export async function objectToIssuanceAdvance(db: Firestore, token: string, body: IssuanceAdvanceObjectionBody, now: Date): Promise<AdvanceObjectionOutcome> {
  const resolved = await resolveAdvancePayer(db, token, now);
  if (!('ok' in resolved)) return resolved;
  const { payer } = resolved;
  const nowIso = now.toISOString();
  const check = await checkPayerAccess(db, payer.invitation, body.accessCode, nowIso);
  if ('kind' in check) return check;
  if (!check.ok) return { kind: 'refused', reason: check.refusal, remaining: check.remaining };
  if (!canObjectToStart(payer.state, nowIso)) return NOT_OBJECTABLE;
  const staged = await stageObjection(db, payer, body.reason, check.verifiedBy, nowIso);
  if (!staged.outcome.ok) return NOT_OBJECTABLE;
  await staged.audit();
  const record = staged.outcome.record;
  const milestone = latestAdvanceMilestone(record, 'start-objected');
  if (staged.outcome.outcome === 'changed' && milestone !== null) {
    await announceAdvanceMilestone(db, { context: payer.context, record, milestone, now });
  }
  const advance = await advanceViewOf(db, { ...payer, record, state: advanceStateOf(record) }, now);
  return { kind: 'result', result: { status: 'objected', advance } };
}
