/**
 * ADR-422 L6 — Read-model ελέγχου συμμόρφωσης κελύφους ΚΕΝΑΚ (PURE SSoT).
 *
 * **Aggregator, ΟΧΙ recompute** (mirror L5 report): ΔΕΝ ξανατρέχει τον resolver ούτε
 * αγγίζει geometry — διαβάζει τα ήδη-υπολογισμένα `SpaceHeatLoadResult.boundaries`
 * (που φέρουν το **βασικό U** + `condition` + `kind` ανά οριακή επιφάνεια) και τα
 * συγκρίνει με το ΚΕΝΑΚ `U_max` της ζώνης (`kenak-envelope-limits`). Ελέγχονται ΜΟΝΟ
 * τα στοιχεία εξωτ. κελύφους (`getKenakMaxU` επιστρέφει `null` αλλιώς → skip).
 *
 * ⚠️ ADVISORY — soft (όπως όλο το ΚΕΝΑΚ pipeline)· ο consumer (report) απλώς το
 * εμφανίζει. Μηδέν persist, idempotent, full unit-testable. ΜΟΝΑΔΕΣ: U/U_max W/m²K.
 *
 * @see ./kenak-envelope-limits (πίνακας ορίων + gate) · ./heat-load-types
 * @see ../report/thermal-study-report (buildComplianceSection — consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L6)
 */

import { compareStrings } from '@/lib/array-utils';
import type { ClimateZone } from '../kenak-thermal-config';
import { getKenakMaxU, isAboveKenakBoundaryUMax } from './kenak-envelope-limits';
import type {
  BoundaryCondition,
  HeatLoadBoundaryKind,
  SpaceHeatLoadResult,
} from './heat-load-types';

/** Μία γραμμή ελέγχου: ένα στοιχείο εξωτ. κελύφους ενός χώρου έναντι ΚΕΝΑΚ. */
export interface EnvelopeComplianceRow {
  readonly spaceId: string;
  readonly kind: HeatLoadBoundaryKind;
  readonly condition: BoundaryCondition;
  /** W/m²K — βασικό U του στοιχείου (χωρίς προσαύξηση θερμογέφυρας). */
  readonly uValue: number;
  /** W/m²K — ΚΕΝΑΚ ανώτατο όριο της ζώνης για το στοιχείο. */
  readonly uMax: number;
  /** true ⇒ U ≤ U_max (συμμορφούμενο). */
  readonly compliant: boolean;
  readonly refId?: string;
}

/** Συγκεντρωτικός έλεγχος κελύφους ορόφου: γραμμές + σύνοψη πλήθους. */
export interface EnvelopeComplianceResult {
  readonly rows: readonly EnvelopeComplianceRow[];
  /** Πλήθος στοιχείων που ελέγχθηκαν (εξωτ. κέλυφος). */
  readonly checkedCount: number;
  /** Πλήθος συμμορφούμενων (U ≤ U_max). */
  readonly compliantCount: number;
  /** Η κλιματική ζώνη του ελέγχου (για header/report). */
  readonly zone: ClimateZone;
}

/**
 * Ελέγχει όλες τις οριακές επιφάνειες εξωτ. κελύφους όλων των χώρων του ορόφου
 * έναντι των ΚΕΝΑΚ ορίων `U_max` της ζώνης. Idempotent — μηδέν side effects.
 */
export function deriveEnvelopeCompliance(
  results: ReadonlyMap<string, SpaceHeatLoadResult>,
  zone: ClimateZone,
): EnvelopeComplianceResult {
  const rows: EnvelopeComplianceRow[] = [];
  const spaceIds = [...results.keys()].sort(compareStrings);

  for (const spaceId of spaceIds) {
    const result = results.get(spaceId);
    if (!result) continue;
    for (const b of result.boundaries) {
      const uMax = getKenakMaxU(b.kind, b.condition, zone);
      if (uMax === null) continue; // δεν είναι εξωτ. κέλυφος ΚΕΝΑΚ — skip
      rows.push({
        spaceId,
        kind: b.kind,
        condition: b.condition,
        uValue: b.uValue,
        uMax,
        compliant: !isAboveKenakBoundaryUMax(b.uValue, uMax),
        refId: b.refId,
      });
    }
  }

  const compliantCount = rows.reduce((n, r) => (r.compliant ? n + 1 : n), 0);
  return { rows, checkedCount: rows.length, compliantCount, zone };
}
