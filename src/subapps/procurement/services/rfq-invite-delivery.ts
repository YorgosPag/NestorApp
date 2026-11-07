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

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { revokeVendorCredential } from '@/services/vendor-portal/vendor-invite-credential-store';

import type { RFQ } from '../types/rfq';
import { RFQ_ACCEPTING_QUOTES } from '../types/rfq';
import type { VendorInvite } from '../types/vendor-invite';
import {
  claimedInviteDelivery,
  deferredInviteDelivery,
  deliveredInviteDelivery,
  isInviteDeliveryClaimable,
  rejectedInviteDelivery,
  undeliverableInviteDelivery,
  unknownInviteDelivery,
  type InviteDeliveryError,
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
  /** Το διαπιστευτήριο πίσω από τον σύνδεσμο: ανακαλείται αν η απόπειρα δεν τον παρέδωσε (ανασκόπηση Ε5). */
  readonly credentialId: string;
}

/** Μια πρόσκληση προς παράδοση. `link: null` ⇒ η μνήμη χάθηκε (cron): εκδίδεται νέος σύνδεσμος μετά την κράτηση. */
export interface InviteDeliveryJob {
  readonly inviteId: string;
  readonly link: InviteDeliveryLink | null;
}

/** `skipped` ⇒ η πρόσκληση δεν ήταν διαθέσιμη (ήδη στάλθηκε, την κρατά άλλος, δεν ωρίμασε, δεν υπάρχει). */
export type InviteDeliveryOutcome = 'skipped' | InviteDeliveryState;

/** Ο δράστης των ανακλήσεων της μηχανής παράδοσης (ADR-195: ταυτότητα, ποτέ όνομα). */
const DELIVERY_ACTOR = `${SYSTEM_IDENTITY.ID}:rfq-invite-delivery`;

interface Claim {
  readonly invite: VendorInvite;
  readonly delivery: VendorInviteDelivery;
}

/** Ό,τι έγινε **μέσα** στην απόπειρα και πρέπει να επιβιώσει και μιας εξαίρεσης: η ποσόστωση και το διαπιστευτήριο. */
interface AttemptTrace {
  quotaAdmitted: boolean;
  credentialId: string | null;
}

type Attempt =
  | { readonly kind: 'sent'; readonly recipient: VendorRecipient; readonly rfqTitle: string }
  | { readonly kind: 'rejected'; readonly error: InviteDeliveryError }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'deferred' }
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

async function linkFor(job: InviteDeliveryJob, invite: VendorInvite, trace: AttemptTrace): Promise<InviteDeliveryLink> {
  if (job.link !== null) return job.link;
  const issued = await issueAdditionalVendorLink({ invite, issuedVia: 'email_resend', issuedBy: null, expiresAtMs: invite.expiresAt.toMillis() });
  trace.credentialId = issued.credential.id;
  return { portalUrl: issued.portalUrl, declineUrl: issued.declineUrl, expiresAtIso: issued.expiresAtIso, credentialId: issued.credential.id };
}

/** Η πρόσκληση και το RFQ της δέχονται ακόμη προσφορές; Αλλιώς ο οριστικός λόγος. */
async function closedReason(db: Db, invite: VendorInvite, nowMs: number): Promise<{ reason: InviteUndeliverableReason } | { rfq: RFQ }> {
  if (!isLiveInviteStatus(invite.status) || invite.expiresAt.toMillis() <= nowMs) return { reason: 'invite_closed' };
  const rfq = await readAcceptingRfq(db, invite);
  return rfq === null ? { reason: 'rfq_closed' } : { rfq };
}

/**
 * Κρίση και αποστολή. Μια εξαίρεση εδώ σημαίνει «δεν έφυγε τίποτα» ⇒ ασφαλής επανάληψη: η αλυσίδα παρόχων **δεν πετά**
 * (κάθε βλάβη παρόχου γίνεται απάντηση), και η μόνη «ίσως έφυγε» έκβασή της (λήξη χρόνου) έρχεται ως `outcomeUnknown`.
 * Η ποσόστωση χρεώνεται **μία** φορά ανά πρόσκληση (`quotaAdmitted`), όχι σε κάθε επανάληψη (ανασκόπηση Ε2).
 */
