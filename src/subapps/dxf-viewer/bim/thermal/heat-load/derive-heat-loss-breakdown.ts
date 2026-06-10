/**
 * ADR-422 L1.8 — Read-model ανάλυσης/itemization θερμικών απωλειών ανά χώρο (PURE SSoT).
 *
 * **Aggregator, ΟΧΙ recompute** (mirror L6 `derive-envelope-compliance`): ΔΕΝ ξανατρέχει
 * τον engine/resolver ούτε αγγίζει geometry — διαβάζει τα ήδη-υπολογισμένα
 * `SpaceHeatLoadResult` και **αποσυνθέτει** το `totalW` κάθε χώρου στα φυσικά του σκέλη
 * (Revit Energy «Heating Load Breakdown» / 4M-FineHEAT πίνακας απωλειών μελέτης):
 *
 *   - **fabric ανά τύπο στοιχείου** `Σ_{b.kind==kind} b.lossW` (από `boundaries`, ΗΔΗ resolved)
 *   - **διείσδυση** `infiltrationW` ↔ **σχεδιασμένος αερισμός** `designedVentilationW` (split L1.7)
 *   - **επανέναρξη** `reheatW`
 *
 * ⚠️ Το `ventilationW = max(infiltrationW, designedVentilationW)` (EN 12831-1 §6.3.3) — ΟΧΙ
 * άθροισμα. Στο σύνολο (`totalW`) προσμετράται ΜΟΝΟ το κυρίαρχο σκέλος· τα 2 σκέλη
 * εμφανίζονται πληροφοριακά. Έτσι ισχύει το invariant:
 *
 *   Σ(fabricByKind) + ventilationW + reheatW === totalW
 *
 * (διότι `Σ(fabricByKind) === transmissionW` by construction). Καθαρή αριθμητική — μηδέν
 * persist, idempotent, full unit-testable. ΜΟΝΑΔΕΣ: όλα W.
 *
 * @see ./heat-load-types (SpaceHeatLoadResult — πηγή) · ./derive-envelope-compliance (πρότυπο L6)
 * @see ../report/thermal-study-report (buildLossBreakdownSection — consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1.8)
 */

import { compareStrings } from '@/lib/array-utils';
import type { HeatLoadBoundaryKind, SpaceHeatLoadResult } from './heat-load-types';

/** Αθροιστικά W ανά τύπο δομικού στοιχείου (όσοι kind εμφανίζονται στον χώρο). */
export type FabricLossByKind = Readonly<Partial<Record<HeatLoadBoundaryKind, number>>>;

/** Αριθμητική αποσύνθεση απωλειών (κοινό σχήμα per-space row + building totals). */
export interface HeatLossBreakdownTotals {
  /** W ανά τύπο στοιχείου (τοίχος/κούφωμα/πόρτα/δάπεδο/στέγη/οροφή). */
  readonly fabricByKind: FabricLossByKind;
  /** W — άθροισμα fabric (= `transmissionW`, περιλαμβάνει θερμογέφυρες). */
  readonly fabricTotalW: number;
  /** W — σκέλος διείσδυσης (πληροφοριακό· δες κανόνα `max`). */
  readonly infiltrationW: number;
  /** W — σκέλος σχεδιασμένου αερισμού (πληροφοριακό· δες κανόνα `max`). */
  readonly designedVentilationW: number;
  /** W — αερισμός που μπαίνει στο σύνολο = `max(infiltrationW, designedVentilationW)`. */
  readonly ventilationW: number;
  /** W — φορτίο επανέναρξης Φ_RH. */
  readonly reheatW: number;
  /** W — συνολικό φορτίο `Φ` (= fabric + ventilation + reheat). */
  readonly totalW: number;
}

/** Μία γραμμή ανάλυσης απωλειών ενός χώρου. */
export interface HeatLossBreakdownRow extends HeatLossBreakdownTotals {
  readonly spaceId: string;
}

/** Συγκεντρωτική ανάλυση απωλειών ορόφου: per-space γραμμές + σύνοψη κτιρίου. */
export interface HeatLossBreakdownResult {
  readonly rows: readonly HeatLossBreakdownRow[];
  /** Άθροισμα όλων των χώρων (building-level σύνολο ανά σκέλος). */
  readonly totals: HeatLossBreakdownTotals;
}

/** Ομαδοποίηση `boundaries[].lossW` ανά `kind` (αθροιστικά). */
function groupFabricByKind(result: SpaceHeatLoadResult): FabricLossByKind {
  const byKind: Partial<Record<HeatLoadBoundaryKind, number>> = {};
  for (const b of result.boundaries) {
    byKind[b.kind] = (byKind[b.kind] ?? 0) + b.lossW;
  }
  return byKind;
}

/** Αποσύνθεση ενός χώρου σε σκέλη (fabric-by-kind + ventilation split + reheat). */
function breakdownOf(result: SpaceHeatLoadResult): HeatLossBreakdownRow {
  const fabricByKind = groupFabricByKind(result);
  const fabricTotalW = Object.values(fabricByKind).reduce((sum, w) => sum + w, 0);
  return {
    spaceId: result.spaceId,
    fabricByKind,
    fabricTotalW,
    infiltrationW: result.infiltrationW,
    designedVentilationW: result.designedVentilationW,
    ventilationW: result.ventilationW,
    reheatW: result.reheatW,
    totalW: result.totalW,
  };
}

/** Συσσώρευση μιας γραμμής στο τρέχον building-level σύνολο (mutating accumulator). */
function accumulate(acc: {
  fabricByKind: Partial<Record<HeatLoadBoundaryKind, number>>;
  fabricTotalW: number;
  infiltrationW: number;
  designedVentilationW: number;
  ventilationW: number;
  reheatW: number;
  totalW: number;
}, row: HeatLossBreakdownRow): void {
  for (const [kind, w] of Object.entries(row.fabricByKind) as [HeatLoadBoundaryKind, number][]) {
    acc.fabricByKind[kind] = (acc.fabricByKind[kind] ?? 0) + w;
  }
  acc.fabricTotalW += row.fabricTotalW;
  acc.infiltrationW += row.infiltrationW;
  acc.designedVentilationW += row.designedVentilationW;
  acc.ventilationW += row.ventilationW;
  acc.reheatW += row.reheatW;
  acc.totalW += row.totalW;
}

/**
 * Αναλύει τις απώλειες ΟΛΩΝ των χώρων του ορόφου σε σκέλη + παράγει σύνοψη κτιρίου.
 * Idempotent — διαβάζει μόνο τα `SpaceHeatLoadResult`, μηδέν side effects.
 */
export function deriveHeatLossBreakdown(
  results: ReadonlyMap<string, SpaceHeatLoadResult>,
): HeatLossBreakdownResult {
  const rows: HeatLossBreakdownRow[] = [];
  const acc = {
    fabricByKind: {} as Partial<Record<HeatLoadBoundaryKind, number>>,
    fabricTotalW: 0,
    infiltrationW: 0,
    designedVentilationW: 0,
    ventilationW: 0,
    reheatW: 0,
    totalW: 0,
  };

  for (const spaceId of [...results.keys()].sort(compareStrings)) {
    const result = results.get(spaceId);
    if (!result) continue;
    const row = breakdownOf(result);
    rows.push(row);
    accumulate(acc, row);
  }

  return { rows, totals: { ...acc, fabricByKind: acc.fabricByKind } };
}
