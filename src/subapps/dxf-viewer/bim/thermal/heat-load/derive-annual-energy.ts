/**
 * ADR-422 L7 — Read-model ετήσιας ενεργειακής ζήτησης θέρμανσης (PURE SSoT).
 *
 * **Aggregator, ΟΧΙ recompute** (mirror L6 `deriveEnvelopeCompliance`): ΔΕΝ ξανατρέχει
 * τον heat-load resolver/engine ούτε αγγίζει geometry — διαβάζει τα ήδη-υπολογισμένα
 * `SpaceHeatLoadResult` (L1) + το cached `space.geometry.area` και εφαρμόζει τη **μέθοδο
 * βαθμοημερών** (ΤΟΤΕΕ 20701-3) ανά χώρο:
 *
 *   - Συντ. απωλειών `H = (transmissionW + ventilationW) / deltaTC` **[W/K]**.
 *     ⚠️ Το `transmissionW` ήδη περιλαμβάνει θερμογέφυρες (L1.5)· το `reheatW`
 *     **ΕΞΑΙΡΕΙΤΑΙ** (εφάπαξ προθέρμανση, όχι συνεχής απώλεια).
 *   - Ετήσια ζήτηση `Q_H = H · HDD · 24 / 1000` **[kWh/έτος]** — οι βαθμοημέρες
 *     ολοκληρώνουν ΔΤ επί την περίοδο → **ΔΕΝ** χρησιμοποιείται το ΔΤ σχεδιασμού.
 *   - Εσωτερικά/ηλιακά κέρδη συντηρητικά αμελούνται v1 (ζήτηση = άνω όριο).
 *   - Σύνολα: `Q_total = ΣQ_H`, `A_total = ΣA`, ειδική `q_H = Q_total / A_total` → κατηγορία.
 *
 * ⚠️ ENDEIKTIKO / advisory (όπως όλο το ΚΕΝΑΚ pipeline)· ο consumer (report) απλώς το
 * εμφανίζει. Μηδέν persist, idempotent, full unit-testable. ΜΟΝΑΔΕΣ: H W/K· Q kWh· A m².
 *
 * @see ./annual-energy-config (HDD table + class bands + getters)
 * @see ./heat-load-types (SpaceHeatLoadResult — πηγή απωλειών)
 * @see ../report/thermal-study-report (buildAnnualEnergySection — consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7)
 */

import { compareStrings } from '@/lib/array-utils';
import type { ClimateZone } from '../kenak-thermal-config';
import type { ThermalSpaceEntity } from '../../types/thermal-space-types';
import { classifyEnergyDemand, getHeatingDegreeDays } from './annual-energy-config';
import type { SpaceHeatLoadResult } from './heat-load-types';

const HOURS_PER_DAY = 24;
const W_TO_KW = 1000;

/** Μία γραμμή ετήσιας ζήτησης — ένας θερμικός χώρος. */
export interface AnnualEnergyRow {
  readonly spaceId: string;
  /** W/K — συντ. θερμικών απωλειών `H = (αγωγή + αερισμός) / ΔΤ` (χωρίς reheat). */
  readonly lossCoefficientWperK: number;
  /** m² — θερμαινόμενο εμβαδό (cached `space.geometry.area`). */
  readonly floorAreaM2: number;
  /** kWh/έτος — ετήσια ζήτηση `Q_H = H · HDD · 24 / 1000`. */
  readonly annualDemandKWh: number;
  /** kWh/m²·έτος — ειδική ετήσια ζήτηση `Q_H / A`. */
  readonly specificDemandKWhM2: number;
}

/** Συγκεντρωτική ετήσια ζήτηση ορόφου: γραμμές + σύνολα + ενδεικτική κατηγορία. */
export interface AnnualHeatingResult {
  readonly rows: readonly AnnualEnergyRow[];
  /** kWh/έτος — άθροισμα ζήτησης όλων των χώρων. */
  readonly totalAnnualKWh: number;
  /** m² — άθροισμα θερμαινόμενου εμβαδού. */
  readonly totalAreaM2: number;
  /** kWh/m²·έτος — συνολική ειδική ζήτηση `Q_total / A_total` (0 αν A_total=0). */
  readonly specificDemandKWhM2: number;
  /** Ενδεικτική ετικέτα κατηγορίας ζήτησης (A+ … H). */
  readonly energyClass: string;
  /** K·ημέρα — βαθμοημέρες θέρμανσης της ζώνης που εφαρμόστηκαν. */
  readonly hdd: number;
  /** Η κλιματική ζώνη του υπολογισμού (για header/report). */
  readonly zone: ClimateZone;
}

/** `H = (αγωγή + αερισμός) / ΔΤ` [W/K]· το reheat εξαιρείται. 0 αν ΔΤ≤0. */
function lossCoefficient(result: SpaceHeatLoadResult): number {
  if (!(result.deltaTC > 0)) return 0;
  return (result.transmissionW + result.ventilationW) / result.deltaTC;
}

/**
 * Υπολογίζει την ετήσια ζήτηση θέρμανσης (μέθοδος βαθμοημερών) όλων των χώρων του
 * ορόφου από τα L1 results + το cached εμβαδό κάθε χώρου. Χώροι χωρίς result ή με
 * μη-θετικό εμβαδό παραλείπονται. Idempotent — μηδέν side effects.
 */
export function deriveAnnualHeating(
  results: ReadonlyMap<string, SpaceHeatLoadResult>,
  spaces: readonly ThermalSpaceEntity[],
  zone: ClimateZone,
): AnnualHeatingResult {
  const hdd = getHeatingDegreeDays(zone);
  const rows: AnnualEnergyRow[] = [];
  const ordered = [...spaces].sort((a, b) => compareStrings(a.id, b.id));

  for (const space of ordered) {
    const result = results.get(space.id);
    if (!result) continue;
    const floorAreaM2 = space.geometry.area;
    if (!(floorAreaM2 > 0)) continue; // guard: χωρίς εμβαδό → χωρίς ειδική ζήτηση
    const lossCoefficientWperK = lossCoefficient(result);
    const annualDemandKWh = (lossCoefficientWperK * hdd * HOURS_PER_DAY) / W_TO_KW;
    rows.push({
      spaceId: space.id,
      lossCoefficientWperK,
      floorAreaM2,
      annualDemandKWh,
      specificDemandKWhM2: annualDemandKWh / floorAreaM2,
    });
  }

  const totalAnnualKWh = rows.reduce((sum, r) => sum + r.annualDemandKWh, 0);
  const totalAreaM2 = rows.reduce((sum, r) => sum + r.floorAreaM2, 0);
  const specificDemandKWhM2 = totalAreaM2 > 0 ? totalAnnualKWh / totalAreaM2 : 0;

  return {
    rows,
    totalAnnualKWh,
    totalAreaM2,
    specificDemandKWhM2,
    energyClass: classifyEnergyDemand(specificDemandKWhM2),
    hdd,
    zone,
  };
}
