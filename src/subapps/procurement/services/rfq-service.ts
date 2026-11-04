import 'server-only';

import { getAdminFirestore, safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateRfqId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';
import type { RFQ, RfqStatus, CreateRfqDTO, UpdateRfqDTO, RfqFilters, RfqDraftLine, RfqFromBoqDraft } from '../types/rfq';
import { RFQ_STATUS_TRANSITIONS, RFQ_FALLBACK_TRADE } from '../types/rfq';
import { patchAdminTimestamp } from './procurement-timestamps';
import {
  describeResponseLock,
  resolveResponseLock,
  sameResponseLock,
} from '../utils/rfq-response-lock';
import { deriveSetupLockState } from '../utils/rfq-lock-state';
import type { AuthContext } from '@/lib/auth';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { readOwnedProcurementDoc } from './procurement-owned-doc';
import { loadOwnedRfq, rfqRef, rfqSubject } from './rfq-ownership';
import { getTradeCodeForAtoeCategory } from '../data/trades';
import type { TradeCode } from '../types/trade';
import { recordRfqLinesAdded } from './rfq-line-service';
import { boqItemsByIdQuery, ownedBoqItems } from './rfq-boq-items';
import { newRfqDocument, planRfqCreate, type RfqCreatePlan } from './rfq-create-plan';
import { runRfqCreateTransaction, type RfqCreateCommit } from './rfq-create-transaction';
import { catalogSuppliersSent } from './rfq-catalog-draft';
import type { RfqCatalogSupplierSent } from '../types/rfq-line';
import { recordAccountContactBirth } from '@/services/contact/account-contact-resolver';
import { recomputeSourcingEventStatus } from './sourcing-event-service';
import { emailVendorInviteChannel } from './channels/email-channel';
import { getContactEmail } from '@/services/contacts/contact-name-resolver-types';
const logger = createModuleLogger('RFQ_SERVICE');

// ============================================================================
// EMAIL DISPATCH HELPERS — post-create invite fan-out (ADR-327 §7 step h)
// ============================================================================

/**
 * Ό,τι χρειάζεται η αποστολή — **οι σύνδεσμοι έτοιμοι**, ποτέ το ωμό token (ADR-876 §5):
 * ζουν μόνο στη μνήμη αυτής της ροής και φεύγουν μόνο μέσα στο email.
 */
interface InviteMeta {
  inviteId: string;
  vendorId: string;
  portalUrl: string;
  declineUrl: string;
  expiresAt: string;
}

async function dispatchRfqInviteEmails(
  ctx: AuthContext,
  rfq: RFQ,
  inviteMeta: InviteMeta[],
): Promise<void> {
  const db = getAdminFirestore();
  const results = await Promise.allSettled(
    inviteMeta.map(async (meta) => {
      const snap = await db.collection(COLLECTIONS.CONTACTS).doc(meta.vendorId).get();
      if (!snap.exists) return;
      const data = snap.data() ?? {};
      // ⚠️ Δευτερεύον δίχτυ ασφαλείας σε **παρενέργεια**, όχι ο κύριος φύλακας
      // της διαδρομής: ρωτά για **επαφή** ενώ ο πρωτεύων πόρος είναι το RFQ.
      // Μένει σιωπηλή παράλειψη παραλήπτη — δεν προάγεται σε άρνηση.
      //
      // 🔴 Έγραφε `data.companyId && data.companyId !== ctx.companyId`: επαφή
      // **χωρίς** `companyId` περνούσε. Εδώ η ζημιά δεν είναι διαρροή ονόματος
      // — το μήνυμα μεταφέρει **portal token** που ανοίγει το RFQ. Έγγραφο
      // χωρίς tenant δεν ανήκει σε κανέναν (ADR-742 §4), άρα δεν λαμβάνει.
      if (!isPayloadOwnedByCompany(data, ctx.companyId)) return;
      const email = getContactEmail(data as Parameters<typeof getContactEmail>[0]);
      if (!email) return;
      const vendorName = String(data.displayName ?? data.companyName ?? data.fullName ?? meta.vendorId);
      const result = await emailVendorInviteChannel.send({
        inviteId: meta.inviteId,
        vendorName,
        recipient: email,
        rfqTitle: rfq.title,
        projectName: null,
        portalUrl: meta.portalUrl,
        expiresAt: meta.expiresAt,
        locale: 'el',
        declineUrl: meta.declineUrl,
      });
      if (result.success) {
        // Στιγμιότυπο παραλήπτη (ADR-876 §5): η αυτοεξυπηρέτηση λήξης στέλνει ΜΟΝΟ εδώ.
        await db.collection(COLLECTIONS.VENDOR_INVITES).doc(meta.inviteId).update({
          deliveredAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          recipientEmail: email,
          recipientName: vendorName,
        });
      }
    }),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.error('Invite email dispatch failed', { vendorId: inviteMeta[i].vendorId, error: String(r.reason) });
    }
  });
}

