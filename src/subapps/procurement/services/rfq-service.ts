import 'server-only';

import { safeFirestoreOperation, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateRfqId, generateVendorInviteId } from '@/services/enterprise-id.service';
import {
  generateVendorPortalToken,
} from '@/services/vendor-portal/vendor-portal-token-service';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';
import { normalizeToDate } from '@/lib/date-local';
import type { RFQ, RfqStatus, CreateRfqDTO, UpdateRfqDTO, RfqFilters, RfqLine } from '../types/rfq';
import { RFQ_STATUS_TRANSITIONS } from '../types/rfq';
import type { AuthContext } from '@/lib/auth';
import type { BOQItem } from '@/types/boq/boq';
import { getTradeCodeForAtoeCategory } from '../data/trades';
import type { TradeCode } from '../types/trade';
import { snapshotFromBoq, addRfqLinesBulk } from './rfq-line-service';
import { recomputeSourcingEventStatus } from './sourcing-event-service';
import { emailVendorInviteChannel } from './channels/email-channel';
import { getContactEmail } from '@/services/contacts/contact-name-resolver-types';

const logger = createModuleLogger('RFQ_SERVICE');

// ============================================================================
// EMAIL DISPATCH HELPERS — post-create invite fan-out (ADR-327 §7 step h)
// ============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://nestor-app.vercel.app';

function rfqPortalUrl(token: string): string {
  return `${APP_URL}/vendor/quote/${encodeURIComponent(token)}`;
}

function rfqDeclineUrl(token: string): string {
  return `${APP_URL}/vendor/quote/${encodeURIComponent(token)}/decline`;
}

interface InviteMeta {
  inviteId: string;
  vendorId: string;
  token: string;
  expiresAt: string;
}

