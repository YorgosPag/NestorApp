/**
 * Vendor Portal Submit Service — encapsulates the Admin-SDK Quote write path
 * used by the public POST `/api/vendor/quote/[token]` route.
 *
 * Lives outside `quote-service.ts` because vendor portal has no `AuthContext` —
 * vendor identity is bound to the HMAC token, not Firebase auth. We therefore
 * write the Quote document directly with Admin SDK and a synthetic
 * `vendor:{contactId}` actor in the audit trail.
 *
 * @module subapps/procurement/services/vendor-portal-submit-service
 * @enterprise ADR-327 §7 + §11 — Phase 3 Vendor Portal
 */

import 'server-only';

import admin from 'firebase-admin';
import type { Timestamp as ClientTimestamp } from 'firebase/firestore';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { getNextQuoteNumber } from './quote-counters';
import { createModuleLogger } from '@/lib/telemetry';
import {
  adminTimestampAsClient,
  adminTimestampFromDateAsClient,
} from '@/services/vendor-portal/vendor-portal-token-service';
import type {
  Quote,
  QuoteAttachment,
  QuoteAuditEntry,
  QuoteLine,
} from '../types/quote';
import { computeQuoteTotals } from '../types/quote';

const logger = createModuleLogger('VENDOR_PORTAL_SUBMIT_SERVICE');

const EDIT_WINDOW_HOURS = 72;

export interface SubmissionPayload {
  lines: QuoteLine[];
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warranty: string | null;
  notes: string | null;
  validUntil: ClientTimestamp | null;
}

export interface ExistingPortalQuote {
  id: string;
  data: Quote;
}

export async function findExistingPortalQuote(
  companyId: string,
  rfqId: string,
  vendorContactId: string,
): Promise<ExistingPortalQuote | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.QUOTES)
      .where('companyId', '==', companyId)
      .where('rfqId', '==', rfqId)
      .where('vendorContactId', '==', vendorContactId)
      .where('source', '==', 'portal')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: { id: doc.id, ...doc.data() } as Quote };
  }, null);
}

function vendorAudit(
  vendorContactId: string,
  action: string,
  detail: string | null,
  ipHash: string,
): QuoteAuditEntry {
  return {
    timestamp: adminTimestampAsClient(),
    userId: `vendor:${vendorContactId}`,
    action,
    previousValue: null,
    newValue: detail,
    source: 'portal',
    ip: ipHash,
  };
}

export interface PersistArgs {
  isFirstSubmission: boolean;
  quoteId: string;
  companyId: string;
  rfqId: string;
  rfqProjectId: string;
  rfqBuildingId: string | null;
  rfqTrade: Quote['trade'];
  vendorContactId: string;
  inviteId: string;
  ipHash: string;
  userAgent: string;
  payload: SubmissionPayload;
  newAttachments: QuoteAttachment[];
  existing: ExistingPortalQuote | null;
}

export async function persistVendorQuote(args: PersistArgs): Promise<{ quoteId: string }> {
  const {
    isFirstSubmission,
    quoteId,
    companyId,
    rfqId,
    rfqProjectId,
    rfqBuildingId,
    rfqTrade,
    vendorContactId,
    inviteId,
    ipHash,
    userAgent,
    payload,
    newAttachments,
    existing,
  } = args;

  const now = adminTimestampAsClient();
  const totals = computeQuoteTotals(payload.lines);
  const audit = vendorAudit(
    vendorContactId,
    isFirstSubmission ? 'portal_submitted' : 'portal_edited',
    `lines=${payload.lines.length}; total=${totals.total.toFixed(2)}; ua=${userAgent.slice(0, 80)}`,
    ipHash,
  );

  if (!existing) {
    const displayNumber = await getNextQuoteNumber(companyId);
    const editWindowExpiresAt = adminTimestampFromDateAsClient(
      new Date(Date.now() + EDIT_WINDOW_HOURS * 60 * 60 * 1000),
    );
    const quote: Quote = {
      id: quoteId,
      displayNumber,
      rfqId,
      projectId: rfqProjectId,
      buildingId: rfqBuildingId,
      companyId,
      vendorContactId,
      trade: rfqTrade,
      source: 'portal',
      status: 'submitted',
      lines: payload.lines,
      totals,
      validUntil: payload.validUntil,
      paymentTerms: payload.paymentTerms,
      deliveryTerms: payload.deliveryTerms,
      warranty: payload.warranty,
      notes: payload.notes,
      attachments: newAttachments,
      extractedData: null,
      overallConfidence: null,
      acceptanceMode: 'manual',
      overrideReason: null,
      overrideAt: null,
      overriddenBy: null,
      vendorEditHistory: [],
      editWindowExpiresAt,
      auditTrail: [
        {
          timestamp: now,
          userId: `vendor:${vendorContactId}`,
          action: 'created',
          previousValue: null,
          newValue: 'submitted',
          source: 'portal',
          ip: ipHash,
        },
        audit,
      ],
      submittedAt: now,
      submitterIp: ipHash,
      createdAt: now,
      updatedAt: now,
      createdBy: `vendor:${vendorContactId}`,
    };
    await safeFirestoreOperation<void>(async (db) => {
      await db
        .collection(COLLECTIONS.QUOTES)
        .doc(quoteId)
        .set(sanitizeForFirestore(quote as unknown as Record<string, unknown>));
    }, undefined);
    logger.info('Vendor portal quote created', { inviteId, quoteId, total: totals.total });
    return { quoteId };
  }

  const versionedAudit = [...(existing.data.auditTrail ?? []), audit];
  const newVersion = (existing.data.vendorEditHistory?.length ?? 0) + 1;
  await safeFirestoreOperation<void>(async (db) => {
    await db
      .collection(COLLECTIONS.QUOTES)
      .doc(existing.id)
      .update(
        sanitizeForFirestore({
          lines: payload.lines,
          totals,
          paymentTerms: payload.paymentTerms,
          deliveryTerms: payload.deliveryTerms,
          warranty: payload.warranty,
          notes: payload.notes,
          validUntil: payload.validUntil,
          attachments: [...(existing.data.attachments ?? []), ...newAttachments],
          status: 'submitted',
          submitterIp: ipHash,
          auditTrail: versionedAudit,
          vendorEditHistory: admin.firestore.FieldValue.arrayUnion({
            version: newVersion,
            editedAt: now,
            changes: `lines=${payload.lines.length};total=${totals.total.toFixed(2)}`,
          }),
          updatedAt: now,
        }),
      );
  }, undefined);
  logger.info('Vendor portal quote edited', {
    inviteId,
    quoteId: existing.id,
    version: newVersion,
  });
  return { quoteId: existing.id };
}
