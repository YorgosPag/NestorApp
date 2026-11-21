/**
 * =============================================================================
 * ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΠΡΟΣΚΛΗΣΗΣ — «αυτό ακριβώς θα λάβει» (ADR-327 §7.5)
 * =============================================================================
 *
 * Ο αγοραστής βλέπει το email **πριν** το στείλει, από τον **ίδιο** builder (`buildVendorInviteMessage`) και
 * τον **ίδιο** composer (`composeVendorInviteEmail`) με την αποστολή — όχι αντίγραφο του προτύπου στον browser.
 * Γι' αυτό η εικόνα έχει τη σωστή **γλώσσα του παραλήπτη** (και για προμηθευτή της πλατφόρμας, που η οθόνη δεν
 * μπορεί να ξέρει), το πραγματικό **όνομα έργου** και τον σωστό χαιρετισμό.
 *
 * 🔒 **Μηδέν παρενέργειες**: καμία εγγραφή, κανένα διαπιστευτήριο, καμία κατανάλωση ορίου. Ο σύνδεσμος είναι
 *    δείγμα με το ΙΔΙΟ σχήμα (`vendorPortalUrl`), που δεν ανοίγει τίποτα.
 * 🔒 Η διεύθυνση του παραλήπτη **δεν** επιστρέφεται: για προμηθευτή της πλατφόρμας είναι ιδιωτική (ADR-923 §5.13 Τ5).
 *
 * @module subapps/procurement/services/vendor-invite-preview
 */

import 'server-only';

import type { HumanLanguage } from '@/i18n/languages';
import type { AuthContext } from '@/lib/auth';
import { vendorLinkExpiryMs } from '@/services/vendor-portal/vendor-invite-credential';

import { judgeInviteExpiryDay } from '../config/vendor-invite-policy';
import type { VendorInvitePreviewRecipient } from '../types/vendor-invite-preview';
import { composeVendorInviteEmail, type ComposedVendorInviteEmail } from './channels/vendor-invite-email-compose';
import { procurementNotFound } from './procurement-ownership';
import { rfqSubject } from './rfq-ownership';
import { getRfq } from './rfq-service';
import { VendorInviteRefusal } from './vendor-invite-create';
import { buildVendorInviteMessage } from './vendor-invite-message';
import { vendorDeclineUrl, vendorPortalUrl } from './vendor-portal-links';
import { fetchVendorContact, inviteEmailLanguage, recipientOfContact } from './vendor-recipient';

export interface VendorInvitePreviewInput {
  readonly recipient: VendorInvitePreviewRecipient;
  readonly expiresOn?: string;
  readonly buyerNote: string | null;
  /** Η γλώσσα της οθόνης — **εφεδρεία** μόνο, όπως στην αποστολή (κερδίζει η γλώσσα του παραλήπτη). */
  readonly locale?: HumanLanguage;
}

export interface VendorInvitePreview extends ComposedVendorInviteEmail {
  readonly language: HumanLanguage;
}

/** Το token-δείγμα — ίδιο σχήμα συνδέσμου, κανένα διαπιστευτήριο πίσω του. */
const PREVIEW_TOKEN = 'preview';

interface PreviewRecipient {
  readonly name: string | null;
  readonly language: HumanLanguage | null;
}

async function previewRecipientOf(companyId: string, recipient: VendorInvitePreviewRecipient): Promise<PreviewRecipient> {
  if ('manualEmail' in recipient) return { name: recipient.manualName ?? null, language: null };
  const contact = await fetchVendorContact(companyId, recipient.vendorContactId);
  if (!contact) throw new Error(`Vendor contact ${recipient.vendorContactId} not found`);
  const resolved = await recipientOfContact(contact, companyId);
  return { name: resolved?.name ?? contact.displayName, language: resolved?.language ?? contact.language };
}

function previewExpiryMs(expiresOn: string | undefined, nowMs: number): number {
  if (expiresOn === undefined) return vendorLinkExpiryMs(nowMs);
  const verdict = judgeInviteExpiryDay(expiresOn, new Date(nowMs));
  if (verdict.kind !== 'ok') throw new VendorInviteRefusal('invalid_expiry');
  return verdict.expiresAtMs;
}

/** **Η** προεπισκόπηση — καθαρή ανάγνωση, ίδια σύνθεση με την αποστολή. */
export async function previewVendorInvite(ctx: AuthContext, rfqId: string, input: VendorInvitePreviewInput): Promise<VendorInvitePreview> {
  const rfq = await getRfq(ctx.companyId, rfqId);
  if (!rfq) throw procurementNotFound(rfqSubject(rfqId));
  const recipient = await previewRecipientOf(ctx.companyId, input.recipient);
  const language = inviteEmailLanguage(recipient, input.locale);
  const expiresAtIso = new Date(previewExpiryMs(input.expiresOn, Date.now())).toISOString();
  const message = await buildVendorInviteMessage({
    companyId: ctx.companyId, inviteId: PREVIEW_TOKEN, rfq, to: '', recipientName: recipient.name,
    link: { portalUrl: vendorPortalUrl(PREVIEW_TOKEN), declineUrl: vendorDeclineUrl(PREVIEW_TOKEN), expiresAtIso },
    buyerNote: input.buyerNote, locale: language,
  });
  return { ...composeVendorInviteEmail(message), language };
}
