import 'server-only';

/**
 * **Πόρτα α, η πλευρά του προμηθευτή** (ADR-923 §5.12 Σ2): πρόσκληση από επαφή, στη μηχανή ADR-853.
 *
 * 🔑 **Η προέγκριση (Buildxact `isPreApproved`) γράφεται ΕΔΩ, όχι στην αποδοχή.** Η κατάταξη της επαφής σε ομάδα είναι
 *    πράξη του προμηθευτή πάνω στον **δικό του** κατάλογο: τρέχει στη μηχανή, με το δικό του `AuthContext`, ατομικά με
 *    την πρόσκληση. Έτσι η αποδοχή ξένου χώρου δεν χρειάζεται καμία εγγραφή `catalog_*`. Αν η πρόσκληση δεν απαντηθεί,
 *    μένει μια ανάθεση σε επαφή του προμηθευτή: ακίνδυνη, και αληθής για τον ίδιο.
 * ⛔ Ο προμηθευτής δεν διαλέγει χώρο (Σ3): εδώ υπάρχει μόνο η επαφή του. Τον χώρο τον δηλώνει ο άλλος.
 * @module server/supply-relationships/supply-invitation-issue.server
 */

import type { Firestore, Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { runCatalogTransaction, type CatalogTx } from '@/server/catalog/catalog-store.server';
import { assertNoIssues, CatalogWriteError } from '@/server/catalog/catalog-write-error';
import { planCustomerAssignment } from '@/server/catalog/customer-assignment-writer.server';
import { signalPricingViewsInTx } from '@/server/catalog/pricing-view-signal.server';
import { newPendingInvitationCore, revokeInvitationAt, stageInvitationWithSupersede } from '@/server/invitations/invitation-lifecycle';
import { mintInvitationToken } from '@/server/invitations/invitation-token';
import { extractContactEmails } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocsInTransaction } from '@/server/lib/owned-contact-docs';
import { generateSupplyInvitationId } from '@/services/enterprise-id.service';
import { supplyInvitationFromDocument } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import type { SupplyInvitation } from '@/subapps/catalog/types/supply-invitation';

import { isContactHeldElsewhereInTx } from './supply-relationship-store.server';

/** ⚠️ Δικό του μυστικό, ποτέ κοινό: με κοινό, σύνδεσμος προμήθειας θα διαβαζόταν ως πρόσκληση άλλου είδους. */
export const SUPPLY_INVITE_SECRET_ENV = 'SUPPLY_INVITE_SECRET';

/** Coupa: 30 ημέρες. Ο άλλος πρέπει να ρωτήσει το λογιστήριό του, όχι να απαντήσει σε ένα κλικ. */
const SUPPLY_INVITATION_LIFETIME_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function supplyInvitationsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.SUPPLY_INVITATIONS);
}

/** «Οι ζωντανές της επαφής»: για μία επαφή ζει το πολύ μία πρόσκληση, ακόμη κι αν άλλαξε το email της. */
export function liveSupplyInvitationsOfContact(db: Firestore, companyId: string, contactId: string): Query {
  return supplyInvitationsCollection(db)
    .where('companyId', '==', companyId)
    .where('contactId', '==', contactId)
    .where('state', '==', 'pending');
}

export interface IssueSupplyInvitationInput {
  readonly contactId: string;
  readonly customerGroupId: string | null;
}

export interface IssuedSupplyInvitation {
  readonly invitation: SupplyInvitation;
  /** Ωμό **μόνο εδώ και στο email**. */
  readonly token: string;
}

interface MintedDraft {
  readonly id: string;
  readonly nonceHash: string;
  readonly expiresAtMs: number;
  readonly createdAt: string;
}

/** Η διεύθυνση της επαφής **αυτού** του χώρου. Ξένη ≡ ανύπαρκτη, και επαφή χωρίς email δεν προσκαλείται. */
async function readContactEmail(scope: CatalogTx, contactId: string): Promise<string> {
  const contacts = await readOwnedContactDocsInTransaction(scope.tx, scope.db, scope.ctx.companyId, [contactId]);
  const contact = contacts.get(contactId);
  if (contact === undefined) throw new CatalogWriteError('invalid', [{ code: 'unknownParty', path: 'contactId' }]);
  const email = primaryEmailOf(extractContactEmails(contact));
  if (email === null) throw new CatalogWriteError('invalid', [{ code: 'contactWithoutEmail', path: 'contactId' }]);
  return email;
}

async function stageIssue(scope: CatalogTx, input: IssueSupplyInvitationInput, draft: MintedDraft): Promise<SupplyInvitation> {
  const { ctx, db, tx } = scope;
  const email = await readContactEmail(scope, input.contactId);
  const held = await isContactHeldElsewhereInTx(tx, db, { supplierCompanyId: ctx.companyId, contactId: input.contactId, buyerCompanyId: null });
  assertNoIssues(held ? [{ code: 'contactAlreadyBound', path: 'contactId' }] : []);
  const party = { kind: 'contact', contactId: input.contactId } as const;
  const assignment = input.customerGroupId === null ? null : await planCustomerAssignment(scope, party, input.customerGroupId);
  const invitation: SupplyInvitation = {
    ...newPendingInvitationCore({ id: draft.id, email, actorUid: ctx.uid, nonceHash: draft.nonceHash, createdAt: draft.createdAt, expiresAtMs: draft.expiresAtMs }),
    companyId: ctx.companyId,
    contactId: input.contactId,
  };
  const staged = await stageInvitationWithSupersede(tx, {
    collection: supplyInvitationsCollection(db),
    invitation,
    liveQuery: liveSupplyInvitationsOfContact(db, ctx.companyId, input.contactId),
    actorUid: ctx.uid,
    nowValue: draft.createdAt,
  });
  staged.commit();
  assignment?.commit();
  scope.pricingViews.push({ kind: 'supply' });
  return invitation;
}

/** **Νέα πρόσκληση = και επαναποστολή:** ανακαλεί ατομικά κάθε ζωντανή της ίδιας επαφής. */
export async function issueSupplyInvitation(ctx: AuthContext, input: IssueSupplyInvitationInput): Promise<IssuedSupplyInvitation> {
  const id = generateSupplyInvitationId();
  const createdAt = nowISO();
  const expiresAtMs = Date.parse(createdAt) + SUPPLY_INVITATION_LIFETIME_DAYS * DAY_MS;
  // Το token βγαίνει ΕΚΤΟΣ συναλλαγής: η επανάληψη της συναλλαγής δεν αλλάζει το nonce που θα ταξιδέψει στο email.
  const { token, nonceHash } = await mintInvitationToken(SUPPLY_INVITE_SECRET_ENV, { id, expiresAtMs, locator: [] });
  const invitation = await runCatalogTransaction(ctx, (scope) => stageIssue(scope, input, { id, nonceHash, expiresAtMs, createdAt }));
  return { invitation, token };
}

/** Ανάκληση από τον προμηθευτή. Ξένη ≡ ανύπαρκτη (`notFound`). */
export async function revokeSupplyInvitation(ctx: AuthContext, invitationId: string): Promise<void> {
  const db = getAdminFirestore();
  const outcome = await revokeInvitationAt(db, supplyInvitationsCollection(db).doc(invitationId), {
    isOwned: (stored) => supplyInvitationFromDocument(stored)?.companyId === ctx.companyId,
    revokedByUid: ctx.uid,
    nowValue: nowISO(),
    observe: (tx) => signalPricingViewsInTx(tx, db, ctx.companyId, [{ kind: 'supply' }]),
  });
  if (outcome.kind === 'absent') throw new CatalogWriteError('notFound');
}
