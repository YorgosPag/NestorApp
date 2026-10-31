import 'server-only';

/**
 * **Οι όψεις `supply`, μία ανά πλευρά** (ADR-923 §5.12): ζωντανές με το ίδιο σήμα (ADR-905), που ο γραφέας της σχέσης
 * αυξάνει **και στους δύο** χώρους. Μία συναλλαγή ανάγνωσης ανά όψη: αριθμός και δεδομένα είναι το ίδιο στιγμιότυπο.
 *
 * 🔒 Η συλλογή είναι `deny_all`: ο πελάτης δεν βλέπει ποτέ το έγγραφο, μόνο την προβολή της πλευράς του.
 * 🔑 Το όνομα του άλλου χώρου διαβάζεται **ζωντανά** και **μόνο** όταν υπάρχει σχέση: η σχέση είναι το δικαίωμα να τον
 *    ξέρεις. Καμία αναζήτηση χώρων πουθενά (Σ3).
 * @module server/supply-relationships/supply-views.server
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { presentedInvitationState } from '@/server/invitations/invitation-lifecycle';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import { readOwnedContactDocsInTransaction } from '@/server/lib/owned-contact-docs';
import { readPricingViewRevisionInTx } from '@/server/catalog/pricing-view-signal.server';
import { pricingFreshUntil } from '@/subapps/catalog/pricing/pricing-view-freshness';
import { supplyInvitationFromDocument, supplyRelationshipFromDocument } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import type { SupplyInvitation } from '@/subapps/catalog/types/supply-invitation';
import type { SupplyRelationship, SupplyRelationshipState } from '@/subapps/catalog/types/supply-relationship';
import type {
  BuyerRelationshipRow,
  BuyerRelationshipState,
  BuyerSupplyView,
  SupplierInvitationRow,
  SupplierRelationshipRow,
  SupplierSupplyView,
} from '@/subapps/catalog/types/supply-views';

import { supplyInvitationsCollection } from './supply-invitation-issue.server';
import { readSupplyRequestLinkInTx, supplyRequestLinkViewOf } from './supply-request-link.server';

/** Φραγμένο ρητά: η λίστα σχέσεων ενός χώρου είναι εκατοντάδες, όχι χιλιάδες. Ξεπερνώντας το, θέλει σελιδοποίηση. */
const SUPPLY_VIEW_LIMIT = 500;

const BUYER_STATE: Readonly<Record<SupplyRelationshipState, BuyerRelationshipState>> = {
  requested: 'requested',
  active: 'active',
  declined: 'ended',
  revoked: 'ended',
};

/** Το όνομα ανά χώρο, με **μία** `getAll` μέσα στη συναλλαγή. */
async function readCompanyNames(tx: Transaction, db: Firestore, companyIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const unique = [...new Set(companyIds)];
  if (unique.length === 0) return new Map();
  const snapshots = await tx.getAll(...unique.map((id) => db.collection(COLLECTIONS.COMPANIES).doc(id)));
  const names = new Map<string, string>();
  for (const snapshot of snapshots) {
    const name = snapshot.get('name');
    if (typeof name === 'string' && name.trim() !== '') names.set(snapshot.id, name.trim());
  }
  return names;
}

const relationshipsOf = (snap: FirebaseFirestore.QuerySnapshot): SupplyRelationship[] =>
  snap.docs.flatMap((doc) => supplyRelationshipFromDocument(doc.data()) ?? []);

function supplierRow(relationship: SupplyRelationship, names: { readonly buyers: ReadonlyMap<string, string>; readonly contacts: ReadonlyMap<string, string> }): SupplierRelationshipRow {
  const { id, buyerCompanyId, state, origin, supplierContactId, customerRef, requestedAt, acceptedAt, endedBySide, endedAt, revision } = relationship;
  return {
    id, buyerCompanyId, state, origin, supplierContactId, customerRef, requestedAt, acceptedAt, endedBySide, endedAt, revision,
    buyerName: names.buyers.get(buyerCompanyId) ?? null,
    contactName: supplierContactId === null ? null : names.contacts.get(supplierContactId) ?? null,
  };
}

