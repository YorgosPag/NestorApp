/**
 * @fileoverview ⛰️ **Ο ΓΡΑΦΕΑΣ ΤΟΥ `PublicListing.terrain`** — ο ΕΝΑΣ (ADR-920 Β3β, A7).
 * @related ADR-920 §12 · ./public-listing-model-projection (αδελφός) · ./publish-public-listing-shelf (ο μόνος καλών)
 * @module services/listings/public-listing-terrain-projection
 *
 * 🔴 **Δέχεται ΜΟΝΟ `ProjectedShelfTerrain`**, δηλαδή έδαφος που **έψησε** το ράφι: URL content-addressed πάνω στο
 * στιγμιότυπο του server και κάρτα παραγμένη από το **ίδιο** στιγμιότυπο. Δεύτερος γραφέας με ωμό URL θα δημοσίευε
 * bytes που κανείς δεν επικύρωσε, σε **μόνιμη** διεύθυνση. Τον ένα γραφέα τον φυλά η πύλη του ενός γραφέα εδάφους·
 * τον έναν καλούντα, το CHECK 3.76.
 *
 * Καθαρό: καμία I/O.
 */

import type { ListingTerrainCard } from '@/lib/terrain/publication/listing-terrain-card';
import type { PublicListing } from '@/types/public-listing';

/** Ο δείκτης προέλευσης — ίδιο ιδίωμα με το `LISTING_MODEL_SOURCE_REF`. */
export const LISTING_TERRAIN_SOURCE_REF = 'property-terrain:measured';

export interface ProjectedShelfTerrain {
  readonly url: string;
  /** ISO — *«πότε το έμαθε η πηγή»*, ποτέ *«πότε το πρόβαλα»*. */
  readonly at: string;
  readonly card: ListingTerrainCard;
}

/** **Δένει το ψημένο έδαφος στην αγγελία** — ή `null` όταν το ράφι δεν δημοσίευσε κανένα (απόσυρση). */
export function withPublishedTerrain(listing: PublicListing, terrain: ProjectedShelfTerrain | null): PublicListing {
  if (terrain === null) return { ...listing, terrain: null };

  return {
    ...listing,
    terrain: {
      provenance: 'measured',
      value: { url: terrain.url, ...terrain.card },
      at: terrain.at,
      sourceRef: LISTING_TERRAIN_SOURCE_REF,
    },
  };
}
