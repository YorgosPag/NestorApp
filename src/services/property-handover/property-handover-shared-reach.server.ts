import 'server-only';

/**
 * @fileoverview **Ποιες πωλήσεις αφορά ένα ΚΟΙΝΟ αρχείο** — τα ακίνητα του κτιρίου/έργου που έχουν παράδοση (ADR-916 Φ-Γ3).
 * @related lib/property-handover/handover-source-scope.ts (τι είναι «κοινό») · property-handover-file-decision.service.ts
 *          (ο καταναλωτής: μία απόφαση ⇒ όλες οι μονάδες) · property-handover-write.service.ts (ο ΕΝΑΣ γραφέας)
 * @module services/property-handover/property-handover-shared-reach.server
 *
 * 🔑 **Γιατί**: η απόφαση γραφείου ζει **πάνω στο αρχείο** (§5.18) ⇒ για αρχείο κτιρίου ισχύει για **κάθε** αγοραστή του.
 *    Η συμφιλίωση της **μίας** πώλησης θα άφηνε τις άλλες μονάδες να περιμένουν το νυχτερινό δίχτυ — εδώ βρίσκονται όλες.
 * 🔒 Ερωτήματα **μόνο** με ισότητες (+ `in`) και πάντα `companyId` (CHECK 3.35 · 3.91): συγχώνευση δεικτών ενός πεδίου.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS, FIRESTORE_DISJUNCTION_LIMIT } from '@/config/firestore-field-constants';
import { chunkArray } from '@/lib/array-utils';
import { handoverSourceScopeOf } from '@/lib/property-handover/handover-source-scope';

export interface SharedSourceRef {
  readonly companyId: string;
  readonly entityType: string;
  readonly entityId: string;
}

/**
 * **Τα ακίνητα με παράδοση** που αφορά το κοινό αρχείο. Αρχείο της μονάδας ⇒ κενό (ο καλών συμφιλιώνει ήδη το δικό του).
 * Σειρά σταθερή (ταξινομημένη) ⇒ ντετερμινιστική συμφιλίωση.
 */
export async function propertiesReachedBySharedSource(adminDb: AdminFirestore, source: SharedSourceRef): Promise<readonly string[]> {
  const scope = handoverSourceScopeOf(source.entityType);
  if (scope === 'unit' || source.entityId === '') return [];
  // Ρητοί κλάδοι, όχι χάρτης `scope → πεδίο`: δυναμικό πεδίο σε `where()` είναι αόρατο στο CHECK 3.91 — έτσι κρίνονται ΚΑΙ τα δύο σχήματα.
  const tenantProperties = adminDb.collection(COLLECTIONS.PROPERTIES).where(FIELDS.COMPANY_ID, '==', source.companyId);
  const properties = await (scope === 'building'
    ? tenantProperties.where(FIELDS.BUILDING_ID, '==', source.entityId).get()
    : tenantProperties.where(FIELDS.PROJECT_ID, '==', source.entityId).get());
  const propertyIds = properties.docs.map((doc) => doc.id);
  const handovers = await Promise.all(chunkArray(propertyIds, FIRESTORE_DISJUNCTION_LIMIT).map((part) =>
    adminDb.collection(COLLECTIONS.PROPERTY_HANDOVERS)
      .where(FIELDS.COMPANY_ID, '==', source.companyId)
      .where(FIELDS.PROPERTY_ID, 'in', part)
      .get()));
  const reached = new Set(handovers.flatMap((snapshot) => snapshot.docs.flatMap((doc) => {
    const propertyId: unknown = doc.get('propertyId');
    return typeof propertyId === 'string' ? [propertyId] : [];
  })));
  return propertyIds.filter((id) => reached.has(id)).sort();
}
