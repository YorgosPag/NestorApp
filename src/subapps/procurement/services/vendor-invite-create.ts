import 'server-only';

/**
 * **Η χειρόγραφη πρόσκληση προμηθευτή** (ADR-327 §7 · ADR-876 §5 · ADR-923 §5.13 Τ5 Λ1β Σ1): κράτηση → αποστολή → σήμανση.
 *
 * 🔴 Πριν (Λ1β Σ1): η πρόσκληση **αποθηκευόταν πάντα**, με ζωντανό διαπιστευτήριο, ακόμη κι όταν το όριο ζεύγους την
 *    αρνιόταν· και τίποτα δεν εμπόδιζε δεύτερη ζωντανή πρόσκληση στην ίδια επαφή του ίδιου RFQ. Ν προσκλήσεις × 3
 *    επαναποστολές = 3Ν email στο ίδιο γραμματοκιβώτιο, και εξάντληση του **κοινού** ορίου του προμηθευτή για όλους.
 *
 * ✅ Τώρα, με αυτή τη σειρά:
 * 1. **Πρόωρος έλεγχος χωρίς κατανάλωση** (ζωντανή πρόσκληση; όριο ζεύγους;) — ώστε ένα «όχι» να μην καίει μονάδα του
 *    κοινού ορίου του προμηθευτή.
 * 2. **Όριο γραμματοκιβωτίου** του προμηθευτή, fail-closed (Μ2).
 * 3. **Μία συναλλαγή** (`reserveInvite`): ξανακρίνει «μία ζωντανή πρόσκληση ανά (RFQ, επαφή)» και το όριο ζεύγους, και
 *    γράφει πρόσκληση + διαπιστευτήριο + RFQ + μετρητή μαζί. Δύο ταυτόχρονες προσκλήσεις γράφουν **και οι δύο** το RFQ ⇒
 *    συγκρούονται, και η δεύτερη ξαναδιαβάζει και βλέπει την πρώτη.
 * 4. Αποστολή, και μόνο μετά από επιτυχία `sent`. Ό,τι αρνήθηκε **δεν** αποθηκεύεται ποτέ.
 *
 * @module subapps/procurement/services/vendor-invite-create
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { HumanLanguage } from '@/i18n/languages';
import type { AuthContext } from '@/lib/auth';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

import { judgeInviteExpiryDay } from '../config/vendor-invite-policy';
import type { RFQ } from '../types/rfq';
import type { CreateVendorInviteDTO, DeliveryChannel, VendorInvite } from '../types/vendor-invite';
import type { InviteRecipientKind } from '../types/vendor-invite-delivery';
import { isLiveInviteStatus, normalizeInviteStatus } from '../utils/vendor-invite-status';
import { resolveChannel } from './channels';
import { admitPlatformQuoteRequest, announcePlatformQuoteRequest } from './platform-quote-request';
import {
  admitQuoteRequestPairs,
  readQuoteRequestPairCounts,
  writeQuoteRequestPairCounts,
  type QuoteRequestPairCounts,
} from './quote-request-pair-quota';
import { getRfq } from './rfq-service';
import { prepareVendorInvite, writePreparedVendorInvite, type PreparedVendorInvite } from './vendor-invite-issue';
import { buildVendorInviteMessage, greetingName } from './vendor-invite-message';
import { buyerVisibleErrorReason, fetchVendorContact, inviteEmailLanguage, recipientEmailSnapshot, recipientOfContact } from './vendor-recipient';

const logger = createModuleLogger('VENDOR_INVITE_CREATE');

type Db = admin.firestore.Firestore;
type Tx = admin.firestore.Transaction;

/**
 * `already_invited` 409 · `quote_request_quota_exhausted` 429 · `quota_unavailable` 503 · `invalid_expiry` 400
 * (ADR-327 §7.5: η ημέρα λήξης εκτός ορίων) — τίποτα δεν αποθηκεύτηκε.
 */
export type VendorInviteRefusalCode = 'already_invited' | 'quote_request_quota_exhausted' | 'quota_unavailable' | 'invalid_expiry';

