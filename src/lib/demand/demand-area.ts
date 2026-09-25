/**
 * 🗺️ **Η σχεδιασμένη περιοχή της ζήτησης** (ADR-888) — ΕΝΑ σημείο για ό,τι ρωτά το `DemandPlace.area`.
 *
 * 🔑 **Η ίδια γεωμετρία με τον χάρτη αποτελεσμάτων (ADR-885).** Η ζήτηση κρατά `shapes` — το ίδιο σχήμα με
 * το `GeoDrawnArea.shapes` — και κάθε κρίση περνά από τα **ίδια** SSoT: όρια από το
 * `lib/listings/listing-drawn-area.ts`, «είναι μέσα;» από το `areaRelation` (`lib/geo/geo-area.ts`). Έτσι
 * το email **δεν μπορεί** να διαφωνήσει με τον χάρτη: ρωτούν τον ίδιο κριτή.
 *
 * 🔴 **ΕΝΩΣΗ, ΠΟΤΕ EVEN-ODD.** Το `isPointInGeoRings` μετρά ισοτιμία (τρύπες διοικητικών ορίων) — σε δύο
 * επικαλυπτόμενα σχήματα θα έβγαζε «έξω» ακριβώς την περιοχή που ο άνθρωπος τόνισε δύο φορές.
 */

import { areaRelation, outlinesBoundingBox } from '@/lib/geo/geo-area';
import {
  MAX_DRAWN_SHAPES,
  MAX_DRAWN_URL_CHARS,
  drawnAreaFromShapes,
  drawnShapesUrlLength,
} from '@/lib/listings/listing-drawn-area';
import type { GeoDrawnArea, GeoOutline, GeoPoint } from '@/types/geo/coordinates';
// ⚠️ ΜΟΝΟ τύπος: το `types/property-demand.ts` εισάγει από εδώ τα invariants — εισαγωγή τιμής θα ήταν κύκλος.
import type { DemandPlace } from '@/types/property-demand';

/** Οι τρόποι που μια σχεδιασμένη περιοχή ζήτησης είναι άκυρη — υποσύνολο του `DEMAND_INVARIANTS`. */
export type DemandAreaInvariant = 'area-empty' | 'outline-degenerate' | 'area-too-many' | 'area-too-large';

/**
 * Οι παραβιάσεις της περιοχής, **όλες μαζί** (ο άνθρωπος διορθώνει μία φορά, όχι τέσσερις).
 *
 * ⚠️ **Το `outline-degenerate` μένει «< 3 κορυφές», όπως πριν το ADR-888.** Το αυστηρότερο `outlineDefect`
 * (αυτοτομή, ελάχιστο εμβαδόν) το επιβάλλει ήδη το πρόχειρο της φόρμας και του χάρτη· αν το έβαζε εδώ, μια
 * **παλιά** ζήτηση θα γινόταν ξαφνικά άκυρη και ο κάτοχός της δεν θα μπορούσε ούτε να τη μετονομάσει.
 *
 * 🔑 **`area-too-large` = δεν χωρά στον σύνδεσμο του ADR-885.** Κάθε αποθηκευμένη ζήτηση χωρά **πάντα**
 * στο `?draw=` ⇒ το «Άνοιγμα στον χάρτη» δείχνει ακριβώς ό,τι σώθηκε.
 */
export function demandAreaInvariants(shapes: readonly GeoOutline[]): DemandAreaInvariant[] {
  if (shapes.length === 0) return ['area-empty'];
  const found: DemandAreaInvariant[] = [];
  if (shapes.some((shape) => shape.length < 3)) found.push('outline-degenerate');
  if (shapes.length > MAX_DRAWN_SHAPES) found.push('area-too-many');
  if (drawnShapesUrlLength(shapes) > MAX_DRAWN_URL_CHARS) found.push('area-too-large');
  return found;
}

/**
 * **Είναι αυτό το σημείο στην περιοχή;** — ο κριτής του χάρτη, με σύνορο **εντός**.
 *
 * Το `areaRelation` ενός σημείου (κύκλος ακτίνας 0) δίνει `intersects` μόνο ακριβώς πάνω στην ακμή —
 * εκεί το σημείο **ανήκει** (το «δεν αποκλείουμε ό,τι ανήκει» του `listing-search-area`).
 */
