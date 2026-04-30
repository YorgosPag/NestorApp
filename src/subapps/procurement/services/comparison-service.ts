import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { calculateSupplierMetrics } from '@/services/procurement/supplier-metrics-service';
import { listQuotes, updateQuote } from './quote-service';
import { generatePoFromAwardedQuote } from './po-generation-service';
import { getRfq, updateRfq } from './rfq-service';
import {
  COMPARISON_TEMPLATES,
  DEFAULT_COMPARISON_TEMPLATE_ID,
} from '../types/comparison';
import type {
  ComparisonWeights,
  QuoteComparisonResult,
  QuoteComparisonEntry,
  QuoteScoreBreakdown,
  ComparisonRecommendation,
  CherryPickResult,
  LineWinner,
  TcoNormalization,
} from '../types/comparison';
import type { Quote, QuoteLine, QuoteStatus } from '../types/quote';
import type { AuthContext } from '@/lib/auth';

const logger = createModuleLogger('COMPARISON_SERVICE');

const COMPARABLE_STATUSES: ReadonlySet<QuoteStatus> = new Set([
  'submitted', 'under_review', 'accepted',
]);

const RISK_SUPPLIER_SCORE_THRESHOLD = 70;
const STRONG_WINNER_DELTA_PERCENT = 5;

import { fetchVendorNames, resolveVendorName } from './vendor-name-resolver';

// ============================================================================
// TCO NORMALIZATION — ADR-331
// ============================================================================

function normalizeTco(quote: Quote): TcoNormalization {
  const vatIncluded = quote.vatIncluded !== undefined
    ? quote.vatIncluded
    : (quote.extractedData?.vatIncluded?.value ?? null);
  const laborIncluded = quote.laborIncluded !== undefined
    ? quote.laborIncluded
    : (quote.extractedData?.laborIncluded?.value ?? null);
  const rawTotal = quote.totals.total;
  const vatDelta = vatIncluded === false ? Math.round(rawTotal * 0.24 * 100) / 100 : 0;
  return {
    normalizedTotal: Math.round((rawTotal + vatDelta) * 100) / 100,
    vatDelta,
    laborFlag: laborIncluded === false,
    deliveryFlag: !quote.deliveryTerms || quote.deliveryTerms.trim() === '',
    warrantyText: quote.warranty ?? null,
    vatIncluded,
    laborIncluded,
  };
}

// ============================================================================
// FACTOR SCORERS (each returns 0-100)
// ============================================================================

function priceScore(total: number, minTotal: number, maxTotal: number): number {
  if (maxTotal === minTotal) return 100;
  return ((maxTotal - total) / (maxTotal - minTotal)) * 100;
}

function termsScore(quote: Quote): number {
  let s = 50;
  if (quote.warranty && quote.warranty.trim().length > 0) s += 15;
  if (quote.paymentTerms) {
    const m = quote.paymentTerms.match(/(\d+)/);
    if (m) {
      const days = parseInt(m[1], 10);
      s += Math.min(30, Math.floor(days / 30) * 10);
    }
  }
  if (quote.notes && quote.notes.length > 0) s += 5;
  return Math.min(100, Math.max(0, s));
}

function deliveryScore(quote: Quote): number {
  if (!quote.deliveryTerms) return 50;
  const m = quote.deliveryTerms.match(/(\d+)/);
  if (!m) return 50;
  const days = parseInt(m[1], 10);
  if (days <= 7) return 100;
  if (days >= 60) return 0;
  return Math.round(100 - ((days - 7) * 100) / 53);
}

interface VendorScoreData {
  score: number;
  totalOrders: number;
}

async function computeVendorScore(
  companyId: string,
  vendorContactId: string,
  vendorName: string
): Promise<VendorScoreData> {
  try {
    const m = await calculateSupplierMetrics(companyId, vendorContactId, vendorName);
    if (m.totalOrders === 0) return { score: 50, totalOrders: 0 };
    const orderBonus = Math.min(20, m.totalOrders * 2);
    const raw = m.onTimeDeliveryRate * 0.5 + (100 - m.cancellationRate) * 0.3 + orderBonus;
    return { score: Math.min(100, Math.max(0, raw)), totalOrders: m.totalOrders };
  } catch (err) {
    logger.warn('Supplier metrics failed', { vendorContactId, error: String(err) });
    return { score: 50, totalOrders: 0 };
  }
}

// ============================================================================
// FLAGS & RECOMMENDATION REASON
// ============================================================================

