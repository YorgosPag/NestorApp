'use client';

/**
 * @fileoverview 📍 **Μια κάτοψη της αγγελίας — με τα σημεία λήψης της, όταν έχει** (ADR-897 Φ4).
 * @related ListingFloorplans.tsx (η κάρτα) · media/ListingFloorplanPageContent.tsx (η πλήρης σελίδα) ·
 *   media/ListingFloorplanSpotsFigure.tsx (η απόδοση των σημείων)
 * @module components/listing-detail/ListingFloorplanWithSpots
 *
 * 🔑 **Ένας τόπος για «κάτοψη στη σελίδα»** — κάρτα και πλήρης σελίδα ρωτούν το ίδιο: *«έχει σημεία;»* ⇒ σημεία που
 *   οδηγούν στη φωτογραφία (`/listing/[id]/photos?photo=N`)· αλλιώς **ακριβώς** η εικόνα που υπήρχε πριν.
 * ⛔ Πλοήγηση μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useRouter } from '@/lib/workspace/navigation';
import type { ListingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { listingPhotosHref } from '@/lib/listings/listing-routes';
import type { ListingFloorplan } from '@/types/public-listing';

import { ListingFloorplanFigure } from './ListingFloorplanFigure';
import { ListingFloorplanSpotsFigure } from './media/ListingFloorplanSpotsFigure';

export interface ListingFloorplanWithSpotsProps {
  readonly listingId: string;
  readonly floorplan: ListingFloorplan;
  /** Τα σημεία **αυτής** της κάτοψης — `null` ⇒ καμία φωτογραφία δεν τοποθετήθηκε εδώ. */
  readonly spots: ListingFloorplanSpots | null;
  /** Πόσες φωτογραφίες έχει η αγγελία — για το «Φωτογραφία N από M». */
  readonly total: number;
  readonly sizes: string;
}

/** ⚠️ Ο router ζητείται **μόνο** εδώ: κάτοψη χωρίς σημεία δεν έχει πού να πλοηγήσει, άρα δεν τον χρειάζεται καθόλου. */
function NavigatingSpotsFigure({ listingId, spots, total, sizes }: { readonly listingId: string; readonly spots: ListingFloorplanSpots; readonly total: number; readonly sizes: string }) {
  const router = useRouter();
  return (
    <ListingFloorplanSpotsFigure entry={spots} total={total} currentImageIndex={null} sizes={sizes}
      onActivate={(imageIndex) => router.push(listingPhotosHref(listingId, imageIndex))} />
  );
}

export function ListingFloorplanWithSpots({ listingId, floorplan, spots, total, sizes }: ListingFloorplanWithSpotsProps) {
  // 🧭 ADR-897 Φ5.2 — και χωρίς σημεία, η κάτοψη δείχνει τον βορρά της (όταν δηλώθηκε).
  if (spots === null) return <ListingFloorplanFigure floorplan={floorplan} sizes={sizes} />;
  return <NavigatingSpotsFigure listingId={listingId} spots={spots} total={total} sizes={sizes} />;
}
