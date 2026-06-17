/**
 * Tributary load takedown — pure SSoT (ADR-464, Slice 4).
 *
 * FEM-free «load takedown» (Revit-without-Robot): παράγει το **DERIVED** χαρακτηριστικό
 * φορτίο μιας κολώνας/πεδίλου από καθαρά γεωμετρία + building-level area loads, χωρίς
 * ανάλυση πλαισίου:
 *
 *   N = (επιφάνεια ευθύνης κολόνας) × (πλήθος ορόφων από πάνω) × (G_area + Q_area)
 *       + ίδιο βάρος κατακόρυφου μέλους (κολόνες)
 *
 * **Επιφάνεια ευθύνης (tributary area)** = grid half-spacing ανά άξονα (Revit-grade):
 * το ορθογώνιο ευθύνης μιας κολώνας έχει πλευρές = μισή απόσταση προς τις γειτονικές
 * κολώνες ανά διεύθυνση (X, Y). Ακραίες/γωνιακές κολώνες παίρνουν half-bay **μόνο** προς
 * την εσωτερική (υπαρκτή) πλευρά — η εξωτερική (slab edge) δίνει 0 (ADR-474: καμία mirror
 * → η γωνιακή παίρνει το πραγματικό ¼, όχι ολόκληρο φάτνωμα). Μεμονωμένος άξονας (κανένας
 * γείτονας) → `DEFAULT_BAY_SPAN_M`. Slab overhang/πρόβολος + ακανόνιστη Voronoi = DEFER.
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: μήκη m, area loads kPa (=kN/m²), φορτία kN.
 *
 * @see ./structural-loads-types.ts — MemberLoad / AppliedMemberLoad
 * @see ../structural-settings.ts — deadAreaLoadKpa / liveAreaLoadKpa (building-level)
 * @see docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md
 */

import type { AppliedMemberLoad, MemberLoad } from './structural-loads-types';

/** m — ανοχή συγχώνευσης σχεδόν-ίδιων θέσεων κολονών σε ΕΝΑ άξονα κανάβου (50 mm). */
const POSITION_SNAP_M = 0.05;

/** m — τυπικό άνοιγμα φατνώματος όταν λείπει γείτονας κολώνας σε έναν άξονα. */
export const DEFAULT_BAY_SPAN_M = 5;

/** Κολώνα ως σημείο για το tributary (κέντρο διατομής σε m). */
export interface TributaryColumn {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
}

/** Sorted μοναδικές θέσεις αξόνων (snapped) από τα κέντρα κολονών. */
function gridLines(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > POSITION_SNAP_M) out.push(v);
  }
  return out;
}

/**
 * Tributary πλάτος (m) γύρω από θέση `p` μέσα στους άξονες `lines` — **Revit-grade**:
 * half-spacing ΜΟΝΟ προς υπαρκτό γείτονα ανά πλευρά· **καμία mirror** στην περίμετρο.
 * Η εξωτερική πλευρά μιας ακραίας/γωνιακής κολώνας ΔΕΝ φέρει πλάκα (slab edge πάνω στον
 * άξονα) → συνεισφορά 0. Έτσι η γωνιακή κολώνα ενός φατνώματος παίρνει το πραγματικό ¼,
 * ΟΧΙ ολόκληρο (ADR-474 — πρώην mirror υπερεκτιμούσε 2× ανά ακραίο άξονα). Όταν δεν
 * υπάρχει γείτονας σε ΚΑΜΙΑ πλευρά (μεμονωμένος άξονας) → `DEFAULT_BAY_SPAN_M` (παραδοχή
 * τυπικού φατνώματος, αφού λείπει γεωμετρία κανάβου). Slab overhang/πρόβολος = DEFER.
 */
function tributaryWidth(p: number, lines: readonly number[]): number {
  if (lines.length === 0) return DEFAULT_BAY_SPAN_M;
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const d = Math.abs(lines[i] - p);
    if (d < best) { best = d; idx = i; }
  }
  const prev = idx > 0 ? lines[idx - 1] : null;
  const next = idx < lines.length - 1 ? lines[idx + 1] : null;
  // Half-bay προς κάθε ΥΠΑΡΚΤΟ γείτονα· ακραία πλευρά (null) → 0 (καμία mirror).
  const halfRight = next != null ? (next - lines[idx]) / 2 : 0;
  const halfLeft = prev != null ? (lines[idx] - prev) / 2 : 0;
  const width = halfLeft + halfRight;
  // Μεμονωμένος σε αυτόν τον άξονα (κανένας γείτονας εκατέρωθεν) → τυπικό φάτνωμα.
  return width > 0 ? width : DEFAULT_BAY_SPAN_M;
}

