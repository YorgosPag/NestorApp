/**
 * **`/demands/new` — δημιουργία ζήτησης** (ADR-777 Α9 · **Α8**).
 *
 * 🔴 **Η ΜΟΝΗ διαδρομή του χαρακτηριστικού που είναι αποκλειστικά desktop.** Και το
 * «αποκλειστικά» είναι γεγονός **bytes**: ξεχωριστή διαδρομή ⇒ αυτόματο route-level
 * code splitting· δυναμική εισαγωγή μέσα στην πύλη ⇒ η φόρμα δεν κατεβαίνει ούτε κι
 * όταν στενή οθόνη **ανοίξει** τη διεύθυνση. Δες {@link DemandCreationGate}.
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
import { NEW_DEMAND_FROM_SEARCH_PARAM } from '@/lib/demand/demand-routes';
import { parseListingFilters } from '@/lib/listings/listing-filters';

interface NewDemandPageProps {
  readonly searchParams: Promise<{ readonly [NEW_DEMAND_FROM_SEARCH_PARAM]?: string }>;
}

export default async function NewDemandPage({ searchParams }: NewDemandPageProps) {
  const { [NEW_DEMAND_FROM_SEARCH_PARAM]: fromSearch } = await searchParams;
  if (typeof fromSearch !== 'string' || fromSearch.length === 0) return <DemandCreationGate />;

  const { values } = demandFormFromListingFilters(parseListingFilters(new URLSearchParams(fromSearch)));
  return <DemandCreationGate initialValues={values} />;
}
