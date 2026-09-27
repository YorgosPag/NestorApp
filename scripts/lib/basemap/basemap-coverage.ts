/**
 * @fileoverview **ΤΙ ΚΑΛΥΠΤΕΙ Ο ΧΑΡΤΗΣ ΦΟΝΤΟΥ, ΣΕ ΚΑΘΕ ZOOM** — κλιμακωτή κάλυψη, δεμένη στην επικράτεια (ADR-891 Φ2).
 * @related ADR-891 §7 · ADR-883 (τα όρια που ορίζουν την επικράτεια) · `scripts/build-basemap.ts`
 * @module scripts/lib/basemap/basemap-coverage
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΚΛΙΜΑΚΩΤΗ ΚΑΙ ΟΧΙ ΕΝΑ ΟΡΘΟΓΩΝΙΟ (μετρημένο 2026-09-27, build 20260926)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το ορθογώνιο της Ελλάδας (19,2–29,75 E · 34,7–41,8 N) δίνει **982 MB** — και το μισό βάρος του είναι η
 * **Κωνσταντινούπολη, η Σμύρνη, η Προύσα και τα Τίρανα** σε zoom 15, που πέφτουν μέσα στο ορθογώνιο.
 * Κανείς δεν ψάχνει ακίνητο εκεί. Όμως ένας χάρτης που **αδειάζει** όταν απομακρύνεσαι μοιάζει χαλασμένος.
 * Οι μεγάλοι το λύνουν με πυραμίδα «επισκόπηση + λεπτομέρεια». Εμείς το ίδιο, ρητά:
 *
 * | Ζώνη | Zoom | Περιοχή | Μετρημένο (dry-run) |
 * |---|---|---|---|
 * | `world` | 0–5 | όλη η Γη | 15 MB |
 * | `region` | 6–7 | επικράτεια + 1.500 km | ~35 MB |
 * | `neighbourhood` | 8–9 | επικράτεια + 600 km | ~55 MB |
 * | `territory` | 10–15 | **κάθε** όριο + 15 km | ~560 MB |
 *
 * 🔑 **Η επικράτεια ΔΕΝ γράφεται με το χέρι.** Βγαίνει από τα όρια Καλλικράτη που **ήδη** δημοσιεύουμε
 * (ADR-883): για κάθε κλάδο της ιεραρχίας, το **λεπτομερέστερο** διαθέσιμο όριο μέχρι τον δήμο. Έτσι το
 * Άγιο Όρος (όριο μόνο σε επίπεδο περιφέρειας) **δεν** χάνεται, όπως θα χανόταν με «μόνο δήμους».
 *
 * 🔑 **Η ζώνη των 15 km είναι εγγύηση, όχι προσέγγιση**: το ορθογώνιο κάθε ορίου **περιέχει** το όριο, άρα
 * κάθε σημείο σε απόσταση ≤15 km από ελληνικό έδαφος έχει πλακίδια λεπτομέρειας. Η τουρκική ακτή απέναντι
 * από τη Σάμο (1,6 km) φαίνεται· η Κωνσταντινούπολη όχι. Δοκιμάστηκε και κάλυψη πάνω στο πλέγμα πλακιδίων
 * z12 με διαστολή: 537 MB — ίδιο βάρος, περισσότερος κώδικας, **καμία** εγγύηση σε km. Απορρίφθηκε.
 *
 * ⚠️ **Καθαρό module** — χωρίς I/O, ώστε τα tests να το ελέγχουν αυτούσιο.
 */

import type { GeoBoundingBox } from '../../../src/types/geo/coordinates';

/** Το μέγιστο zoom του build του Protomaps. Πάνω από αυτό ο MapLibre μεγεθύνει το z15 (overzoom). */
export const BASEMAP_MAX_ZOOM = 15;

/** Μέσο μήκος μίας μοίρας γεωγραφικού πλάτους. */
const KM_PER_DEGREE = 111.32;

