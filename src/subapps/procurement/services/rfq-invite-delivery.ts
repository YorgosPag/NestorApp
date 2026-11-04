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
 * 🔒 Το `delivery.lastError` το διαβάζει κάθε μέλος του αγοραστή: γράφεται **κωδικός** (`INVITE_DELIVERY_ERROR_CODES`), ποτέ
 *    το κείμενο του παρόχου — που συχνά περιέχει τη διεύθυνση του παραλήπτη, δηλαδή το ιδιωτικό `quoteIntake` του χώρου.
 *    Το ωμό κείμενο μένει στο log του διακομιστή.
 * 🔑 Το email γράφεται στη γλώσσα του **παραλήπτη** (`inviteEmailLanguage`), όχι του αγοραστή.
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
import { revokeVendorCredential } from '@/services/vendor-portal/vendor-invite-credential-store';

import type { RFQ } from '../types/rfq';
import { RFQ_ACCEPTING_QUOTES } from '../types/rfq';
import type { VendorInvite } from '../types/vendor-invite';
import {
  claimedInviteDelivery,
  deliveredInviteDelivery,
  isInviteDeliveryClaimable,
  redeliveredInviteDelivery,
  rejectedInviteDelivery,
  uncertainInviteDelivery,
  undeliverableInviteDelivery,
  type InviteDeliveryErrorCode,
  type InviteDeliveryState,
  type InviteRecipientKind,
  type InviteUndeliverableReason,
  type VendorInviteDelivery,
} from '../types/vendor-invite-delivery';
import { isLiveInviteStatus } from '../utils/vendor-invite-status';
import { emailVendorInviteChannel } from './channels/email-channel';
import { admitPlatformQuoteRequest, announcePlatformQuoteRequest } from './platform-quote-request';
import { readOwnedProcurementDoc } from './procurement-owned-doc';
import { rfqRef, rfqSubject } from './rfq-ownership';
import { issueAdditionalVendorLink } from './vendor-invite-issue';
import { inviteEmailLanguage, recipientEmailSnapshot, resolveVendorRecipient, type VendorRecipient } from './vendor-recipient';

const logger = createModuleLogger('RFQ_INVITE_DELIVERY');

type Db = admin.firestore.Firestore;

/** Ποιος ανακαλεί ένα διαπιστευτήριο που δεν στάλθηκε ποτέ (Λ1β Χ6) — η μηχανή, όχι άνθρωπος. */
const DELIVERY_REVOKER = 'system:rfq-invite-delivery';

/** Ένας σύνδεσμος έτοιμος προς αποστολή — μόνο στη μνήμη, ποτέ στη βάση (ADR-876 §5). */
export interface InviteDeliveryLink {
  readonly portalUrl: string;
  readonly declineUrl: string;
  readonly expiresAtIso: string;
  /** Το διαπιστευτήριο πίσω από τον σύνδεσμο (μόνο το id ταξιδεύει στο καθολικό, Λ1β Χ6). */
  readonly credential?: { readonly id: string };
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

/**
 * Ό,τι **έγινε** σε αυτή την απόπειρα, ακόμη κι αν μετά πετάξει εξαίρεση: καταναλώθηκε η μονάδα του προμηθευτή; ποιο
 * διαπιστευτήριο χρησιμοποιήθηκε; ποιος ήταν ο παραλήπτης; Γράφεται στην καταγραφή (Λ1β Μ3 · Χ6).
 */
interface AttemptProgress {
  quotaCounted: boolean;
  credentialId: string | null;
  recipientKind: InviteRecipientKind | null;
}

type Attempt =
  | { readonly kind: 'sent'; readonly recipient: VendorRecipient; readonly rfqTitle: string }
  | { readonly kind: 'rejected'; readonly code: InviteDeliveryErrorCode; readonly uncertain: boolean }
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

/**
 * Η καταγραφή — μόνο αν η κράτηση είναι ακόμη αυτή. Εξαίρεση: η σάρωση έκρινε `unknown` τη **δική μας** απόπειρα (ίδιος
 * αριθμός) ενώ το email είχε φύγει ⇒ η αλήθεια `delivered` κερδίζει, ώστε ο αγοραστής να μη δει ψευδή αποτυχία.
 */
async function settleInvite(db: Db, claim: Claim, next: VendorInviteDelivery, extra: Record<string, unknown>, nowMs: number): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef(db, claim.invite.id));
    const current = (snap.data() as VendorInvite | undefined)?.delivery;
    const ours = current?.attempts === claim.delivery.attempts;
    const open = current?.state === 'sending' || (current?.state === 'unknown' && next.state === 'delivered');
    if (!ours || !open) return false;
    tx.update(inviteRef(db, claim.invite.id), { ...extra, delivery: next, updatedAt: admin.firestore.Timestamp.fromMillis(nowMs) });
    return true;
  });
}