// ============================================================================
// CREATE
// ============================================================================

/** Το ίχνος ADR-195 κάθε επαφής προμηθευτή που **γεννήθηκε** στη συναλλαγή — μετά το commit, ποτέ για υπάρχουσα. */
function recordSupplierContactBirths(ctx: AuthContext, committed: RfqCreateCommit): void {
  for (const contact of committed.bornContacts) {
    void recordAccountContactBirth({
      contactId: contact.contactId,
      displayName: contact.displayName,
      companyId: ctx.companyId,
      performedBy: ctx.uid,
      origin: { field: 'platformCompanyId', value: contact.supplierCompanyId, label: 'Προμηθευτής πλατφόρμας' },
    });
  }
}

/** Παρενέργειες **μετά** το commit, χωρίς να μπλοκάρουν την απάντηση: ίχνη και αποστολή (ADR-327 §7 βήμα h). */
function afterRfqCreated(ctx: AuthContext, rfq: RFQ, dto: CreateRfqDTO, plan: RfqCreatePlan, committed: RfqCreateCommit): void {
  recordSupplierContactBirths(ctx, committed);
  if (dto.adHocLines?.length) recordRfqLinesAdded(ctx, rfq.id, dto.adHocLines.length, 'bulk');
  if (plan.catalogLines.length > 0) recordRfqLinesAdded(ctx, rfq.id, plan.catalogLines.length, 'catalog');
  const inviteMeta: InviteMeta[] = plan.invites.map((prepared) => ({
    inviteId: prepared.invite.id,
    vendorId: prepared.invite.vendorContactId,
    portalUrl: prepared.link.portalUrl,
    declineUrl: prepared.link.declineUrl,
    expiresAt: prepared.link.expiresAtIso,
  }));
  if (inviteMeta.length > 0) void dispatchRfqInviteEmails(ctx, rfq, inviteMeta);
}

/**
 * **Δημιουργία RFQ — ΜΙΑ συναλλαγή, όλο ή τίποτα** (ADR-923 §5.13 Ε6γ, Τ4). Σχέδιο πριν (κρίσεις, αρνήσεις, προσκλήσεις),
 * συναλλαγή στη μέση (αναγνώσεις πριν από εγγραφές), παρενέργειες μετά. Ισχύει για **όλες** τις ροές: BOQ, ad-hoc, inline,
 * κατάλογος — μία διαδρομή, ώστε καμία ροή να μη γεννά RFQ χωρίς γραμμές.
 */
export async function createRfq(ctx: AuthContext, dto: CreateRfqDTO): Promise<RFQ> {
  return (await createRfqWithOutcome(ctx, dto)).rfq;
}

/** Η έκβαση μιας δημιουργίας: το RFQ και οι προμηθευτές του καταλόγου που **προσκλήθηκαν** σε αυτήν (§5.13 Ε6δ, Τ6). */
export interface RfqCreateOutcome {
  readonly rfq: RFQ;
  readonly catalogSuppliers: readonly RfqCatalogSupplierSent[];
}

/** Ίδια με το `createRfq`· μετά το commit λέει και ποιους προμηθευτές καταλόγου κάλεσε (για το επόμενο βήμα της οθόνης). */
export async function createRfqWithOutcome(ctx: AuthContext, dto: CreateRfqDTO): Promise<RfqCreateOutcome> {
  const plan = await planRfqCreate(ctx, dto, generateRfqId());
  const now = admin.firestore.Timestamp.now();
  const rfq = newRfqDocument(ctx, dto, plan, now);
  const committed = await safeFirestoreOperation((db) => runRfqCreateTransaction(db, { companyId: ctx.companyId, dto, plan, rfq, now }));
  if (!committed) throw new Error('Failed to create RFQ');
  logger.info('RFQ created', { id: rfq.id, companyId: ctx.companyId, linesStorage: rfq.linesStorage, lines: committed.lines.length });
  afterRfqCreated(ctx, rfq, dto, plan, committed);
  return { rfq, catalogSuppliers: await catalogSuppliersSent(plan) };
}

// ============================================================================
// READ — LIST
// ============================================================================

