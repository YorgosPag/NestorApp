/**
 * @fileoverview **ΕΓΣΑ'87 κάνναβος (E, N) → WGS84** — η ΜΙΑ σύνθεση προβολής + μετάθεσης datum.
 * @related `egsa87-projection.ts` (κάνναβος ↔ ελλειψοειδές) · `ggrs87-datum.ts` (GGRS87 ↔ WGS84) ·
 *   ADR-889 §10 (ζώνες αντικειμενικών αξιών) · ADR-782 (υπόβαθρο σχεδίου)
 * @module lib/geo/greek-grid
 *
 * 🔑 **Δύο σκαλιά, ΠΑΝΤΑ μαζί** όταν ο προορισμός είναι χάρτης: η προβολή μόνη της δίνει γεωγραφικές
 * **GGRS87**, που κάθονται **~325 m** μακριά από τον χάρτη WGS84 (μετρημένο, `ggrs87-datum.ts`). Όποιος
 * καλεί μόνο το `gridToGeographic` για να ζωγραφίσει σε χάρτη, ζωγραφίζει τρία τετράγωνα δίπλα. Γι' αυτό η
 * σύνθεση ζει **εδώ, μία φορά**: τη ζητούν ο γεννήτορας ζωνών (ADR-889 Φ5) **και** το υπόβαθρο του σχεδιαστή
 * (`basemap-projection.worldMmToGeographic`).
 *
 * ⚠️ Φύλλο **χωρίς** runtime εισαγωγές από `@/` — ο γεννήτορας τρέχει με `tsx` χωρίς alias.
 */

import type { GeoPoint } from '@/types/geo/coordinates';
import { gridToGeographic } from './egsa87-projection';
import { ggrs87ToWgs84 } from './ggrs87-datum';

/**
 * Η **περιοχή χρήσης** του EPSG:2100 («Greece – onshore»), στις προβαλλόμενες συντεταγμένες του, σε μέτρα — όπως τη
 * δημοσιεύει το μητρώο EPSG (epsg.io/2100: 94874.71 3859448.36 / 892934.13 4631226.44). Γεγονός του μητρώου, όχι
 * εκτίμηση: δεν εφευρίσκεται δεύτερο «κουτί της Ελλάδας» (ADR-920 §13.3).
 */
export const GREEK_GRID_AREA_OF_USE_M = {
  minEasting: 94_874.71,
  minNorthing: 3_859_448.36,
  maxEasting: 892_934.13,
  maxNorthing: 4_631_226.44,
} as const;

/** Πέφτει το (E, N), σε μέτρα, μέσα στην περιοχή χρήσης του ΕΓΣΑ'87; */
export function isWithinGreekGridAreaOfUse(easting: number, northing: number): boolean {
  const a = GREEK_GRID_AREA_OF_USE_M;
  return easting >= a.minEasting && easting <= a.maxEasting && northing >= a.minNorthing && northing <= a.maxNorthing;
}

/** Σημείο του εθνικού καννάβου ΕΓΣΑ'87 (EPSG:2100), **σε μέτρα**, → WGS84 (μοίρες). */
export function greekGridToGeoPoint(easting: number, northing: number): GeoPoint {
  const local = gridToGeographic(easting, northing);
  const wgs84 = ggrs87ToWgs84(local.lat, local.lon);
  return { lat: wgs84.lat, lng: wgs84.lon };
}
