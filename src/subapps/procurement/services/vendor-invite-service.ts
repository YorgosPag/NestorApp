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
import { safeFirestoreOperation, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
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
import { resolveChannel } from './channels';
import { pickContactDisplayName } from './vendor-name-resolver';
import type {
  VendorInvite,
  CreateVendorInviteDTO,
  DeliveryChannel,
  InviteStatus,
} from '../types/vendor-invite';
import { getRfq } from './rfq-service';
import { getContactEmail } from '@/services/contacts/contact-name-resolver-types';
import { isLiveInviteStatus, normalizeInviteStatus } from '../utils/vendor-invite-status';
import { prepareVendorInvite, writePreparedVendorInvite } from './vendor-invite-issue';
import { recordVendorInviteAudit } from './vendor-invite-audit';

const logger = createModuleLogger('VENDOR_INVITE_SERVICE');


// =============================================================================
// CONTACT LOOKUP
// =============================================================================

export interface VendorContactSnapshot {
  id: string;
  displayName: string;
  email: string | null;
  preferredChannel: DeliveryChannel | null;
}

export async function fetchVendorContact(
  companyId: string,
  contactId: string,
): Promise<VendorContactSnapshot | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    // Επαφή χωρίς `companyId` δεν ανήκει σε κανέναν (ADR-742 §4 · ADR-876 §5 Σ15) — ήταν `data.companyId && …`.
    if (!isPayloadOwnedByCompany(data, companyId)) return null;
    const supplierPersona = data.supplierPersona as { preferredChannel?: DeliveryChannel } | undefined;
    return {
      id: snap.id,
      displayName: pickContactDisplayName(data) ?? contactId,
      email: getContactEmail(data as Parameters<typeof getContactEmail>[0]),
      preferredChannel: supplierPersona?.preferredChannel ?? null,
    };
  }, null);
}

// =============================================================================
// CREATE
// =============================================================================

export interface CreateInviteResult {
  invite: VendorInvite;
  /** Ο σύνδεσμος — επιστρέφεται **μία φορά**, στη δημιουργία. Δεν αποθηκεύεται πουθενά. */
  portalUrl: string;
  delivery: {
    success: boolean;
    providerMessageId: string | null;
    errorReason: string | null;
  };
}

interface ResolvedRecipient {
  vendorContactId: string;
  displayName: string;
  email: string | null;
  preferredChannel: DeliveryChannel | null;
}

async function resolveRecipient(
  ctx: AuthContext,
  dto: CreateVendorInviteDTO,
): Promise<ResolvedRecipient> {
  if (dto.vendorContactId !== undefined) {
    const vendor = await fetchVendorContact(ctx.companyId, dto.vendorContactId);
    if (!vendor) throw new Error(`Vendor contact ${dto.vendorContactId} not found`);
    return {
      vendorContactId: vendor.id,
      displayName: vendor.displayName,
      email: vendor.email,
      preferredChannel: vendor.preferredChannel,
    };
  }
  const email = dto.manualEmail.trim();
  const name = dto.manualName.trim();
  if (!email) throw new Error('manualEmail is required');
  if (!name) throw new Error('manualName is required');
  return { vendorContactId: '', displayName: name, email, preferredChannel: null };
}

type PreparedInvite = Awaited<ReturnType<typeof prepareVendorInvite>>;
type ChannelDriver = NonNullable<ReturnType<typeof resolveChannel>>;

/** Η πρώτη αποστολή — email στον παραλήπτη, ή (copy_link) ο ίδιος ο σύνδεσμος ως «παραλήπτης». */
async function dispatchNewInvite(
  channelDriver: ChannelDriver,
  prepared: PreparedInvite,
  recipient: ResolvedRecipient,
  rfqTitle: string,
  locale: 'el' | 'en',
) {
  const isEmail = channelDriver.id === 'email';
  if (isEmail && !recipient.email) {
    return { success: false, providerMessageId: null, errorReason: 'Recipient has no email address' };
  }
  const { link } = prepared;
  return channelDriver.send({
    inviteId: prepared.invite.id,
    vendorName: recipient.displayName,
    recipient: isEmail && recipient.email ? recipient.email : link.portalUrl,
    rfqTitle,
    projectName: null,
    portalUrl: link.portalUrl,
    expiresAt: link.expiresAtIso,
    locale,
    declineUrl: link.declineUrl,
  });
}

