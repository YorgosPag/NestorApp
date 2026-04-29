/**
 * =============================================================================
 * Vendor Invite Service — RFQ vendor invite lifecycle
 * =============================================================================
 *
 * Owns vendor_invites collection writes (Admin SDK). Generates HMAC tokens via
 * `vendor-portal-token-service`, dispatches the invite through a `MessageChannel`
 * driver (email/copy_link in P3 day-1), and tracks delivery + lifecycle status.
 *
 * Status machine: sent → opened → submitted | declined | expired
 *
 * @module subapps/procurement/services/vendor-invite-service
 * @enterprise ADR-327 §7 — Phase 3 Vendor Portal
 */

import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateVendorInviteId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AuthContext } from '@/lib/auth';
import {
  generateVendorPortalToken,
  revokeVendorPortalToken,
  adminTimestampAsClient,
  adminTimestampFromDateAsClient,
  type GeneratedVendorPortalToken,
} from '@/services/vendor-portal/vendor-portal-token-service';
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

const logger = createModuleLogger('VENDOR_INVITE_SERVICE');

const DEFAULT_EXPIRY_DAYS = 7;
const EDIT_WINDOW_HOURS = 72; // ADR-327 Q8

// =============================================================================
// CONTACT LOOKUP
// =============================================================================

interface VendorContactSnapshot {
  id: string;
  displayName: string;
  email: string | null;
  preferredChannel: DeliveryChannel | null;
}

async function fetchVendorContact(
  companyId: string,
  contactId: string,
): Promise<VendorContactSnapshot | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    if (data.companyId && data.companyId !== companyId) return null;
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
// PORTAL URL
// =============================================================================

function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://nestor-app.vercel.app';
}

function buildPortalUrl(token: string): string {
  return `${getPortalBaseUrl()}/vendor/quote/${encodeURIComponent(token)}`;
}

function buildDeclineUrl(token: string): string {
  return `${getPortalBaseUrl()}/vendor/quote/${encodeURIComponent(token)}/decline`;
}

// =============================================================================
// CREATE
// =============================================================================

export interface CreateInviteResult {
  invite: VendorInvite;
  portalUrl: string;
  delivery: {
    success: boolean;
    providerMessageId: string | null;
    errorReason: string | null;
  };
}

/**
 * Create a new vendor invite for an RFQ. Persists invite doc, registers the
 * vendor on `RFQ.invitedVendorIds`, and dispatches the configured channel
 * (default `email`, falls back to `copy_link` if email is unavailable).
 */
