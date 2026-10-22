/**
 * **`/demands/new` — δημιουργία ζήτησης** (ADR-777 Α9 · **Α8** · **§8.98**).
 *
 * 🔴 **Η ΜΟΝΗ διαδρομή του χαρακτηριστικού που είναι αποκλειστικά desktop.** Και το
 * «αποκλειστικά» είναι γεγονός **bytes**: ξεχωριστή διαδρομή ⇒ αυτόματο route-level
 * code splitting· δυναμική εισαγωγή μέσα στην πύλη ⇒ η φόρμα δεν κατεβαίνει ούτε κι
 * όταν στενή οθόνη **ανοίξει** τη διεύθυνση. Δες {@link DemandCreationGate}.
 *
 * 🔑 **§8.98 — `?when=<πότε>`**: χωρίς αυτό η σελίδα δείχνει **πρώτα** την ερώτηση «Πότε το θέλεις;»
 * (`DemandTimingChooser`). Με αυτό, η φόρμα ανοίγει με το «πότε» ήδη απαντημένο.
 *
 * 🔑 **ADR-888 — `?from=<αναζήτηση>`**: η φόρμα ανοίγει προσυμπληρωμένη από τα φίλτρα του χάρτη
 * αποτελεσμάτων, μέσω της **μίας** αντίστροφης προβολής (`demandFormFromListingFilters`).
 *
 * ⚠️ **Το `searchParams` είναι `Promise` (Next 15)**.
 *
 * @module app/(me)/demands/new/page
 */

import { DemandCreationGate } from '@/components/demand/DemandCreationGate';
import { demandFormFromListingFilters } from '@/lib/demand/demand-form-from-filters';
import { EMPTY_DEMAND_FORM } from '@/lib/demand/demand-form-values';
import { NEW_DEMAND_FROM_SEARCH_PARAM, NEW_DEMAND_TIMING_PARAM } from '@/lib/demand/demand-routes';
import { parseListingFilters } from '@/lib/listings/listing-filters';
import { isDemandTimingKind } from '@/types/property-demand';

interface NewDemandPageProps {
  readonly searchParams: Promise<{
    readonly [NEW_DEMAND_FROM_SEARCH_PARAM]?: string;
    readonly [NEW_DEMAND_TIMING_PARAM]?: string;
  }>;
}

export default async function NewDemandPage({ searchParams }: NewDemandPageProps) {
  const { [NEW_DEMAND_FROM_SEARCH_PARAM]: fromSearch, [NEW_DEMAND_TIMING_PARAM]: when } = await searchParams;
  const hasSearch = typeof fromSearch === 'string' && fromSearch.length > 0;

  if (!isDemandTimingKind(when)) {
    const query = hasSearch ? new URLSearchParams({ [NEW_DEMAND_FROM_SEARCH_PARAM]: fromSearch }).toString() : '';
    return <DemandCreationGate timingChooserQuery={query} />;
  }

  const base = hasSearch
    ? demandFormFromListingFilters(parseListingFilters(new URLSearchParams(fromSearch))).values
    : EMPTY_DEMAND_FORM;
  return <DemandCreationGate initialValues={{ ...base, timingKind: when }} />;
}
