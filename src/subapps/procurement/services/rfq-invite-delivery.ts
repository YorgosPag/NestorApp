import 'server-only';

/**
 * **Η παράδοση μιας πρόσκλησης RFQ** (ADR-923 §5.13 Τ5 · ADR-327 §7 βήμα h): κράτηση → κρίση → αποστολή → καταγραφή.
 *
 * Πριν, το fan-out του `createRfq` ήταν `void dispatch…()` χωρίς ίχνος: αποτυχία του παρόχου χανόταν, και η επαφή ενός
 * προμηθευτή της πλατφόρμας (χωρίς email) παρακαμπτόταν σιωπηλά, δηλαδή **ο προμηθευτής δεν μάθαινε ποτέ** το αίτημα.
 * Τώρα η πρόθεση ζει στο έγγραφο της πρόσκλησης (`delivery`, γραμμένο στη συναλλαγή του RFQ), η πρώτη απόπειρα τρέχει στο
 * `after()` με τον σύνδεσμο που κρατά ακόμη η μνήμη, και οι επόμενες στο cron `rfq-invite-delivery` με **νέο** σύνδεσμο.
 *
 * 🔑 **Το πολύ ένα email ανά πρόσκληση:** στέλνει μόνο όποιος κερδίσει τη συναλλαγή `pending → sending` (CAS), και η
 *    καταγραφή γίνεται μόνο αν η κράτηση είναι ακόμη δική του. Επανάληψη μόνο όταν ο πάροχος αρνήθηκε ρητά.
 * 🔑 Ο παραλήπτης κρίνεται **τη στιγμή της αποστολής** (`resolveVendorRecipient`), ποτέ από αυτό που έγραψε ο πελάτης.
 * ⚠️ Δεν διαβάζει μέσω του `rfq-service` (κύκλος εισαγωγών): το RFQ διαβάζεται με τον ίδιο φράχτη tenant (`readOwnedProcurementDoc`).
 *
 * @module subapps/procurement/services/rfq-invite-delivery
 */

import admin from 'firebase-admin';
import { after } from 'next/server';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

import type { RFQ } from '../types/rfq';
import { RFQ_ACCEPTING_QUOTES } from '../types/rfq';
import type { VendorInvite } from '../types/vendor-invite';
import {
  claimedInviteDelivery,
  deliveredInviteDelivery,
  isInviteDeliveryClaimable,
  rejectedInviteDelivery,
  undeliverableInviteDelivery,
  type InviteDeliveryState,
  type InviteUndeliverableReason,
  type VendorInviteDelivery,
} from '../types/vendor-invite-delivery';
import { isLiveInviteStatus } from '../utils/vendor-invite-status';
import { emailVendorInviteChannel } from './channels/email-channel';
import { admitPlatformQuoteRequest, announcePlatformQuoteRequest } from './platform-quote-request';
import { readOwnedProcurementDoc } from './procurement-owned-doc';
import { rfqRef, rfqSubject } from './rfq-ownership';
import { issueAdditionalVendorLink } from './vendor-invite-issue';
import { recipientEmailSnapshot, resolveVendorRecipient, type VendorRecipient } from './vendor-recipient';

const logger = createModuleLogger('RFQ_INVITE_DELIVERY');

type Db = admin.firestore.Firestore;

/** Ένας σύνδεσμος έτοιμος προς αποστολή — μόνο στη μνήμη, ποτέ στη βάση (ADR-876 §5). */
export interface InviteDeliveryLink {
  readonly portalUrl: string;
  readonly declineUrl: string;
  readonly expiresAtIso: string;
}

/** Μια πρόσκληση προς παράδοση. `link: null` ⇒ η μνήμη χάθηκε (cron): εκδίδεται νέος σύνδεσμος μετά την κράτηση. */
export interface InviteDeliveryJob {
  readonly inviteId: string;
  readonly link: InviteDeliveryLink | null;
}

/** `skipped` ⇒ η πρόσκληση δεν ήταν διαθέσιμη (ήδη στάλθηκε, την κρατά άλλος, δεν ωρίμασε, δεν υπάρχει). */
export type InviteDeliveryOutcome = 'skipped' | InviteDeliveryState;

interface Claim {
  readonly invite: VendorInvite;
  readonly delivery: VendorInviteDelivery;
}

type Attempt =
  | { readonly kind: 'sent'; readonly recipient: VendorRecipient; readonly rfqTitle: string }
  | { readonly kind: 'rejected'; readonly error: string }
  | { readonly kind: 'undeliverable'; readonly reason: InviteUndeliverableReason };

const inviteRef = (db: Db, inviteId: string) => db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId);
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Η κράτηση: μόνο μία απόπειρα κάθε φορά περνά από `pending` σε `sending`. */
async function claimInvite(db: Db, inviteId: string, nowMs: number): Promise<Claim | null> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef(db, inviteId));
    const data = snap.data() as VendorInvite | undefined;
    if (!snap.exists || data === undefined || !isInviteDeliveryClaimable(data.delivery, nowMs) || !data.delivery) return null;
    const delivery = claimedInviteDelivery(data.delivery, nowMs);
    tx.update(inviteRef(db, inviteId), { delivery, updatedAt: admin.firestore.Timestamp.fromMillis(nowMs) });
    return { invite: { ...data, id: snap.id }, delivery };
  });
}

/** Η καταγραφή — μόνο αν η κράτηση είναι ακόμη αυτή (η σάρωση μπορεί να την έκρινε `unknown`). */
async function settleInvite(db: Db, claim: Claim, next: VendorInviteDelivery, extra: Record<string, unknown>, nowMs: number): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef(db, claim.invite.id));
    const current = (snap.data() as VendorInvite | undefined)?.delivery;
    if (current?.state !== 'sending' || current.attempts !== claim.delivery.attempts) return false;
    tx.update(inviteRef(db, claim.invite.id), { ...extra, delivery: next, updatedAt: admin.firestore.Timestamp.fromMillis(nowMs) });
    return true;
  });
}