export async function createVendorInvite(
  ctx: AuthContext,
  dto: CreateVendorInviteDTO,
  options: { locale?: 'el' | 'en' } = {},
): Promise<CreateInviteResult> {
  const rfq = await getRfq(ctx.companyId, dto.rfqId);
  if (!rfq) throw new Error(`RFQ ${dto.rfqId} not found`);
  if (rfq.status === 'archived') throw new Error('Cannot invite vendor on archived RFQ');

  const vendor = await fetchVendorContact(ctx.companyId, dto.vendorContactId);
  if (!vendor) throw new Error(`Vendor contact ${dto.vendorContactId} not found`);

  const expiresInDays = dto.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
  const generated: GeneratedVendorPortalToken = generateVendorPortalToken(
    dto.rfqId,
    dto.vendorContactId,
    expiresInDays,
  );
  const portalUrl = buildPortalUrl(generated.token);
  const declineUrl = buildDeclineUrl(generated.token);

  const requestedChannel: DeliveryChannel = dto.deliveryChannel;
  const channelDriver =
    resolveChannel(requestedChannel) ?? resolveChannel('copy_link');
  if (!channelDriver) throw new Error('No delivery channel available');
  const effectiveChannel: DeliveryChannel = channelDriver.id;

  const inviteId = generateVendorInviteId();
  const now = adminTimestampAsClient();
  const expiresAt = adminTimestampFromDateAsClient(new Date(generated.expiresAt));

  const invite: VendorInvite = {
    id: inviteId,
    rfqId: dto.rfqId,
    vendorContactId: dto.vendorContactId,
    companyId: ctx.companyId,
    token: generated.token,
    deliveryChannel: effectiveChannel,
    preferredChannel: vendor.preferredChannel,
    status: 'sent',
    deliveredAt: null,
    openedAt: null,
    submittedAt: null,
    declinedAt: null,
    declineReason: null,
    expiresAt,
    editWindowExpiresAt: null,
    remindersSentAt: [],
    lastReminderAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const dispatch =
    effectiveChannel === 'email' && !vendor.email
      ? {
          success: false,
          providerMessageId: null,
          errorReason: 'Vendor contact has no email address',
          channel: 'email' as DeliveryChannel,
        }
      : await channelDriver.send({
          inviteId,
          vendorName: vendor.displayName,
          recipient: effectiveChannel === 'email' ? vendor.email! : portalUrl,
          rfqTitle: rfq.title,
          projectName: null,
          portalUrl,
          expiresAt: generated.expiresAt,
          locale: options.locale ?? 'el',
          declineUrl,
        });

  await safeFirestoreOperation<void>(async (db) => {
    const batch = db.batch();
    batch.set(
      db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId),
      sanitizeForFirestore({
        ...invite,
        deliveredAt: dispatch.success ? now : null,
      }),
    );
    if (!rfq.invitedVendorIds.includes(dto.vendorContactId)) {
      batch.update(db.collection(COLLECTIONS.RFQS).doc(dto.rfqId), {
        invitedVendorIds: FieldValue.arrayUnion(dto.vendorContactId),
        updatedAt: now,
      });
    }
    await batch.commit();
  }, undefined);

  logger.info('Vendor invite created', {
    inviteId,
    rfqId: dto.rfqId,
    vendorContactId: dto.vendorContactId,
    channel: effectiveChannel,
    delivered: dispatch.success,
  });

  return {
    invite: { ...invite, deliveredAt: dispatch.success ? now : null },
    portalUrl,
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
    const invite = { id: snap.id, ...snap.data() } as VendorInvite;
    if (invite.companyId !== companyId) return null;
    return invite;
  }, null);
}

/**
 * Resolve invite by token (used by public vendor portal page — no auth).
 * Caller MUST validate the token via `validateVendorPortalTokenSignature`
 * BEFORE invoking this to avoid Firestore lookups on forged tokens.
 */
export async function getVendorInviteByToken(token: string): Promise<VendorInvite | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.VENDOR_INVITES)
      .where('token', '==', token)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as VendorInvite;
  }, null);
}

export async function listVendorInvitesByRfq(
  companyId: string,
  rfqId: string,
): Promise<VendorInvite[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.VENDOR_INVITES)
      .where('companyId', '==', companyId)
      .where('rfqId', '==', rfqId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorInvite));
  }, []);
}

export async function listVendorInvitesByVendor(
  companyId: string,
  vendorContactId: string,
): Promise<VendorInvite[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.VENDOR_INVITES)
      .where('companyId', '==', companyId)
      .where('vendorContactId', '==', vendorContactId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VendorInvite));
  }, []);
}

// =============================================================================
// STATUS TRANSITIONS
// =============================================================================

async function patchInvite(
  inviteId: string,
  updates: Partial<VendorInvite>,
): Promise<void> {
  await safeFirestoreOperation<void>(async (db) => {
    await db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId).update(
      sanitizeForFirestore({
        ...updates,
        updatedAt: adminTimestampAsClient(),
      }),
    );
  }, undefined);
}

/**
 * Mark invite as `opened` the first time the vendor visits the portal page.
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
    if (data.status === 'sent') {
      tx.update(ref, {
        status: 'opened' satisfies InviteStatus,
        openedAt: now,
        updatedAt: now,
      });
    } else if (!data.openedAt) {
      tx.update(ref, {
        openedAt: now,
        updatedAt: now,
      });
    }
  });
}

/**
 * Mark invite submitted. Opens 72h edit window per Q8.
 */
