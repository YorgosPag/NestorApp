/**
 * @fileoverview **Το σήμα μιας όψης τιμών για τον πελάτη** (Web SDK) — χτισμένο σε **ένα** σημείο, **μόνο ανάγνωση**.
 * @related ADR-923 §5.11 «3δ» Ζ · ADR-905 §2 · server/catalog/pricing-view-signal.server.ts (ο ΕΝΑΣ γραφέας, μέσα στη μηχανή)
 * @module services/catalog/pricing-view-signal.client-ref
 *
 * 🔑 Ο **ίδιος** σπόρος (`pricingViewKey`) και ο **ίδιος** γεννήτορας id με τον γραφέα: το έγγραφο υπολογίζεται, δεν
 *    αναζητείται — κανένα ερώτημα, κανένας δείκτης, κανένα `list` (που ο κανόνας αρνείται ούτως ή άλλως).
 * ⛔ **ΚΑΜΙΑ ΓΡΑΦΗ, ΠΟΤΕ**: ο κανόνας κλείνει κάθε γραφή πελάτη και η πύλη 3.106 κρατά τη συλλογή στον έναν γραφέα.
 */

import { doc, type DocumentReference } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { generateDeterministicCatalogPricingViewSignalId } from '@/services/enterprise-id.service';
import type { ServerViewSignalSource } from '@/services/realtime/hooks/use-server-view-signal';
import { pricingViewKey, type PricingView } from '@/subapps/catalog/pricing/pricing-view-key';

/** Η πηγή του σήματος μιας όψης στον χώρο `companyId` — το id είναι και το κλειδί της συνδρομής. */
export function pricingViewSignalSource(companyId: string, view: PricingView): ServerViewSignalSource {
  const id = generateDeterministicCatalogPricingViewSignalId(companyId, pricingViewKey(view));
  return {
    key: id,
    ref: (): DocumentReference => doc(db, COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS, id),
  };
}
