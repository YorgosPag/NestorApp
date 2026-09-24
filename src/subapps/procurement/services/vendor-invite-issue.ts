/**
 * =============================================================================
 * ΕΚΔΟΣΗ ΠΡΟΣΚΛΗΣΗΣ + ΣΥΝΔΕΣΜΟΥ — ο ΕΝΑΣ κατασκευαστής (ADR-876 §5 Σ3)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: το έγγραφο πρόσκλησης χτιζόταν **με το χέρι σε δύο σημεία**
 * (`vendor-invite-service.createVendorInvite` · `rfq-service.createRfq` fan-out), με ωμό
 * `token` και στα δύο. Αλλαγή σχήματος στο ένα θα άφηνε το άλλο να γράφει το μυστικό σιωπηλά
 * — ακριβώς η διαρροή που κλείνει το ADR-876 Ε4. Τώρα και οι δύο γραφείς ζητούν από εδώ
 * **{έγγραφο, διαπιστευτήριο, σύνδεσμο}** και τα γράφουν στο **ίδιο** batch.
 *
 * Το ίδιο σημείο εκδίδει και **επιπλέον** συνδέσμους για υπάρχουσα πρόσκληση (αντιγραφή ·
 * επαναποστολή · αυτοεξυπηρέτηση): νέο διαπιστευτήριο + `expiresAt` της πρόσκλησης = ο
 * νεότερος σύνδεσμος. Οι παλιοί **δεν** πεθαίνουν (ADR-876 §5 — ανάκληση ανά σύνδεσμο).
 *
 * @module subapps/procurement/services/vendor-invite-issue
 * @enterprise ADR-876 §5 · ADR-327 §7
 */

import 'server-only';

import admin from 'firebase-admin';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { generateVendorInviteId } from '@/services/enterprise-id.service';
import { adminTimestampAsClient } from '@/services/vendor-portal/admin-client-timestamp';
import {
  mintVendorInviteCredential,
  vendorLinkExpiryMs,
} from '@/services/vendor-portal/vendor-invite-credential';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';

import type { DeliveryChannel, InviteStatus, VendorInvite } from '../types/vendor-invite';
import type {
  VendorCredentialOrigin,
  VendorInviteCredential,
} from '../types/vendor-invite-credential';
import { vendorDeclineUrl, vendorPortalUrl } from './vendor-portal-links';

/** Ένας σύνδεσμος έτοιμος προς αποστολή — το `token` ζει μόνο στη μνήμη αυτής της ροής. */
export interface IssuedVendorLink {
  readonly credential: VendorInviteCredential;
  readonly token: string;
  readonly portalUrl: string;
  readonly declineUrl: string;
  readonly expiresAtIso: string;
}

export interface PrepareVendorInviteInput {
  readonly companyId: string;
  readonly rfqId: string;
  readonly vendorContactId: string;
  readonly deliveryChannel: DeliveryChannel;
  readonly preferredChannel: DeliveryChannel | null;
  readonly status: InviteStatus;
  readonly recipientEmail: string | null;
  readonly recipientName: string | null;
  readonly issuedVia: VendorCredentialOrigin;
  readonly issuedBy: string;
  readonly expiresInDays?: number;
}

export interface PreparedVendorInvite {
  readonly invite: VendorInvite;
  readonly link: IssuedVendorLink;
}

function toIssuedLink(credential: VendorInviteCredential, token: string): IssuedVendorLink {
  return {
    credential,
    token,
    portalUrl: vendorPortalUrl(token),
    declineUrl: vendorDeclineUrl(token),
    expiresAtIso: credential.expiresAt,
  };
}

/**
 * **Νέα πρόσκληση + πρώτος σύνδεσμος** — χωρίς εγγραφή. Ο καλών τα γράφει μαζί με ό,τι άλλο
 * ανήκει στην ίδια πράξη (RFQ · `invitedVendorIds`), με {@link writePreparedVendorInvite}.
 */
