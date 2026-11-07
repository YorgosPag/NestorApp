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
import type { VendorCredentialOrigin, VendorInviteCredentialSummary } from '../types/vendor-invite-credential';
import type { InviteRecipientKind } from '../types/vendor-invite-delivery';
import { isLiveInviteStatus } from '../utils/vendor-invite-status';
import { resolveChannel } from './channels';
import { getRfq } from './rfq-service';
import { recordVendorInviteAudit } from './vendor-invite-audit';
import { issueAdditionalVendorLink } from './vendor-invite-issue';
import { VendorInviteStateError, getVendorInviteOfRfq } from './vendor-invite-service';
import { admitPlatformQuoteRequest } from './platform-quote-request';
import { resolveVendorRecipient } from './vendor-recipient';

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

/** Ο παραλήπτης μιας πρόσκλησης, με το **είδος** του: ο φρουρός της πλατφόρμας και η απόκριση εξαρτώνται από αυτό. */
export interface InviteRecipient {
  readonly email: string;
  readonly name: string;
  readonly kind: InviteRecipientKind;
  readonly platformCompanyId: string | null;
}

/**
 * Ο **καταχωρημένος** παραλήπτης της πρόσκλησης — στιγμιότυπο πρώτα, ζωντανή κρίση (`resolveVendorRecipient`) μόνο όταν
 * λείπει. `null` ⇒ δεν υπάρχει πού να σταλεί. Ο ΜΟΝΟΣ προορισμός κάθε νέου συνδέσμου μέσω email — και της επαναποστολής
 * του γραφείου και της αυτοεξυπηρέτησης λήξης.
 *
 * 🔑 ADR-923 §5.13 Τ5: πρόσκληση προς χώρο της πλατφόρμας δεν έχει ποτέ στιγμιότυπο email (η διεύθυνση είναι ιδιωτική του
 *    προμηθευτή), άρα λύνεται **πάντα** ζωντανά από το `quoteIntake` του — και μόνο όσο ο προμηθευτής δέχεται και η βιτρίνα
 *    του είναι επιβεβαιωμένη. Επιστρέφει `kind`/`platformCompanyId` ώστε ο καλών να ρωτήσει τον έναν φρουρό (ανασκόπηση Ε1).
 */
export async function resolveInviteRecipient(
  invite: Pick<VendorInvite, 'companyId' | 'vendorContactId' | 'recipientEmail' | 'recipientName'>,
): Promise<InviteRecipient | null> {
  if (invite.recipientEmail) {
    return { email: invite.recipientEmail, name: invite.recipientName ?? invite.recipientEmail, kind: 'contact', platformCompanyId: null };
  }
  if (!invite.vendorContactId) return null;
  const recipient = await resolveVendorRecipient(invite.companyId, invite.vendorContactId);
  return recipient ? { ...recipient, name: invite.recipientName ?? recipient.name } : null;
}

/** Οι προελεύσεις συνδέσμων που φτάνουν **με email** στον παραλήπτη. Ο σύνδεσμος αντιγραφής του γραφείου δεν αγγίζεται. */
const EMAILED_ORIGINS: ReadonlySet<VendorCredentialOrigin> = new Set(['invite_email', 'rfq_fanout', 'email_resend', 'self_service']);

/**
 * Μετά από επαναποστολή σε χώρο πλατφόρμας: ανάκληση των **προηγούμενων** ζωντανών συνδέσμων που στάλθηκαν με email
 * (ανασκόπηση Ε1). Κάθε επαναποστολή αλλιώς άφηνε ένα ακόμη ζωντανό διαπιστευτήριο σε κοινόχρηστο γραμματοκιβώτιο.
 * Μόνο μετά από **επιτυχή** αποστολή, ώστε ο προμηθευτής να μη μείνει χωρίς σύνδεσμο.
 */
async function revokeEarlierEmailedLinks(ctx: AuthContext, inviteId: string, keepCredentialId: string): Promise<void> {
  const links = await listVendorCredentials(ctx.companyId, inviteId);
  const earlier = links.filter((link) => link.id !== keepCredentialId && link.revokedAt === null && EMAILED_ORIGINS.has(link.issuedVia));
  await Promise.all(earlier.map((link) => revokeVendorCredential({
    companyId: ctx.companyId, inviteId, credentialId: link.id, revokedBy: ctx.uid, nowIso: nowISO(),
  })));
}

/** Η απόκριση της επαναποστολής. 🔒 Για χώρο της πλατφόρμας μόνο γενικός κωδικός (ανασκόπηση Ε6): το κείμενο του παρόχου στο log. */
export type ResendOutcome = { success: boolean; errorReason: string | null };

const PLATFORM_DELIVERY_FAILED = 'delivery_failed';

async function sendResend(ctx: AuthContext, invite: VendorInvite, recipient: InviteRecipient, locale: 'el' | 'en'): Promise<ResendOutcome> {
  const rfq = await getRfq(ctx.companyId, invite.rfqId);
  if (!rfq) throw new VendorInviteStateError('not_found');
  const emailChannel = resolveChannel('email');
  if (!emailChannel) throw new Error('Email channel not available');
  const link = await issueAdditionalVendorLink({ invite, issuedVia: 'email_resend', issuedBy: ctx.uid, expiresAtMs: vendorLinkExpiryMs(Date.now()) });
  const dispatch = await emailChannel.send({
    inviteId: invite.id, vendorName: recipient.name, recipient: recipient.email, rfqTitle: rfq.title, projectName: null,
    portalUrl: link.portalUrl, expiresAt: link.expiresAtIso, locale, declineUrl: link.declineUrl,
  });
  recordVendorInviteAudit(ctx, invite.id, 'email_sent', [
    { field: 'portalLink', oldValue: null, newValue: link.credential.id, label: 'email_resend' },
  ]);
  logger.info('Vendor invite resent', { inviteId: invite.id, credentialId: link.credential.id, success: dispatch.success, reason: dispatch.errorReason });
  if (recipient.kind !== 'platform') return { success: dispatch.success, errorReason: dispatch.errorReason };
  if (dispatch.success) await revokeEarlierEmailedLinks(ctx, invite.id, link.credential.id);
  return { success: dispatch.success, errorReason: dispatch.success ? null : PLATFORM_DELIVERY_FAILED };
}

/**
 * **Επαναποστολή** με **νέο** σύνδεσμο στο καταχωρημένο email (DocuSign «Resend»). Για επαφή του αγοραστή οι παλιοί σύνδεσμοι
 * μένουν ζωντανοί ως τη λήξη τους ή ως ρητή ανάκληση (ADR-876 §5). Για χώρο της πλατφόρμας (ADR-923 §5.13 Τ5, ανασκόπηση Ε1):
 * περνά από τον **έναν** φρουρό (ζεύγος + προμηθευτής) και ανακαλεί τους προηγούμενους συνδέσμους email.
 */
export async function resendVendorInvite(
  ctx: AuthContext,
  rfqId: string,
  inviteId: string,
  options: { locale?: 'el' | 'en' } = {},
): Promise<ResendOutcome> {
  const invite = await requireLiveInvite(ctx, rfqId, inviteId);
  const recipient = await resolveInviteRecipient(invite);
  if (!recipient) throw new Error('Recipient has no email address');
  if (recipient.platformCompanyId !== null && (await admitPlatformQuoteRequest(ctx.companyId, recipient.platformCompanyId)) !== 'admitted') {
    return { success: false, errorReason: 'recipient_quota' };
  }
  return sendResend(ctx, invite, recipient, options.locale ?? 'el');
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