/** Το όριο του Web Mercator: πέρα από αυτό δεν υπάρχουν πλακίδια. */
const MERCATOR_MAX_LAT = 85.0511;

export type BasemapTierArea =
  | { readonly kind: 'world' }
  | { readonly kind: 'territory-radius'; readonly radiusKm: number }
  | { readonly kind: 'territory'; readonly marginKm: number };

export interface BasemapTier {
  readonly id: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly area: BasemapTierArea;
  /** Γιατί υπάρχει η ζώνη — τυπώνεται στην αναφορά προέλευσης. */
  readonly why: string;
}

/** Ο πίνακας των ζωνών — ο **ΕΝΑΣ** ορισμός του «τι καλύπτει το αρχείο». Συνεχείς, ξένες, 0…{@link BASEMAP_MAX_ZOOM}. */
export const BASEMAP_TIERS: readonly BasemapTier[] = [
  { id: 'world', minZoom: 0, maxZoom: 5, area: { kind: 'world' }, why: 'ο χάρτης δεν αδειάζει ποτέ όταν απομακρύνεσαι' },
  { id: 'region', minZoom: 6, maxZoom: 7, area: { kind: 'territory-radius', radiusKm: 1500 }, why: 'Βαλκάνια και Μεσόγειος γύρω από την Ελλάδα' },
  { id: 'neighbourhood', minZoom: 8, maxZoom: 9, area: { kind: 'territory-radius', radiusKm: 600 }, why: 'γειτονικές ακτές και σύνορα σε κλίμακα περιφέρειας' },
  { id: 'territory', minZoom: 10, maxZoom: BASEMAP_MAX_ZOOM, area: { kind: 'territory', marginKm: 15 }, why: 'πλήρης λεπτομέρεια σε κάθε ελληνικό όριο και 15 km γύρω του' },
];

/** Ένα όριο της ιεραρχίας με το ορθογώνιό του — ό,τι χρειάζεται η κάλυψη, τίποτε άλλο. */
export interface TerritoryBoundary {
  readonly id: string;
  readonly level: number;
  readonly bbox: GeoBoundingBox;
}

/** Η βαθμίδα του δήμου στην ιεραρχία Καλλικράτη — το λεπτομερέστερο επίπεδο που ζητά η κάλυψη. */
export const TERRITORY_FINEST_LEVEL = 5;

/**
 * **Τα φύλλα της επικράτειας**: όρια έως τον δήμο που **δεν** έχουν παιδί με όριο. Όπου υπάρχουν δήμοι,
 * κρατούνται οι δήμοι· όπου η ιεραρχία σταματά νωρίτερα (Άγιο Όρος), κρατείται ό,τι υπάρχει.
 * ⚠️ Ο γονέας μπορεί να λείπει από τα όρια (βαθμίδα χωρίς αρχείο): τότε το παιδί δένεται στον **πρόγονο** που υπάρχει.
 */
export function territoryLeaves(boundaries: readonly TerritoryBoundary[], parentOf: (id: string) => string | null): TerritoryBoundary[] {
  const eligible = boundaries.filter((b) => b.level <= TERRITORY_FINEST_LEVEL);
  const present = new Set(eligible.map((b) => b.id));
  const hasChild = new Set<string>();
  for (const boundary of eligible) {
    for (let ancestor = parentOf(boundary.id); ancestor !== null; ancestor = parentOf(ancestor)) {
      if (present.has(ancestor)) {
        hasChild.add(ancestor);
        break;
      }
    }
  }
  return eligible.filter((b) => !hasChild.has(b.id));
}

/** Το ορθογώνιο που περιέχει όλα τα ορθογώνια. */
export function unionBox(boxes: readonly GeoBoundingBox[]): GeoBoundingBox {
  if (boxes.length === 0) throw new Error('κάλυψη χωρίς κανένα όριο — η επικράτεια δεν μπορεί να είναι κενή');
  return {
    west: Math.min(...boxes.map((b) => b.west)),
    south: Math.min(...boxes.map((b) => b.south)),
    east: Math.max(...boxes.map((b) => b.east)),
    north: Math.max(...boxes.map((b) => b.north)),
  };
}

