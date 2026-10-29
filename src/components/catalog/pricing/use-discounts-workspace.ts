'use client';

/**
 * @fileoverview **Η κατάσταση της σελίδας «Εκπτώσεις»** — μία όψη του διακομιστή, τέσσερις αισιόδοξες ουρές (ADR-923 §5.11 «3δ»
 *   Τμήμα 2).
 * @related hooks/catalog/usePriceListViews.ts (`useDiscountsView`) · hooks/catalog/useCatalogOptimistic.ts
 * @module components/catalog/pricing/use-discounts-workspace
 *
 * 🔑 **Οι τιμές ΜΟΝΟ από τον διακομιστή** (απόφαση Ζ): ομάδες · αναθέσεις · συνθήκες έρχονται από την όψη `discounts`,
 *    ζωντανή με το σήμα της — καμία ανάγνωση Firestore για εκπτώσεις.
 * 🔑 **Ένα κράτημα για τέσσερις ουρές**: όσο εκκρεμεί **οποιαδήποτε** αισιόδοξη εγγραφή, η ανανέωση της όψης περιμένει —
 *    η όψη είναι ΜΙΑ, άρα μια ανανέωση στη μέση θα έσβηνε την αισιόδοξη εικόνα και των άλλων τριών.
 */

import { useCatalogOptimistic, type CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { useDiscountsView } from '@/hooks/catalog/usePriceListViews';
import { usePendingHold, useReleaseWhenSettled, type PricingViewApi } from '@/hooks/catalog/usePricingView';
import type {
  CustomerAssignmentWire,
  CustomerGroupWire,
  DiscountConditionWire,
  DiscountGroupWire,
  DiscountsView,
} from '@/subapps/catalog/types/pricing-views';
import { useCatalogFailureNotice } from '../shared/catalog-ui-hooks';

const NO_DISCOUNT_GROUPS: readonly DiscountGroupWire[] = [];
const NO_CUSTOMER_GROUPS: readonly CustomerGroupWire[] = [];
const NO_ASSIGNMENTS: readonly CustomerAssignmentWire[] = [];
const NO_CONDITIONS: readonly DiscountConditionWire[] = [];
const NO_NAMES: Readonly<Record<string, string>> = {};

export interface DiscountsWorkspace {
  readonly api: PricingViewApi<DiscountsView>;
  /** `null` όσο φορτώνει ή αν απέτυχε. */
  readonly view: DiscountsView | null;
  readonly forbidden: boolean;
  /** Η στιγμή της ανάγνωσης (`asOf`) — ντετερμινιστικό «τώρα» για την ισχύ (η όψη λήγει στο επόμενο όριο). */
  readonly nowMs: number;
  readonly partyNames: Readonly<Record<string, string>>;
  readonly discountGroups: CatalogOptimistic<DiscountGroupWire>;
  readonly customerGroups: CatalogOptimistic<CustomerGroupWire>;
  readonly assignments: CatalogOptimistic<CustomerAssignmentWire>;
  readonly conditions: CatalogOptimistic<DiscountConditionWire>;
}

export function useDiscountsWorkspace(): DiscountsWorkspace {
  const hold = usePendingHold();
  const api = useDiscountsView(hold.isHeld);
  const view = api.current.state === 'ready' ? api.current.view : null;
  const notice = useCatalogFailureNotice();
  const discountGroups = useCatalogOptimistic(view?.discountGroups ?? NO_DISCOUNT_GROUPS, notice);
  const customerGroups = useCatalogOptimistic(view?.customerGroups ?? NO_CUSTOMER_GROUPS, notice);
  const assignments = useCatalogOptimistic(view?.assignments ?? NO_ASSIGNMENTS, notice);
  const conditions = useCatalogOptimistic(view?.conditions ?? NO_CONDITIONS, notice);
  const pending = discountGroups.pendingKeys.size + customerGroups.pendingKeys.size + assignments.pendingKeys.size + conditions.pendingKeys.size;
  useReleaseWhenSettled(hold, pending, api.release);
  return {
    api,
    view,
    forbidden: api.current.state === 'failed' && api.current.failure.kind === 'forbidden',
    nowMs: view ? Date.parse(view.asOf) : 0,
    partyNames: view?.partyNames ?? NO_NAMES,
    discountGroups,
    customerGroups,
    assignments,
    conditions,
  };
}