export async function markInviteSubmitted(inviteId: string): Promise<void> {
  const submittedAt = adminTimestampAsClient();
  const editWindowExpiresAt = adminTimestampFromDateAsClient(
    new Date(Date.now() + EDIT_WINDOW_HOURS * 60 * 60 * 1000),
  );
  await patchInvite(inviteId, {
    status: 'submitted',
    submittedAt,
    editWindowExpiresAt,
  });
  logger.info('Vendor invite submitted', { inviteId, editWindowHours: EDIT_WINDOW_HOURS });
}

export async function markInviteDeclined(
  inviteId: string,
  reason: string | null,
): Promise<void> {
  await patchInvite(inviteId, {
    status: 'declined',
    declinedAt: adminTimestampAsClient(),
    declineReason: reason,
  });
  logger.info('Vendor invite declined', { inviteId, hasReason: !!reason });
}

/**
 * Revoke invite (PM action) — invalidates token + stops reminders.
 */
// =============================================================================
// RESEND
// =============================================================================

/**
 * Re-send the invite email for an existing invite. Always uses email channel.
 * Used by the UnifiedShareDialog email button (ADR-327 Phase H).
 */
export async function resendVendorInvite(
  ctx: AuthContext,
  inviteId: string,
  options: { locale?: 'el' | 'en' } = {},
): Promise<{ success: boolean; errorReason: string | null }> {
  const invite = await getVendorInvite(ctx.companyId, inviteId);
  if (!invite) throw new Error(`Vendor invite ${inviteId} not found`);
  if (invite.status === 'expired' || invite.status === 'declined') {
    throw new Error(`Cannot resend invite with status '${invite.status}'`);
  }

  const vendor = await fetchVendorContact(ctx.companyId, invite.vendorContactId);
  if (!vendor) throw new Error(`Vendor contact ${invite.vendorContactId} not found`);
  if (!vendor.email) throw new Error('Vendor contact has no email address');

  const rfq = await getRfq(ctx.companyId, invite.rfqId);
  if (!rfq) throw new Error(`RFQ ${invite.rfqId} not found`);

  const emailChannel = resolveChannel('email');
  if (!emailChannel) throw new Error('Email channel not available');

  const expiresTs = invite.expiresAt as unknown as { toDate?: () => Date; seconds?: number };
  const expiresDate = expiresTs.toDate?.() ?? new Date((expiresTs.seconds ?? 0) * 1000);

  const dispatch = await emailChannel.send({
    inviteId,
    vendorName: vendor.displayName,
    recipient: vendor.email,
    rfqTitle: rfq.title,
    projectName: null,
    portalUrl: buildPortalUrl(invite.token),
    expiresAt: expiresDate.toISOString(),
    locale: options.locale ?? 'el',
    declineUrl: buildDeclineUrl(invite.token),
  });

  logger.info('Vendor invite resent', { inviteId, success: dispatch.success });
  return { success: dispatch.success, errorReason: dispatch.errorReason };
}

export async function revokeVendorInvite(
  ctx: AuthContext,
  inviteId: string,
): Promise<void> {
  const invite = await getVendorInvite(ctx.companyId, inviteId);
  if (!invite) throw new Error(`Vendor invite ${inviteId} not found`);

  try {
    const decoded = await import('@/services/vendor-portal/vendor-portal-token-service').then((m) =>
      m.validateVendorPortalTokenSignature(invite.token),
    );
    if (decoded.valid) {
      await revokeVendorPortalToken(decoded.payload.nonce, ctx.uid);
    }
  } catch (err) {
    logger.warn('Token revoke skipped — could not parse', {
      inviteId,
      error: getErrorMessage(err, 'unknown'),
    });
  }

  await patchInvite(inviteId, { status: 'expired' });
}