async function readAcceptingRfq(db: Db, invite: VendorInvite): Promise<RFQ | null> {
  const rfq = await readOwnedProcurementDoc<RFQ>(rfqRef(db, invite.rfqId), invite.companyId, rfqSubject(invite.rfqId));
  return rfq !== null && RFQ_ACCEPTING_QUOTES.has(rfq.status) ? rfq : null;
}

/** Ανάκληση ενός διαπιστευτηρίου που κανένα email δεν μετέφερε. Ποτέ δεν πετά: ένας ορφανός σύνδεσμος δεν σταματά παράδοση. */
async function revokeUnsentCredential(invite: VendorInvite, credentialId: string | null | undefined, nowMs: number): Promise<void> {
  if (!credentialId) return;
  try {
    await revokeVendorCredential({
      companyId: invite.companyId, inviteId: invite.id, credentialId, revokedBy: DELIVERY_REVOKER, nowIso: new Date(nowMs).toISOString(),
    });
  } catch (error) {
    logger.warn('Το αναπόστολο διαπιστευτήριο δεν ανακλήθηκε', { inviteId: invite.id, credentialId, error: errorText(error) });
  }
}

/** Ο σύνδεσμος της απόπειρας. Νέος (cron) ⇒ ο προηγούμενος, που δεν στάλθηκε ποτέ, ανακαλείται (Λ1β Χ6). */
async function linkFor(job: InviteDeliveryJob, claim: Claim, progress: AttemptProgress, nowMs: number): Promise<InviteDeliveryLink> {
  if (job.link !== null) {
    progress.credentialId = job.link.credential?.id ?? null;
    return job.link;
  }
  const { invite } = claim;
  const link = await issueAdditionalVendorLink({ invite, issuedVia: 'email_resend', issuedBy: null, expiresAtMs: invite.expiresAt.toMillis() });
  progress.credentialId = link.credential.id;
  await revokeUnsentCredential(invite, claim.delivery.unsentCredentialId, nowMs);
  return link;
}

/**
 * Το όριο του γραμματοκιβωτίου του προμηθευτή μετρά **μία** φορά ανά πρόσκληση — κρίνει η σημαία του καθολικού, όχι ο αριθμός
 * της απόπειρας (Λ1β Μ3): απόπειρα που πέθανε **πριν** μετρήσει δεν αφήνει την επόμενη να στείλει αμέτρητη. Store πεσμένο ⇒
 * εξαίρεση ⇒ ασφαλής επανάληψη αργότερα, ποτέ αποστολή χωρίς μέτρηση (Μ2).
 */
async function admitRecipient(recipient: VendorRecipient, progress: AttemptProgress): Promise<boolean> {
  if (recipient.platformCompanyId === null || progress.quotaCounted) return true;
  const verdict = await admitPlatformQuoteRequest(recipient.platformCompanyId);
  if (verdict === 'unavailable') throw new Error('supplier quota store unavailable');
  if (verdict === 'allowed') progress.quotaCounted = true;
  return verdict === 'allowed';
}

/** Κρίση και αποστολή. Κάθε εξαίρεση εδώ σημαίνει «δεν έφυγε τίποτα» ⇒ ασφαλής επανάληψη. */
async function attemptDelivery(db: Db, job: InviteDeliveryJob, claim: Claim, progress: AttemptProgress, nowMs: number): Promise<Attempt> {
  const { invite } = claim;
  if (!isLiveInviteStatus(invite.status) || invite.expiresAt.toMillis() <= nowMs) return { kind: 'undeliverable', reason: 'invite_closed' };
  const rfq = await readAcceptingRfq(db, invite);
  if (rfq === null) return { kind: 'undeliverable', reason: 'rfq_closed' };
  const recipient = await resolveVendorRecipient(invite.companyId, invite.vendorContactId);
  if (recipient === null) return { kind: 'undeliverable', reason: 'no_recipient' };
  progress.recipientKind = recipient.kind;
  if (!(await admitRecipient(recipient, progress))) return { kind: 'undeliverable', reason: 'recipient_quota' };
  const link = await linkFor(job, claim, progress, nowMs);
  const result = await emailVendorInviteChannel.send({
    inviteId: invite.id, vendorName: recipient.name, recipient: recipient.email, rfqTitle: rfq.title, projectName: null,
    portalUrl: link.portalUrl, expiresAt: link.expiresAtIso, locale: inviteEmailLanguage(recipient), declineUrl: link.declineUrl,
  });
  if (result.success) return { kind: 'sent', recipient, rfqTitle: rfq.title };
  const uncertain = result.uncertain === true;
  logger.warn('Ο πάροχος δεν παρέδωσε την πρόσκληση', { inviteId: invite.id, attempt: claim.delivery.attempts, uncertain, error: result.errorReason });
  return { kind: 'rejected', code: uncertain ? 'provider_timeout' : 'provider_rejected', uncertain };
}