export async function prepareVendorInvite(input: PrepareVendorInviteInput): Promise<PreparedVendorInvite> {
  const nowMs = Date.now();
  const inviteId = generateVendorInviteId();
  const expiresAtMs = vendorLinkExpiryMs(nowMs, input.expiresInDays);
  const { credential, token } = await mintVendorInviteCredential({
    inviteId,
    rfqId: input.rfqId,
    companyId: input.companyId,
    issuedVia: input.issuedVia,
    issuedBy: input.issuedBy,
    nowIso: new Date(nowMs).toISOString(),
    expiresAtMs,
  });
  return { invite: newInviteDoc(input, inviteId, nowMs, expiresAtMs), link: toIssuedLink(credential, token) };
}

/** Το έγγραφο της νέας πρόσκλησης — **χωρίς** διαπιστευτήριο (ADR-876 §5 Ε4). */
function newInviteDoc(
  input: PrepareVendorInviteInput,
  inviteId: string,
  nowMs: number,
  expiresAtMs: number,
): VendorInvite {
  const now = adminTimestampAsClient(admin.firestore.Timestamp.fromMillis(nowMs));
  return {
    id: inviteId,
    rfqId: input.rfqId,
    vendorContactId: input.vendorContactId,
    companyId: input.companyId,
    deliveryChannel: input.deliveryChannel,
    preferredChannel: input.preferredChannel,
    status: input.status,
    deliveredAt: null,
    openedAt: null,
    submittedAt: null,
    declinedAt: null,
    declineReason: null,
    expiresAt: adminTimestampAsClient(admin.firestore.Timestamp.fromMillis(expiresAtMs)),
    editWindowExpiresAt: null,
    remindersSentAt: [],
    lastReminderAt: null,
    createdAt: now,
    updatedAt: now,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
  };
}

/** Γράψε πρόσκληση + διαπιστευτήριο στο batch του καλούντος — **ποτέ** χωριστά. */
export function writePreparedVendorInvite(
  batch: admin.firestore.WriteBatch,
  db: admin.firestore.Firestore,
  prepared: { readonly invite: VendorInvite; readonly link: IssuedVendorLink },
): void {
  batch.set(db.collection(COLLECTIONS.VENDOR_INVITES).doc(prepared.invite.id), sanitizeForFirestore(prepared.invite));
  batch.set(
    db.collection(COLLECTIONS.VENDOR_INVITE_CREDENTIALS).doc(prepared.link.credential.id),
    prepared.link.credential,
  );
}

export interface IssueAdditionalLinkInput {
  readonly invite: Pick<VendorInvite, 'id' | 'rfqId' | 'companyId'>;
  readonly issuedVia: Exclude<VendorCredentialOrigin, 'invite_email' | 'rfq_fanout' | 'legacy'>;
  readonly issuedBy: string | null;
  readonly expiresAtMs: number;
  readonly requesterIpHash?: string | null;
}

/**
 * **Επιπλέον σύνδεσμος** για υπάρχουσα πρόσκληση. Διαπιστευτήριο + ανανέωση `expiresAt` της
 * πρόσκλησης στο ίδιο batch. Οι προηγούμενοι σύνδεσμοι μένουν ζωντανοί.
 */
export async function issueAdditionalVendorLink(input: IssueAdditionalLinkInput): Promise<IssuedVendorLink> {
  const nowMs = Date.now();
  const { credential, token } = await mintVendorInviteCredential({
    inviteId: input.invite.id,
    rfqId: input.invite.rfqId,
    companyId: input.invite.companyId,
    issuedVia: input.issuedVia,
    issuedBy: input.issuedBy,
    nowIso: new Date(nowMs).toISOString(),
    expiresAtMs: input.expiresAtMs,
    requesterIpHash: input.requesterIpHash,
  });
  const db = getAdminFirestore();
  const batch = db.batch();
  batch.set(db.collection(COLLECTIONS.VENDOR_INVITE_CREDENTIALS).doc(credential.id), credential);
  batch.update(db.collection(COLLECTIONS.VENDOR_INVITES).doc(input.invite.id), {
    expiresAt: admin.firestore.Timestamp.fromMillis(input.expiresAtMs),
    updatedAt: admin.firestore.Timestamp.fromMillis(nowMs),
  });
  await batch.commit();
  return toIssuedLink(credential, token);
}
