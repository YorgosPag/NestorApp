/**
 * =============================================================================
 * ΟΙ ΣΥΝΔΕΣΜΟΙ ΜΙΑΣ ΠΡΟΣΚΛΗΣΗΣ — ό,τι κάνει το γραφείο (ADR-876 §5)
 * =============================================================================
 *
 * «Ένας σύνδεσμος = ένα διαπιστευτήριο» (W3C TAG *Capability URLs* · DocuSign · GitHub):
 *
 * · **Αντιγραφή** → **νέος** σύνδεσμος (`copy_link`), επιστρέφεται **μία φορά**. Πριν, ο browser
 *   διάβαζε το ωμό token από το έγγραφο της πρόσκλησης και έχτιζε μόνος του το URL (Ε4/Σ2).
 * · **Επαναποστολή** → νέος σύνδεσμος (`email_resend`) στο καταχωρημένο email. Οι προηγούμενοι
 *   **δεν** πεθαίνουν — δεν ακυρώνουμε email που ο προμηθευτής ήδη κρατά.
 * · **Ανάκληση ενός συνδέσμου** — χωρίς να αγγίξει τους άλλους (πάνω από DocuSign: εκεί η
 *   ενέργεια είναι ολική).
 * · **Λίστα** → μεταδεδομένα (προέλευση · ποιος · πότε · τελευταία χρήση), **ποτέ** hash.
 *
 * Κάθε πράξη περνά από {@link getVendorInviteOfRfq} (μισθωτής **και** RFQ της διαδρομής) και
 * αφήνει ίχνος (`recordVendorInviteAudit`).
 *
 * @module subapps/procurement/services/vendor-invite-links-service
 * @enterprise ADR-876 §5
 */

import 'server-only';

import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import {
  listVendorCredentials,
  revokeVendorCredential,
} from '@/services/vendor-portal/vendor-invite-credential-store';
import { vendorLinkExpiryMs } from '@/services/vendor-portal/vendor-invite-credential';
import { createModuleLogger } from '@/lib/telemetry';

import type { VendorInvite } from '../types/vendor-invite';
import type { VendorInviteCredentialSummary } from '../types/vendor-invite-credential';
import { isLiveInviteStatus } from '../utils/vendor-invite-status';
import { resolveChannel } from './channels';
import { getRfq } from './rfq-service';
import { recordVendorInviteAudit } from './vendor-invite-audit';
import { issueAdditionalVendorLink } from './vendor-invite-issue';
import {
  VendorInviteStateError,
  fetchVendorContact,
  getVendorInviteOfRfq,
} from './vendor-invite-service';

const logger = createModuleLogger('VENDOR_INVITE_LINKS');

async function requireLiveInvite(ctx: AuthContext, rfqId: string, inviteId: string): Promise<VendorInvite> {
  const invite = await getVendorInviteOfRfq(ctx.companyId, rfqId, inviteId);
  if (!invite) throw new VendorInviteStateError('not_found');
  if (!isLiveInviteStatus(invite.status)) throw new VendorInviteStateError('not_live');
  return invite;
}

/** **Νέος σύνδεσμος για αντιγραφή** — το URL επιστρέφεται μία φορά και δεν αποθηκεύεται. */
export async function issueVendorInviteCopyLink(
  ctx: AuthContext,
  rfqId: string,
  inviteId: string,
): Promise<{ portalUrl: string; expiresAt: string; credentialId: string }> {
  const invite = await requireLiveInvite(ctx, rfqId, inviteId);
  const link = await issueAdditionalVendorLink({
    invite,
    issuedVia: 'copy_link',
    issuedBy: ctx.uid,
    expiresAtMs: vendorLinkExpiryMs(Date.now()),
  });
  recordVendorInviteAudit(ctx, inviteId, 'linked', [
    { field: 'portalLink', oldValue: null, newValue: link.credential.id, label: 'copy_link' },
  ]);
  return { portalUrl: link.portalUrl, expiresAt: link.expiresAtIso, credentialId: link.credential.id };
}

