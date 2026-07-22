/**
 * ADR-685 — Φάση 1: Ανίχνευση «πλάκα στη ΒΑΣΗ της σκάλας» + ταξινόμηση σχέσης.
 *
 * Ο δίδυμος (mirror) του `stair-slab-overlap.ts` (`findSlabsAboveStair`, ADR-632),
 * αλλά για την πλάκα **δαπέδου/βάσης** — αυτή που η σκάλα πατάει (ή διαπερνά) στη
 * βάση της, όχι την οροφή που την «καπακώνει». Το ADR-632 φίλτρο
 * `isSlabAboveStairBase` απορρίπτει ρητά αυτή την πλάκα (`undersideZmm > baseZmm`)·
 * εδώ την κρατάμε και ταξινομούμε τη σχέση.
 *
 * **Ταξινόμηση (Revit/ArchiCAD parity):**
 *   - `seat` (**terminating**) — η βάση της σκάλας είναι μέσα ή στην κορυφή της
 *     πλάκας (`underside ≤ base ≤ top`, εντός eps). Η σκάλα **εδράζεται**: η βάση
 *     ανασηκώνεται στο top-face (μέσω του υπάρχοντος base-attach, ADR-401 Phase G).
 *   - `pass-through` — η βάση κατεβαίνει **κάτω από την κάτω παρειά** της πλάκας
 *     (`base < underside`). Η σκάλα **διαπερνά** προς κάτω όροφο → opening (Φάση 2,
 *     ADR-632-style στο `useCrossLevelStairwellOpenings`). Εδώ ΔΕΝ την εδράζουμε.
 *   - `floating` — η βάση είναι πάνω από την πλάκα (`base > top`) → δεν είναι πλάκα
 *     βάσης (ο υπάρχων ADR-401 pull-down χειρίζεται την αιωρούμενη σκάλα).
 *
 * Pure — μηδέν scene / entities / React. x/y στις μονάδες σκηνής (σκάλα & πλάκα
 * μοιράζονται τη σκηνή)· τα z σε απόλυτα mm (ίδια σύμβαση με `stair-slab-overlap`).
 *
 * REUSE (SSoT, N.0.2): `footprintOverlapArea` + τα input types από
 * `stair-slab-overlap` (ADR-632)· `HOST_Z_EPS` (`host-footprint-eval`). Καμία
 * διπλή γεωμετρία/κατώφλι.
 *
 * @see bim/geometry/stairs/stair-slab-overlap.ts — ο ADR-632 δίδυμος (πλάκα ΑΠΟ ΠΑΝΩ)
 * @see docs/centralized-systems/reference/adrs/ADR-685-stair-base-slab-seating-ssot.md
 */

import { HOST_Z_EPS } from '../host-footprint-eval';
import {
  footprintOverlapArea,
  type StairFootprintInput,
  type StairSlabOverlap,
  type StairSlabOverlapOptions,
  type StairwellSlabCandidate,
} from './stair-slab-overlap';

/** mm³ → m³ (BOQ όγκος σκυροδέματος). */
const MM3_TO_M3 = 1e-9;

/** Σχέση βάσης σκάλας ↔ πλάκας δαπέδου (Revit/ArchiCAD parity). */
export type StairBaseRelation = 'seat' | 'pass-through' | 'floating';

/**
 * Ταξινομεί τη σχέση της βάσης της σκάλας (`baseZmm`) με μία πλάκα-υποψήφια βάσης
 * (`topZmm` / `undersideZmm`), όλα σε απόλυτα mm. Καθαρά scalar → την καλούν και ο
 * attach coordinator (seat gate) και το BOQ guard.
 *
 *   base < underside − eps            → `pass-through` (διαπερνά προς κάτω)
 *   underside − eps ≤ base ≤ top + eps → `seat` (εδράζεται/βυθισμένη)
 *   base > top + eps                   → `floating` (αιωρούμενη πάνω από την πλάκα)
 */
export function classifyStairBaseRelation(
  baseZmm: number,
  slabTopZmm: number,
  slabUndersideZmm: number,
  eps: number = HOST_Z_EPS,
): StairBaseRelation {
  if (baseZmm < slabUndersideZmm - eps) return 'pass-through';
  if (baseZmm <= slabTopZmm + eps) return 'seat';
  return 'floating';
}

/**
 * Η πλάκα στη ΒΑΣΗ της σκάλας που δικαιολογεί **έδραση** (`seat`): footprint overlap
 * > `minOverlapArea` ΚΑΙ σχέση `seat`. Όταν πολλές ταιριάζουν, επιστρέφεται αυτή με
 * το **ψηλότερο** top-face (η πλάκα που η σκάλα πραγματικά πατάει). `null` όταν καμία
 * δεν εδράζει (αιωρούμενη / διαπερνά / χωρίς overlap).
 *
 * Δεν εδράζουμε ΠΟΤΕ σε `pass-through` πλάκα — αυτή θέλει opening (Φάση 2), όχι seat.
 */
