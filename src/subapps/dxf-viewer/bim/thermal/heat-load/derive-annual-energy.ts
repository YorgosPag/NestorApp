/**
 * ADR-422 L7/L7.1 — Read-model ετήσιας ενεργειακής ζήτησης θέρμανσης (PURE SSoT).
 *
 * **Aggregator, ΟΧΙ recompute** (mirror L6 `deriveEnvelopeCompliance`): ΔΕΝ ξανατρέχει
 * τον heat-load resolver/engine ούτε αγγίζει geometry — διαβάζει τα ήδη-υπολογισμένα
 * `SpaceHeatLoadResult` (L1) + το cached `space.geometry.area` και εφαρμόζει ανά χώρο:
 *
 *   - **L7 (μεικτή / gross):** συντ. απωλειών `H = (transmissionW + ventilationW) / deltaTC`
 *     **[W/K]** (το `transmissionW` ήδη περιλαμβάνει θερμογέφυρες L1.5· το `reheatW`
 *     **ΕΞΑΙΡΕΙΤΑΙ**) → μεικτή ζήτηση `Q_loss = H · HDD · 24 / 1000` **[kWh/έτος]** (μέθοδος
 *     βαθμοημερών ΤΟΤΕΕ 20701-3· κέρδη αμελημένα ⇒ συντηρητικό άνω όριο).
 *   - **L7.1 (καθαρή / net):** αφαιρεί τα **αξιοποιήσιμα** κέρδη (EN ISO 13790 §12.2):
 *     `Q_int = q_int(use) · A · hours_season / 1000` (εσωτερικά)·
 *     `Q_sol = Σ_win A_win · g · F_F · F_sh · I_season(zone)` (ηλιακά, από τους εξωτ.
 *     υαλοπίνακες του breakdown)· `γ = (Q_int + Q_sol) / Q_loss`·
 *     `η_gn = computeGainUtilisation(γ)` → **καθαρή** `Q_net = max(0, Q_loss − η·(Q_int+Q_sol))`.
 *   - Σύνολα: `Q_net_total = ΣQ_net`, `A_total = ΣA`, ειδική **καθαρή** `q_H = Q_net_total /
 *     A_total` → ενδεικτική κατηγορία. Η μεικτή (`gross`) μένει ορατή ως breakdown (Revit).
 *
 * ⚠️ ENDEIKTIKO / advisory (όπως όλο το ΚΕΝΑΚ pipeline)· ο consumer (report) απλώς το
 * εμφανίζει. Μηδέν persist, idempotent, full unit-testable. ΜΟΝΑΔΕΣ: H W/K· Q kWh· A m²·
 * `utilisation` ∈ [0,1] (το ×100 για % γίνεται στο report).
 *
 * @see ./annual-energy-config (HDD table + class bands — μεικτή πλευρά)
 * @see ./annual-gains-config (εσωτερικά/ηλιακά κέρδη + computeGainUtilisation — καθαρή πλευρά)
 * @see ./heat-load-types (SpaceHeatLoadResult — πηγή απωλειών + boundaries)
 * @see ../report/thermal-study-report (buildAnnualEnergySection — consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L7/L7.1)
 */

import { compareStrings } from '@/lib/array-utils';
import type { ClimateZone } from '../kenak-thermal-config';
import type { ThermalSpaceEntity, ThermalSpaceUseType } from '../../types/thermal-space-types';
import { classifyEnergyDemand, getHeatingDegreeDays } from './annual-energy-config';
import {
  FRAME_FACTOR,
  GLAZING_SOLAR_FACTOR_G,
  SHADING_FACTOR,
  azimuthToOrientation,
  computeGainUtilisation,
  getHeatingSeasonHours,
  getInternalGainWperM2,
  getSeasonalSolarIrradiation,
  getSolarShadingObstructionFactor,
} from './annual-gains-config';
import { resolveSolarShadingLevel } from '../thermal-space-use-catalog';
import type { SpaceHeatLoadResult } from './heat-load-types';

const HOURS_PER_DAY = 24;
const W_TO_KW = 1000;