export async function listRfqs(
  companyId: string,
  filters: RfqFilters = {}
): Promise<RFQ[]> {
  return safeFirestoreOperation(async (db) => {
    let query = db.collection(COLLECTIONS.RFQS)
      .where('companyId', '==', companyId)
      .where('status', '!=', 'archived') as FirebaseFirestore.Query;

    if (filters.projectId) query = query.where('projectId', '==', filters.projectId);
    if (filters.status) query = query.where('status', '==', filters.status);

    const snap = await query.orderBy('createdAt', 'desc').get();
    const rfqs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RFQ));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      return rfqs.filter((r) => r.title.toLowerCase().includes(q));
    }

    return rfqs;
  }, []);
}

// ============================================================================
// READ — GET
// ============================================================================

/**
 * 🔴 **Δύο σημασιολογίες, μία γραμμή — και γι' αυτό η πολιτική είναι σιωπή.**
 *
 * Καλείται από **δύο** εντελώς διαφορετικούς κόσμους:
 *
 * | Καλών | Τι δίνει ως `companyId` | Ταυτότητα |
 * |---|---|---|
 * | `api/rfqs/[id]` (και οι υπηρεσίες σύγκρισης/προσκλήσεων) | `ctx.companyId` | ταυτοποιημένος χρήστης |
 * | `api/vendor/quote`, `…/decline`, `…/renew` (σύνδεσμος σε `Authorization: Bearer`, ADR-876 §5) | `invite.companyId` — τιμή από **άλλο έγγραφο** | **δημόσιο HMAC token**, μηδέν `ctx`, μηδέν `globalRole` |
 *
 * ⚠️ Στο δημόσιο μονοπάτι **δεν υπάρχει ρόλος να ρωτηθεί**, άρα το
 * `concealCrossTenant` δεν έχει τι να κρίνει: ο κλάδος `reveal` προϋποθέτει
 * καλούντα με νόμιμη cross-tenant ορατότητα, και ο προμηθευτής με token δεν
 * είναι τέτοιος. Χρήση σκέτου `ownedOrNull` — **μην «τυποποιήσεις» τα δύο
 * μονοπάτια σε ένα** (ADR-742 §7ter.5).
 *
 * Η σιωπή εδώ δεν είναι συντηρητική επιλογή· είναι **η μόνη σωστή**: το
 * `invite.companyId` έρχεται από έγγραφο που το ίδιο το token όρισε, οπότε ένα
 * ειλικρινές «ανήκει αλλού» θα μαρτυρούσε ύπαρξη RFQ σε κάποιον που το μόνο
 * που απέδειξε είναι ότι κρατά ένα token.
 */