async function attemptDelivery(db: Db, job: InviteDeliveryJob, invite: VendorInvite, nowMs: number, trace: AttemptTrace): Promise<Attempt> {
  const open = await closedReason(db, invite, nowMs);
  if ('reason' in open) return { kind: 'undeliverable', reason: open.reason };
  const recipient = await resolveVendorRecipient(invite.companyId, invite.vendorContactId);
  if (recipient === null) return { kind: 'undeliverable', reason: 'no_recipient' };
  if (recipient.platformCompanyId !== null && !trace.quotaAdmitted) {
    if ((await admitPlatformQuoteRequest(invite.companyId, recipient.platformCompanyId)) !== 'admitted') return { kind: 'deferred' };
    trace.quotaAdmitted = true;
  }
  const link = await linkFor(job, invite, trace);
  const result = await emailVendorInviteChannel.send({
    inviteId: invite.id, vendorName: recipient.name, recipient: recipient.email, rfqTitle: open.rfq.title, projectName: null,
    portalUrl: link.portalUrl, expiresAt: link.expiresAtIso, locale: 'el', declineUrl: link.declineUrl,
  });
  if (result.success) return { kind: 'sent', recipient, rfqTitle: open.rfq.title };
  // 🔒 Ανασκόπηση Ε6: το κείμενο του παρόχου (ίσως με τη διεύθυνση) μόνο στο log· στο έγγραφο κλειστός κωδικός.
  logger.warn('Invite email not delivered', { inviteId: invite.id, reason: result.errorReason, outcomeUnknown: result.outcomeUnknown === true });
  return result.outcomeUnknown ? { kind: 'ambiguous' } : { kind: 'rejected', error: 'provider_rejected' };
}

/** Η επόμενη κατάσταση του καθολικού και τα πεδία που τη συνοδεύουν. */
function settlementOf(claim: Claim, attempt: Attempt, nowMs: number): { next: VendorInviteDelivery; extra: Record<string, unknown> } {
  switch (attempt.kind) {
    case 'undeliverable': return { next: undeliverableInviteDelivery(claim.delivery, attempt.reason, nowMs), extra: {} };
    case 'rejected': return { next: rejectedInviteDelivery(claim.delivery, attempt.error, nowMs), extra: {} };
    case 'ambiguous': return { next: unknownInviteDelivery(claim.delivery, nowMs, 'outcome_unknown'), extra: {} };
    case 'deferred': return { next: deferredInviteDelivery(claim.delivery, nowMs), extra: {} };
    case 'sent': return {
      next: deliveredInviteDelivery(claim.delivery, attempt.recipient.kind, nowMs),
      // Στιγμιότυπο παραλήπτη (ADR-876 §5): ποτέ η ιδιωτική διεύθυνση ενός χώρου της πλατφόρμας.
      extra: { deliveredAt: admin.firestore.Timestamp.fromMillis(nowMs), recipientEmail: recipientEmailSnapshot(attempt.recipient), recipientName: attempt.recipient.name },
    };
  }
}

/**
 * Το διαπιστευτήριο μιας απόπειρας που **δεν** παρέδωσε τον σύνδεσμο ανακαλείται (ανασκόπηση Ε5): δεν το κρατά κανείς, και ένα
 * ζωντανό διαπιστευτήριο χωρίς κάτοχο είναι μόνο επιφάνεια. Μένει ζωντανό όταν στάλθηκε, ή όταν **ίσως** στάλθηκε.
 */
async function revokeUndelivered(invite: VendorInvite, attempt: Attempt, credentialId: string | null, nowMs: number): Promise<void> {
  if (credentialId === null || attempt.kind === 'sent' || attempt.kind === 'ambiguous') return;
  await revokeVendorCredential({ companyId: invite.companyId, inviteId: invite.id, credentialId, revokedBy: DELIVERY_ACTOR, nowIso: new Date(nowMs).toISOString() })
    .catch((error: unknown) => logger.warn('Undelivered credential not revoked', { inviteId: invite.id, error: errorText(error) }));
}

/** Μία απόπειρα παράδοσης. Ιδεμποτική: δεύτερη κλήση για την ίδια πρόσκληση επιστρέφει `skipped`. */
export async function deliverRfqInvite(job: InviteDeliveryJob, nowMs: number = Date.now()): Promise<InviteDeliveryOutcome> {
  const db = getAdminFirestore();
  const claim = await claimInvite(db, job.inviteId, nowMs);
  if (claim === null) return 'skipped';
  const trace: AttemptTrace = { quotaAdmitted: claim.delivery.quotaAdmitted === true, credentialId: job.link?.credentialId ?? null };
  const attempt = await attemptDelivery(db, job, claim.invite, nowMs, trace).catch((error: unknown): Attempt => {
    logger.warn('Invite delivery attempt failed before sending', { inviteId: job.inviteId, error: errorText(error) });
    return { kind: 'rejected', error: 'transient_error' };
  });
  const { next, extra } = settlementOf(claim, attempt, nowMs);
  if (!(await settleInvite(db, claim, { ...next, quotaAdmitted: trace.quotaAdmitted }, extra, nowMs))) return 'skipped';
  await revokeUndelivered(claim.invite, attempt, trace.credentialId, nowMs);
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
