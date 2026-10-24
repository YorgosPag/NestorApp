/**
 * @fileoverview **ΟΙ ΛΕΞΕΙΣ ΚΑΙ ΟΙ ΑΡΙΘΜΟΙ ΤΟΥ ΧΑΡΤΗ ΕΔΑΦΟΥΣ** — υψόμετρα, εύρη κλίσης, ποσοστά, μήκη (ADR-920 Β4.8).
 * @related lib/terrain/publication/terrain-map-model (αριθμοί, ποτέ κείμενο) · `@/lib/intl-formatting` (το ΕΝΑ σημείο
 *   μορφοποίησης ανά γλώσσα) · namespace `listing-detail:terrain.map`
 * @module components/listing-detail/terrain/terrain-map-words
 *
 * 🔑 Το μοντέλο κρατά **αριθμούς**· εδώ γίνονται κείμενο για τη γλώσσα του αναγνώστη («120,5» / «120.5»). Χάρτης, πίνακας
 *   και περιγραφή για αναγνώστη οθόνης παίρνουν τις **ίδιες** λέξεις από εδώ — ποτέ δύο μορφοποιήσεις του ίδιου αριθμού.
 * 📐 **Ακρίβεια = της ισοδιάστασης**: ισοϋψείς ανά 0,25 m τυπώνονται με 2 δεκαδικά, ανά 1 m με κανένα (πρακτική USGS / Civil 3D:
 *   η ετικέτα δεν υπόσχεται ακρίβεια που η επιφάνεια δεν έχει).
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber, formatPercentage } from '@/lib/intl-formatting';
import type { TerrainMapSlopeRegion } from '@/lib/terrain/publication/terrain-map-regions';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map';

/** Τα namespaces των λέξεων του χάρτη. */
export const TERRAIN_MAP_WORD_NAMESPACES = ['listing-detail'] as const;

/** Μερίδιο εμβαδού κάτω από αυτό (αλλά > 0) γράφεται «κάτω από 0,1 %» — ένα «0 %» θα έλεγε «καθόλου», που είναι ψέμα. */
const SHARE_FLOOR_PCT = 0.1;
/** Περισσότερα δεκαδικά δεν έχουν νόημα σε υψόμετρο αγγελίας. */
const MAX_LEVEL_DIGITS = 3;

/** Τα δεκαδικά που χρειάζεται ένα βήμα (0,25 → 2 · 0,5 → 1 · 2 → 0). */
export function fractionDigitsOf(stepM: number): number {
  for (let digits = 0; digits < MAX_LEVEL_DIGITS; digits++) {
    const scaled = stepM * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return digits;
  }
  return MAX_LEVEL_DIGITS;
}

/** Μέτρα με την ακρίβεια του βήματος, για τη γλώσσα του αναγνώστη (χωρίς μονάδα). */
export function metresOf(valueM: number, stepM: number): string {
  const digits = fractionDigitsOf(stepM);
  return formatNumber(valueM, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** «12 m» — η μονάδα από το locale (σύμβολο SI και στις δύο γλώσσες). */
export function lengthLabel(t: T, valueM: number, stepM: number = valueM): string {
  return t(`${NS}.metres`, { value: metresOf(valueM, stepM) });
}

const pct = (value: number): string => formatPercentage(value, { maximumFractionDigits: 0 });

/** Το εύρος μιας κλάσης κλίσης: «5 % – 15 %» · η τελευταία, ανοιχτή: «25 % και άνω». */
export function slopeRangeLabel(t: T, region: TerrainMapSlopeRegion): string {
  if (region.toPct === null) return t(`${NS}.slope.rangeOpen`, { from: pct(region.fromPct) });
  return t(`${NS}.slope.range`, { from: pct(region.fromPct), to: pct(region.toPct) });
}

/** Το μερίδιο εμβαδού (`0..1`): «37,5 %» · «κάτω από 0,1 %» για ίχνος · «0 %» μόνο όταν είναι πράγματι μηδέν. */
export function areaShareLabel(t: T, areaShare: number): string {
  const share = areaShare * 100;
  if (share > 0 && share < SHARE_FLOOR_PCT) {
    return t(`${NS}.slope.lessThan`, { value: formatPercentage(SHARE_FLOOR_PCT) });
  }
  return formatPercentage(share);
}
