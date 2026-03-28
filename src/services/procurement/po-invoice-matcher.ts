/**
 * PO Invoice Matcher — Auto-match expense documents to Purchase Orders
 *
 * Scoring algorithm inspired by matching-engine.ts (bank reconciliation)
 * but adapted for PO domain: amounts, dates, line items, references.
 *
 * @module services/procurement/po-invoice-matcher
 * @see ADR-267 Phase C, Feature 1
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  PO_MATCH_SCORING,
  PO_MATCHABLE_STATUSES,
  type POMatchCandidate,
  type POMatchResult,
  type PurchaseOrder,
} from '@/types/procurement';
import type { ExtractedDocumentData } from '@/subapps/accounting/types/documents';
import { listPurchaseOrders } from './procurement-repository';

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Match an expense document to candidate POs based on extracted data.
 *
 * Flow:
 * 1. Find supplier by VAT number
 * 2. Query open POs for that supplier
 * 3. Score each PO
 * 4. Return ranked candidates
 */
export async function matchInvoiceToPO(
  companyId: string,
  extractedData: ExtractedDocumentData
): Promise<POMatchResult> {
  const supplierId = await findSupplierByVat(companyId, extractedData.issuerVatNumber);
  if (!supplierId) {
    return { candidates: [], bestMatch: null, autoMatched: false };
  }

  const candidatePOs = await listPurchaseOrders({
    companyId,
    supplierId,
  });

  // Filter to matchable statuses (not draft/cancelled/closed)
  const matchable = candidatePOs.filter(po =>
    PO_MATCHABLE_STATUSES.has(po.status) && !po.isDeleted
  );

  if (matchable.length === 0) {
    return { candidates: [], bestMatch: null, autoMatched: false };
  }

  const scored = matchable
    .map(po => scorePOMatch(po, extractedData))
    .filter(c => c.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, PO_MATCH_SCORING.MAX_CANDIDATES);

  const bestMatch = scored.length > 0 ? scored[0] : null;
  const autoMatched = bestMatch !== null && bestMatch.confidence >= PO_MATCH_SCORING.AUTO_MATCH_THRESHOLD;

  return { candidates: scored, bestMatch, autoMatched };
}

// ============================================================================
// SCORING
// ============================================================================

/** Score a single PO against extracted invoice data */
function scorePOMatch(
  po: PurchaseOrder,
  extracted: ExtractedDocumentData
): POMatchCandidate {
  const reasons: string[] = [];
  let confidence = 0;

  confidence += scoreAmount(po, extracted, reasons);
  confidence += scoreDateProximity(po, extracted, reasons);
  confidence += scoreLineItemCount(po, extracted, reasons);
  confidence += scoreDescriptionMatch(po, extracted, reasons);
  confidence += scoreReference(po, extracted, reasons);

  return {
    poId: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    total: po.total,
    subtotal: po.subtotal,
    status: po.status,
    confidence: Math.min(confidence, 100),
    matchReasons: reasons,
  };
}

/** Score based on amount similarity (net or gross) */
function scoreAmount(
  po: PurchaseOrder,
  extracted: ExtractedDocumentData,
  reasons: string[]
): number {
  const netMatch = scoreAmountPair(extracted.netAmount, po.subtotal);
  const grossMatch = scoreAmountPair(extracted.grossAmount, po.total);
  const best = Math.max(netMatch, grossMatch);

  if (best === PO_MATCH_SCORING.AMOUNT_EXACT_POINTS) {
    reasons.push('Ακριβής αντιστοίχιση ποσού (±5%)');
  } else if (best === PO_MATCH_SCORING.AMOUNT_NEAR_POINTS) {
    reasons.push('Κοντινό ποσό (±10%)');
  }
  return best;
}

