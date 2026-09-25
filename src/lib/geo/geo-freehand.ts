/**
 * # ΑΠΟ ΤΗ ΓΡΑΜΜΗ ΤΟΥ ΔΑΧΤΥΛΟΥ ΣΕ ΣΧΗΜΑΤΑ (ADR-885)
 *
 * Μια ελεύθερη χειρονομία είναι **εκατοντάδες** σημεία, με τρέμουλο, που συνήθως δεν
 * κλείνουν εκεί που άρχισαν και συχνά **κόβουν τον εαυτό τους** (οκτάρι, κόμπος στο
 * τέλος). Αυτό το module την κάνει **απλά** σχήματα που ο κριτής δέχεται.
 *
 * 🏆 **Το πρότυπο είναι του Idealista** — ο μόνος μεγάλος με δημοσιευμένη μηχανική
 * («Draw a Search», Codemotion): απλοποίηση, κλείσιμο, και **διάσπαση στις αυτοτομές
 * σε χωριστά πολύγωνα** αντί για απόρριψη. Το Zillow ζητά ξανασχεδίαση.
 *
 * 🔑 **Douglas–Peucker, όχι Visvalingam** (που χρησιμοποιεί το Idealista): ο DP
 * **εγγυάται μέγιστη απόκλιση** από τη γραμμή του ανθρώπου — δηλαδή κανένα σημείο του
 * σχήματος δεν απέχει περισσότερο από την ανοχή από εκεί που πέρασε το δάχτυλο. Ο
 * Visvalingam δίνει ωραιότερα σχήματα αλλά **καμία** τέτοια εγγύηση. Επαναχρησιμοποιείται
 * ο ΕΝΑΣ απλοποιητής του έργου (`geo-simplify.ts`).
 *
 * 🔒 **Γενικό**: δεν ξέρει τι είναι αναζήτηση ή σύνδεσμος. Όρια μήκους και κβάντιση
 * ζουν στο `lib/listings/listing-drawn-area.ts`.
 */

import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import { geoOutlineAreaSqm } from './geo-ring';
import { fromLocalMetres, localSegmentCrossing, toLocalMetres, type LocalPoint } from './geo-local-frame';
import { simplifyGeoRing } from './geo-simplify';

export interface FreehandOptions {
  /** Μέγιστη απόκλιση του σχήματος από τη γραμμή του ανθρώπου, σε μέτρα. */
  readonly toleranceM: number;
  /** Βρόχοι μικρότεροι από αυτό είναι κόμπος της χειρονομίας, όχι σχήμα. */
  readonly minAreaSqm: number;
}

/**
 * Φρένο διασπάσεων — μια σπείρα ή ένα «μουτζούρωμα» θα γεννούσε δεκάδες βρόχους. Πάνω
 * από αυτό η χειρονομία δεν είναι περιοχή· είναι θόρυβος, και σταματάμε με όσα βρέθηκαν.
 */
const MAX_SPLITS = 32;

/**
 * **Ελεύθερη χειρονομία → απλά σχήματα.**
 *
 * 1. Απλοποίηση (DP) του κλειστού δακτυλίου με εγγυημένη μέγιστη απόκλιση.
 * 2. Διάσπαση σε **απλούς** βρόχους σε κάθε αυτοτομή.
 * 3. Απόρριψη βρόχων κάτω από το ελάχιστο εμβαδόν (ο κόμπος στο κλείσιμο).
 *
 * @returns σχήματα **χωρίς** αυτοτομή — ή κενός πίνακας αν δεν έμεινε κανένα.
 */
export function strokeToShapes(stroke: readonly GeoPoint[], options: FreehandOptions): GeoOutline[] {
  const simplified = simplifyGeoRing(stroke, options.toleranceM);
  if (simplified === null) return [];

  const origin = simplified[0];
  const loops = splitIntoSimpleLoops(toLocalMetres(simplified, origin));

  return loops
    .filter((loop) => loop.length >= 3)
    .map((loop) => loop.map((point) => fromLocalMetres(point, origin)))
    .filter((shape) => geoOutlineAreaSqm(shape) >= options.minAreaSqm);
}

/**
 * **Κόψε τον δακτύλιο σε κάθε αυτοτομή.** Στην πρώτη τομή των τμημάτων `i` και `j`, με
 * σημείο `X`, ο δακτύλιος γίνεται δύο: ο βρόχος `X → i+1 … j` και το υπόλοιπο
 * `0 … i → X → j+1 … τέλος`. Και οι δύο ξαναμπαίνουν στη στοίβα μέχρι να μην κόβουν.
 *
 * 🔒 Κάθε διάσπαση κάνει και τους δύο δακτυλίους **γνησίως μικρότερους** σε κορυφές
 * (+1 για το `X`, −τουλάχιστον 2), άρα η διαδικασία **τερματίζει** — και το φρένο
 * {@link MAX_SPLITS} υπάρχει για τον χρόνο, όχι για την ορθότητα.
 */
function splitIntoSimpleLoops(ring: readonly LocalPoint[]): LocalPoint[][] {
  const done: LocalPoint[][] = [];
  const pending: LocalPoint[][] = [[...ring]];
  let splits = 0;

  while (pending.length > 0) {
    const current = pending.pop() as LocalPoint[];
    const crossing = splits < MAX_SPLITS ? firstCrossing(current) : null;
    if (crossing === null) {
      done.push(current);
      continue;
    }
    splits += 1;
    const { i, j, point } = crossing;
    pending.push([point, ...current.slice(i + 1, j + 1)]);
    pending.push([...current.slice(0, i + 1), point, ...current.slice(j + 1)]);
  }
  return done;
}

/** Η πρώτη γνήσια τομή μη γειτονικών τμημάτων — ίδιο κατηγόρημα με το `isSimpleGeoOutline`. */
function firstCrossing(ring: readonly LocalPoint[]): { i: number; j: number; point: LocalPoint } | null {
  const n = ring.length;
  if (n < 4) return null;

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const point = localSegmentCrossing(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n]);
      if (point !== null) return { i, j, point };
    }
  }
  return null;
}
