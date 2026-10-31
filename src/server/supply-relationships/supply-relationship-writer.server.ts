import 'server-only';

/**
 * **Οι πράξεις πάνω σε υπάρχουσα σχέση** (ADR-923 §5.12 Σ2 · Σ7): έγκριση · απόρριψη αιτήματος · ανάκληση από όποια πλευρά.
 *
 * 🔑 Ξένη σχέση ≡ ανύπαρκτη (`notFound`), και για τις δύο πλευρές: καμία άλλη απάντηση δεν φεύγει (ADR-742 §3.3).
 * 🔑 Η **έγκριση** τρέχει μέσα στη μηχανή καταλόγου: είναι πράξη του προμηθευτή, στον δικό του χώρο, και η κατάταξη σε
 *    ομάδα γράφεται ατομικά με την ενεργοποίηση. Η **ανάκληση** δεν αγγίζει τον κατάλογο: η ομάδα μένει, για να
 *    ξαναβρεθεί αν η σχέση ξαναζήσει, ενώ κάθε ξένη ανάγνωση κόβεται άμεσα από το ότι η σχέση δεν είναι `active` (Σ4).
 * @module server/supply-relationships/supply-relationship-writer.server
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { assertRevision, runCatalogTransaction, type CatalogTx } from '@/server/catalog/catalog-store.server';
import { assertNoIssues, CatalogWriteError } from '@/server/catalog/catalog-write-error';
import { planCustomerAssignment } from '@/server/catalog/customer-assignment-writer.server';
import { partyIssues } from '@/server/catalog/pricing-party-reads.server';
import { stageLiveInvitationRevocation } from '@/server/invitations/invitation-lifecycle';
import {
  judgeRelationshipEnd,
  judgeRequestApproval,
  judgeRequestDecline,
  type SupplyTransition,
} from '@/subapps/catalog/pricing/supply-relationship-judge';
import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { SupplyRelationship, SupplyRelationshipSide } from '@/subapps/catalog/types/supply-relationship';

import { liveSupplyInvitationsOfContact, supplyInvitationsCollection } from './supply-invitation-issue.server';
import {
  isContactHeldElsewhereInTx,
  readSupplyRelationshipInTx,
  recordSupplyRelationshipChange,
  stageSupplyRelationship,
  type StagedSupplyChange,
} from './supply-relationship-store.server';

const SIDE_FIELD: Readonly<Record<SupplyRelationshipSide, 'companyId' | 'buyerCompanyId'>> = { supplier: 'companyId', buyer: 'buyerCompanyId' };

/** Η σχέση, μόνο αν ο χώρος του αιτήματος είναι η δηλωμένη πλευρά της. */
async function readAsSide(tx: Transaction, db: Firestore, ctx: AuthContext, id: string, side: SupplyRelationshipSide): Promise<SupplyRelationship> {
  const relationship = await readSupplyRelationshipInTx(tx, db, id);
  if (relationship === null || relationship[SIDE_FIELD[side]] !== ctx.companyId) throw new CatalogWriteError('notFound');
  return relationship;
}

/** Η έκβαση του κριτή σε γραφή. `unchanged` ⇒ καμία γραφή, καμία γραμμή ιστορικού. */
function applied(tx: Transaction, db: Firestore, current: SupplyRelationship, transition: SupplyTransition, act: { readonly uid: string; readonly now: string }): StagedSupplyChange | null {
  if (transition.kind === 'unchanged') return null;
  if (transition.kind === 'refused') throw new CatalogWriteError('invalid', [{ code: 'supplyNotRequested', path: 'state' }]);
  return stageSupplyRelationship(tx, db, { before: current, next: transition.next, ...act });
}

