/**
 * @fileoverview SSoT — **τι σημαίνει ένα κλικ πάνω στον χάρτη καταχωρίσεων** (ADR-777 §8.76).
 * @related components/search-results/listing-map-pick.ts · lib/maps/listing-clusters.ts
 * @module lib/maps/map-pick
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΕΡΩΤΗΣΗ: «ΤΙ ΕΝΝΟΟΥΣΕ Ο ΑΝΘΡΩΠΟΣ;» — ΤΕΣΣΕΡΙΣ ΑΠΑΝΤΗΣΕΙΣ, ΕΝΑΣ ΚΡΙΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | κάτω από τον δείκτη | απάντηση |
 * |---|---|
 * | τίποτα | `none` — ακύρωση επιλογής |
 * | ομάδα | `cluster` — ζουμ, **ή** λίστα αν το ζουμ δεν μπορεί να τη χωρίσει |
 * | ΜΙΑ αγγελία | `listing` — επιλογή |
 * | ΠΟΛΛΕΣ αγγελίες, η μία πάνω στην άλλη | `stack` — λίστα για διάλεγμα |
 *
 * 🔑 **Πριν, ζούσαν σε έξι χειριστές** (ένας ανά επίπεδο + ένας για το κενό) και **δεν
 * ρωτούσαν ποτέ** αν κάτω από τον δείκτη υπάρχουν δύο αγγελίες: το κλικ επέλεγε
 * σιωπηλά όποια τύχαινε από πάνω, και η άλλη ήταν **δομικά απρόσιτη** από τον χάρτη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΛΙΣΤΑ ΚΑΙ ΟΧΙ SPIDERFY — ΚΑΙ ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **Google MarkerClusterer**: κλικ ⇒ `fitBounds` στο κάδρο της ομάδας — γνωστό ότι
 *   **δεν** τη χωρίζει πάντα (το κάδρο χωρά, η ομάδα μένει ομάδα).
 * - **MapLibre / Mapbox**: κλικ ⇒ `getClusterExpansionZoom` με κέντρο την ομάδα —
 *   χωρίζει πάντα, αλλά μέλη της μπορεί να βγουν **εκτός** κάδρου.
 * - **Spiderfy** (Google Earth, Leaflet): ανοίγει τα σημεία σε βεντάλια. **Απορρίπτεται**:
 *   ζωγραφίζει αγγελίες **εκεί που δεν είναι** — ακριβώς το ψέμα θέσης που απαγορεύει
 *   η Α5 — και δεν έχει διαδρομή πληκτρολογίου.
 * - **Zillow** (πολλές μονάδες στο ίδιο κτίριο) και **AutoCAD Selection Cycling**
 *   (επικαλυπτόμενα αντικείμενα): **λίστα** για διάλεγμα. Αυτό υιοθετούμε.
 *
 * ✅ Εδώ: **(α)** το ζουμ είναι `max(ζουμ που χωρά όλα τα μέλη, ζουμ που τη χωρίζει)` —
 * κάθε κλικ **προχωρά** και **κανένα μέλος δεν χάνεται** από το κάδρο· **(β)** η λίστα
 * δεν ενεργοποιείται «στο μέγιστο ζουμ» (Leaflet) αλλά **όταν αποδεικνύεται** ότι το
 * ζουμ δεν μπορεί να βοηθήσει, μέσα στο ταβάνι ειλικρίνειας του κάδρου· **(γ)** ο ίδιος
 * κριτής λύνει και την επικάλυψη **χωρίς** ομάδα (πάνω από το `CLUSTER_MAX_ZOOM`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις + σταθερές.
 */

import { CLUSTER_KEY, CLUSTER_RADIUS_PX } from './listing-clusters';
import { lngLatToWorldPixel } from './metric-size';

/** Τα επίπεδα της **ομάδας** (κουκκίδα + αριθμός). */
export const CLUSTER_PICK_LAYERS = ['listing-cluster', 'listing-cluster-count'] as const;

/** Σχήματα **σημείου** — ακριβής στόχος, προηγείται κάθε έκτασης. */
export const POINT_PICK_LAYERS = ['listing-pin', 'listing-pin-ring'] as const;

/**
 * Σχήματα **έκτασης**. Επιλέξιμα κι αυτά — αλλιώς οι αγγελίες με σκιασμένη περιοχή θα
 * ήταν ορατές αλλά **μη επιλέξιμες**, δηλαδή θα τιμωρούνταν επειδή ξέρουμε λιγότερα.
 */
