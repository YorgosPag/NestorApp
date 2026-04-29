/**
 * Vendor name resolution helpers (extracted from `comparison-service.ts`).
 *
 * Two failure modes the comparison UI used to surface as raw contact ids:
 *
 *   1. The CONTACTS doc exists but `displayName` and `companyName` are both
 *      blank — fallback chain ended at `doc.id`, so the UI rendered
 *      `cont_dfa2bc20-…` where a vendor name was expected.
 *   2. The contact lookup returned nothing (different `companyId`, deleted
 *      doc, race during creation) — `Map.get()` was undefined and the UI
 *      defaulted to the raw id.
 *
 * `resolveVendorName()` adds a second-source fallback to the AI-extracted
 * `quote.extractedData.vendorName.value` and emits a structured warn when
 * either path triggers, so future regressions surface in the audit log
 * instead of silently dressing the page with internal ids.
 *
 * @module subapps/procurement/services/vendor-name-resolver
 * @see ADR-327 §changelog 2026-04-27 (RFQ comparison UI fixes)
 */

import 'server-only';

import type admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { Quote } from '../types/quote';

const logger = createModuleLogger('VENDOR_NAME_RESOLVER');

export async function fetchVendorNames(
  companyId: string,
  vendorIds: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(vendorIds.filter(Boolean)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  return safeFirestoreOperation(async (db) => {
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      const snap = await db
        .collection(COLLECTIONS.CONTACTS)
        .where('companyId', '==', companyId)
        .where('__name__', 'in', chunk)
        .get();
      for (const doc of snap.docs) {
        const name = pickContactDisplayName(doc.data());
        if (name) out.set(doc.id, name);
      }
    }
    return out;
  }, out);
}

export function pickContactDisplayName(data: admin.firestore.DocumentData): string | null {
  const candidates = [
    data.displayName,
    data.companyName,
    data.fullName,
    data.legalName,
    data.name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  // Natural persons: firstName + lastName stored separately
  const first = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  const last = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  const composite = [first, last].filter(Boolean).join(' ');
  if (composite.length > 0) return composite;
  return null;
}

export function resolveVendorName(quote: Quote, lookup: Map<string, string>): string {
  const fromContact = lookup.get(quote.vendorContactId);
  if (fromContact) return fromContact;
  const fromExtraction = quote.extractedData?.vendorName?.value;
  if (typeof fromExtraction === 'string' && fromExtraction.trim().length > 0) {
    logger.warn('Vendor name fell back to extracted data', {
      quoteId: quote.id,
      vendorContactId: quote.vendorContactId,
    });
    return fromExtraction.trim();
  }
  logger.warn('Vendor name unresolved — using raw contact id', {
    quoteId: quote.id,
    vendorContactId: quote.vendorContactId,
  });
  return quote.vendorContactId;
}