async function readAcceptingRfq(db: Db, invite: VendorInvite): Promise<RFQ | null> {
  const rfq = await readOwnedProcurementDoc<RFQ>(rfqRef(db, invite.rfqId), invite.companyId, rfqSubject(invite.rfqId));
  return rfq !== null && RFQ_ACCEPTING_QUOTES.has(rfq.status) ? rfq : null;
}

function linkFor(job: InviteDeliveryJob, invite: VendorInvite): Promise<InviteDeliveryLink> {
  if (job.link !== null) return Promise.resolve(job.link);
  return issueAdditionalVendorLink({ invite, issuedVia: 'email_resend', issuedBy: null, expiresAtMs: invite.expiresAt.toMillis() });
}

/** Κρίση και αποστολή. Κάθε εξαίρεση εδώ σημαίνει «δεν έφυγε τίποτα» ⇒ ασφαλής επανάληψη. */
async function attemptDelivery(db: Db, job: InviteDeliveryJob, invite: VendorInvite, nowMs: number): Promise<Attempt> {
  if (!isLiveInviteStatus(invite.status) || invite.expiresAt.toMillis() <= nowMs) return { kind: 'undeliverable', reason: 'invite_closed' };
  const rfq = await readAcceptingRfq(db, invite);
  if (rfq === null) return { kind: 'undeliverable', reason: 'rfq_closed' };
  const recipient = await resolveVendorRecipient(invite.companyId, invite.vendorContactId);
  if (recipient === null) return { kind: 'undeliverable', reason: 'no_recipient' };
  if (recipient.platformCompanyId !== null && !(await admitPlatformQuoteRequest(recipient.platformCompanyId))) {
    return { kind: 'undeliverable', reason: 'recipient_quota' };
  }
  const link = await linkFor(job, invite);
  const result = await emailVendorInviteChannel.send({
    inviteId: invite.id, vendorName: recipient.name, recipient: recipient.email, rfqTitle: rfq.title, projectName: null,
    portalUrl: link.portalUrl, expiresAt: link.expiresAtIso, locale: 'el', declineUrl: link.declineUrl,
  });
  return result.success ? { kind: 'sent', recipient, rfqTitle: rfq.title } : { kind: 'rejected', error: result.errorReason ?? 'provider rejected' };
}

/** Η επόμενη κατάσταση του καθολικού και τα πεδία που τη συνοδεύουν. */
function settlementOf(claim: Claim, attempt: Attempt, nowMs: number): { next: VendorInviteDelivery; extra: Record<string, unknown> } {
  if (attempt.kind === 'undeliverable') return { next: undeliverableInviteDelivery(claim.delivery, attempt.reason, nowMs), extra: {} };
  if (attempt.kind === 'rejected') return { next: rejectedInviteDelivery(claim.delivery, attempt.error, nowMs), extra: {} };
  const { recipient } = attempt;
  return {
    next: deliveredInviteDelivery(claim.delivery, recipient.kind, nowMs),
    // Στιγμιότυπο παραλήπτη (ADR-876 §5): ποτέ η ιδιωτική διεύθυνση ενός χώρου της πλατφόρμας.
    extra: { deliveredAt: admin.firestore.Timestamp.fromMillis(nowMs), recipientEmail: recipientEmailSnapshot(recipient), recipientName: recipient.name },
  };
}

/** Μία απόπειρα παράδοσης. Ιδεμποτική: δεύτερη κλήση για την ίδια πρόσκληση επιστρέφει `skipped`. */
export async function deliverRfqInvite(job: InviteDeliveryJob, nowMs: number = Date.now()): Promise<InviteDeliveryOutcome> {
  const db = getAdminFirestore();
  const claim = await claimInvite(db, job.inviteId, nowMs);
  if (claim === null) return 'skipped';
  const attempt = await attemptDelivery(db, job, claim.invite, nowMs).catch((error: unknown): Attempt => ({ kind: 'rejected', error: errorText(error) }));
  const { next, extra } = settlementOf(claim, attempt, nowMs);
  if (!(await settleInvite(db, claim, next, extra, nowMs))) return 'skipped';
  if (attempt.kind === 'sent' && attempt.recipient.platformCompanyId !== null) {
    await announcePlatformQuoteRequest({
      supplierCompanyId: attempt.recipient.platformCompanyId, buyerCompanyId: claim.invite.companyId, rfqTitle: attempt.rfqTitle, inviteId: claim.invite.id,
    });
  }
  return next.state;
}

async function deliverAll(jobs: readonly InviteDeliveryJob[]): Promise<void> {
  const results = await Promise.allSettled(jobs.map((job) => deliverRfqInvite(job)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') logger.error('Invite delivery attempt crashed', { inviteId: jobs[index].inviteId, error: errorText(result.reason) });
  });
}

/**
 * Η πρώτη απόπειρα, **μετά** την απάντηση (`after()`): η συναλλαγή του RFQ έχει ήδη γράψει την πρόθεση, άρα ό,τι δεν
 * προλάβει εδώ το πιάνει η σάρωση. Έξω από αίτημα (σενάρια, jest) το `after` πετά ⇒ τρέχει αμέσως, χωρίς αναμονή.
 */
export function scheduleRfqInviteDeliveries(jobs: readonly InviteDeliveryJob[]): void {
  if (jobs.length === 0) return;
  const run = () => deliverAll(jobs);
  try {
    after(run);
  } catch {
    void run();
  }
}