function nextDeliveryOf(claim: Claim, attempt: Attempt, nowMs: number): VendorInviteDelivery {
  if (attempt.kind === 'undeliverable') return undeliverableInviteDelivery(claim.delivery, attempt.reason, nowMs);
  if (attempt.kind === 'sent') return deliveredInviteDelivery(claim.delivery, attempt.recipient.kind, nowMs);
  // Λ1β Μ1 — λήξη χρόνου του παρόχου: ίσως έφυγε ⇒ `unknown`, ποτέ νέα απόπειρα.
  return attempt.uncertain ? uncertainInviteDelivery(claim.delivery, nowMs) : rejectedInviteDelivery(claim.delivery, attempt.code, nowMs);
}

/** Η επόμενη κατάσταση του καθολικού και τα πεδία που τη συνοδεύουν. */
function settlementOf(claim: Claim, attempt: Attempt, progress: AttemptProgress, nowMs: number): { next: VendorInviteDelivery; extra: Record<string, unknown> } {
  const base = nextDeliveryOf(claim, attempt, nowMs);
  // Μόνο ρητή άρνηση αφήνει σύνδεσμο που σίγουρα δεν στάλθηκε· στο `unknown` μπορεί να είναι στα χέρια του προμηθευτή.
  const unsent = attempt.kind === 'rejected' && !attempt.uncertain ? progress.credentialId : null;
  const next: VendorInviteDelivery = {
    ...base, supplierQuotaCounted: progress.quotaCounted, unsentCredentialId: unsent, recipientKind: base.recipientKind ?? progress.recipientKind,
  };
  if (attempt.kind !== 'sent') return { next, extra: {} };
  const { recipient } = attempt;
  // Στιγμιότυπο παραλήπτη (ADR-876 §5): ποτέ η ιδιωτική διεύθυνση ενός χώρου της πλατφόρμας.
  return { next, extra: { deliveredAt: admin.firestore.Timestamp.fromMillis(nowMs), recipientEmail: recipientEmailSnapshot(recipient), recipientName: recipient.name } };
}

/** Μετά την καταγραφή: ειδοποίηση του χώρου (μόνο σε παράδοση) · ανάκληση του συνδέσμου μιας οριστικής αποτυχίας. */
async function afterSettlement(claim: Claim, attempt: Attempt, next: VendorInviteDelivery, nowMs: number): Promise<void> {
  if (next.state === 'failed') await revokeUnsentCredential(claim.invite, next.unsentCredentialId, nowMs);
  if (attempt.kind !== 'sent' || attempt.recipient.platformCompanyId === null) return;
  await announcePlatformQuoteRequest({
    supplierCompanyId: attempt.recipient.platformCompanyId, buyerCompanyId: claim.invite.companyId, rfqTitle: attempt.rfqTitle, inviteId: claim.invite.id,
  });
}

/** Μία απόπειρα παράδοσης. Ιδεμποτική: δεύτερη κλήση για την ίδια πρόσκληση επιστρέφει `skipped`. */
export async function deliverRfqInvite(job: InviteDeliveryJob, nowMs: number = Date.now()): Promise<InviteDeliveryOutcome> {
  const db = getAdminFirestore();
  const claim = await claimInvite(db, job.inviteId, nowMs);
  if (claim === null) return 'skipped';
  const progress: AttemptProgress = { quotaCounted: claim.delivery.supplierQuotaCounted === true, credentialId: null, recipientKind: null };
  const attempt = await attemptDelivery(db, job, claim, progress, nowMs).catch((error: unknown): Attempt => {
    logger.warn('Η απόπειρα παράδοσης απέτυχε πριν από τον πάροχο', { inviteId: job.inviteId, error: errorText(error) });
    return { kind: 'rejected', code: 'delivery_error', uncertain: false };
  });
  const { next, extra } = settlementOf(claim, attempt, progress, nowMs);
  if (!(await settleInvite(db, claim, next, extra, nowMs))) return 'skipped';
  await afterSettlement(claim, attempt, next, nowMs);
  return next.state;
}

/**
 * Η «Επαναποστολή» του γραφείου πέτυχε: κλείνει το καθολικό ως `delivered` (μόνο από κλειστή, μη παραδομένη κατάσταση — η
 * ανοιχτή ανήκει στη σάρωση). Ιδεμποτική· ποτέ δεν πετά (το email ήδη έφυγε).
 */
export async function recordInviteRedelivered(inviteId: string, kind: InviteRecipientKind, nowMs: number = Date.now()): Promise<void> {
  const db = getAdminFirestore();
  try {
    await db.runTransaction(async (tx) => {
      const next = redeliveredInviteDelivery(((await tx.get(inviteRef(db, inviteId))).data() as VendorInvite | undefined)?.delivery, kind, nowMs);
      if (next !== null) tx.update(inviteRef(db, inviteId), { delivery: next, updatedAt: admin.firestore.Timestamp.fromMillis(nowMs) });
    });
  } catch (error) {
    logger.error('Το καθολικό δεν ενημερώθηκε μετά την επαναποστολή', { inviteId, error: errorText(error) });
  }
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