/** Πρόσκληση + διαπιστευτήριο + εγγραφή του προμηθευτή στο RFQ — **ένα** batch. */
async function persistNewInvite(
  invite: VendorInvite,
  link: PreparedInvite['link'],
  vendorContactId: string,
  invitedVendorIds: readonly string[],
): Promise<void> {
  await safeFirestoreOperation<void>(async (db) => {
    const batch = db.batch();
    writePreparedVendorInvite(batch, db, { invite, link });
    if (vendorContactId && !invitedVendorIds.includes(vendorContactId)) {
      batch.update(db.collection(COLLECTIONS.RFQS).doc(invite.rfqId), {
        invitedVendorIds: FieldValue.arrayUnion(vendorContactId),
        updatedAt: invite.createdAt,
      });
    }
    await batch.commit();
  }, undefined);
}

/**
 * Create a new vendor invite for an RFQ. Persists invite + first credential, registers
 * the vendor on `RFQ.invitedVendorIds`, and dispatches the configured channel (default
 * `email`, falls back to `copy_link` if email is unavailable).
 */
export async function createVendorInvite(
  ctx: AuthContext,
  dto: CreateVendorInviteDTO,
  options: { locale?: 'el' | 'en' } = {},
): Promise<CreateInviteResult> {
  const rfq = await getRfq(ctx.companyId, dto.rfqId);
  if (!rfq) throw new Error(`RFQ ${dto.rfqId} not found`);
  if (rfq.status === 'archived') throw new Error('Cannot invite vendor on archived RFQ');

  const recipient = await resolveRecipient(ctx, dto);
  const channelDriver = resolveChannel(dto.deliveryChannel) ?? resolveChannel('copy_link');
  if (!channelDriver) throw new Error('No delivery channel available');
  const effectiveChannel: DeliveryChannel = channelDriver.id;

  const prepared = await prepareVendorInvite({
    companyId: ctx.companyId,
    rfqId: dto.rfqId,
    vendorContactId: recipient.vendorContactId,
    deliveryChannel: effectiveChannel,
    preferredChannel: recipient.preferredChannel,
    status: 'pending',
    recipientEmail: recipient.email,
    recipientName: recipient.displayName,
    issuedVia: effectiveChannel === 'email' ? 'invite_email' : 'copy_link',
    issuedBy: ctx.uid,
    expiresInDays: dto.expiresInDays,
  });
  const { link } = prepared;
  const dispatch = await dispatchNewInvite(channelDriver, prepared, recipient, rfq.title, options.locale ?? 'el');

  const status: InviteStatus = effectiveChannel === 'copy_link' || !dispatch.success ? 'pending' : 'sent';
  const invite: VendorInvite = {
    ...prepared.invite,
    status,
    deliveredAt: dispatch.success ? prepared.invite.createdAt : null,
  };
  await persistNewInvite(invite, link, recipient.vendorContactId, rfq.invitedVendorIds);

  logger.info('Vendor invite created', {
    inviteId: invite.id,
    rfqId: dto.rfqId,
    vendorContactId: recipient.vendorContactId || '<manual>',
    channel: effectiveChannel,
    delivered: dispatch.success,
  });

  return {
    invite,
    portalUrl: link.portalUrl,
    delivery: {
      success: dispatch.success,
      providerMessageId: dispatch.providerMessageId,
      errorReason: dispatch.errorReason,
    },
  };
}

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
export class VendorInviteStateError extends Error {
  constructor(readonly code: 'not_found' | 'not_live') {
    super(code === 'not_found' ? 'Vendor invite not found' : 'Vendor invite is no longer live');
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
