'use client';

/**
 * useDrillDownToPurchaseOrders — **ο ένας** χειριστής κλικ που οδηγεί από ένα
 * γράφημα analytics στη λίστα εντολών αγοράς, φιλτραρισμένη σε ό,τι πατήθηκε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο 2026-08-01 · ADR-742 §7quaterdecies · N.18)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `readClickedRowKey` και το `buildPurchaseOrdersUrl` ήταν ήδη SSoT — και
 * παρ' όλα αυτά **η ίδια οκτάγραμμη τελετουργία** ήταν γραμμένη τρεις φορές:
 *
 * ```
 * onClick={(payload) => {
 *   const x = readClickedRowKey(payload, '<πεδίο>');   // 1. διάβασε την ταυτότητα
 *   if (!x) return;                                     // 2. σιώπησε αν λείπει
 *   router.push(buildPurchaseOrdersUrl(filters, {...}), // 3. χτίσε τη διαδρομή
 *               { scroll: false });                     // 4. μην πηδήξεις πάνω
 * }}
 * ```
 *
 * 🔑 **Το SSoT των συστατικών δεν είναι SSoT της συνταγής.** Δύο εξαγόμενες
 * συναρτήσεις σε κοινό αρχείο δεν εμποδίζουν κανέναν να τις συνδέσει λάθος: το
 * `{ scroll: false }` — που κρατά τον χρήστη στο ύψος του γραφήματος αντί να
 * τον πετάξει στην κορυφή της λίστας — είναι **ανά-καλούντα απόφαση** σε τρία
 * σημεία, άρα τρεις ευκαιρίες να ξεχαστεί σιωπηλά. Εδώ είναι μία.
 *
 * ⚠️ **Γιατί το `filterKey` περνά από `switch` και όχι από υπολογισμένο κλειδί.**
 * Το `{ [filterKey]: [value] }` τυποποιείται από τον TypeScript ως
 * `{ [x: string]: string[] }` — δηλαδή **χάνει** τη σύνδεση με το
 * `PurchaseOrdersUrlOverride` και θα περνούσε άγνωστο κλειδί χωρίς παράπονο.
 * Ο εξαντλητικός `switch` κρατά τον έλεγχο: νέο κλειδί φίλτρου ⇒ ο μεταγλωττιστής
 * χτυπά **εδώ**, όχι στο URL την ώρα που ο χρήστης πατά τη μπάρα.
 *
 * @module app/procurement/analytics/_components/useDrillDownToPurchaseOrders
 * @see ADR-331 §2.7 (drill-down) · ADR-710 (chart-card shell) · ADR-742 §7quaterdecies
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildPurchaseOrdersUrl,
  readClickedRowKey,
  type PurchaseOrdersFilterKey,
  type PurchaseOrdersUrlOverride,
} from './chart-utils';
import type { SpendAnalyticsFilters } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

export interface ChartDrillDown {
  /** Η τρέχουσα κατάσταση φίλτρων της οθόνης — προωθείται αυτούσια. */
  readonly filters: SpendAnalyticsFilters;
  /** Το πεδίο **της γραμμής** που κουβαλά την ταυτότητα του προορισμού. */
  readonly rowKey: string;
  /** Το φίλτρο **της λίστας** που θα δεχτεί αυτή την ταυτότητα. */
  readonly filterKey: PurchaseOrdersFilterKey;
}

/**
 * Εξαντλητική αντιστοίχιση κλειδιού → override. Ο δηλωμένος τύπος επιστροφής
 * μαζί με τον `switch` χωρίς `default` κάνουν κάθε νέο κλειδί σφάλμα μεταγλώττισης.
 */
function toOverride(filterKey: PurchaseOrdersFilterKey, value: string): PurchaseOrdersUrlOverride {
  switch (filterKey) {
    case 'projectId':
      return { projectId: [value] };
    case 'supplierId':
      return { supplierId: [value] };
    case 'categoryCode':
      return { categoryCode: [value] };
  }
}

/**
 * @returns χειριστής `onClick` για στοιχείο recharts. Σιωπά — δεν πλοηγεί —
 * όταν το φορτίο του κλικ δεν φέρει έγκυρη ταυτότητα (κλικ στο κενό, στον
 * άξονα, ή σε σειρά χωρίς προορισμό).
 */
export function useDrillDownToPurchaseOrders({
  filters,
  rowKey,
  filterKey,
}: ChartDrillDown): (payload: unknown) => void {
  const router = useRouter();

  return useCallback(
    (payload: unknown) => {
      const value = readClickedRowKey(payload, rowKey);
      if (!value) return;
      router.push(buildPurchaseOrdersUrl(filters, toOverride(filterKey, value)), {
        scroll: false,
      });
    },
    [router, filters, rowKey, filterKey],
  );
}