/** Compare two amounts with tolerance */
function scoreAmountPair(
  invoiceAmount: number | null,
  poAmount: number
): number {
  if (invoiceAmount === null || poAmount === 0) return 0;

  const ratio = Math.abs(invoiceAmount - poAmount) / poAmount;
  if (ratio <= PO_MATCH_SCORING.AMOUNT_EXACT_TOLERANCE) {
    return PO_MATCH_SCORING.AMOUNT_EXACT_POINTS;
  }
  if (ratio <= PO_MATCH_SCORING.AMOUNT_NEAR_TOLERANCE) {
    return PO_MATCH_SCORING.AMOUNT_NEAR_POINTS;
  }
  return 0;
}

/** Score based on date proximity (invoice date vs order date) */
function scoreDateProximity(
  po: PurchaseOrder,
  extracted: ExtractedDocumentData,
  reasons: string[]
): number {
  if (!extracted.issueDate || !po.dateOrdered) return 0;

  const invoiceDate = new Date(extracted.issueDate).getTime();
  const orderDate = new Date(po.dateOrdered).getTime();
  if (isNaN(invoiceDate) || isNaN(orderDate)) return 0;

  const diffDays = Math.abs(invoiceDate - orderDate) / (1000 * 60 * 60 * 24);

  if (diffDays <= PO_MATCH_SCORING.DATE_NEAR_DAYS) {
    reasons.push(`Ημερομηνία εντός ${PO_MATCH_SCORING.DATE_NEAR_DAYS} ημερών`);
    return PO_MATCH_SCORING.DATE_NEAR_POINTS;
  }
  if (diffDays <= PO_MATCH_SCORING.DATE_FAR_DAYS) {
    reasons.push(`Ημερομηνία εντός ${PO_MATCH_SCORING.DATE_FAR_DAYS} ημερών`);
    return PO_MATCH_SCORING.DATE_FAR_POINTS;
  }
  return 0;
}

/** Score based on matching line item count */
function scoreLineItemCount(
  po: PurchaseOrder,
  extracted: ExtractedDocumentData,
  reasons: string[]
): number {
  if (!extracted.lineItems || extracted.lineItems.length === 0) return 0;
  if (extracted.lineItems.length === po.items.length) {
    reasons.push(`Ίδιος αριθμός ειδών (${po.items.length})`);
    return PO_MATCH_SCORING.LINE_ITEM_COUNT_POINTS;
  }
  return 0;
}

/** Score based on fuzzy description matching between items */
function scoreDescriptionMatch(
  po: PurchaseOrder,
  extracted: ExtractedDocumentData,
  reasons: string[]
): number {
  if (!extracted.lineItems || extracted.lineItems.length === 0) return 0;

  const poDescriptions = po.items.map(i => normalise(i.description));
  const invoiceDescriptions = extracted.lineItems.map(i => normalise(i.description));

  let matches = 0;
  for (const invDesc of invoiceDescriptions) {
    if (poDescriptions.some(poDesc => poDesc.includes(invDesc) || invDesc.includes(poDesc))) {
      matches++;
    }
  }

  if (matches > 0) {
    reasons.push(`${matches} είδη ταιριάζουν στην περιγραφή`);
    return PO_MATCH_SCORING.DESCRIPTION_MATCH_POINTS;
  }
  return 0;
}

/** Score based on PO number reference in invoice document number */
function scoreReference(
  po: PurchaseOrder,
  extracted: ExtractedDocumentData,
  reasons: string[]
): number {
  if (!extracted.documentNumber) return 0;

  const docNum = normalise(extracted.documentNumber);
  const poNum = normalise(po.poNumber);

  if (docNum.includes(poNum) || poNum.includes(docNum)) {
    reasons.push('Αναφορά αριθμού PO στο παραστατικό');
    return PO_MATCH_SCORING.REFERENCE_MATCH_POINTS;
  }
  return 0;
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Normalise text for comparison: lowercase, trim, remove extra spaces */
function normalise(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Find supplier contact by VAT number */
async function findSupplierByVat(
  companyId: string,
  vatNumber: string | null
): Promise<string | null> {
  if (!vatNumber) return null;

  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.CONTACTS)
    .where('companyId', '==', companyId)
    .where('vatNumber', '==', vatNumber)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}