export class VendorInviteRefusal extends Error {
  constructor(readonly code: VendorInviteRefusalCode) {
    super(`Vendor invite refused: ${code}`);
    this.name = 'VendorInviteRefusal';
  }
}

export interface CreateInviteResult {
  invite: VendorInvite;
  /** Ο σύνδεσμος — επιστρέφεται **μία φορά**, στη δημιουργία. Δεν αποθηκεύεται πουθενά. */
  portalUrl: string;
  delivery: { success: boolean; providerMessageId: string | null; errorReason: string | null };
}

interface ResolvedRecipient {
  vendorContactId: string;
  /** `null` ⇒ χειροκίνητη πρόσκληση χωρίς όνομα (Ε3) — ο χαιρετισμός είναι ουδέτερος. */
  displayName: string | null;
  /** Πού στέλνεται το email (για επαφή πλατφόρμας: το `quoteIntake` του προμηθευτή). */
  email: string | null;
  /** Τι μένει στο έγγραφο της πρόσκλησης — ποτέ η διεύθυνση ενός χώρου της πλατφόρμας. */
  snapshotEmail: string | null;
  preferredChannel: DeliveryChannel | null;
  /** Μόνο για επαφή πλατφόρμας: ποσοστώσεις και ειδοποίηση του χώρου του προμηθευτή. */
  platformCompanyId: string | null;
  kind: InviteRecipientKind | null;
  language: HumanLanguage | null;
}

async function resolveRecipient(ctx: AuthContext, dto: CreateVendorInviteDTO): Promise<ResolvedRecipient> {
  if (dto.vendorContactId !== undefined) {
    const vendor = await fetchVendorContact(ctx.companyId, dto.vendorContactId);
    if (!vendor) throw new Error(`Vendor contact ${dto.vendorContactId} not found`);
    const recipient = await recipientOfContact(vendor, ctx.companyId);
    return {
      vendorContactId: vendor.id, displayName: vendor.displayName, email: recipient?.email ?? null,
      snapshotEmail: recipient ? recipientEmailSnapshot(recipient) : null, preferredChannel: vendor.preferredChannel,
      platformCompanyId: recipient?.platformCompanyId ?? null, kind: recipient?.kind ?? null, language: recipient?.language ?? vendor.language,
    };
  }
  const email = dto.manualEmail.trim();
  if (!email) throw new Error('manualEmail is required');
  // Ε3 — το όνομα είναι προαιρετικό· όνομα που περιέχει `@` είναι διεύθυνση, όχι όνομα ⇒ δεν κρατιέται.
  const name = greetingName(dto.manualName);
  return { vendorContactId: '', displayName: name, email, snapshotEmail: email, preferredChannel: null, platformCompanyId: null, kind: 'contact', language: null };
}

/** Τα ερωτήματα της κράτησης — ίδια για τον πρόωρο έλεγχο (`tx = null`) και για τη συναλλαγή. */
interface Reservation {
  readonly ctx: AuthContext;
  readonly rfqId: string;
  readonly vendorContactId: string;
  /** Μόνο όταν φεύγει email σε χώρο της πλατφόρμας: μετρά στο όριο ζεύγους. */
  readonly pairSupplierId: string | null;
  readonly nowMs: number;
}

function rfqInvitesQuery(db: Db, r: Reservation) {
  return db.collection(COLLECTIONS.VENDOR_INVITES).where('companyId', '==', r.ctx.companyId).where('rfqId', '==', r.rfqId).orderBy('createdAt', 'desc');
}

const isLiveInvite = (invite: VendorInvite, nowMs: number): boolean =>
  isLiveInviteStatus(normalizeInviteStatus(invite.status)) && invite.expiresAt.toMillis() > nowMs;

