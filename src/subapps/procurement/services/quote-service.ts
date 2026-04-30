import 'server-only';

import { safeFirestoreOperation, getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateQuoteId, generateOptimisticId } from '@/services/enterprise-id.service';
import { getNextQuoteNumber } from './quote-counters';
import { createModuleLogger } from '@/lib/telemetry';
import admin from 'firebase-admin';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import type {
  Quote,
  QuoteStatus,
  CreateQuoteDTO,
  UpdateQuoteDTO,
  QuoteFilters,
  QuoteAuditEntry,
  QuoteLine,
  ExtractedQuoteData,
  QuoteSource,
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
      quotedTotal: null,
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
      auditTrail: [auditEntry(ctx.uid, 'created', null, 'draft', dto.source)],
      submittedAt: null,
      submitterIp: null,
      linkedPoId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    await db.collection(COLLECTIONS.QUOTES).doc(id).set(sanitizeForFirestore(quote));
    safeFireAndForget(EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.QUOTE,
      entityId: id,
      entityName: `#${displayNumber}`,
      action: 'created',
      changes: [],
      performedBy: ctx.uid,
      performedByName: null,
      companyId: ctx.companyId,
    }));
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
    // Sorting done in JS — orderBy(createdAt) on base query requires a 2-field
    // composite index [companyId, createdAt] that Firestore doesn't auto-create.
    // Per-company collections are small so JS sort is acceptable.
    let query = db.collection(COLLECTIONS.QUOTES)
      .where('companyId', '==', companyId) as FirebaseFirestore.Query;

    if (filters.projectId) query = query.where('projectId', '==', filters.projectId);
    if (filters.rfqId) query = query.where('rfqId', '==', filters.rfqId);
    if (filters.vendorContactId) query = query.where('vendorContactId', '==', filters.vendorContactId);
    if (filters.trade) query = query.where('trade', '==', filters.trade);
    if (filters.status) query = query.where('status', '==', filters.status);

    const snap = await query.get();
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Quote))
      .filter((q) => filters.status ? q.status === filters.status : q.status !== 'archived')
      .sort((a, b) => {
        const aTs = (a.createdAt as unknown as { _seconds: number })?._seconds ?? 0;
        const bTs = (b.createdAt as unknown as { _seconds: number })?._seconds ?? 0;
        return bTs - aTs;
      });
    return docs;
  }, []);
}

// ============================================================================
// READ — GET
// ============================================================================

/**
 * Fetch a single quote by id, scoped to `companyId`.
 *
 * Returns `null` ONLY for legitimate "not visible to caller" cases:
 *   - document does not exist (`!snap.exists`)
 *   - document exists but belongs to a different tenant
 *
 * Firestore errors (timeouts, deadline exceeded, network failures) are
 * **propagated** — callers must distinguish "404 not-found" from "503
 * service-unavailable". The previous `safeFirestoreOperation(..., null)`
 * wrapper silently swallowed transient failures and returned `null`,
 * surfacing them in the API as false 404s and triggering useQuote retry
 * loops on doc that actually existed.
 */
export async function getQuote(
  companyId: string,
  quoteId: string
): Promise<Quote | null> {
  if (!isFirebaseAdminAvailable()) {
    throw new Error('Firestore unavailable');
  }
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.QUOTES).doc(quoteId).get();
  if (!snap.exists) {
    logger.info('getQuote: document does not exist', { quoteId, companyId });
    return null;
  }
  const quote = { id: snap.id, ...snap.data() } as Quote;
  if (quote.companyId !== companyId) {
    logger.warn('getQuote: tenant mismatch', {
      quoteId,
      requestedBy: companyId,
      actualCompanyId: quote.companyId,
    });
    return null;
  }
  return quote;
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
    const newQuotedTotal = dto.quotedTotal !== undefined ? dto.quotedTotal : (current.quotedTotal ?? null);
    const newAudit = [...current.auditTrail];
    if (dto.status && dto.status !== current.status) {
      newAudit.push(auditEntry(ctx.uid, 'status_change', current.status, dto.status));
    }
    if (dto.overrideReason) {
      newAudit.push(auditEntry(ctx.uid, 'risk_flag_override', null, dto.overrideReason));
    }

    const updates: Partial<Quote> = {
      lines: newLines,
      totals: computeQuoteTotals(newLines, newQuotedTotal),
      quotedTotal: newQuotedTotal,
      paymentTerms: dto.paymentTerms !== undefined ? dto.paymentTerms : current.paymentTerms,
      deliveryTerms: dto.deliveryTerms !== undefined ? dto.deliveryTerms : current.deliveryTerms,
      warranty: dto.warranty !== undefined ? dto.warranty : current.warranty,
      notes: dto.notes !== undefined ? dto.notes : current.notes,
      status: (dto.status ?? current.status) as QuoteStatus,
      overrideReason: dto.overrideReason ?? current.overrideReason,
      overrideAt: dto.overrideReason ? admin.firestore.Timestamp.now() : current.overrideAt,
      overriddenBy: dto.overrideReason ? ctx.uid : current.overriddenBy,
      vendorContactId: dto.vendorContactId ?? current.vendorContactId,
      auditTrail: newAudit,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(sanitizeForFirestore(updates));
    if (dto.status && dto.status !== current.status) {
      safeFireAndForget(EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.QUOTE,
        entityId: quoteId,
        entityName: `#${current.displayNumber}`,
        action: 'status_changed',
        changes: [{ field: 'status', oldValue: current.status, newValue: dto.status }],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }));
    }
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
  logger.info('Quote archived', { quoteId, userId: ctx.uid });
}