function invitationRow(invitation: SupplyInvitation, nowValue: string, contacts: ReadonlyMap<string, string>): SupplierInvitationRow {
  return {
    id: invitation.id,
    contactId: invitation.contactId,
    contactName: contacts.get(invitation.contactId) ?? null,
    inviteeEmail: invitation.inviteeEmail,
    state: presentedInvitationState(invitation, nowValue),
    sentAt: invitation.createdAt,
    openedAt: invitation.openedAt,
    expiresAt: invitation.expiresAt,
  };
}

async function readContactNames(tx: Transaction, db: Firestore, companyId: string, contactIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const contacts = await readOwnedContactDocsInTransaction(tx, db, companyId, contactIds);
  return new Map([...contacts].map(([id, data]) => [id, extractContactDisplayName(data).trim()]));
}

/** Οι εκκρεμείς προσκλήσεις του προμηθευτή. Μόνο ισότητες ⇒ κανένας σύνθετος δείκτης. */
async function readPendingInvitations(tx: Transaction, db: Firestore, companyId: string): Promise<SupplyInvitation[]> {
  const snap = await tx.get(supplyInvitationsCollection(db).where('companyId', '==', companyId).where('state', '==', 'pending').limit(SUPPLY_VIEW_LIMIT));
  return snap.docs.flatMap((doc) => supplyInvitationFromDocument(doc.data()) ?? []);
}

/** Η όψη του προμηθευτή: σχέσεις · εκκρεμείς προσκλήσεις · ο σύνδεσμος. */
export function readSupplierSupplyView(ctx: AuthContext, nowMs = Date.now()): Promise<SupplierSupplyView> {
  const db = getAdminFirestore();
  return db.runTransaction(async (tx) => {
    const revision = await readPricingViewRevisionInTx(tx, db, ctx.companyId, { kind: 'supply' });
    const relationships = relationshipsOf(await tx.get(db.collection(COLLECTIONS.SUPPLY_RELATIONSHIPS).where('companyId', '==', ctx.companyId).limit(SUPPLY_VIEW_LIMIT)));
    const invitations = await readPendingInvitations(tx, db, ctx.companyId);
    const link = await readSupplyRequestLinkInTx(tx, db, ctx.companyId);
    const buyers = await readCompanyNames(tx, db, relationships.map((relationship) => relationship.buyerCompanyId));
    const contactIds = [...relationships.flatMap((relationship) => relationship.supplierContactId ?? []), ...invitations.map((invitation) => invitation.contactId)];
    const contacts = await readContactNames(tx, db, ctx.companyId, contactIds);
    const nowValue = new Date(nowMs).toISOString();
    return {
      freshness: { revision, freshUntil: pricingFreshUntil(nowMs, invitations.map((invitation) => invitation.expiresAt)) },
      relationships: relationships.map((relationship) => supplierRow(relationship, { buyers, contacts })),
      invitations: invitations.map((invitation) => invitationRow(invitation, nowValue, contacts)),
      link: supplyRequestLinkViewOf(link),
    };
  }, { readOnly: true });
}

function buyerRow(relationship: SupplyRelationship, suppliers: ReadonlyMap<string, string>): BuyerRelationshipRow {
  return {
    id: relationship.id,
    supplierCompanyId: relationship.companyId,
    supplierName: suppliers.get(relationship.companyId) ?? null,
    state: BUYER_STATE[relationship.state],
    customerRef: relationship.customerRef,
    revision: relationship.revision,
  };
}

/** Η όψη του αγοραστή: οι προμηθευτές του. */
export function readBuyerSupplyView(ctx: AuthContext, nowMs = Date.now()): Promise<BuyerSupplyView> {
  const db = getAdminFirestore();
  return db.runTransaction(async (tx) => {
    const revision = await readPricingViewRevisionInTx(tx, db, ctx.companyId, { kind: 'supply' });
    // firestore-tenant-scope-exempt: έγγραφο δύο πλευρών· ο αγοραστής είναι ο δεύτερος ιδιοκτήτης του, με το δικό του πεδίο.
    const query = db.collection(COLLECTIONS.SUPPLY_RELATIONSHIPS).where('buyerCompanyId', '==', ctx.companyId).limit(SUPPLY_VIEW_LIMIT);
    const relationships = relationshipsOf(await tx.get(query));
    const suppliers = await readCompanyNames(tx, db, relationships.map((relationship) => relationship.companyId));
    return {
      freshness: { revision, freshUntil: pricingFreshUntil(nowMs, []) },
      relationships: relationships.map((relationship) => buyerRow(relationship, suppliers)),
    };
  }, { readOnly: true });
}