export function findSlabToSeatStairBase(
  stair: StairFootprintInput,
  slabs: readonly StairwellSlabCandidate[],
  options?: StairSlabOverlapOptions,
): StairSlabOverlap | null {
  const minArea = options?.minOverlapArea ?? 0;
  const eps = options?.verticalEps ?? HOST_Z_EPS;
  let best: StairSlabOverlap | null = null;
  for (const slab of slabs) {
    if (classifyStairBaseRelation(stair.baseZmm, slab.topZmm, slab.undersideZmm, eps) !== 'seat') {
      continue;
    }
    const overlapArea = footprintOverlapArea(stair.footprint, slab.outline);
    if (overlapArea <= minArea) continue;
    if (best === null || slab.topZmm > best.slab.topZmm) {
      best = { stairId: stair.stairId, slab, overlapArea };
    }
  }
  return best;
}

/** Διατομή μηρού (waist) σκάλας σε mm — ό,τι χρειάζεται ο κοινός-όγκος υπολογισμός. */
export interface StairWaistSection {
  /** Πλάτος σκάλας (mm). */
  readonly widthMm: number;
  /** Πάχος μηρού/waist RC (mm) — `params.waistThickness`. */
  readonly waistThicknessMm: number;
  /** Ύψος βαθμίδας (mm) — effective (whole-step snap αν attached). */
  readonly riseMm: number;
  /** Πάτημα/going (mm) — `params.tread`. */
  readonly goingMm: number;
  /** Πλήθος βαθμίδων (για cap σε ρηχή σκάλα). */
  readonly stepCount: number;
}

/**
 * BOQ safety-guard όγκος (m³): το **πραγματικό** κοινό σκυρόδεμα μηρού↔πλάκας στη
 * ζώνη βάσης. Ο μονολιθικός μηρός (κεκλιμένη πλάκα πάχους `waistThickness`, πλάτους
 * `width`) διαπερνά **μία φορά** την κατακόρυφη ζώνη της πλάκας (ύψος = `slabThickness`).
 * Το κοινό = διατομή μηρού × κεκλιμένο μήκος που καλύπτει τη ζώνη:
 *
 *     shared = width · waist · min(slabThickness / sinθ, stepCount · hyp)
 *
 * όπου `θ` η κλίση της σκάλας (`sinθ = rise / hypot(rise, going)`) και το `min(...)`
 * κόβει το κεκλιμένο μήκος στο συνολικό run (ρηχή σκάλα δεν διαπερνά όλο το πάχος).
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `overlapArea × thickness`:** το footprint-overlap (bbox) καλύπτει
 * ΟΛΟ το αποτύπωμα της σκάλας, αλλά μόνο ο μηρός των **πρώτων ~2 βαθμίδων** τέμνει
 * τη ζώνη της πλάκας (οι υπόλοιπες βαθμίδες ανεβαίνουν πάνω από αυτήν). Το
 * `overlapArea × thickness` υπερ-αφαιρεί ~10× → σοβαρή υπο-μέτρηση σκυροδέματος. Εδώ
 * μοντελοποιείται η **πραγματική** στήλη μηρού-εντός-πλάκας. Η έδραση (§2) ΔΕΝ
 * αλλάζει αυτόν τον όγκο (ο τύπος ποσοτήτων είναι Z-ανεξάρτητος) → όλη η διόρθωση
 * διπλομέτρησης βαραίνει αυτό το guard.
 *
 * Clamp ≥ 0 σε κάθε είσοδο· μηδέν σε εκφυλισμένη σκάλα (μηδέν width/waist/rise/steps).
 * Ο caller το εφαρμόζει μόνο όταν η σκάλα εδράζεται σε πλάκα (`findSlabToSeatStairBase`).
 * Όλα σε mm (params σκάλας canonical mm) → καμία μετατροπή σκηνής.
 */
export function computeStairWaistSlabOverlapVolumeM3(
  section: StairWaistSection,
  slabThicknessMm: number,
): number {
  const width = Math.max(0, section.widthMm);
  const waist = Math.max(0, section.waistThicknessMm);
  const rise = Math.max(0, section.riseMm);
  const going = Math.max(0, section.goingMm);
  const steps = Math.max(0, section.stepCount);
  const t = Math.max(0, slabThicknessMm);
  if (width === 0 || waist === 0 || rise === 0 || steps === 0 || t === 0) return 0;

  const hyp = Math.hypot(rise, going);
  const sinTheta = hyp > 0 ? rise / hyp : 0;
  if (sinTheta <= 0) return 0;

  const inclinedBand = Math.min(t / sinTheta, steps * hyp);
  return width * waist * inclinedBand * MM3_TO_M3;
}