export function isPointInDemandArea(point: GeoPoint, shapes: readonly GeoOutline[]): boolean {
  const bbox = outlinesBoundingBox(shapes);
  if (bbox === null) return false;
  const area: GeoDrawnArea = { shapes, bbox };
  return areaRelation({ center: point, radiusKm: 0 }, area) !== 'disjoint';
}

/**
 * Η περιοχή ως **φίλτρο οθόνης** (`?draw=`), ή `null` αν κάποιο σχήμα δεν περνά το `outlineDefect` του
 * χάρτη (μόνο παλιά έγγραφα) — τότε ο καλών πέφτει σε κύκλο και **δηλώνει** την απώλεια.
 */
export function demandAreaAsDrawn(shapes: readonly GeoOutline[]): GeoDrawnArea | null {
  return drawnAreaFromShapes(shapes);
}

// =============================================================================
// ΤΟ ΣΥΝΟΡΟ ΑΠΟΘΗΚΕΥΣΗΣ — το Firestore ΔΕΝ δέχεται πίνακα μέσα σε πίνακα
// =============================================================================

/**
 * Ένα σχήμα **όπως αποθηκεύεται**: `{ ring }` και όχι γυμνός πίνακας.
 *
 * 🔴 **ΒΡΕΘΗΚΕ ΖΩΝΤΑΝΑ (ADR-888, 2026-09-25)**: το `setDoc` με `shapes: GeoOutline[]` απέτυχε με *«Nested arrays
 * are not supported»* — κανένα jest δεν το είδε, γιατί κανένα δεν γράφει σε Firestore. Στη **μνήμη** η γεωμετρία
 * μένει η ίδια με τον χάρτη (`GeoOutline[]`)· μόνο το **έγγραφο** τυλίγει κάθε δακτύλιο σε αντικείμενο (πίνακας
 * αντικειμένων που κρατούν πίνακα = επιτρέπεται). Ένας κωδικοποιητής, δύο κατευθύνσεις, ένα αρχείο.
 */
export interface StoredAreaShape {
  readonly ring: GeoOutline;
}

/** Ο τόπος **για εγγραφή**: η περιοχή τυλίγεται (`{ring}`), κάθε άλλη μορφή περνά αυτούσια. */
export function demandPlaceForStorage(place: DemandPlace): DemandPlace | StoredAreaPlace {
  if (place.kind !== 'area') return place;
  return { kind: 'area', shapes: place.shapes.map((ring) => ({ ring })) };
}

export interface StoredAreaPlace {
  readonly kind: 'area';
  readonly shapes: readonly StoredAreaShape[];
}

/**
 * **Ανάγνωση-με-ανοχή** του αποθηκευμένου `place` — πάντα `{ kind:'area', shapes: GeoOutline[] }` στη μνήμη:
 * - αποθηκευμένο σχήμα `{ ring }` → ο δακτύλιος·
 * - έγγραφο πριν το ADR-888 (`{ kind:'area', outline }`) → `shapes:[outline]`·
 * - κάθε άλλη τιμή περνά αυτούσια.
 *
 * ⚠️ Ο κλάδος `outline` φεύγει όταν το `scripts/migrate-demand-area-shapes.ts` αναφέρει 0 παλιά έγγραφα.
 */
export function withAreaShapes(stored: unknown): unknown {
  if (typeof stored !== 'object' || stored === null) return stored;
  const place: { readonly kind?: unknown; readonly outline?: unknown; readonly shapes?: unknown } = stored;
  if (place.kind !== 'area') return stored;
  if (Array.isArray(place.shapes)) return { ...place, shapes: place.shapes.map(ringOf) };
  if (!Array.isArray(place.outline)) return stored;
  const { outline, ...rest } = place;
  return { ...rest, shapes: [outline] };
}

/** Ένα αποθηκευμένο σχήμα → ο δακτύλιός του (δέχεται και γυμνό πίνακα: ό,τι είναι ήδη στη μνήμη). */
function ringOf(shape: unknown): unknown {
  if (typeof shape === 'object' && shape !== null && !Array.isArray(shape) && 'ring' in shape) return shape.ring;
  return shape;
}
