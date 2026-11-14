import 'server-only';

/**
 * **Πόρτα α, η πλευρά του αγοραστή** (ADR-923 §5.12 Σ2 · Σ3): το τέταρτο είδος της μηχανής ADR-853.
 *
 * Η κλειδαριά (υπογραφή · λήξη δύο φορές · nonce · δέσμευση παραλήπτη στο email του Auth · απόδειξη γραμματοκιβωτίου)
 * είναι η **ίδια**. Εδώ ζουν μόνο: πού ζει η πρόσκληση, και τι γράφει η αποδοχή: τη σχέση, στην **ίδια** συναλλαγή με το
 * `pending → accepted`. Δύο κλικ ⇒ ένα αποτέλεσμα. Άρνηση του κριτή ⇒ η πρόσκληση μένει `pending`, καμία γραφή.
 *
 * ⛔ **Καμία γραφή `catalog_*` εδώ:** η ομάδα γράφτηκε στην έκδοση, από τον προμηθευτή.
 * ⛔ **Κανένας ρόλος, κανένα claim:** ο αγοραστής δεν γίνεται μέλος του προμηθευτή.
 * @module server/supply-relationships/supply-invitation-redeem.server
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { addressedInvitationPreview, type AddressedInvitationPreviewOutcome } from '@/server/invitations/invitation-preview-outcome';
import {
  readInvitationByToken,
  redeemInvitation,
  type InvitationAcceptance,
  type InvitationKind,
  type InvitationLocator,
  type InvitationRedeemer,
  type InvitationRedeemOutcome,
  type InvitationResolution,
} from '@/server/invitations/invitation-redeem';
import { judgeInvitationAcceptance } from '@/subapps/catalog/pricing/supply-relationship-judge';
import { supplyInvitationFromDocument } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import type { SupplyBuyerRefusal, SupplyInvitation, SupplyInvitationPreview } from '@/subapps/catalog/types/supply-invitation';
import type { InvitationDocumentCore } from '@/types/invitation-core';

import { announceSupplyChange } from './supply-relationship-notifier.server';
import { resolveBuyerOffice, type SupplyBuyerActing } from './supply-buyer-office.server';
import { SUPPLY_INVITE_SECRET_ENV, supplyInvitationsCollection } from './supply-invitation-issue.server';
import {
  isContactHeldElsewhereInTx,
  readSupplyRelationshipInTx,
  recordSupplyRelationshipChange,
  stageSupplyRelationship,
  supplyRelationshipId,
  type StagedSupplyChange,
} from './supply-relationship-store.server';

const logger = createModuleLogger('supply-invitation-redeem');

export type SupplyInvitationUnavailable = 'secret-missing' | 'offices-unknown';

export type SupplyInvitationOutcome = InvitationRedeemOutcome<SupplyInvitation, SupplyBuyerRefusal, SupplyInvitationUnavailable, StagedSupplyChange | null>;

/** Top-level συλλογή: το id αρκεί, κανένας locator. Το `belongs` είναι πάντα: η πρόσκληση δεν αλλάζει κάτοχο. */
const SUPPLY_INVITATION_LOCATOR: InvitationLocator = {
  secretEnv: SUPPLY_INVITE_SECRET_ENV,
  locatorCount: 0,
  locate: async (db, invitationId) => ({ ref: supplyInvitationsCollection(db).doc(invitationId), belongs: () => true }),
};

function recordOf(stored: InvitationDocumentCore, resolution: InvitationResolution): SupplyInvitation | null {
  const record = supplyInvitationFromDocument({ ...stored, ...resolution });
  if (record === null) logger.error('Πρόσκληση προμήθειας που δεν διαβάζεται: δεν εξαργυρώνεται', { invitationId: stored.id });
  return record;
}

type Acceptance = InvitationAcceptance<SupplyBuyerRefusal, SupplyInvitationUnavailable, StagedSupplyChange | null>;

