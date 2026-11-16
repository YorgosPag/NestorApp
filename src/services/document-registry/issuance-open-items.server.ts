import 'server-only';

/**
 * @fileoverview ADR-915 §45 Φ4 — **οι εκκρεμότητες αναθέσεων του γραφείου**, πάνω στον **υπάρχοντα** αναγνώστη του μητρώου
 *   (`readDocumentRegistry`): κανένα νέο ερώτημα, καμία δεύτερη κρίση σταδίου ή καθυστέρησης.
 * @related lib/document-validity/issuance-open-item.ts (η προβολή) · app/api/document-registry/open-items/route.ts
 * @module services/document-registry/issuance-open-items.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceOpenItemsOf, type IssuanceOpenItemsResponse } from '@/lib/document-validity/issuance-open-item';

import { readDocumentRegistry } from './document-registry.service';

export async function readIssuanceOpenItems(db: Firestore, companyId: string, now: Date): Promise<IssuanceOpenItemsResponse> {
  const registry = await readDocumentRegistry(db, companyId, now);
  if (!registry.issuanceKnown) return { asOf: registry.asOf, known: false, items: [] };
  const items = issuanceOpenItemsOf({
    rows: registry.rows,
    issuance: registry.issuance,
    asOf: registry.asOf,
    propertyNameOf: (propertyId) => registry.properties[propertyId]?.name ?? null,
    contactNameOf: (contactId) => registry.people[contactId]?.name ?? null,
  });
  return { asOf: registry.asOf, known: true, items };
}
