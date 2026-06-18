/**
 * Analytical load-cases & combinations — SSoT (ADR-480, T2).
 *
 * Ταξινομία δράσεων (G/Q/E) + μητρώο συνδυασμών σχεδιασμού **χτισμένο ΠΑΝΩ** στο
 * `load-combinations.ts` (EN1990) — μηδέν διπλότυπο συντελεστή (N.0.2). Το T2
 * παρέχει τον θεμελιώδη ULS (1.35G+1.50Q) και τον χαρακτηριστικό SLS (G+Q).
 *
 * **Extensibility hook (T4):** οι σεισμικοί συνδυασμοί (`G + ψ2·Q ± E`, Newmark
 * ±1.0/±0.3) προστίθενται μέσω ενός `SeismicCombinationProvider` που περνά στο
 * {@link buildLoadCombinations} — **χωρίς αναδόμηση** αυτού του module. Το T2 ΔΕΝ
 * υλοποιεί σεισμό· απλώς αφήνει την υποδοχή ανοιχτή (registry-by-composition).
 *
 * Pure — zero React/DOM/Firestore. i18n keys μόνο (N.11), ποτέ μεταφρασμένα strings.
 *
 * @see ../loads/load-combinations.ts — EN1990 ULS/SLS συντελεστές & combiners
 * @see ../loads/structural-loads-types.ts — MemberLoad / CombinedLoad
 * @see docs/centralized-systems/reference/adrs/ADR-480-analytical-model-ssot.md
 */

import type { CombinedLoad, MemberLoad } from '../loads/structural-loads-types';
import {
  EN1990_ULS_FACTORS,
  combineSls,
  combineUls,
  type LoadCombinationFactors,
} from '../loads/load-combinations';

/** Είδος δράσης (EN1990). `seismic` = υποδοχή για T4 (δεν παράγεται εδώ). */
export type LoadCaseKind = 'permanent' | 'variable' | 'seismic';

/** Μια δράση — ταυτότητα + i18n label. */
export interface LoadCase {
  readonly id: string;
  readonly kind: LoadCaseKind;
  readonly labelKey: string;
}

/** i18n prefix (ns `dxf-viewer-shell`). */
const MSG = 'analyticalModel';

/** Μόνιμη δράση G (ίδιο βάρος + μόνιμα φορτία). */
export const PERMANENT_CASE: LoadCase = { id: 'G', kind: 'permanent', labelKey: `${MSG}.loadCases.permanent` };
/** Μεταβλητή δράση Q (ωφέλιμα). */
export const VARIABLE_CASE: LoadCase = { id: 'Q', kind: 'variable', labelKey: `${MSG}.loadCases.variable` };

/** Οι δράσεις που μοντελοποιεί το T2 (η σεισμική E προστίθεται στο T4). */
export const ANALYTICAL_LOAD_CASES: readonly LoadCase[] = [PERMANENT_CASE, VARIABLE_CASE];

/** Κατάσταση συνδυασμού. */
export type CombinationKind = 'uls' | 'sls' | 'seismic';

/**
 * Ένας συνδυασμός σχεδιασμού: μετασχηματίζει το χαρακτηριστικό `MemberLoad` σε
 * φορτίο σχεδιασμού `CombinedLoad`. `combine` = pure (testable με synthetic load).
 */
export interface LoadCombination {
  readonly id: string;
  readonly kind: CombinationKind;
  readonly labelKey: string;
  readonly combine: (load: MemberLoad) => CombinedLoad;
}

/** Πάροχος σεισμικών συνδυασμών (T4) — αδειανός στο T2. */
export type SeismicCombinationProvider = () => readonly LoadCombination[];

/**
 * Οι τυπικοί συνδυασμοί EN1990: θεμελιώδης ULS (εξ. 6.10) + χαρακτηριστικός SLS.
 * Οι συντελεστές παρέχονται (default EN1990) ώστε άλλος κανονισμός να διαφέρει
 * χωρίς διπλότυπο.
 */
export function buildStandardCombinations(
  factors: LoadCombinationFactors = EN1990_ULS_FACTORS,
): LoadCombination[] {
  return [
    { id: 'ULS-6.10', kind: 'uls', labelKey: `${MSG}.combinations.ulsFundamental`, combine: (l) => combineUls(l, factors) },
    { id: 'SLS-char', kind: 'sls', labelKey: `${MSG}.combinations.slsCharacteristic`, combine: combineSls },
  ];
}

/**
 * Το πλήρες μητρώο συνδυασμών: τυπικοί EN1990 + (προαιρετικά) σεισμικοί από τον
 * `seismic` provider (T4). Composition-by-concatenation → επεκτάσιμο χωρίς
 * αναδόμηση. Το T2 καλείται χωρίς `seismic` → μόνο ULS/SLS.
 */
export function buildLoadCombinations(opts?: {
  readonly factors?: LoadCombinationFactors;
  readonly seismic?: SeismicCombinationProvider;
}): LoadCombination[] {
  const standard = buildStandardCombinations(opts?.factors);
  const seismic = opts?.seismic ? [...opts.seismic()] : [];
  return [...standard, ...seismic];
}