async function dispatchRfqInviteEmails(
  ctx: AuthContext,
  rfq: RFQ,
  inviteMeta: InviteMeta[],
): Promise<void> {
  const db = admin.firestore();
  const results = await Promise.allSettled(
    inviteMeta.map(async (meta) => {
      const snap = await db.collection(COLLECTIONS.CONTACTS).doc(meta.vendorId).get();
      if (!snap.exists) return;
      const data = snap.data() ?? {};
      if (data.companyId && data.companyId !== ctx.companyId) return;
      const email = getContactEmail(data as Parameters<typeof getContactEmail>[0]);
      if (!email) return;
      const vendorName = String(data.displayName ?? data.companyName ?? data.fullName ?? meta.vendorId);
      const portalUrl = rfqPortalUrl(meta.token);
      const result = await emailVendorInviteChannel.send({
        inviteId: meta.inviteId,
        vendorName,
        recipient: email,
        rfqTitle: rfq.title,
        projectName: null,
        portalUrl,
        expiresAt: meta.expiresAt,
        locale: 'el',
        declineUrl: rfqDeclineUrl(meta.token),
      });
      if (result.success) {
        await db.collection(COLLECTIONS.VENDOR_INVITES).doc(meta.inviteId).update({
          deliveredAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
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

const DEFAULT_INVITE_EXPIRY_DAYS = 7;

// ============================================================================
// CREATE
// ============================================================================

export async function createRfq(
  ctx: AuthContext,
  dto: CreateRfqDTO
): Promise<RFQ> {
  const result = await safeFirestoreOperation(async (db) => {
    const id = generateRfqId();
    const now = admin.firestore.Timestamp.now();
    const invitedVendorIds = dto.invitedVendorIds ?? [];

    const linesStorage =
      dto.boqItemIds?.length ? 'boq' :
      dto.adHocLines?.length ? 'ad_hoc' :
      dto.lines?.length ? 'inline_legacy' :
      null;

    const newRfq: RFQ = {
      id,
      projectId: dto.projectId,
      buildingId: dto.buildingId ?? null,
      companyId: ctx.companyId,
      title: dto.title,
      description: dto.description ?? null,
      lines: dto.lines ?? [],
      deadlineDate: null,
      status: 'draft',
      awardMode: dto.awardMode ?? 'whole_package',
      reminderTemplate: dto.reminderTemplate ?? 'standard',
      invitedVendorIds,
      winnerQuoteId: null,
      comparisonTemplateId: dto.comparisonTemplateId ?? 'standard',
      auditTrail: [{
        timestamp: now,
        userId: ctx.uid,
        action: 'created',
        detail: null,
      }],
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
      // Multi-Vendor extension fields (Q28-Q31)
      sourcingEventId: dto.sourcingEventId ?? null,
      sourcingEventStatus: null,
      invitedVendorCount: invitedVendorIds.length,
      respondedCount: 0,
      linesStorage,
    };

    const needsBatch = invitedVendorIds.length > 0 || !!dto.sourcingEventId;
    const inviteMeta: InviteMeta[] = [];

    if (needsBatch) {
      const batch = db.batch();
      batch.set(db.collection(COLLECTIONS.RFQS).doc(id), sanitizeForFirestore(newRfq));

      // Q28 fan-out: create vendor invite stubs atomically with the RFQ
      for (const vendorId of invitedVendorIds) {
        const inviteId = generateVendorInviteId();
        const generated = generateVendorPortalToken(id, vendorId, DEFAULT_INVITE_EXPIRY_DAYS);
        inviteMeta.push({ inviteId, vendorId, token: generated.token, expiresAt: generated.expiresAt });
        const inviteStub = {
          id: inviteId,
          rfqId: id,
          vendorContactId: vendorId,
          companyId: ctx.companyId,
          token: generated.token,
          deliveryChannel: 'email',
          preferredChannel: null,
          status: 'sent',
          deliveredAt: null,
          openedAt: null,
          submittedAt: null,
          declinedAt: null,
          declineReason: null,
          expiresAt: admin.firestore.Timestamp.fromDate(normalizeToDate(generated.expiresAt) ?? new Date()),
          editWindowExpiresAt: null,
          remindersSentAt: [],
          lastReminderAt: null,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(
          db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId),
          sanitizeForFirestore(inviteStub),
        );
      }

      // Q31: link to parent sourcing event atomically
      if (dto.sourcingEventId) {
        batch.update(
          db.collection(COLLECTIONS.SOURCING_EVENTS).doc(dto.sourcingEventId),
          sanitizeForFirestore({
            rfqIds: FieldValue.arrayUnion(id),
            rfqCount: FieldValue.increment(1),
            updatedAt: now,
          }),
        );
      }

      await batch.commit();
    } else {
      await db.collection(COLLECTIONS.RFQS).doc(id).set(sanitizeForFirestore(newRfq));
    }

    logger.info('RFQ created', { id, companyId: ctx.companyId, linesStorage });
    return { rfq: newRfq, inviteMeta };
  });

  if (!result) throw new Error('Failed to create RFQ');
  const { rfq, inviteMeta } = result;

  // Sub-collection line writes — after RFQ doc exists (Q29)
  if (dto.boqItemIds?.length) {
    await snapshotFromBoq(ctx, rfq.id, dto.boqItemIds, 'materials_general');
  } else if (dto.adHocLines?.length) {
    await addRfqLinesBulk(ctx, rfq.id, dto.adHocLines);
  }

  // Email dispatch — fire-and-forget, does not block RFQ creation response (step h)
  if (inviteMeta.length > 0) {
    void dispatchRfqInviteEmails(ctx, rfq, inviteMeta);
  }

  return rfq;
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

export async function getRfq(
  companyId: string,
  rfqId: string
): Promise<RFQ | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.RFQS).doc(rfqId).get();
    if (!snap.exists) return null;
    const rfq = { id: snap.id, ...snap.data() } as RFQ;
    if (rfq.companyId !== companyId) return null;
    return rfq;
  }, null);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateRfq(
  ctx: AuthContext,
  rfqId: string,
  dto: UpdateRfqDTO
): Promise<RFQ> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.RFQS).doc(rfqId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`RFQ ${rfqId} not found`);

    const current = { id: snap.id, ...snap.data() } as RFQ;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

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

    const updates: Partial<RFQ> = {
      title: dto.title ?? current.title,
      description: dto.description !== undefined ? dto.description : current.description,
      lines: dto.lines ?? current.lines,
      deadlineDate: dto.deadlineDate !== undefined
        ? (dto.deadlineDate ? admin.firestore.Timestamp.fromDate(normalizeToDate(dto.deadlineDate) ?? new Date()) : null)
        : current.deadlineDate,
      awardMode: dto.awardMode ?? current.awardMode,
      reminderTemplate: dto.reminderTemplate ?? current.reminderTemplate,
      status: (dto.status ?? current.status) as RfqStatus,
      winnerQuoteId: dto.winnerQuoteId !== undefined ? dto.winnerQuoteId : current.winnerQuoteId,
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
): Promise<CreateRfqDTO> {
  if (boqItemIds.length === 0) {
    return { projectId: '', title: '', lines: [] };
  }
  // Firestore `in` supports max 30 values
  const ids = boqItemIds.slice(0, 30);

  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.BOQ_ITEMS)
      .where(admin.firestore.FieldPath.documentId(), 'in', ids)
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as BOQItem))
      .filter((item) => item.companyId === ctx.companyId);

    if (items.length === 0) {
      return { projectId: '', title: '', lines: [] };
    }

    const firstItem = items[0];
    const projectId = firstItem.projectId;
    const buildingId = firstItem.buildingId ?? null;

    const vendorIdSet = new Set<string>();
    const lines: RfqLine[] = items.map((item, idx) => {
      if (item.linkedContractorId) vendorIdSet.add(item.linkedContractorId);

      const tradeCode: TradeCode =
        getTradeCodeForAtoeCategory(item.categoryCode) ?? 'materials_general';

      return {
        id: `rfql_boq_${idx}_${Date.now()}`,
        description: item.title,
        trade: tradeCode,
        categoryCode: item.categoryCode,
        quantity: item.estimatedQuantity,
        unit: item.unit as string,
        notes: item.description ?? null,
      };
    });

    const tradeGroups = new Set(lines.map((l) => l.trade));
    const primaryTrade = tradeGroups.size === 1 ? [...tradeGroups][0] : null;
    const title = primaryTrade
      ? `RFQ — ${firstItem.categoryCode}`
      : `RFQ — ${projectId.slice(-6)}`;

    const dto: CreateRfqDTO = {
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
