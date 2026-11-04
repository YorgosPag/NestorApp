/**
 * =============================================================================
 * Vendor Invite Service — RFQ vendor invite lifecycle
 * =============================================================================
 *
 * Owns vendor_invites collection writes (Admin SDK). The invite document holds
 * **no credential** (ADR-876 §5): every portal link is a separate hashed record in
 * `vendor_invite_credentials`, issued through `vendor-invite-issue` and read through
 * `vendor-invite-credential-store`. Office-side link operations (copy · resend ·
 * revoke one link) live in `vendor-invite-links-service`.
 *
 * Status machine: pending → sent → opened → submitted | declined | revoked
 * («έληξε» is DERIVED from `expiresAt`, never stored — see `utils/vendor-invite-status`).
 *
 * @module subapps/procurement/services/vendor-invite-service
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal · ADR-876 §5
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import type { AuthContext } from '@/lib/auth';
import {
  adminTimestampAsClient,
  adminTimestampFromDateAsClient,
} from '@/services/vendor-portal/admin-client-timestamp';
import { readLiveCredentialRefsTx } from '@/services/vendor-portal/vendor-invite-credential-store';
import { nowISO } from '@/lib/date-local';
import type { VendorInvite, InviteStatus } from '../types/vendor-invite';
import { isLiveInviteStatus, normalizeInviteStatus } from '../utils/vendor-invite-status';
import { recordVendorInviteAudit } from './vendor-invite-audit';

const logger = createModuleLogger('VENDOR_INVITE_SERVICE');


// =============================================================================
// CONTACT LOOKUP — η ΜΙΑ κρίση παραλήπτη ζει στο `vendor-recipient` (ADR-923 §5.13 Τ5)
// =============================================================================

export { fetchVendorContact, type VendorContactSnapshot } from './vendor-recipient';

// =============================================================================
// CREATE — ζει στο `vendor-invite-create` (ADR-923 §5.13 Τ5 Λ1β Σ1: κράτηση σε ΜΙΑ συναλλαγή)
// =============================================================================

export { createVendorInvite, VendorInviteRefusal, type CreateInviteResult, type VendorInviteRefusalCode } from './vendor-invite-create';

// =============================================================================
// READ
// =============================================================================

export async function getVendorInvite(
  companyId: string,
  inviteId: string,
): Promise<VendorInvite | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId).get();
    if (!snap.exists) return null;
    if (!isPayloadOwnedByCompany(snap.data(), companyId)) return null;
    const invite = { id: snap.id, ...snap.data() } as VendorInvite;
    return { ...invite, status: normalizeInviteStatus(invite.status) };
  }, null);
}

/**
 * Η πρόσκληση **αυτού του RFQ** — ξένη εταιρεία ή άλλο RFQ ⇒ `null`. Οι διαδρομές του
 * γραφείου (`/api/rfqs/[id]/invites/[inviteId]/…`) αγνοούσαν το `[id]`.
 */
export async function getVendorInviteOfRfq(
  companyId: string,
  rfqId: string,
  inviteId: string,
): Promise<VendorInvite | null> {
  const invite = await getVendorInvite(companyId, inviteId);
  return invite && invite.rfqId === rfqId ? invite : null;
}

/**
 * Οι προσκλήσεις μιας εταιρείας, **φιλτραρισμένες σε ένα ακόμη πεδίο**, νεότερες πρώτα.
 *
 * ⚠️ **Το `companyId` μένει ΠΡΩΤΟ και δεν είναι παράμετρος**: είναι ο φράχτης μισθωτή
 * (CHECK 3.10/3.35), όχι κριτήριο αναζήτησης.
 */
function listInvitesWhere(
  companyId: string,
  field: 'rfqId' | 'vendorContactId',
  value: string,
): Promise<VendorInvite[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.VENDOR_INVITES)
      .where('companyId', '==', companyId)
      .where(field, '==', value)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorInvite));
  }, []);
}

export function listVendorInvitesByRfq(companyId: string, rfqId: string): Promise<VendorInvite[]> {
  return listInvitesWhere(companyId, 'rfqId', rfqId);
}

export function listVendorInvitesByVendor(
  companyId: string,
  vendorContactId: string,
): Promise<VendorInvite[]> {
  return listInvitesWhere(companyId, 'vendorContactId', vendorContactId);
}

// =============================================================================
// STATUS TRANSITIONS
// =============================================================================

async function patchInvite(inviteId: string, updates: Partial<VendorInvite>): Promise<void> {
  await safeFirestoreOperation<void>(async (db) => {
    await db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId).update(
      sanitizeForFirestore({ ...updates, updatedAt: adminTimestampAsClient() }),
    );
  }, undefined);
}

/**
 * Mark invite as `opened` the first time the vendor visits the portal.
 * No-op if status has progressed beyond `opened` (e.g. already submitted).
 */
export async function markInviteOpened(inviteId: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() as VendorInvite;
    const now = admin.firestore.Timestamp.now();
    if (data.status === 'pending' || data.status === 'sent') {
      tx.update(ref, { status: 'opened' satisfies InviteStatus, openedAt: now, updatedAt: now });
    } else if (!data.openedAt) {
      tx.update(ref, { openedAt: now, updatedAt: now });
    }
  });
}