/** Μία γραμμή ετήσιας ζήτησης — ένας θερμικός χώρος (μεικτή + κέρδη + καθαρή). */
export interface AnnualEnergyRow {
  readonly spaceId: string;
  /** W/K — συντ. θερμικών απωλειών `H = (αγωγή + αερισμός) / ΔΤ` (χωρίς reheat). */
  readonly lossCoefficientWperK: number;
  /** m² — θερμαινόμενο εμβαδό (cached `space.geometry.area`). */
  readonly floorAreaM2: number;
  /** kWh/έτος — **μεικτή** ζήτηση `Q_loss = H · HDD · 24 / 1000` (L7, κέρδη αμελημένα). */
  readonly grossDemandKWh: number;
  /** kWh/έτος — εσωτερικά κέρδη `q_int(use) · A · hours_season / 1000`. */
  readonly internalGainKWh: number;
  /** kWh/έτος — ηλιακά κέρδη `Σ_win A · g · F_F · F_sh · I_season`. */
  readonly solarGainKWh: number;
  /** Συντελεστής αξιοποίησης κερδών `η_gn` ∈ [0,1] (EN ISO 13790). */
  readonly utilisation: number;
  /** kWh/έτος — **καθαρή** ζήτηση `max(0, Q_loss − η·(Q_int+Q_sol))`. */
  readonly netDemandKWh: number;
  /** kWh/έτος — headline ζήτηση = **καθαρή** (downstream class/KPIs). */
  readonly annualDemandKWh: number;
  /** kWh/m²·έτος — ειδική **καθαρή** ζήτηση `Q_net / A`. */
  readonly specificDemandKWhM2: number;
}

