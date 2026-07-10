/**
 * ADR-632 — Φάση 2: Ανίχνευση ζεύγους «σκάλα ↔ πλάκα από πάνω».
 *
 * Ποια πλάκα «καπακώνει» μια σκάλα; Δύο ανεξάρτητες συνθήκες:
 *   1. **Οριζόντια επικάλυψη** — το footprint της πλάκας τέμνει το footprint της
 *      σκάλας στο επίπεδο κάτοψης (`safeIntersection` area > 0).
 *   2. **Κατακόρυφα από πάνω** — η κάτω παρειά της πλάκας βρίσκεται ΠΑΝΩ από τη
 *      βάση της σκάλας (`undersideZmm > baseZmm`). Έτσι αποκλείεται η ίδια η πλάκα
 *      στήριξης (top-face = baseZmm → underside < baseZmm) και οι πλάκες
 *      χαμηλότερων ορόφων· κρατιέται η οροφή που πρέπει να τρυπηθεί.
 *
 * Ο ΑΚΡΙΒΗΣ έλεγχος ελεύθερου ύψους (clearance < Hmin ανά μύτη) γίνεται στη Φάση 3
 * (`StairwellOpeningEngine`, μέσω `evaluateStairHeadroom`) — εδώ κάνουμε μόνο το
 * χοντρικό ζευγάρωμα τοπολογίας/υψομέτρου. Μια πλάκα πολύ ψηλότερα περνά αυτό το
 * φίλτρο αλλά ο headroom έλεγχος δεν θα βρει παράβαση → κανένα opening (αβλαβές).
 *
 * Pure — μηδέν scene / entities / React. x/y στις μονάδες της σκηνής (σκάλα &
 * πλάκα μοιράζονται τη σκηνή, ADR-358 §9.2 Q22)· τα z σε απόλυτα mm (ADR-369 §2
 * datum), ίδια σύμβαση με `resolveStairVerticalProfile` / `host-footprint-eval`.
 *
 * REUSE (SSoT, N.0.2): `safeIntersection` (ADR-396) + `multiPolygonArea` +
 * `polygon3dToClipPolygon` (polygon-utils) για την επικάλυψη· `HOST_Z_EPS`
 * (`host-footprint-eval`) για το κατακόρυφο κατώφλι. Καμία διπλή γεωμετρία.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §4-5
 */

import type { Polygon3D } from '../../types/bim-base';
import { safeIntersection } from '../shared/safe-polygon-boolean';
import { multiPolygonArea, polygon3dToClipPolygon } from '../shared/polygon-utils';
import { HOST_Z_EPS } from '../host-footprint-eval';

/** Σκάλα (footprint κάτοψης + resolved κατακόρυφο εύρος) — input ανιχνευτή. */
export interface StairFootprintInput {
  readonly stairId: string;
  /** Footprint κάτοψης (κλειστό) στις μονάδες σκηνής — π.χ. ένωση treads. */
  readonly footprint: Polygon3D;
  /** Απόλυτο Z βάσης (mm) — `resolveStairVerticalProfile.baseZmm`. */
  readonly baseZmm: number;
  /** Απόλυτο Z κορυφής/άφιξης (mm) — `resolveStairVerticalProfile.topZmm`. */
  readonly topZmm: number;
}

/**
 * Υποψήφια υπερκείμενη πλάκα. Δομικά συμβατή με ό,τι δίνει ο engine (Φ3) από τα
 * slab entities: `outline` (Polygon3D, ίδιος χώρος με τη σκάλα) για την τρύπα,
 * `undersideZmm` για τον headroom έλεγχο. Οριζόντια πλάκα (levelElevation) → μία
 * τιμή underside αρκεί (κεκλιμένες: ο engine δειγματοληπτεί, εκτός Φ2 scope).
 */
export interface StairwellSlabCandidate {
  readonly slabId: string;
  /** Footprint κάτοψης πλάκας (κλειστό), ίδιες μονάδες με το stair footprint. */
  readonly outline: Polygon3D;
  /** Απόλυτο Z άνω παρειάς (mm). */
  readonly topZmm: number;
  /** Απόλυτο Z κάτω παρειάς (mm) = `topZmm − thickness`. */
  readonly undersideZmm: number;
}