/** **Η κρίση της κράτησης.** Πετά `VendorInviteRefusal`· αλλιώς οι νέοι μετρητές ζεύγους (`null` ⇒ τίποτα να μετρηθεί). */
async function judgeReservation(tx: Tx | null, db: Db, r: Reservation): Promise<QuoteRequestPairCounts | null> {
  if (r.vendorContactId) {
    const snap = tx === null ? await rfqInvitesQuery(db, r).get() : await tx.get(rfqInvitesQuery(db, r));
    const invites = snap.docs.map((d) => ({ ...(d.data() as VendorInvite), id: d.id }));
    if (invites.some((invite) => invite.vendorContactId === r.vendorContactId && isLiveInvite(invite, r.nowMs))) {
      throw new VendorInviteRefusal('already_invited');
    }
  }
  if (r.pairSupplierId === null) return null;
  const admission = admitQuoteRequestPairs(await readQuoteRequestPairCounts(tx, db, r.ctx.companyId, r.nowMs), [r.pairSupplierId]);
  if (admission.kind === 'exhausted') throw new VendorInviteRefusal('quote_request_quota_exhausted');
  return admission.counts;
}

/** Η μία συναλλαγή: ξανακρίνει και γράφει πρόσκληση + διαπιστευτήριο + RFQ + μετρητή — όλα ή τίποτα. */
function reserveInvite(db: Db, r: Reservation, prepared: PreparedVendorInvite): Promise<void> {
  const rfqDoc = db.collection(COLLECTIONS.RFQS).doc(r.rfqId);
  return db.runTransaction(async (tx) => {
    const rfqSnap = await tx.get(rfqDoc);
    const counts = await judgeReservation(tx, db, r);
    writePreparedVendorInvite(tx, db, prepared);
    // Το RFQ γράφεται ΠΑΝΤΑ: έτσι δύο ταυτόχρονες κρατήσεις του ίδιου RFQ συγκρούονται αντί να περάσουν και οι δύο.
    const invited = ((rfqSnap.data() as Partial<RFQ> | undefined)?.invitedVendorIds ?? []) as readonly string[];
    const addVendor = r.vendorContactId !== '' && !invited.includes(r.vendorContactId);
    tx.update(rfqDoc, { ...(addVendor ? { invitedVendorIds: FieldValue.arrayUnion(r.vendorContactId) } : {}), updatedAt: prepared.invite.createdAt });
    if (counts !== null) writeQuoteRequestPairCounts(tx, db, r.ctx.companyId, counts, r.nowMs);
  });
}

/** Το κοινό όριο του γραμματοκιβωτίου του προμηθευτή — fail-closed, και **μετά** τον πρόωρο έλεγχο (δεν καίγεται σε «όχι»). */
async function admitSupplierMailbox(supplierCompanyId: string | null): Promise<void> {
  if (supplierCompanyId === null) return;
  const verdict = await admitPlatformQuoteRequest(supplierCompanyId);
  if (verdict === 'exhausted') throw new VendorInviteRefusal('quote_request_quota_exhausted');
  if (verdict === 'unavailable') throw new VendorInviteRefusal('quota_unavailable');
}

type ChannelDriver = NonNullable<ReturnType<typeof resolveChannel>>;

async function dispatchNewInvite(db: Db, driver: ChannelDriver, prepared: PreparedVendorInvite, recipient: ResolvedRecipient, rfq: RFQ, locale: HumanLanguage | undefined) {
  const isEmail = driver.id === 'email';
  if (isEmail && !recipient.email) return { success: false, providerMessageId: null, errorReason: 'Recipient has no email address' };
  const { invite, link } = prepared;
  return driver.send(await buildVendorInviteMessage({
    db, companyId: invite.companyId, inviteId: invite.id, rfq, to: isEmail && recipient.email ? recipient.email : link.portalUrl,
    recipientName: recipient.displayName, link, buyerNote: invite.buyerNote, locale: inviteEmailLanguage(recipient, locale),
  }));
}

/** Ε1β — η ρητή ημέρα λήξης, αν δόθηκε: εκτός ορίων ⇒ άρνηση πριν από οτιδήποτε άλλο (τίποτα δεν γράφεται). */
function explicitExpiryMs(dto: CreateVendorInviteDTO, nowMs: number): number | undefined {
  if (dto.expiresOn === undefined) return undefined;
  const verdict = judgeInviteExpiryDay(dto.expiresOn, new Date(nowMs));
  if (verdict.kind !== 'ok') throw new VendorInviteRefusal('invalid_expiry');
  return verdict.expiresAtMs;
}