/**
 * Ο **καταχωρημένος** παραλήπτης της πρόσκλησης — στιγμιότυπο πρώτα, ζωντανή επαφή μόνο για
 * παλιά έγγραφα. `null` ⇒ δεν υπάρχει πού να σταλεί. Ο ΜΟΝΟΣ προορισμός κάθε νέου συνδέσμου
 * μέσω email — και της επαναποστολής του γραφείου και της αυτοεξυπηρέτησης λήξης.
 */
export async function resolveInviteRecipient(
  invite: Pick<VendorInvite, 'companyId' | 'vendorContactId' | 'recipientEmail' | 'recipientName'>,
): Promise<{ email: string; name: string } | null> {
  let email = invite.recipientEmail;
  let name = invite.recipientName;
  if ((!email || !name) && invite.vendorContactId) {
    const vendor = await fetchVendorContact(invite.companyId, invite.vendorContactId);
    email = email ?? vendor?.email ?? null;
    name = name ?? vendor?.displayName ?? null;
  }
  return email ? { email, name: name ?? email } : null;
}

/**
 * **Επαναποστολή** με **νέο** σύνδεσμο στο καταχωρημένο email (DocuSign «Resend»). Οι παλιοί
 * σύνδεσμοι μένουν ζωντανοί ως τη λήξη τους ή ως ρητή ανάκληση.
 */
export async function resendVendorInvite(
  ctx: AuthContext,
  rfqId: string,
  inviteId: string,
  options: { locale?: 'el' | 'en' } = {},
): Promise<{ success: boolean; errorReason: string | null }> {
  const invite = await requireLiveInvite(ctx, rfqId, inviteId);
  const recipient = await resolveInviteRecipient(invite);
  if (!recipient) throw new Error('Recipient has no email address');
  const rfq = await getRfq(ctx.companyId, invite.rfqId);
  if (!rfq) throw new VendorInviteStateError('not_found');
  const emailChannel = resolveChannel('email');
  if (!emailChannel) throw new Error('Email channel not available');

  const link = await issueAdditionalVendorLink({
    invite,
    issuedVia: 'email_resend',
    issuedBy: ctx.uid,
    expiresAtMs: vendorLinkExpiryMs(Date.now()),
  });
  const dispatch = await emailChannel.send({
    inviteId,
    vendorName: recipient.name,
    recipient: recipient.email,
    rfqTitle: rfq.title,
    projectName: null,
    portalUrl: link.portalUrl,
    expiresAt: link.expiresAtIso,
    locale: options.locale ?? 'el',
    declineUrl: link.declineUrl,
  });
  recordVendorInviteAudit(ctx, inviteId, 'email_sent', [
    { field: 'portalLink', oldValue: null, newValue: link.credential.id, label: 'email_resend' },
  ]);
  logger.info('Vendor invite resent', { inviteId, credentialId: link.credential.id, success: dispatch.success });
  return { success: dispatch.success, errorReason: dispatch.errorReason };
}

/** Οι σύνδεσμοι μιας πρόσκλησης — μόνο μεταδεδομένα. */
export async function listVendorInviteLinks(
  ctx: AuthContext,
  rfqId: string,
  inviteId: string,
): Promise<VendorInviteCredentialSummary[]> {
  const invite = await getVendorInviteOfRfq(ctx.companyId, rfqId, inviteId);
  if (!invite) throw new VendorInviteStateError('not_found');
  return listVendorCredentials(ctx.companyId, inviteId);
}

/** Ανάκληση **ενός** συνδέσμου. Ιδεμποτική: ήδη ανακλημένος ⇒ επιτυχία χωρίς νέο ίχνος. */
export async function revokeVendorInviteLink(
  ctx: AuthContext,
  rfqId: string,
  inviteId: string,
  credentialId: string,
): Promise<void> {
  const invite = await getVendorInviteOfRfq(ctx.companyId, rfqId, inviteId);
  if (!invite) throw new VendorInviteStateError('not_found');
  const outcome = await revokeVendorCredential({
    companyId: ctx.companyId,
    inviteId,
    credentialId,
    revokedBy: ctx.uid,
    nowIso: nowISO(),
  });
  if (outcome === 'not_found') throw new VendorInviteStateError('not_found');
  if (outcome === 'revoked') {
    recordVendorInviteAudit(ctx, inviteId, 'unlinked', [
      { field: 'portalLink', oldValue: credentialId, newValue: null },
    ]);
  }
}