function assignFlags(
  entry: QuoteComparisonEntry,
  ctx: { minNormTotal: number; maxSupplier: number; maxDelivery: number; maxTerms: number }
): QuoteComparisonEntry['flags'] {
  const flags: QuoteComparisonEntry['flags'] = [];
  if (entry.tco.normalizedTotal === ctx.minNormTotal) flags.push('cheapest');
  if (entry.breakdown.supplier === ctx.maxSupplier && ctx.maxSupplier > 0) flags.push('most_reliable');
  if (entry.breakdown.delivery === ctx.maxDelivery && ctx.maxDelivery > 0) flags.push('fastest_delivery');
  if (entry.breakdown.terms === ctx.maxTerms && ctx.maxTerms > 0) flags.push('best_terms');
  if (entry.supplierScore !== null && entry.supplierScore < RISK_SUPPLIER_SCORE_THRESHOLD) {
    flags.push('risk_low_score');
  }
  return flags;
}

function buildReason(top: QuoteComparisonEntry, second: QuoteComparisonEntry | null): string {
  const parts: string[] = [];
  if (top.flags.includes('cheapest')) parts.push('cheapest');
  if (top.flags.includes('most_reliable')) parts.push('most_reliable');
  if (top.flags.includes('fastest_delivery')) parts.push('fastest_delivery');
  if (top.flags.includes('best_terms')) parts.push('best_terms');
  if (parts.length === 0) parts.push('balanced_score');
  if (second) {
    const delta = top.score - second.score;
    parts.push(delta >= STRONG_WINNER_DELTA_PERCENT ? 'strong_lead' : 'narrow_lead');
  }
  return parts.join(',');
}

// ============================================================================
// CORE: COMPUTE COMPARISON
// ============================================================================

async function buildEntries(
  companyId: string,
  quotes: Quote[],
  weights: ComparisonWeights
): Promise<QuoteComparisonEntry[]> {
  const names = await fetchVendorNames(companyId, quotes.map((q) => q.vendorContactId));
  const resolvedNames = new Map(quotes.map((q) => [q.id, resolveVendorName(q, names)] as const));

  const tcoMap = new Map(quotes.map((q) => [q.id, normalizeTco(q)] as const));
  const normTotals = quotes.map((q) => tcoMap.get(q.id)!.normalizedTotal);
  const minNormTotal = Math.min(...normTotals);
  const maxNormTotal = Math.max(...normTotals);

  const vendorScores = await Promise.all(
    quotes.map((q) => computeVendorScore(companyId, q.vendorContactId, resolvedNames.get(q.id) ?? q.vendorContactId))
  );

  const partial: QuoteComparisonEntry[] = quotes.map((q, idx) => {
    const tco = tcoMap.get(q.id)!;
    const breakdown: QuoteScoreBreakdown = {
      price: priceScore(tco.normalizedTotal, minNormTotal, maxNormTotal),
      supplier: vendorScores[idx].score,
      terms: termsScore(q),
      delivery: deliveryScore(q),
    };
    const score =
      breakdown.price * weights.price +
      breakdown.supplier * weights.supplier +
      breakdown.terms * weights.terms +
      breakdown.delivery * weights.delivery;
    return {
      quoteId: q.id,
      vendorName: resolvedNames.get(q.id) ?? q.vendorContactId,
      vendorContactId: q.vendorContactId,
      total: q.totals.total,
      tco,
      score: Math.round(score * 100) / 100,
      breakdown,
      rank: 0,
      flags: [],
      supplierScore: vendorScores[idx].totalOrders === 0 ? null : vendorScores[idx].score,
      hasRiskFlags: false,
    };
  });

  partial.sort((a, b) => b.score - a.score);
  partial.forEach((e, i) => { e.rank = i + 1; });

  const ctx = {
    minNormTotal,
    maxSupplier: Math.max(...partial.map((e) => e.breakdown.supplier)),
    maxDelivery: Math.max(...partial.map((e) => e.breakdown.delivery)),
    maxTerms: Math.max(...partial.map((e) => e.breakdown.terms)),
  };
  for (const e of partial) {
    e.flags = assignFlags(e, ctx);
    e.hasRiskFlags = e.flags.includes('risk_low_score');
  }
  return partial;
}

function buildRecommendation(entries: QuoteComparisonEntry[]): ComparisonRecommendation | null {
  if (entries.length === 0) return null;
  const top = entries[0];
  const second = entries[1] ?? null;
  const delta = second ? top.score - second.score : top.score;
  return {
    quoteId: top.quoteId,
    reason: buildReason(top, second),
    confidence: Math.min(1, Math.max(0, delta / 100)),
    deltaFromSecond: Math.round(delta * 100) / 100,
  };
}

