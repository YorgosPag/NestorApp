import 'server-only';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateQuoteId, generateOptimisticId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { getNextQuoteNumber } from './quote-counters';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';
import type {
  Quote,
  QuoteStatus,
  CreateQuoteDTO,
  UpdateQuoteDTO,
  QuoteFilters,
  QuoteAuditEntry,
} from '../types/quote';
import { QUOTE_STATUS_TRANSITIONS, computeQuoteTotals, isTransitionAllowed } from '../types/quote';
import type { AuthContext } from '@/lib/auth';

const logger = createModuleLogger('QUOTE_SERVICE');

// ============================================================================
// HELPERS
// ============================================================================

function auditEntry(
  userId: string,
  action: string,
  prev: string | null = null,
  next: string | null = null,
  source: QuoteAuditEntry['source'] = 'system'
): QuoteAuditEntry {
  return {
    timestamp: admin.firestore.Timestamp.now(),
    userId,
    action,
    previousValue: prev,
    newValue: next,
    source,
    ip: null,
  };
}

// ============================================================================
// CREATE
// ============================================================================

export async function createQuote(
  ctx: AuthContext,
  dto: CreateQuoteDTO
): Promise<Quote> {
  return safeFirestoreOperation(async (db) => {
    const id = generateQuoteId();
    const displayNumber = await getNextQuoteNumber(ctx.companyId);
    const now = admin.firestore.Timestamp.now();
    const lines = dto.lines ?? [];

    const quote: Quote = {
      id,
      displayNumber,
      rfqId: dto.rfqId ?? null,
      projectId: dto.projectId,
      buildingId: dto.buildingId ?? null,
      companyId: ctx.companyId,
      vendorContactId: dto.vendorContactId,
      trade: dto.trade,
      source: dto.source,
      status: 'draft',
      lines,
      totals: computeQuoteTotals(lines),
      validUntil: null,
      paymentTerms: dto.paymentTerms ?? null,
      deliveryTerms: dto.deliveryTerms ?? null,
      warranty: null,
      notes: dto.notes ?? null,
      attachments: [],
      extractedData: null,
      overallConfidence: null,
      acceptanceMode: null,
      overrideReason: null,
      overrideAt: null,
      overriddenBy: null,
      vendorEditHistory: [],
      editWindowExpiresAt: null,
      auditTrail: [auditEntry(ctx.userId, 'created', null, 'draft', dto.source)],
      submittedAt: null,
      submitterIp: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
    };

    await db.collection(COLLECTIONS.QUOTES).doc(id).set(sanitizeForFirestore(quote));
    logger.info('Quote created', { id, displayNumber, companyId: ctx.companyId });
    return quote;
  });
}

// ============================================================================
// READ — LIST
// ============================================================================

export async function listQuotes(
  companyId: string,
  filters: QuoteFilters = {}
): Promise<Quote[]> {
  return safeFirestoreOperation(async (db) => {
    let query = db.collection(COLLECTIONS.QUOTES)
      .where('companyId', '==', companyId)
      .where('status', '!=', 'archived') as FirebaseFirestore.Query;

    if (filters.projectId) query = query.where('projectId', '==', filters.projectId);
    if (filters.rfqId) query = query.where('rfqId', '==', filters.rfqId);
    if (filters.vendorContactId) query = query.where('vendorContactId', '==', filters.vendorContactId);
    if (filters.trade) query = query.where('trade', '==', filters.trade);
    if (filters.status) query = query.where('status', '==', filters.status);

    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quote));
  }, []);
}

// ============================================================================
// READ — GET
// ============================================================================

export async function getQuote(
  companyId: string,
  quoteId: string
): Promise<Quote | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.QUOTES).doc(quoteId).get();
    if (!snap.exists) return null;
    const quote = { id: snap.id, ...snap.data() } as Quote;
    if (quote.companyId !== companyId) return null;
    return quote;
  }, null);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateQuote(
  ctx: AuthContext,
  quoteId: string,
  dto: UpdateQuoteDTO
): Promise<Quote> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.QUOTES).doc(quoteId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Quote ${quoteId} not found`);

    const current = { id: snap.id, ...snap.data() } as Quote;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

    if (dto.status && dto.status !== current.status) {
      if (!isTransitionAllowed(current.status, dto.status)) {
        throw new Error(`Invalid transition: ${current.status} → ${dto.status}`);
      }
      if (dto.status === 'accepted' && current.status !== 'under_review' && !dto.overrideReason) {
        if (current.auditTrail.some((e) => e.action === 'risk_flag_override')) {
          throw new Error('Override reason required when accepting a flagged quote');
        }
      }
    }

    const newLines = dto.lines ?? current.lines;
    const newAudit = [...current.auditTrail];
    if (dto.status && dto.status !== current.status) {
      newAudit.push(auditEntry(ctx.userId, 'status_change', current.status, dto.status));
    }
    if (dto.overrideReason) {
      newAudit.push(auditEntry(ctx.userId, 'risk_flag_override', null, dto.overrideReason));
    }

    const updates: Partial<Quote> = {
      lines: newLines,
      totals: computeQuoteTotals(newLines),
      paymentTerms: dto.paymentTerms !== undefined ? dto.paymentTerms : current.paymentTerms,
      deliveryTerms: dto.deliveryTerms !== undefined ? dto.deliveryTerms : current.deliveryTerms,
      warranty: dto.warranty !== undefined ? dto.warranty : current.warranty,
      notes: dto.notes !== undefined ? dto.notes : current.notes,
      status: (dto.status ?? current.status) as QuoteStatus,
      overrideReason: dto.overrideReason ?? current.overrideReason,
      overrideAt: dto.overrideReason ? admin.firestore.Timestamp.now() : current.overrideAt,
      overriddenBy: dto.overrideReason ? ctx.userId : current.overriddenBy,
      auditTrail: newAudit,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(sanitizeForFirestore(updates));
    return { ...current, ...updates };
  });
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function archiveQuote(
  ctx: AuthContext,
  quoteId: string
): Promise<void> {
  await updateQuote(ctx, quoteId, { status: 'archived' });
  logger.info('Quote archived', { quoteId, userId: ctx.userId });
}