/** Mark invite submitted. Opens 72h edit window per Q8. */
/**
 * Πρώτη υποβολή: κατάσταση + παράθυρο + **η απάντηση της πρόσκλησης** (`quoteId`, ADR-876 §5 Σ19).
 * `editWindowEnd` από τον καλούντα (`vendorQuoteEditWindowEnd`) — η ΙΔΙΑ στιγμή με την προσφορά.
 */
export async function markInviteSubmitted(inviteId: string, editWindowEnd: Date, quoteId: string): Promise<void> {
  await patchInvite(inviteId, {
    status: 'submitted',
    submittedAt: adminTimestampAsClient(),
    editWindowExpiresAt: adminTimestampFromDateAsClient(editWindowEnd),
    quoteId,
  });
  logger.info('Vendor invite submitted', { inviteId, quoteId, editWindowExpiresAt: editWindowEnd.toISOString() });
}

export async function markInviteDeclined(inviteId: string, reason: string | null): Promise<void> {
  await patchInvite(inviteId, {
    status: 'declined',
    declinedAt: adminTimestampAsClient(),
    declineReason: reason,
  });
  logger.info('Vendor invite declined', { inviteId, hasReason: !!reason });
}

// =============================================================================
// REVOKE (whole invite)
// =============================================================================

/** Γιατί δεν ανακλήθηκε — ονομασμένο, ώστε η διαδρομή να απαντήσει 404 ή 409 σωστά. */
/**
 * `not_found` 404 · `not_live` 409 · ADR-923 §5.13 Τ5: `delivery_in_progress` 409 (το outbox θα τη στείλει — δεύτερο email
 * θα ήταν διπλό) · `resend_quota_exhausted` 429 (`VENDOR_INVITE_RESEND_QUOTA`).
 */
export type VendorInviteStateCode =
  | 'not_found' | 'not_live' | 'delivery_in_progress' | 'resend_quota_exhausted'
  /** Λ1β Μ2 — το store του ορίου δεν απάντησε: fail-closed, 503. */
  | 'quota_unavailable';

const STATE_ERROR_MESSAGES: Record<VendorInviteStateCode, string> = {
  not_found: 'Vendor invite not found',
  not_live: 'Vendor invite is no longer live',
  delivery_in_progress: 'Vendor invite delivery is still in progress',
  resend_quota_exhausted: 'Vendor invite resend quota exhausted',
  quota_unavailable: 'Vendor invite quota store unavailable',
};

export class VendorInviteStateError extends Error {
  constructor(readonly code: VendorInviteStateCode) {
    super(STATE_ERROR_MESSAGES[code]);
    this.name = 'VendorInviteStateError';
  }
}

/**
 * **Ανάκληση πρόσκλησης** (DocuSign «Void»): `status: 'revoked'` + ανάκληση **όλων** των ζωντανών
 * συνδέσμων της, σε **μία** transaction — ποτέ πρόσκληση ανακλημένη με σύνδεσμο που ακόμη ανοίγει.
 *
 * ⚠️ Μόνο ζωντανή πρόσκληση (`pending|sent|opened`): υποβεβλημένη προσφορά **δεν** ακυρώνεται
 * από εδώ (το UI το έκρυβε ήδη· ο server δεν το έλεγχε — ADR-876 Σ5).
 * **Ιδεμποτική** (ADR-876 §5 Σ20): ήδη ανακλημένη ⇒ επιτυχία χωρίς εγγραφή/audit — όπως η ανάκληση
 * ενός συνδέσμου. Ήταν 409 `not_live`: δεύτερο μέλος που πατούσε «Απόσυρση» έβλεπε σφάλμα ενώ
 * η κατάσταση που ζήτησε ίσχυε ήδη.
 */
export async function revokeVendorInvite(ctx: AuthContext, rfqId: string, inviteId: string): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId);
  const nowIso = nowISO();
  const revokedLinks = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as VendorInvite | undefined;
    if (!data || !isPayloadOwnedByCompany(data, ctx.companyId) || data.rfqId !== rfqId) {
      throw new VendorInviteStateError('not_found');
    }
    // Η ΑΠΟΘΗΚΕΥΜΕΝΗ τιμή: μια άγνωστη τιμή (π.χ. `'expired'`, που είναι ΜΟΝΟ παράγωγη) δεν «περνά» σιωπηλά χωρίς ανάκληση συνδέσμων.
    if (data.status === 'revoked') return null;
    if (!isLiveInviteStatus(normalizeInviteStatus(data.status))) throw new VendorInviteStateError('not_live');
    const liveRefs = await readLiveCredentialRefsTx(tx, db, ctx.companyId, inviteId);
    tx.update(ref, { status: 'revoked' satisfies InviteStatus, updatedAt: admin.firestore.Timestamp.now() });
    for (const credentialRef of liveRefs) tx.update(credentialRef, { revokedAt: nowIso, revokedBy: ctx.uid });
    return liveRefs.length;
  });
  if (revokedLinks === null) return;
  recordVendorInviteAudit(ctx, inviteId, 'status_changed', [
    { field: 'status', oldValue: 'live', newValue: 'revoked' },
  ]);
  logger.info('Vendor invite revoked', { inviteId, revokedLinks });
}