export async function getRfq(
  companyId: string,
  rfqId: string
): Promise<RFQ | null> {
  return safeFirestoreOperation(
    async (db) =>
      readOwnedProcurementDoc<RFQ>(rfqRef(db, rfqId), companyId, rfqSubject(rfqId)),
    null,
  );
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * ADR-327 §8.5 Β — αλλαγή κλειδώματος απάντησης: μόνο όταν **αλλάζει** (ιδεμποτικό), με γραμμή ιστορικού
 * `response_lock_change` (`quantity:off,unit:off → quantity:on,unit:on`).
 */
function responseLockChange(current: RFQ, dto: UpdateRfqDTO) {
  if (!dto.responseLock) return null;
  const before = resolveResponseLock(current);
  const next = { quantity: dto.responseLock.quantity, unit: dto.responseLock.unit };
  if (sameResponseLock(before, next)) return null;
  // Ίδιο σύνορο με το UI (`deriveSetupLockState`): μετά την ανάθεση ή σε κλειστό κύκλο ζωής, οι όροι δεν αλλάζουν.
  if (deriveSetupLockState(current, []) !== 'unlocked') throw new Error('RFQ setup is locked: response lock cannot change');
  return {
    next,
    audit: { action: 'response_lock_change', detail: `${describeResponseLock(before)} → ${describeResponseLock(next)}` },
  };
}

export async function updateRfq(
  ctx: AuthContext,
  rfqId: string,
  dto: UpdateRfqDTO
): Promise<RFQ> {
  return safeFirestoreOperation(async (db) => {
    const { ref, current } = await loadOwnedRfq<RFQ>(db, ctx.companyId, rfqId);

    if (dto.status && dto.status !== current.status) {
      const allowed = RFQ_STATUS_TRANSITIONS[current.status];
      if (!allowed.includes(dto.status)) {
        throw new Error(`Invalid transition: ${current.status} → ${dto.status}`);
      }
    }

    const newAudit = [...current.auditTrail];
    if (dto.status && dto.status !== current.status) {
      newAudit.push({
        timestamp: admin.firestore.Timestamp.now(),
        userId: ctx.uid,
        action: 'status_change',
        detail: `${current.status} → ${dto.status}`,
      });
    }
    const lockChange = responseLockChange(current, dto);
    if (lockChange) newAudit.push({ timestamp: admin.firestore.Timestamp.now(), userId: ctx.uid, ...lockChange.audit });

    const updates: Partial<RFQ> = {
      title: dto.title ?? current.title,
      description: dto.description !== undefined ? dto.description : current.description,
      lines: dto.lines ?? current.lines,
      deadlineDate: patchAdminTimestamp(dto.deadlineDate, current.deadlineDate),
      awardMode: dto.awardMode ?? current.awardMode,
      reminderTemplate: dto.reminderTemplate ?? current.reminderTemplate,
      status: (dto.status ?? current.status) as RfqStatus,
      winnerQuoteId: dto.winnerQuoteId !== undefined ? dto.winnerQuoteId : current.winnerQuoteId,
      ...(lockChange ? { responseLock: lockChange.next } : {}),
      auditTrail: newAudit,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(sanitizeForFirestore(updates));
    const updatedRfq = { ...current, ...updates };

    // Q31: propagate closed status to parent sourcing event
    if (dto.status === 'closed' && dto.status !== current.status && current.sourcingEventId) {
      await recomputeSourcingEventStatus(ctx, current.sourcingEventId).catch((err) => {
        logger.warn('Failed to recompute sourcing event status', {
          rfqId,
          sourcingEventId: current.sourcingEventId,
          error: String(err),
        });
      });
    }

    return updatedRfq;
  });
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function archiveRfq(
  ctx: AuthContext,
  rfqId: string
): Promise<void> {
  await updateRfq(ctx, rfqId, { status: 'archived' });
  logger.info('RFQ archived', { rfqId, uid: ctx.uid });
}

// ============================================================================
// LIFECYCLE — ADR-335 cancel + reopen (extracted to rfq-lifecycle-service.ts)
// ============================================================================

export { cancelRfq, reopenRfq } from './rfq-lifecycle-service';
export type { CancelRfqOptions } from './rfq-lifecycle-service';

// ============================================================================
// FACTORY — Build CreateRfqDTO from BOQ items (ADR-327 P5-BOQ)
// Reads BOQ items from Firestore, maps ΑΤΟΕ categoryCode → TradeCode,
// returns a pre-filled DTO ready for RfqBuilder. Does NOT persist an RFQ.
// ============================================================================

export async function createRfqFromBoqItems(
  ctx: AuthContext,
  boqItemIds: string[]
): Promise<RfqFromBoqDraft> {
  if (boqItemIds.length === 0) {
    return { projectId: '', title: '', lines: [] };
  }
  return safeFirestoreOperation(async (db) => {
    const items = ownedBoqItems(await boqItemsByIdQuery(db, boqItemIds).get(), ctx.companyId);

    if (items.length === 0) {
      return { projectId: '', title: '', lines: [] };
    }

    const firstItem = items[0];
    const projectId = firstItem.projectId;
    const buildingId = firstItem.buildingId ?? null;

    const vendorIdSet = new Set<string>();
    const lines: RfqDraftLine[] = items.map((item, idx) => {
      if (item.linkedContractorId) vendorIdSet.add(item.linkedContractorId);

      const tradeCode: TradeCode =
        getTradeCodeForAtoeCategory(item.categoryCode) ?? RFQ_FALLBACK_TRADE;

      return {
        id: `rfql_boq_${idx}_${Date.now()}`,
        description: item.title,
        trade: tradeCode,
        categoryCode: item.categoryCode,
        quantity: item.estimatedQuantity,
        unit: item.unit as string,
        notes: item.description ?? null,
        boqItemId: item.id,
      };
    });

    const tradeGroups = new Set(lines.map((l) => l.trade));
    const primaryTrade = tradeGroups.size === 1 ? [...tradeGroups][0] : null;
    const title = primaryTrade
      ? `RFQ — ${firstItem.categoryCode}`
      : `RFQ — ${projectId.slice(-6)}`;

    const dto: RfqFromBoqDraft = {
      projectId,
      buildingId,
      title,
      lines,
      invitedVendorIds: vendorIdSet.size > 0 ? [...vendorIdSet] : undefined,
    };

    logger.info('createRfqFromBoqItems', { count: items.length, projectId });
    return dto;
  }, { projectId: '', title: '', lines: [] });
}