// ============================================================================
// AI APPLY EXTRACTED DATA — ADR-327 §6 (Phase 2 — AI Scan)
// ============================================================================

/**
 * Materialize `ExtractedQuoteData.lineItems` (FieldWithConfidence wrapped) into
 * concrete `QuoteLine[]` for the quote document. Confidence info is preserved
 * separately in `extractedData` so the review UI can highlight low-confidence cells.
 */
function materializeQuoteLines(extracted: ExtractedQuoteData): QuoteLine[] {
  return extracted.lineItems.map((item, idx): QuoteLine => {
    const qty = item.quantity.value;
    const price = item.unitPrice.value;
    const explicitTotal = item.lineTotal.value;
    const computedTotal = qty * price;
    const total = explicitTotal && explicitTotal > 0 ? explicitTotal : computedTotal;
    const vatRaw = item.vatRate.value;
    const vatRate: 0 | 6 | 13 | 24 =
      vatRaw === 0 || vatRaw === 6 || vatRaw === 13 ? vatRaw : 24;
    return {
      id: `${generateOptimisticId()}_line_${idx}`,
      description: item.description.value || '',
      categoryCode: null,
      quantity: qty || 0,
      unit: item.unit.value || 'τμχ',
      unitPrice: price || 0,
      vatRate,
      lineTotal: total || 0,
      notes: null,
    };
  });
}

export interface ApplyExtractedDataOptions {
  /** Source that produced the extraction (default: 'scan'). */
  source?: QuoteSource;
  /** Auto-accept threshold 0-1. If `overallConfidence/100 >= threshold` → status `submitted`. Default 1.0 (always review). */
  autoAcceptThreshold?: number;
}

/**
 * Persist AI-extracted fields onto a quote.
 *
 * Behavior (Q6 default):
 *  - extractedData stored as-is (review UI reads confidence info)
 *  - quote.lines materialized from extracted lineItems (review UI may overwrite)
 *  - quote.totals recomputed from materialized lines
 *  - audit entry `extracted_applied`
 *  - if confidence ratio below threshold → status remains `draft` (manual review)
 *  - if confidence ratio meets/exceeds threshold AND current status is `draft` → status `submitted`
 */
export async function applyExtractedData(
  ctx: AuthContext,
  quoteId: string,
  extracted: ExtractedQuoteData,
  options: ApplyExtractedDataOptions = {}
): Promise<Quote> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.QUOTES).doc(quoteId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Quote ${quoteId} not found`);

    const current = { id: snap.id, ...snap.data() } as Quote;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');

    const source = options.source ?? 'scan';
    const threshold = options.autoAcceptThreshold ?? 1.0;
    const ratio = (extracted.overallConfidence ?? 0) / 100;
    const shouldAutoSubmit =
      current.status === 'draft' && ratio >= threshold && extracted.lineItems.length > 0;

    const newLines = materializeQuoteLines(extracted);
    const quotedTotal = extracted.totalAmount?.value ?? null;
    const newAudit = [...current.auditTrail];
    newAudit.push(auditEntry(
      ctx.uid,
      'extracted_applied',
      null,
      `confidence=${extracted.overallConfidence}; lines=${newLines.length}; quotedTotal=${quotedTotal}`,
      source
    ));
    if (shouldAutoSubmit) {
      newAudit.push(auditEntry(ctx.uid, 'status_change', current.status, 'submitted', source));
    }

    const updates: Partial<Quote> = {
      extractedData: extracted,
      overallConfidence: extracted.overallConfidence ?? 0,
      lines: newLines,
      totals: computeQuoteTotals(newLines, quotedTotal),
      quotedTotal,
      acceptanceMode: shouldAutoSubmit ? 'auto' : 'manual',
      status: shouldAutoSubmit ? 'submitted' : current.status,
      auditTrail: newAudit,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(sanitizeForFirestore(updates));
    logger.info('Quote extracted data applied', {
      quoteId,
      confidence: extracted.overallConfidence,
      lines: newLines.length,
      autoSubmitted: shouldAutoSubmit,
    });

    return { ...current, ...updates } as Quote;
  });
}
