/**
 * @fileoverview ⛰️ **ΜΙΑ ΓΡΑΜΜΗ ΠΟΥ ΔΗΜΟΣΙΕΥΕΙ ΕΔΑΦΟΣ** — ο τύπος και ο φρουρός του (ADR-920 Β3β).
 * @related ADR-920 §12 · ADR-845 Φ4.2 · services/upload/utils/public-shelf-kinds · ./public-shelf-video-kind
 * @module services/upload/utils/public-shelf-terrain-kind
 *
 * 🔑 Ίδια συνταγή με το `public-shelf-video-kind`: εδώ **μόνο τύποι** και ο φρουρός· η ίδια η γραμμή
 * (`LISTING_TERRAIN_SHELF`) μένει στο `public-shelf-kinds`, γιατί μοιράζεται ρίζα και φρουρό ταυτότητας με τις
 * φωτογραφίες (τιμές εκείνου του αρχείου) — αλλιώς κύκλος αρχικοποίησης (CHECK 3.80).
 */

import type { TerrainShelfEncoding } from './public-shelf-encoding';
import type { PublicShelfKind } from './public-shelf-kinds';

/** Ένα έδαφος δημοσιεύεται ως **ένα** αρχείο: ούτε πλάτη, ούτε πλαισίωμα, ούτε σημείο εστίασης. */
export interface TerrainShelfKind<M> extends PublicShelfKind<M> {
  readonly encoding: TerrainShelfEncoding;
}

/** **Δημοσιεύει αυτή η γραμμή έδαφος;** — καταφατικό κατηγόρημα, ποτέ άρνηση των άλλων (μάθημα Φ4.1). */
export function isTerrainShelfKind<M>(kind: PublicShelfKind<M>): kind is TerrainShelfKind<M> {
  return kind.encoding.kind === 'terrain';
}
