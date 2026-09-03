/**
 * =============================================================================
 * ADDRESS EDITOR — Suggestion Ranking Helper (ADR-332 Phase 2)
 * =============================================================================
 *
 * Combines the top geocoding hit with its alternatives into a single ranked
 * `SuggestionRanking[]` consumed by `<AddressSuggestionsPanel>` (Phase 4).
 *
 * Ranking score blends two signals:
 *   - **confidence** (0..1) from the engine's per-field match scoring
 *   - **proximity** (0..1) inverse of distance to the current map center,
 *     capped at `proximityCapM` (default 5 km)
 *
 * Without a `proximityAnchor` the score collapses to plain confidence and the order
 * is preserved (top first, then alternatives in their original Nominatim rank).

 * ⚠️ Αυτή ήταν η **μόνη** συμπεριφορά που έτρεχε ποτέ στην παραγωγή ως τις 03/09: ο
 * μοναδικός καλών δεν έδινε αφετηρία, οπότε το `distanceFromCenterM` ήταν **πάντα
 * `null`** και η γραμμή απόστασης στο πάνελ δεν εμφανίστηκε ποτέ. Δες ADR-332 D23.
 *
 * @module components/shared/addresses/editor/helpers/rankSuggestions
 * @see ADR-332 §3.4 Suggestion trigger algorithm
 */

import { distanceMeters } from '@/lib/geo/geo-distance';
import type {
  GeocodingAlternative,
  GeocodingApiResponse,
  SuggestionRanking,
} from '../types';

/**
 * Το σημείο **από το οποίο μετριέται** η εγγύτητα.
 *
 * 🔴 **ΛΕΓΟΤΑΝ `MapCenter` ΚΑΙ ΤΟ ΟΝΟΜΑ ΗΤΑΝ ΛΑΘΟΣ** (ADR-332 D23): δεν είναι το κέντρο
 * του χάρτη — είναι **πού δουλεύει ο άνθρωπος**. Η διαφορά μετρήθηκε: αν κάποιος
 * συνέδεε εδώ το κέντρο προβολής, τότε ένας χρήστης που έσυρε τον χάρτη στην Αθήνα ενώ
 * καταχωρεί διεύθυνση Θεσσαλονίκης θα έβλεπε **την Αθήνα πρώτη** — δηλαδή η βοήθεια θα
 * ανέβαζε τη λάθος γραμμή εκεί ακριβώς που πατάει ο κόσμος. Το παλιό όνομα δεν ήταν
 * ανακρίβεια· ήταν **οδηγία προς λάθος καλωδίωση**.
 */
export interface ProximityAnchor {
  lat: number;
  lng: number;
}

export interface RankSuggestionsOptions {
  /** Πού δουλεύει ο άνθρωπος — οδηγεί τη συνιστώσα εγγύτητας του σκορ. */
  proximityAnchor?: ProximityAnchor;
  /** Distance (m) at and above which the proximity bonus is 0. Default 5000. */
  proximityCapM?: number;
  /** Weight assigned to confidence (0..1). Proximity weight is `1 - confidenceWeight`. Default 0.7. */
  confidenceWeight?: number;
}

const DEFAULTS = {
  proximityCapM: 5000,
  confidenceWeight: 0.7,
} as const;

// ⚠️ Η **απόσταση** δεν ζει πια εδώ: `@/lib/geo/geo-distance` (SSoT). Ήταν μία από
// τέσσερις υλοποιήσεις, και η **μόνη** με ακτίνα 6 371 000 μαζί με το
// `overpass-housenumber`. Η αλλαγή σε 6 371 008,8 είναι **1,4·10⁻⁶** σχετικά και
// **ομοιόμορφος** συντελεστής κλίμακας ⇒ η **κατάταξη** εδώ μένει κατά λέξη ίδια
// (το `proximityCapM` είναι το μόνο απόλυτο κατώφλι, και 5 km ± 7 mm).

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Coerces a flat `GeocodingAlternative` (no nested alternatives) into the full
 * `GeocodingApiResponse` shape so it can be rendered uniformly with the top hit.
 */
function alternativeToFullResponse(alt: GeocodingAlternative): GeocodingApiResponse {
  return { ...alt, alternatives: [] };
}

interface ScoreOptions {
  proximityAnchor?: ProximityAnchor;
  proximityCapM: number;
  confidenceWeight: number;
}

function scoreCandidate(
  candidate: GeocodingApiResponse,
  opts: ScoreOptions,
): { rankScore: number; distanceFromCenterM: number | null } {
  if (!opts.proximityAnchor) {
    return { rankScore: candidate.confidence, distanceFromCenterM: null };
  }
  const distance = distanceMeters(opts.proximityAnchor, {
    lat: candidate.lat,
    lng: candidate.lng,
  });
  const proximity = 1 - clamp(distance / opts.proximityCapM, 0, 1);
  const rankScore =
    opts.confidenceWeight * candidate.confidence +
    (1 - opts.confidenceWeight) * proximity;
  return { rankScore, distanceFromCenterM: distance };
}

/**
 * Returns top + alternatives ranked by combined score (descending). Each entry
 * carries its `originalRank` so the UI can show a "(best match)" hint on the
 * Nominatim winner even when proximity reorders the list.
 */
export function rankSuggestions(
  result: GeocodingApiResponse,
  options: RankSuggestionsOptions = {},
): SuggestionRanking[] {
  const proximityCapM = options.proximityCapM ?? DEFAULTS.proximityCapM;
  const confidenceWeight = clamp(
    options.confidenceWeight ?? DEFAULTS.confidenceWeight,
    0,
    1,
  );
  const scoreOpts: ScoreOptions = {
    proximityAnchor: options.proximityAnchor,
    proximityCapM,
    confidenceWeight,
  };

  const candidates: GeocodingApiResponse[] = [
    result,
    ...result.alternatives.map(alternativeToFullResponse),
  ];

  const ranked: SuggestionRanking[] = candidates.map((candidate, originalRank) => {
    const { rankScore, distanceFromCenterM } = scoreCandidate(candidate, scoreOpts);
    return { candidate, originalRank, distanceFromCenterM, rankScore };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  return ranked;
}