/** Συγκεντρωτική ετήσια ζήτηση ορόφου: γραμμές + σύνολα (gross/κέρδη/net) + κατηγορία. */
export interface AnnualHeatingResult {
  readonly rows: readonly AnnualEnergyRow[];
  /** kWh/έτος — άθροισμα **καθαρής** ζήτησης όλων των χώρων (headline). */
  readonly totalAnnualKWh: number;
  /** kWh/έτος — άθροισμα **μεικτής** ζήτησης (gross breakdown). */
  readonly totalGrossKWh: number;
  /** kWh/έτος — άθροισμα εσωτερικών κερδών. */
  readonly totalInternalGainKWh: number;
  /** kWh/έτος — άθροισμα ηλιακών κερδών. */
  readonly totalSolarGainKWh: number;
  /** m² — άθροισμα θερμαινόμενου εμβαδού. */
  readonly totalAreaM2: number;
  /** kWh/m²·έτος — συνολική ειδική **καθαρή** ζήτηση `Q_net_total / A_total` (0 αν A=0). */
  readonly specificDemandKWhM2: number;
  /** Ενδεικτική ετικέτα κατηγορίας ζήτησης (A+ … H), βάσει **καθαρής** ζήτησης. */
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

/** kWh/περίοδο — εσωτερικά κέρδη της χρήσης επί εμβαδό × ώρες περιόδου θέρμανσης. */
function internalGainKWh(
  use: ThermalSpaceUseType,
  floorAreaM2: number,
  zone: ClimateZone,
): number {
  return (getInternalGainWperM2(use) * floorAreaM2 * getHeatingSeasonHours(zone)) / W_TO_KW;
}

/** Σταθερό γινόμενο οπτικών συντελεστών υαλοπίνακα (g · F_F · F_sh). */
const GLAZING_OPTICAL_FACTOR = GLAZING_SOLAR_FACTOR_G * FRAME_FACTOR * SHADING_FACTOR;

/**
 * kWh/περίοδο — ηλιακά κέρδη **ανά** εξωτ. υαλοπίνακα (`window` & `external-air`):
 * `A · g · F_F · F_sh · obstruction · I_season(zone, orientation)` (ADR-422 L7.2/L7.3).
 * Η ακτινοβολία εξαρτάται από τον προσανατολισμό του υαλοπίνακα (από το `azimuthDeg`
 * του τοίχου-ξενιστή)· **απουσία `azimuthDeg` ⇒ orientation-agnostic μέση τιμή**
 * (zero-regression L7.1). Ο `obstruction` (L7.3) είναι ο per-space συντελεστής σκίασης
 * εξωτ. εμποδίων (default 1.0 ⇒ zero-regression). Area/azimuth από τα ήδη-resolved
 * boundaries — μηδέν re-resolve geometry.
 */
function solarGainKWh(
  result: SpaceHeatLoadResult,
  zone: ClimateZone,
  obstruction: number,
): number {
  let total = 0;
  for (const b of result.boundaries) {
    if (b.kind !== 'window' || b.condition !== 'external-air') continue;
    const irradiation =
      b.azimuthDeg != null
        ? getSeasonalSolarIrradiation(zone, azimuthToOrientation(b.azimuthDeg))
        : getSeasonalSolarIrradiation(zone);
    total += b.area * GLAZING_OPTICAL_FACTOR * obstruction * irradiation;
  }
  return total;
}

/** Χτίζει μία γραμμή (μεικτή → κέρδη → αξιοποίηση → καθαρή). `floorAreaM2 > 0` guarded. */
function buildAnnualRow(
  space: ThermalSpaceEntity,
  result: SpaceHeatLoadResult,
  hdd: number,
  zone: ClimateZone,
): AnnualEnergyRow {
  const floorAreaM2 = space.geometry.area;
  const lossCoefficientWperK = lossCoefficient(result);
  const grossDemandKWh = (lossCoefficientWperK * hdd * HOURS_PER_DAY) / W_TO_KW;
  const internal = internalGainKWh(space.params.useType, floorAreaM2, zone);
  const shadingObstruction = getSolarShadingObstructionFactor(
    resolveSolarShadingLevel(space.params),
  );
  const solar = solarGainKWh(result, zone, shadingObstruction);
  const gains = internal + solar;
  const ratio = grossDemandKWh > 0 ? gains / grossDemandKWh : 0;
  const utilisation = computeGainUtilisation(ratio);
  const netDemandKWh = Math.max(0, grossDemandKWh - utilisation * gains);
  return {
    spaceId: space.id,
    lossCoefficientWperK,
    floorAreaM2,
    grossDemandKWh,
    internalGainKWh: internal,
    solarGainKWh: solar,
    utilisation,
    netDemandKWh,
    annualDemandKWh: netDemandKWh,
    specificDemandKWhM2: netDemandKWh / floorAreaM2,
  };
}

/**
 * Υπολογίζει την ετήσια ζήτηση θέρμανσης (μεικτή L7 + καθαρή L7.1 με αξιοποίηση κερδών)
 * όλων των χώρων του ορόφου από τα L1 results + το cached εμβαδό κάθε χώρου. Χώροι χωρίς
 * result ή με μη-θετικό εμβαδό παραλείπονται. Idempotent — μηδέν side effects.
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
    if (!(space.geometry.area > 0)) continue; // guard: χωρίς εμβαδό → χωρίς ειδική ζήτηση
    rows.push(buildAnnualRow(space, result, hdd, zone));
  }

  const totalAnnualKWh = rows.reduce((sum, r) => sum + r.netDemandKWh, 0);
  const totalGrossKWh = rows.reduce((sum, r) => sum + r.grossDemandKWh, 0);
  const totalInternalGainKWh = rows.reduce((sum, r) => sum + r.internalGainKWh, 0);
  const totalSolarGainKWh = rows.reduce((sum, r) => sum + r.solarGainKWh, 0);
  const totalAreaM2 = rows.reduce((sum, r) => sum + r.floorAreaM2, 0);
  const specificDemandKWhM2 = totalAreaM2 > 0 ? totalAnnualKWh / totalAreaM2 : 0;

  return {
    rows,
    totalAnnualKWh,
    totalGrossKWh,
    totalInternalGainKWh,
    totalSolarGainKWh,
    totalAreaM2,
    specificDemandKWhM2,
    energyClass: classifyEnergyDemand(specificDemandKWhM2),
    hdd,
    zone,
  };
}