async function assertContactUsable(scope: CatalogTx, contactId: string | null, buyerCompanyId: string): Promise<void> {
  if (contactId === null) return;
  assertNoIssues(await partyIssues(scope, { kind: 'contact', contactId }, 'supplierContactId'));
  const held = await isContactHeldElsewhereInTx(scope.tx, scope.db, { supplierCompanyId: scope.ctx.companyId, contactId, buyerCompanyId });
  assertNoIssues(held ? [{ code: 'contactAlreadyBound', path: 'supplierContactId' }] : []);
}

export interface SupplyRequestApproval {
  readonly expectedRevision: number;
  readonly supplierContactId: string | null;
  readonly customerGroupId: string | null;
}

/** Ο προμηθευτής εγκρίνει: ενεργοποίηση + κατάταξη, ατομικά. Η ομάδα δένεται στην επαφή αν δόθηκε, αλλιώς στον χώρο. */
export async function approveSupplyRequest(ctx: AuthContext, id: string, input: SupplyRequestApproval): Promise<SupplyRelationship> {
  const change = await runCatalogTransaction(ctx, async (scope) => {
    const current = await readAsSide(scope.tx, scope.db, ctx, id, 'supplier');
    assertRevision(current, input.expectedRevision);
    const contactId = input.supplierContactId ?? current.supplierContactId;
    await assertContactUsable(scope, contactId, current.buyerCompanyId);
    const party: PricingPartyRef = contactId === null ? { kind: 'workspace', companyId: current.buyerCompanyId } : { kind: 'contact', contactId };
    const assignment = input.customerGroupId === null ? null : await planCustomerAssignment(scope, party, input.customerGroupId);
    const act = { uid: ctx.uid, now: scope.now };
    const staged = applied(scope.tx, scope.db, current, judgeRequestApproval(current, { contactId, act }), act);
    assignment?.commit();
    return staged;
  });
  if (change === null) throw new CatalogWriteError('invalid', [{ code: 'supplyNotRequested', path: 'state' }]);
  await recordSupplyRelationshipChange(change, ctx.uid);
  return change.after;
}

/** Μία πράξη σε δική του συναλλαγή, χωρίς κατάλογο: απόρριψη ή ανάκληση. */
async function runSupplyAct(
  ctx: AuthContext,
  id: string,
  input: { readonly side: SupplyRelationshipSide; readonly expectedRevision: number },
  judge: (current: SupplyRelationship, act: { readonly uid: string; readonly now: string }) => SupplyTransition,
): Promise<SupplyRelationship> {
  const db = getAdminFirestore();
  const [relationship, change] = await db.runTransaction(async (tx) => {
    const current = await readAsSide(tx, db, ctx, id, input.side);
    assertRevision(current, input.expectedRevision);
    const act = { uid: ctx.uid, now: nowISO() };
    const transition = judge(current, act);
    const revocation = transition.kind === 'write' && current.supplierContactId !== null
      ? await stageLiveInvitationRevocation(tx, {
        collection: supplyInvitationsCollection(db),
        liveQuery: liveSupplyInvitationsOfContact(db, current.companyId, current.supplierContactId),
        actorUid: ctx.uid,
        nowValue: act.now,
      })
      : null;
    const staged = applied(tx, db, current, transition, act);
    revocation?.commit();
    return [staged?.after ?? current, staged] as const;
  });
  if (change !== null) await recordSupplyRelationshipChange(change, ctx.uid);
  return relationship;
}

export function declineSupplyRequest(ctx: AuthContext, id: string, expectedRevision: number): Promise<SupplyRelationship> {
  return runSupplyAct(ctx, id, { side: 'supplier', expectedRevision }, judgeRequestDecline);
}

/** Σ7: ανάκληση από όποια πλευρά. Μαζί πέφτει και κάθε ζωντανή πρόσκληση της επαφής, ώστε να μη μένει πόρτα ανοιχτή. */
export function endSupplyRelationship(ctx: AuthContext, id: string, input: { readonly side: SupplyRelationshipSide; readonly expectedRevision: number }): Promise<SupplyRelationship> {
  return runSupplyAct(ctx, id, input, (current, act) => judgeRelationshipEnd(current, { side: input.side, act }));
}