interface ComputeOptions {
  templateId?: string;
  weightsOverride?: ComparisonWeights;
}

export async function computeRfqComparison(
  companyId: string,
  rfqId: string,
  options: ComputeOptions = {}
): Promise<QuoteComparisonResult> {
  const rfq = await getRfq(companyId, rfqId);
  if (!rfq) throw new Error(`RFQ ${rfqId} not found`);

  const all = await listQuotes(companyId, { rfqId });
  const quotes = all.filter((q) => COMPARABLE_STATUSES.has(q.status));

  const templateId = options.templateId ?? rfq.comparisonTemplateId ?? DEFAULT_COMPARISON_TEMPLATE_ID;
  const weights =
    options.weightsOverride ??
    COMPARISON_TEMPLATES[templateId]?.weights ??
    COMPARISON_TEMPLATES[DEFAULT_COMPARISON_TEMPLATE_ID].weights;

  const entries = quotes.length > 0
    ? await buildEntries(companyId, quotes, weights)
    : [];

  return {
    rfqId,
    adhocGroupKey: null,
    quoteCount: entries.length,
    quotes: entries,
    recommendation: buildRecommendation(entries),
    weights,
    templateId,
    computedAt: nowISO(),
  };
}

// ============================================================================
// CHERRY-PICK (per-line winners)
// ============================================================================

function lineKey(line: QuoteLine): string {
  if (line.categoryCode) return `code:${line.categoryCode}`;
  return `desc:${line.description.trim().toLowerCase()}`;
}

export async function computeCherryPick(
  companyId: string,
  rfqId: string
): Promise<CherryPickResult> {
  const all = await listQuotes(companyId, { rfqId });
  const quotes = all.filter((q) => COMPARABLE_STATUSES.has(q.status));
  if (quotes.length === 0) {
    return {
      lineWinners: [],
      totalIfCherryPick: 0,
      totalIfWholePackage: 0,
      savingsFromSplit: 0,
      savingsPercent: 0,
    };
  }

  const names = await fetchVendorNames(companyId, quotes.map((q) => q.vendorContactId));

  const byKey = new Map<string, Array<{ quote: Quote; line: QuoteLine }>>();
  for (const q of quotes) {
    for (const line of q.lines) {
      const key = lineKey(line);
      const list = byKey.get(key) ?? [];
      list.push({ quote: q, line });
      byKey.set(key, list);
    }
  }

  const lineWinners: LineWinner[] = [];
  let totalCherry = 0;

  for (const [, candidates] of byKey) {
    candidates.sort((a, b) => a.line.unitPrice - b.line.unitPrice);
    const win = candidates[0];
    const worst = candidates[candidates.length - 1];
    const savings = (worst.line.unitPrice - win.line.unitPrice) * win.line.quantity;
    const savingsPct = worst.line.unitPrice > 0
      ? ((worst.line.unitPrice - win.line.unitPrice) / worst.line.unitPrice) * 100
      : 0;
    lineWinners.push({
      lineDescription: win.line.description,
      categoryCode: win.line.categoryCode,
      winnerQuoteId: win.quote.id,
      winnerVendorName: names.get(win.quote.vendorContactId) ?? win.quote.vendorContactId,
      winnerUnitPrice: win.line.unitPrice,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPct * 100) / 100,
    });
    totalCherry += win.line.unitPrice * win.line.quantity;
  }

  const totalWhole = Math.min(...quotes.map((q) => q.totals.subtotal));
  const savingsFromSplit = Math.max(0, totalWhole - totalCherry);
  const savingsPercent = totalWhole > 0 ? (savingsFromSplit / totalWhole) * 100 : 0;

  return {
    lineWinners,
    totalIfCherryPick: Math.round(totalCherry * 100) / 100,
    totalIfWholePackage: Math.round(totalWhole * 100) / 100,
    savingsFromSplit: Math.round(savingsFromSplit * 100) / 100,
    savingsPercent: Math.round(savingsPercent * 100) / 100,
  };
}

// ============================================================================
// AWARD FLOW (atomic FSM transitions + audit)
// ============================================================================

export interface AwardOptions {
  winnerQuoteId: string;
  overrideReason?: string;
}

export interface AwardResult {
  rfqId: string;
  winnerQuoteId: string;
  rejectedQuoteIds: string[];
  override: boolean;
  poId: string;
  poNumber: string;
}

