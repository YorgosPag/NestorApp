/**
 * ADR-404 Phase 5c — Μονάδα εμφάνισης κλίσης πλάκας (SSoT μετατροπών + pref store).
 *
 * Το `SlabSlope.angle` αποθηκεύεται ΠΑΝΤΑ ως **ποσοστό %** (drainage standard,
 * ADR-369 §9 Q7). Ο χρήστης όμως μπορεί να το διαβάζει/γράφει σε 3 μονάδες
 * (Giorgio: «πλήρης ευελιξία»):
 *
 *   - `percent` — ταυτό με το stored (2 → «2», zero conversion).
 *   - `degrees` — γωνία από οριζόντιο: `deg = atan(pct/100)`, `pct = tan(deg)·100`.
 *   - `ratio`   — λόγος 1:N (αρχιτεκτονικός): N = `100/pct` (input/display = το N).
 *
 * Η επιλεγμένη μονάδα είναι **ribbon display preference** (ΟΧΙ δεδομένο πλάκας,
 * ΟΧΙ tool override) → ζει σε module singleton store με subscribe ώστε το πεδίο
 * «Τιμή» να ξανα-μορφοποιείται όταν αλλάζει η μονάδα (`useSyncExternalStore` στο
 * `useRibbonSlabBridge`). Default `percent`.
 *
 * Όλες οι τιμές εμφάνισης/εισόδου είναι **αριθμητικά strings** (numericInput-safe):
 * για `ratio` εκτίθεται μόνο το N (π.χ. «50» = 1:50) — το «1:» μπαίνει στο label
 * της μονάδας, ΟΧΙ στο combobox value.
 *
 * **SSoT reuse (ADR-417 Q5):** το deg↔percent math ΔΕΝ ξαναγράφεται — delegate στο
 * υπάρχον `roof-slope-units.ts` (`roofSlopeToRatio`/`roofSlopeFromRatio`, pure, dependency-
 * free, ήδη σε χρήση από τον roof bridge) με pivot το **rise/run ratio**. Εδώ ζει ΜΟΝΟ ό,τι
 * δεν έχει η στέγη: η 3η μονάδα «λόγος 1:N» (display/parse) + το display-unit pref store.
 *
 * @see bim/geometry/roof-slope-units.ts — roofSlopeToRatio/roofSlopeFromRatio (deg↔percent SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 5c
 */

import { roofSlopeFromRatio, roofSlopeToRatio } from '../../../../bim/geometry/roof-slope-units';

/** Display/input μονάδα της κλίσης. Stored value = ΠΑΝΤΑ %. */
export type SlabSlopeUnit = 'percent' | 'degrees' | 'ratio';

export const SLAB_SLOPE_UNIT_PERCENT: SlabSlopeUnit = 'percent';
export const SLAB_SLOPE_UNIT_DEGREES: SlabSlopeUnit = 'degrees';
export const SLAB_SLOPE_UNIT_RATIO: SlabSlopeUnit = 'ratio';

const VALID_UNITS: ReadonlySet<string> = new Set<string>([
  SLAB_SLOPE_UNIT_PERCENT,
  SLAB_SLOPE_UNIT_DEGREES,
  SLAB_SLOPE_UNIT_RATIO,
]);

export function isSlabSlopeUnit(value: string): value is SlabSlopeUnit {
  return VALID_UNITS.has(value);
}

/** Στρογγυλοποίηση σε k δεκαδικά χωρίς trailing μηδενικά («2.00»→«2», «1.15»→«1.15»). */
function trimNumber(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

/**
 * Stored % → numeric display string στη `unit`. `pct ≤ 0` → «0» (flat). Pivot = rise/run
 * ratio μέσω του roof SSoT (deg↔percent)· μόνο το «1:N» (ratio) ζει εδώ.
 */
export function slopePercentToDisplay(pct: number, unit: SlabSlopeUnit): string {
  if (!(pct > 0)) return '0';
  const riseRun = roofSlopeToRatio(pct, 'percent'); // pct/100
  switch (unit) {
    case 'degrees':
      return trimNumber(roofSlopeFromRatio(riseRun, 'deg'), 2);
    case 'ratio':
      return String(Math.round(1 / riseRun)); // N στο 1:N
    case 'percent':
    default:
      return trimNumber(pct, 2);
  }
}

/**
 * Numeric display string στη `unit` → stored %. Επιστρέφει `null` σε άκυρο/μη-θετικό
 * (ο caller το ερμηνεύει ως «flat / off»). Για `ratio` το input είναι το N (1:N).
 * deg↔percent μέσω του roof SSoT (μηδέν re-implement tan/atan).
 */
export function slopeDisplayToPercent(value: string, unit: SlabSlopeUnit): number | null {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  switch (unit) {
    case 'degrees':
      return roofSlopeFromRatio(roofSlopeToRatio(n, 'deg'), 'percent'); // tan(n°)·100
    case 'ratio':
      return roofSlopeFromRatio(1 / n, 'percent'); // (1/N)·100
    case 'percent':
    default:
      return n;
  }
}

// ─── Display-unit preference store (module singleton, subscribable) ───────────

type Listener = () => void;

let currentUnit: SlabSlopeUnit = SLAB_SLOPE_UNIT_PERCENT;
const listeners = new Set<Listener>();

export const slabSlopeUnitStore = {
  get(): SlabSlopeUnit {
    return currentUnit;
  },
  set(unit: SlabSlopeUnit): void {
    if (unit === currentUnit) return;
    currentUnit = unit;
    for (const l of listeners) l();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