/**
 * Επιφάνεια ευθύνης (m²) ανά κολώνα μέσω grid half-spacing. ΕΝΑ pass: άξονες X/Y
 * από όλα τα κέντρα, μετά γινόμενο των tributary πλατών ανά κολώνα.
 */
export function computeGridTributaryAreas(
  columns: readonly TributaryColumn[],
): Map<string, number> {
  const xLines = gridLines(columns.map((c) => c.xM));
  const yLines = gridLines(columns.map((c) => c.yM));
  const out = new Map<string, number>();
  for (const c of columns) {
    const wx = tributaryWidth(c.xM, xLines);
    const wy = tributaryWidth(c.yM, yLines);
    out.set(c.id, Math.max(0, wx) * Math.max(0, wy));
  }
  return out;
}

/** Building-level παράμετροι takedown (storey count + area loads G/Q). */
export interface TakedownSettings {
  readonly storeyCount: number;
  readonly deadAreaLoadKpa: number;
  readonly liveAreaLoadKpa: number;
}

/** Χαρακτηριστικές συνιστώσες (G/Q) μιας επιφορτιζόμενης επιφάνειας. */
export interface AreaLoadResultant {
  readonly deadAxialKn: number;
  readonly liveAxialKn: number;
}

/**
 * ΕΝΑ SSoT μετατροπής (επιφάνεια × όροφοι × area load) → αξονικά G/Q (kN). Το
 * μοιράζονται ο per-column takedown (επιφάνεια ευθύνης) ΚΑΙ ο raft bearing (Slice 5,
 * επιφάνεια εδαφόπλακας) — μηδέν διπλότυπο (N.0.2). Αρνητικά/μη-πεπερασμένα → 0.
 */
export function areaLoadResultant(
  areaM2: number,
  storeyCount: number,
  deadAreaLoadKpa: number,
  liveAreaLoadKpa: number,
): AreaLoadResultant {
  const a = Number.isFinite(areaM2) && areaM2 > 0 ? areaM2 : 0;
  const n = Number.isFinite(storeyCount) && storeyCount > 0 ? Math.floor(storeyCount) : 0;
  const g = Number.isFinite(deadAreaLoadKpa) && deadAreaLoadKpa > 0 ? deadAreaLoadKpa : 0;
  const q = Number.isFinite(liveAreaLoadKpa) && liveAreaLoadKpa > 0 ? liveAreaLoadKpa : 0;
  return { deadAxialKn: a * n * g, liveAxialKn: a * n * q };
}

/** Είσοδος takedown μέλους — γεωμετρία ευθύνης + building area loads + ίδιο βάρος. */
export interface MemberTakedownInput {
  readonly tributaryAreaM2: number;
  readonly storeyCount: number;
  readonly deadAreaLoadKpa: number;
  readonly liveAreaLoadKpa: number;
  /** Πρόσθετο μόνιμο ίδιο βάρος (kN) κατακόρυφου μέλους (στοιβαγμένες κολόνες). */
  readonly extraDeadAxialKn?: number;
}

/**
 * Tributary takedown → `MemberLoad` (`source: 'takedown'`, κεντρικό — μηδέν ροπές).
 * Η εκκεντρότητα από ασύμμετρη ευθύνη/πλαισιακή λειτουργία = DEFER (FEM phase).
 */
export function computeMemberTakedown(input: MemberTakedownInput): MemberLoad {
  const r = areaLoadResultant(
    input.tributaryAreaM2, input.storeyCount, input.deadAreaLoadKpa, input.liveAreaLoadKpa,
  );
  const extra = Number.isFinite(input.extraDeadAxialKn) && (input.extraDeadAxialKn ?? 0) > 0
    ? (input.extraDeadAxialKn as number) : 0;
  return {
    deadAxialKn: r.deadAxialKn + extra,
    liveAxialKn: r.liveAxialKn,
    deadMomentXKnm: 0,
    liveMomentXKnm: 0,
    deadMomentYKnm: 0,
    liveMomentYKnm: 0,
    source: 'takedown',
  };
}

/**
 * `MemberLoad` (takedown) → persisted `AppliedMemberLoad`. Κρατά μόνο τα αξονικά G/Q
 * + την προέλευση· οι μηδενικές ροπές **παραλείπονται** (concentric takedown,
 * Firestore-safe — μηδέν explicit `undefined`, ADR-390 Φ4).
 */
export function toAppliedTakedownLoad(load: MemberLoad): AppliedMemberLoad {
  return {
    deadAxialKn: load.deadAxialKn,
    liveAxialKn: load.liveAxialKn,
    source: 'takedown',
  };
}