async function transitionWinner(
  ctx: AuthContext,
  quote: Quote,
  overrideReason: string | undefined
): Promise<void> {
  if (quote.status === 'submitted') {
    await updateQuote(ctx, quote.id, { status: 'under_review' });
  }
  await updateQuote(ctx, quote.id, {
    status: 'accepted',
    overrideReason,
  });
}

async function transitionLoser(ctx: AuthContext, quote: Quote): Promise<void> {
  if (quote.status === 'accepted' || quote.status === 'rejected' || quote.status === 'archived') return;
  await updateQuote(ctx, quote.id, { status: 'rejected' });
}

interface AwardContext {
  isOverride: boolean;
  isRiskOverride: boolean;
  recommended: string | null;
  templateId: string;
}

function validateOverride(
  ctx: AwardContext,
  reason: string | undefined
): void {
  const requiresReason = ctx.isOverride || ctx.isRiskOverride;
  if (requiresReason && (!reason || reason.trim().length < 20)) {
    throw new Error('Override requires a reason of at least 20 characters');
  }
}

async function writeAwardAudit(
  rfqId: string,
  userId: string,
  options: AwardOptions,
  ctx: AwardContext
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.RFQS).doc(rfqId);
    await ref.update(sanitizeForFirestore({
      auditTrail: admin.firestore.FieldValue.arrayUnion({
        timestamp: admin.firestore.Timestamp.now(),
        userId,
        action: 'award_decision',
        detail: JSON.stringify({
          winnerQuoteId: options.winnerQuoteId,
          recommendedQuoteId: ctx.recommended,
          override: ctx.isOverride,
          riskOverride: ctx.isRiskOverride,
          overrideReason: options.overrideReason ?? null,
          templateId: ctx.templateId,
        }),
      }),
    }));
  }, undefined);
}

export async function awardRfq(
  ctx: AuthContext,
  rfqId: string,
  options: AwardOptions
): Promise<AwardResult> {
  const rfq = await getRfq(ctx.companyId, rfqId);
  if (!rfq) throw new Error(`RFQ ${rfqId} not found`);
  if (rfq.status === 'archived') throw new Error('Cannot award archived RFQ');
  if (rfq.winnerQuoteId) throw new Error(`RFQ already awarded to ${rfq.winnerQuoteId}`);

  const all = await listQuotes(ctx.companyId, { rfqId });
  const winner = all.find((q) => q.id === options.winnerQuoteId);
  if (!winner) throw new Error(`Winner quote ${options.winnerQuoteId} not in RFQ ${rfqId}`);

  const comparison = await computeRfqComparison(ctx.companyId, rfqId);
  const recommended = comparison.recommendation?.quoteId ?? null;
  const winnerEntry = comparison.quotes.find((e) => e.quoteId === options.winnerQuoteId);
  const awardCtx: AwardContext = {
    isOverride: recommended !== null && recommended !== options.winnerQuoteId,
    isRiskOverride: winnerEntry?.hasRiskFlags ?? false,
    recommended,
    templateId: comparison.templateId,
  };

  validateOverride(awardCtx, options.overrideReason);

  const overrideReason = (awardCtx.isOverride || awardCtx.isRiskOverride) ? options.overrideReason : undefined;
  await transitionWinner(ctx, winner, overrideReason);

  const losers = all.filter((q) => q.id !== options.winnerQuoteId && COMPARABLE_STATUSES.has(q.status));
  for (const l of losers) await transitionLoser(ctx, l);

  // RFQ FSM only allows draft → active → closed. Manual quote-entry flows
  // never move the RFQ to `active` (no vendor invites sent), so award would
  // fail FSM with `Invalid transition: draft → closed`. Promote first.
  if (rfq.status === 'draft') {
    await updateRfq(ctx, rfqId, { status: 'active' });
  }
  await updateRfq(ctx, rfqId, { winnerQuoteId: options.winnerQuoteId, status: 'closed' });
  await writeAwardAudit(rfqId, ctx.uid, options, awardCtx);

  const { poId, poNumber } = await generatePoFromAwardedQuote(ctx, winner);

  logger.info('RFQ awarded', {
    rfqId,
    winnerQuoteId: options.winnerQuoteId,
    override: awardCtx.isOverride,
    riskOverride: awardCtx.isRiskOverride,
    losers: losers.length,
    poId,
    poNumber,
  });

  return {
    rfqId,
    winnerQuoteId: options.winnerQuoteId,
    rejectedQuoteIds: losers.map((l) => l.id),
    override: awardCtx.isOverride || awardCtx.isRiskOverride,
    poId,
    poNumber,
  };
}
