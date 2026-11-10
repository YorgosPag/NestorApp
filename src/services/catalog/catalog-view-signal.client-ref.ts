/**
 * @fileoverview **Το σήμα μιας όψης καταλόγου για τον πελάτη** (Web SDK) — χτισμένο σε **ένα** σημείο, **μόνο ανάγνωση**.
 * @related ADR-923 §5.11 «3δ» Ζ · §5.5.2 · ADR-905 §2 · server/catalog/catalog-view-signal.server.ts (ο ΕΝΑΣ γραφέας, μέσα στη μηχανή)
 * @module services/catalog/catalog-view-signal.client-ref
 *
 * 🔑 Ο **ίδιος** σπόρος (`catalogViewKey`) και ο **ίδιος** γεννήτορας id με τον γραφέα: το έγγραφο υπολογίζεται, δεν
 *    αναζητείται — κανένα ερώτημα, κανένας δείκτης, κανένα `list` (που ο κανόνας αρνείται ούτως ή άλλως).
 * ⛔ **ΚΑΜΙΑ ΓΡΑΦΗ, ΠΟΤΕ**: ο κανόνας κλείνει κάθε γραφή πελάτη και η πύλη 3.106 κρατά τη συλλογή στον έναν γραφέα.
 */

import { doc, type DocumentReference } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { generateDeterministicCatalogPricingViewSignalId } from '@/services/enterprise-id.service';
import type { ServerViewSignalSource } from '@/services/realtime/hooks/use-server-view-signal';
import { catalogViewKey, type CatalogView } from '@/subapps/catalog/views/catalog-view-key';

/** Η πηγή του σήματος μιας όψης στον χώρο `companyId` — το id είναι και το κλειδί της συνδρομής. */
export function catalogViewSignalSource(companyId: string, view: CatalogView): ServerViewSignalSource {
  const id = generateDeterministicCatalogPricingViewSignalId(companyId, catalogViewKey(view));
  return {
    key: id,
    ref: (): DocumentReference => doc(db, COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS, id),
  };
}