export const AREA_PICK_LAYERS = ['listing-neighbourhood', 'listing-city', 'listing-outline-fill'] as const;

/** **Όλα** τα επίπεδα που ρωτά το κλικ — μία λίστα, και για την επιλογή και για το «κενό». */
export const PICKABLE_LAYER_IDS: readonly string[] = [
  ...CLUSTER_PICK_LAYERS,
  ...POINT_PICK_LAYERS,
  ...AREA_PICK_LAYERS,
];

/** Ό,τι μας νοιάζει από ένα `queryRenderedFeatures` — ανεξάρτητο από τη βιβλιοθήκη. */
export interface PickHit {
  readonly layerId: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export type MapPick =
  | { readonly kind: 'none' }
  | { readonly kind: 'cluster'; readonly clusterId: number; readonly pointCount: number }
  | { readonly kind: 'listing'; readonly id: string }
  | { readonly kind: 'stack'; readonly ids: readonly string[] };

const inLayers = (layers: readonly string[]) => (hit: PickHit): boolean => layers.includes(hit.layerId);

/** Οι **διακριτές** ταυτότητες, με τη σειρά που τις δίνει ο χάρτης (πάνω πρώτα). */
function distinctIds(hits: readonly PickHit[]): readonly string[] {
  const ids: string[] = [];
  for (const hit of hits) {
    const id = hit.properties.id;
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function clusterOf(hits: readonly PickHit[]): MapPick | null {
  const hit = hits.find(inLayers(CLUSTER_PICK_LAYERS));
  if (hit === undefined) return null;
  const clusterId = hit.properties.cluster_id;
  const pointCount = hit.properties[CLUSTER_KEY.pointCount];
  if (typeof clusterId !== 'number' || typeof pointCount !== 'number') return null;
  return { kind: 'cluster', clusterId, pointCount };
}

function listingsOf(ids: readonly string[]): MapPick | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return { kind: 'listing', id: ids[0] };
  return { kind: 'stack', ids };
}

/**
 * **Ο κριτής του κλικ.**
 *
 * 🔑 **Η σειρά είναι ιεραρχία ακρίβειας**: ομάδα (κάθεται από πάνω) → σημεία → εκτάσεις.
 * Πινέζα της Α μέσα στον κύκλο «κάπου στην πόλη» της Β **δεν** είναι αμφισημία — ο
 * άνθρωπος πάτησε τον ακριβή στόχο. Δύο κύκλοι πόλης στο ίδιο κέντρο **είναι**.
 */
export function resolveMapPick(hits: readonly PickHit[]): MapPick {
  return clusterOf(hits)
    ?? listingsOf(distinctIds(hits.filter(inLayers(POINT_PICK_LAYERS))))
    ?? listingsOf(distinctIds(hits.filter(inLayers(AREA_PICK_LAYERS))))
    ?? { kind: 'none' };
}

/**
 * **Μπορεί το ζουμ να χωρίσει αυτά τα σημεία;** — `false` ⇒ λίστα αντί για ζουμ.
 *
 * Μετρά τη διαγώνιο του κάδρου τους σε pixel **στο `zoom`** (το ταβάνι του κάδρου). Κάτω
 * από το {@link CLUSTER_RADIUS_PX} — την απόσταση που ο ίδιος ο ομαδοποιητής θεωρεί
 * «ένα δάχτυλο» — τα σημεία **δεν** γίνονται δύο στόχοι ούτε εκεί. Ένα όριο, δύο χρήσεις.
 */
export function zoomCanSeparate(
  points: readonly (readonly [number, number])[],
  zoom: number,
  touchPx: number = CLUSTER_RADIUS_PX,
): boolean {
  if (points.length < 2) return true;
  const projected = points.map(([lng, lat]) => lngLatToWorldPixel(lng, lat, zoom));
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return diagonal >= touchPx;
}

/**
 * **Σε ποιο ζουμ πάει ένα κλικ σε ομάδα.**
 *
 * `max(fit, expansion)` ⇒ **προχωρά πάντα** (Mapbox) **και** χωρά όλα τα μέλη όταν γίνεται
 * (Google)· `min(…, ceiling)` ⇒ ποτέ πάνω από όσα ισχυρίζεται το κάδρο.
 */
export function clusterTargetZoom(fitZoom: number | null, expansionZoom: number, ceilingZoom: number): number {
  return Math.min(Math.max(fitZoom ?? expansionZoom, expansionZoom), ceilingZoom);
}