/**
 * Διευρύνει κατά `km` προς **κάθε** κατεύθυνση. Το γεωγραφικό μήκος μετριέται στο πλάτος με το **μικρότερο**
 * μήκος μοίρας (το πιο βόρειο/νότιο άκρο), ώστε η διεύρυνση να είναι **τουλάχιστον** `km` παντού.
 */
export function expandBox(box: GeoBoundingBox, km: number): GeoBoundingBox {
  const south = Math.max(-MERCATOR_MAX_LAT, box.south - km / KM_PER_DEGREE);
  const north = Math.min(MERCATOR_MAX_LAT, box.north + km / KM_PER_DEGREE);
  const widestLat = Math.max(Math.abs(south), Math.abs(north));
  const lonDegrees = km / (KM_PER_DEGREE * Math.cos((widestLat * Math.PI) / 180));
  return { west: Math.max(-180, box.west - lonDegrees), south, east: Math.min(180, box.east + lonDegrees), north };
}

/** Τι παίρνει το `pmtiles extract` για μια ζώνη: ορθογώνιο (`--bbox`) ή πολύγωνο (`--region`). */
export type TierExtent =
  | { readonly kind: 'bbox'; readonly bbox: GeoBoundingBox }
  | { readonly kind: 'region'; readonly region: GeoJSON.MultiPolygon };

const WORLD: GeoBoundingBox = { west: -180, south: -MERCATOR_MAX_LAT, east: 180, north: MERCATOR_MAX_LAT };

function boxPolygon(box: GeoBoundingBox): GeoJSON.Position[][] {
  const { west, south, east, north } = box;
  return [[[west, south], [east, south], [east, north], [west, north], [west, south]]];
}

/** Η περιοχή μιας ζώνης, από τα φύλλα της επικράτειας. */
export function tierExtent(tier: BasemapTier, leaves: readonly TerritoryBoundary[]): TierExtent {
  const { area } = tier;
  if (area.kind === 'world') return { kind: 'bbox', bbox: WORLD };
  if (area.kind === 'territory-radius') {
    return { kind: 'bbox', bbox: expandBox(unionBox(leaves.map((l) => l.bbox)), area.radiusKm) };
  }
  if (leaves.length === 0) throw new Error(`ζώνη ${tier.id}: καμία επικράτεια`);
  return { kind: 'region', region: { type: 'MultiPolygon', coordinates: leaves.map((l) => boxPolygon(expandBox(l.bbox, area.marginKm))) } };
}

/** `--bbox` του CLI: `west,south,east,north`. */
export function bboxArgument(box: GeoBoundingBox): string {
  return [box.west, box.south, box.east, box.north].map((v) => Number(v.toFixed(6))).join(',');
}

/**
 * **Οι ζώνες χωρίζουν ακριβώς το 0…max** — συνεχείς, χωρίς επικάλυψη, χωρίς κενό. Το `pmtiles merge` θέλει
 * **ξένα** αρχεία· ένα κενό zoom θα ήταν επίπεδο όπου ο χάρτης **αδειάζει**, χωρίς κανένα σφάλμα.
 */
export function assertTierPartition(tiers: readonly BasemapTier[], maxZoom: number = BASEMAP_MAX_ZOOM): void {
  let expected = 0;
  for (const tier of tiers) {
    if (tier.minZoom !== expected || tier.maxZoom < tier.minZoom) {
      throw new Error(`ζώνη ${tier.id}: zoom ${tier.minZoom}–${tier.maxZoom}, αναμενόταν να αρχίζει στο ${expected}`);
    }
    expected = tier.maxZoom + 1;
  }
  if (expected !== maxZoom + 1) throw new Error(`οι ζώνες σταματούν στο ${expected - 1}, όχι στο ${maxZoom}`);
}