/** Μετά από επιτυχή αποστολή: `sent` (email) και `deliveredAt`. Η κράτηση έγραψε `pending`. */
async function markDispatched(db: Db, invite: VendorInvite, channel: DeliveryChannel): Promise<VendorInvite> {
  const patch = { status: channel === 'email' ? 'sent' as const : invite.status, deliveredAt: invite.createdAt };
  await db.collection(COLLECTIONS.VENDOR_INVITES).doc(invite.id).update({ ...patch, updatedAt: admin.firestore.Timestamp.now() });
  return { ...invite, ...patch };
}

async function prepareFor(ctx: AuthContext, dto: CreateVendorInviteDTO, recipient: ResolvedRecipient, channel: DeliveryChannel, expiresAtMs: number | undefined): Promise<PreparedVendorInvite> {
  return prepareVendorInvite({
    companyId: ctx.companyId, rfqId: dto.rfqId, vendorContactId: recipient.vendorContactId, deliveryChannel: channel,
    preferredChannel: recipient.preferredChannel, status: 'pending', recipientEmail: recipient.snapshotEmail, recipientName: recipient.displayName,
    issuedVia: channel === 'email' ? 'invite_email' : 'copy_link', issuedBy: ctx.uid, expiresInDays: dto.expiresInDays, expiresAtMs,
    buyerNote: dto.buyerNote ?? null,
  });
}

/**
 * Create a new vendor invite for an RFQ. Refusals (`VendorInviteRefusal`) persist **nothing**; otherwise invite + first
 * credential + RFQ registration are written in ONE transaction, then the channel is dispatched.
 */
export async function createVendorInvite(ctx: AuthContext, dto: CreateVendorInviteDTO, options: { locale?: HumanLanguage } = {}): Promise<CreateInviteResult> {
  const rfq = await getRfq(ctx.companyId, dto.rfqId);
  if (!rfq) throw new Error(`RFQ ${dto.rfqId} not found`);
  if (rfq.status === 'archived') throw new Error('Cannot invite vendor on archived RFQ');
  const nowMs = Date.now();
  const expiresAtMs = explicitExpiryMs(dto, nowMs);
  const recipient = await resolveRecipient(ctx, dto);
  const driver = resolveChannel(dto.deliveryChannel) ?? resolveChannel('copy_link');
  if (!driver) throw new Error('No delivery channel available');
  const emailsSupplier = driver.id === 'email' && recipient.email !== null ? recipient.platformCompanyId : null;
  const db = getAdminFirestore();
  const reservation: Reservation = { ctx, rfqId: dto.rfqId, vendorContactId: recipient.vendorContactId, pairSupplierId: emailsSupplier, nowMs };
  await judgeReservation(null, db, reservation);
  await admitSupplierMailbox(emailsSupplier);
  const prepared = await prepareFor(ctx, dto, recipient, driver.id, expiresAtMs);
  await reserveInvite(db, reservation, prepared);
  const dispatch = await dispatchNewInvite(db, driver, prepared, recipient, rfq, options.locale);
  const invite = dispatch.success ? await markDispatched(db, prepared.invite, driver.id) : prepared.invite;
  if (dispatch.success && emailsSupplier !== null) {
    void announcePlatformQuoteRequest({ supplierCompanyId: emailsSupplier, buyerCompanyId: ctx.companyId, rfqTitle: rfq.title, inviteId: invite.id });
  }
  logger.info('Vendor invite created', { inviteId: invite.id, rfqId: dto.rfqId, vendorContactId: recipient.vendorContactId || '<manual>', channel: driver.id, delivered: dispatch.success });
  return {
    invite, portalUrl: prepared.link.portalUrl,
    delivery: { success: dispatch.success, providerMessageId: dispatch.providerMessageId, errorReason: buyerVisibleErrorReason(recipient.kind, dispatch.errorReason) },
  };
}
