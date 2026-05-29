/**
 * ADR-396 Phase P3 — Exposed-slab classifier (Z2 / Z3 detector).
 *
 * Pure SSoT που αποφασίζει αν μια πλάκα είναι **εκτεθειμένη** και χρειάζεται
 * θερμοπρόσοψη στην επίπεδη παρειά της (ETICS ζώνες §2.1):
 *   - Z2 = οροφή πιλοτής (soffit): η πλάκα ΔΕΝ έχει όροφο από κάτω → η κάτω
 *          παρειά της εκτίθεται (μονώνει το δάπεδο των ακινήτων από πάνω).
 *   - Z3 = δώμα (top): η πλάκα ΔΕΝ έχει όροφο από πάνω → η πάνω παρειά της
 *          εκτίθεται στον ουρανό.
 *   - null = εσωτερική πλάκα (όροφος και πάνω και κάτω).
 *
 * meters-in/meters-out boundary: τα storey elevations έρχονται σε ΜΕΤΡΑ
 * (`StoreyRef.elevation`, ADR-369 §9.0)· τα slab params σε mm. Όλη η σύγκριση
 * γίνεται σε mm εσωτερικά. Καμία γεωμετρία/render/Firestore — pure function.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §2.1, §3.1, §7 (P3)
 * @see ../utils/bim-floor-utils (getEntityAbsoluteElevation / StoreyRef SSoT)
 */

import type { StoreyRef } from '../utils/bim-floor-utils';
import { getEntityAbsoluteElevation } from '../utils/bim-floor-utils';

/** Z2 = πιλοτή soffit (no storey below)· Z3 = δώμα top (no storey above)· null = εσωτερική. */
export type ExposedSlabZone = 'Z2' | 'Z3' | null;

/**
 * Ελάχιστη μορφή πλάκας για classification — δομικά συμβατή με `SlabEntity`
 * (extra fields αγνοούνται). Καλύπτει και storey-linked (ADR-369) και legacy
 * `levelElevation` πλάκες.
 */
export interface SlabForZoneClassification {
  /** BaseEntity-level storey FK (fallback όταν λείπει `params.storeyId`). */
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly params: {
    /** mm — top face FFL absolute z (ADR-369 §2.1). Legacy/authoritative slab position. */
    readonly levelElevation: number;
    /** mm (default 0) — raise/drop top face από το FFL. */
    readonly heightOffsetFromLevel?: number;
    /** mm — πάχος πλάκας (κρέμεται προς τα κάτω από το top face). */
    readonly thickness: number;
    /** In-params storey FK (ADR-369 Phase 0.4). */
    readonly storeyId?: string;
    /** mm (default 0) — top face offset από το storey reference elevation. */
    readonly offsetFromStorey?: number;
  };
}

/**
 * mm ανοχή για τη σύγκριση elevations. Sub-slab-thickness (< 100mm) ώστε ένα
 * μικρό `offsetFromStorey` να μη σπάει τον εντοπισμό «ίδιος όροφος».
 */
const ELEV_SNAP_MM = 10;

/**
 * Resolve το absolute top-face elevation της πλάκας σε mm.
 *
 * Όταν η πλάκα είναι storey-linked (το `storeyId`/`floorId` ταιριάζει σε όροφο
 * της λίστας) → χρησιμοποιεί το SSoT `getEntityAbsoluteElevation` (ADR-369).
 * Αλλιώς → το authoritative `levelElevation` (+ `heightOffsetFromLevel`).
 */
function resolveSlabTopMm(
  slab: SlabForZoneClassification,
  floors: readonly StoreyRef[],
): number {
  const storeyId = slab.params.storeyId ?? slab.floorId;
  const linked = storeyId !== undefined && floors.some(f => f.id === storeyId);
  if (linked) {
    return getEntityAbsoluteElevation(slab, floors.slice());
  }
  return slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
}

/**
 * Classify μια πλάκα ως Z2 (πιλοτή soffit), Z3 (δώμα top) ή null (εσωτερική).
 *
 * Z3 precedence: σε μονώροφο κτίριο μια πλάκα μπορεί να ικανοποιεί ΚΑΙ τα δύο
 * (καμία πλάκα πάνω + καμία κάτω) — τότε νικά το Z3 (η οροφή είναι δώμα).
 *
 * @param slab   - πλάκα (SlabEntity ή narrowed shape).
 * @param floors - όλοι οι διαθέσιμοι όροφοι (StoreyRef, elevation σε ΜΕΤΡΑ).
 *                 Ιδανικά pre-filtered στο `buildingId` της πλάκας.
 */
export function classifyExposedSlab(
  slab: SlabForZoneClassification,
  floors: readonly StoreyRef[],
): ExposedSlabZone {
  const storeyElevsMm = floors.map(f => (f.elevation ?? 0) * 1000);
  const slabTopMm = resolveSlabTopMm(slab, floors);
  const slabBottomMm = slabTopMm - slab.params.thickness;

  // Z3 = δώμα: κανένας όροφος πάνω από το top face (εντός ανοχής).
  const hasStoreyAbove = storeyElevsMm.some(e => e > slabTopMm + ELEV_SNAP_MM);
  if (!hasStoreyAbove) return 'Z3';

  // Z2 = πιλοτή: κανένας όροφος κάτω από την κάτω παρειά (εντός ανοχής).
  const hasStoreyBelow = storeyElevsMm.some(e => e < slabBottomMm - ELEV_SNAP_MM);
  if (!hasStoreyBelow) return 'Z2';

  return null;
}

/**
 * Φιλτράρει μια λίστα πλακών κρατώντας μόνο τις εκτεθειμένες (Z2/Z3), με τη
 * ζώνη κάθε μιας. BOQ/render-ready (D5: χωριστή γραμμή ανά ζώνη+όροφο).
 */
export function filterExposedSlabs<T extends SlabForZoneClassification>(
  slabs: readonly T[],
  floors: readonly StoreyRef[],
): Array<{ slab: T; zone: 'Z2' | 'Z3' }> {
  const result: Array<{ slab: T; zone: 'Z2' | 'Z3' }> = [];
  for (const slab of slabs) {
    const zone = classifyExposedSlab(slab, floors);
    if (zone !== null) result.push({ slab, zone });
  }
  return result;
}