/** Ζευγάρι σκάλα↔πλάκα-από-πάνω που πέρασε επικάλυψη + κατακόρυφο φίλτρο. */
export interface StairSlabOverlap {
  readonly stairId: string;
  readonly slab: StairwellSlabCandidate;
  /** Εμβαδόν επικάλυψης footprint (μονάδες σκηνής², unsigned). */
  readonly overlapArea: number;
}

export interface StairSlabOverlapOptions {
  /**
   * Ελάχιστο εμβαδόν επικάλυψης (μονάδες σκηνής²) για να μετρήσει· φιλτράρει
   * οριακές εφαπτόμενες τομές. Default `0` → οποιαδήποτε θετική τομή μετρά.
   */
  readonly minOverlapArea?: number;
  /** Κατακόρυφο κατώφλι (mm). Default `HOST_Z_EPS`. */
  readonly verticalEps?: number;
}

/**
 * Εμβαδόν οριζόντιας επικάλυψης δύο footprints (μονάδες²). `0` όταν κάποιο είναι
 * degenerate ή η τομή κενή. Reuse `safeIntersection` + `multiPolygonArea`.
 */
export function footprintOverlapArea(a: Polygon3D, b: Polygon3D): number {
  const ga = polygon3dToClipPolygon(a);
  const gb = polygon3dToClipPolygon(b);
  if (!ga || !gb) return 0;
  return multiPolygonArea(safeIntersection(ga, gb));
}

/**
 * True αν η πλάκα βρίσκεται κατακόρυφα ΠΑΝΩ από τη βάση της σκάλας (η κάτω παρειά
 * της υπερβαίνει το `baseZmm` κατά > eps). Αποκλείει την πλάκα στήριξης και τους
 * κάτω ορόφους.
 */
export function isSlabAboveStairBase(
  slab: StairwellSlabCandidate,
  stair: StairFootprintInput,
  eps: number = HOST_Z_EPS,
): boolean {
  return slab.undersideZmm > stair.baseZmm + eps;
}

/**
 * Οι πλάκες που «καπακώνουν» μία σκάλα: επικάλυψη footprint > `minOverlapArea`
 * ΚΑΙ κατακόρυφα πάνω από τη βάση. Ταξινομημένες κατά κάτω-παρειά αύξουσα (η
 * πλησιέστερη οροφή — ο πιο πιθανός headroom παραβάτης — πρώτη).
 */
export function findSlabsAboveStair(
  stair: StairFootprintInput,
  slabs: readonly StairwellSlabCandidate[],
  options?: StairSlabOverlapOptions,
): StairSlabOverlap[] {
  const minArea = options?.minOverlapArea ?? 0;
  const eps = options?.verticalEps ?? HOST_Z_EPS;
  const result: StairSlabOverlap[] = [];
  for (const slab of slabs) {
    if (!isSlabAboveStairBase(slab, stair, eps)) continue;
    const overlapArea = footprintOverlapArea(stair.footprint, slab.outline);
    if (overlapArea > minArea) {
      result.push({ stairId: stair.stairId, slab, overlapArea });
    }
  }
  return result.sort((x, y) => x.slab.undersideZmm - y.slab.undersideZmm);
}

/**
 * Cross-product convenience: όλα τα ζεύγη σκάλα↔πλάκα-από-πάνω για πολλές σκάλες.
 * Ο engine (Φ3) το τρέχει μία φορά ανά building level· κάθε ζεύγος τροφοδοτεί
 * ξεχωριστό headroom έλεγχο + (αν παραβιάζεται) ένα auto-opening (`autoStairId`).
 */
export function findStairSlabOverlaps(
  stairs: readonly StairFootprintInput[],
  slabs: readonly StairwellSlabCandidate[],
  options?: StairSlabOverlapOptions,
): StairSlabOverlap[] {
  const out: StairSlabOverlap[] = [];
  for (const stair of stairs) {
    out.push(...findSlabsAboveStair(stair, slabs, options));
  }
  return out;
}