async function stageAcceptance(
  db: Firestore,
  tx: Transaction,
  accepted: { readonly record: SupplyInvitation; readonly identity: InvitationRedeemer },
  buyerCompanyId: string,
): Promise<Acceptance> {
  const { record, identity } = accepted;
  const ends = { supplierCompanyId: record.companyId, buyerCompanyId };
  const current = await readSupplyRelationshipInTx(tx, db, supplyRelationshipId(ends));
  if (await isContactHeldElsewhereInTx(tx, db, { supplierCompanyId: record.companyId, contactId: record.contactId, buyerCompanyId })) {
    return { kind: 'refused', reason: 'contact-bound' };
  }
  // Η **ίδια** στιγμή με τη σφράγιση της πρόσκλησης: ένα ρολόι ανά αποδοχή.
  const act = { uid: identity.uid, now: record.resolvedAt ?? nowISO() };
  const transition = judgeInvitationAcceptance(current, { ends, contactId: record.contactId, act });
  if (transition.kind === 'refused') return transition;
  if (transition.kind === 'unchanged') return { kind: 'commit', write: () => null };
  return { kind: 'commit', write: () => stageSupplyRelationship(tx, db, { before: current, next: transition.next, ...act }) };
}

/** Το είδος, ανά αίτημα: η αποδοχή κουβαλά το γραφείο που δήλωσε ο άνθρωπος. `null` ⇒ άρνηση, που δεν φτάνει ποτέ στο `onAccept`. */
function supplyInvitationKind(
  db: Firestore,
  buyerCompanyId: string | null,
): InvitationKind<InvitationDocumentCore, SupplyInvitation, InvitationRedeemer, SupplyBuyerRefusal, SupplyInvitationUnavailable, StagedSupplyChange | null> {
  return {
    ...SUPPLY_INVITATION_LOCATOR,
    secretMissing: 'secret-missing',
    recordOf,
    prepareAcceptance: async (_identity, stored) => (
      supplyInvitationFromDocument(stored)?.companyId === buyerCompanyId ? { kind: 'refused', reason: 'same-workspace' } : null
    ),
    onAccept: (tx, accepted) => {
      if (buyerCompanyId === null) throw new Error('Supply invitation accepted without an office');
      return stageAcceptance(db, tx, accepted, buyerCompanyId);
    },
  };
}

export interface SupplyInvitationResponse {
  readonly action: 'accept' | 'decline';
  readonly token: string;
  readonly identity: InvitationRedeemer;
  readonly acting: SupplyBuyerActing;
}

async function acceptSupplyInvitation(db: Firestore, input: SupplyInvitationResponse): Promise<SupplyInvitationOutcome> {
  const office = await resolveBuyerOffice(input.acting);
  if (office.kind === 'unknown') return { kind: 'unavailable', reason: 'offices-unknown' };
  if (office.kind === 'refused') return office;
  return redeemInvitation(db, supplyInvitationKind(db, office.companyId), {
    token: input.token, identity: input.identity, target: 'accepted', nowValue: nowISO(),
  });
}

/** Η απάντηση ολόκληρη: εξαργύρωση (ατομική) → ίχνος στα δύο βιβλία. */
export async function respondToSupplyInvitation(db: Firestore, input: SupplyInvitationResponse): Promise<SupplyInvitationOutcome> {
  const outcome = input.action === 'accept'
    ? await acceptSupplyInvitation(db, input)
    : await redeemInvitation(db, supplyInvitationKind(db, null), { token: input.token, identity: input.identity, target: 'declined', nowValue: nowISO() });
  if (outcome.kind === 'accepted' && outcome.effect !== null) {
    await recordSupplyRelationshipChange(outcome.effect, input.identity.uid);
    await announceSupplyChange(outcome.effect.after, 'accepted', outcome.invitation.invitedByUid);
  }
  return outcome;
}

export type SupplyInvitationPreviewOutcome = AddressedInvitationPreviewOutcome<SupplyInvitationPreview>;

/** Η όψη, **χωρίς ταυτότητα και χωρίς κατανάλωση**: ο ίδιος δρόμος με την εξαργύρωση. Μόνο το όνομα του προμηθευτή. */
export async function previewSupplyInvitation(
  db: Firestore,
  input: { readonly token: string; readonly viewerEmail: string | null },
): Promise<SupplyInvitationPreviewOutcome> {
  const found = await readInvitationByToken(db, SUPPLY_INVITATION_LOCATOR, { token: input.token, nowValue: nowISO(), recipientEmail: null });
  if (found.kind === 'secret-missing') return { kind: 'unavailable' };
  if (found.kind === 'refused') return found;
  const invitation = supplyInvitationFromDocument(found.stored);
  if (invitation === null) return { kind: 'unavailable' };
  const supplierName = (await readWorkspaceName(invitation.companyId).catch(() => '')).trim();
  return addressedInvitationPreview(input, invitation, {
    opened: { db, ref: found.location.ref },
    preview: { supplierName: supplierName === '' ? null : supplierName, expiresAt: invitation.expiresAt },
  });
}
