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
  DEFAULT_SURFACE_COLOR_LEVEL,
  EXTERNAL_RADIATIVE_COEFFICIENT_H_R,
  EXTERNAL_SURFACE_RESISTANCE_R_SE,
  FRAME_FACTOR,
  GLAZING_SOLAR_FACTOR_G,
  SHADING_FACTOR,
  SKY_TEMP_DIFFERENCE_DELTA_THETA_ER,
  type FinShadingLevel,
  type HorizonShadingLevel,
  type ThermalMassLevel,
  azimuthToOrientation,
  computeGainUtilisation,
  computeNumericParam,
  computeTimeConstantHours,
  getFinShadingFactor,
  getHeatingSeasonHours,
  getHorizonShadingFactor,
  getHorizontalSolarIrradiation,
  getInternalGainWperM2,
  getSeasonalSolarIrradiation,
  getSkyViewFactor,
  getSolarAbsorptance,
  getSolarShadingObstructionFactor,
  getThermalMassCapacity,
} from './annual-gains-config';
import {
  resolveFinShadingLevel,
  resolveHorizonShadingLevel,
  resolveSolarShadingLevel,
} from '../thermal-space-use-catalog';
import type { BoundaryHeatLoss, SpaceHeatLoadResult } from './heat-load-types';

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
  /** kWh/έτος — ηλιακά κέρδη **υαλοπινάκων** `Σ_win A · g · F_F · F_sh · I_season`. */
  readonly solarGainKWh: number;
  /**
   * kWh/έτος — ηλιακά κέρδη **αδιαφανών** εξωτ. στοιχείων `Σ α·R_se·U·A·obstr·I`:
   * κατακόρυφοι τοίχοι (L7.6, προσανατολισμένη I) + **στέγη** (L7.7, οριζόντια I).
   * Ξεχωριστός όρος από τους υαλοπίνακες (διαφορετική φυσική).
   */
  readonly opaqueSolarGainKWh: number;
  /**
   * kWh/έτος — **απώλεια** long-wave ακτινοβολίας προς τον ουρανό (θετικός αριθμός =
   * απώλεια) των ίδιων εξωτ. αδιαφανών στοιχείων (τοίχοι + στέγη): `Σ F_r·R_se·U·A·
   * h_r·Δθ_er·hours/1000` (L7.8, EN ISO 13790 §11.3.5). Ο **μειωτικός** όρος του
   * radiation balance — αφαιρείται από τα κέρδη (`opaque_net = absorption − sky`).
   */
  readonly skyRadiationLossKWh: number;
  /**
   * kWh/έτος — **απώλεια** long-wave ακτινοβολίας προς τον ουρανό (θετικός = απώλεια)
   * των εξωτ. **υαλοπινάκων** (`window` & `external-air`): `Σ F_r·R_se·U_glass·A·h_r·
   * Δθ_er·hours/1000` (L7.8-B, EN ISO 13790 §11.3.5· `F_r,window=0.5`). Mirror του
   * `skyRadiationLossKWh` (αδιαφανή) στους πιο ακτινοβόλους υαλοπίνακες — ξεχωριστός
   * **μειωτικός** όρος του radiation balance (αφαιρείται από τα κέρδη).
   */
  readonly glazingSkyRadiationLossKWh: number;
  /**
   * h — σταθερά χρόνου `τ = C_m / H` του χώρου (L7.9/L7.9-B, EN ISO 13790 §12.2.1.1),
   * παρούσα όταν υπάρχει `C_m`: geometry-derived `Σ κ_m·A` (L7.9-B) ή κατηγορία
   * `thermalMassLevel` (L7.9)· αλλιώς `undefined` ⇒ simplified `a0=1.0` (zero-regression).
   * Τροφοδοτεί το δυναμικό `a0` της αξιοποίησης· ορατή ως future breakdown column.
   */
  readonly timeConstantHours?: number;
  /** Συντελεστής αξιοποίησης κερδών `η_gn` ∈ [0,1] (EN ISO 13790· δυναμικό a0 αν δηλωθεί μάζα). */
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
  /** kWh/έτος — άθροισμα ηλιακών κερδών **υαλοπινάκων**. */
  readonly totalSolarGainKWh: number;
  /** kWh/έτος — άθροισμα ηλιακών κερδών **αδιαφανών** εξωτ. στοιχείων (τοίχοι L7.6 + στέγη L7.7). */
  readonly totalOpaqueSolarGainKWh: number;
  /** kWh/έτος — άθροισμα **απωλειών ουρανού** (long-wave) αδιαφανών εξωτ. στοιχείων (L7.8). */
  readonly totalSkyRadiationLossKWh: number;
  /** kWh/έτος — άθροισμα **απωλειών ουρανού** (long-wave) εξωτ. **υαλοπινάκων** (L7.8-B). */
  readonly totalGlazingSkyRadiationLossKWh: number;
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

/** Per-space συντελεστές σκίασης υαλοπινάκων (L7.3 triad `F_sh,gl = obstruction·F_hor·F_ov·F_fin`). */
interface GlazingShading {
  /** Generic συντελεστής σκίασης εξωτ. εμποδίων (L7.3 v1, default 1.0). */
  readonly obstruction: number;
  /** Επίπεδο σκίασης μακρινού ορίζοντα `F_hor` (L7.3 Slice C). */
  readonly horizonLevel: HorizonShadingLevel;
  /** Επίπεδο σκίασης πλευρικών πτερυγίων `F_fin` (L7.3 Slice C). */
  readonly finLevel: FinShadingLevel;
}

/**
 * kWh/περίοδο — ηλιακά κέρδη **ανά** εξωτ. υαλοπίνακα (`window` & `external-air`):
 * `A · g · F_F · F_sh · obstruction · F_hor · F_ov · F_fin · I_season(zone, orientation)`
 * (ADR-422 L7.2/L7.3/L7.4/L7.5/Slice B/Slice C). Το `g` (SHGC) είναι **per-window** (L7.4·
 * absent ⇒ `GLAZING_SOLAR_FACTOR_G` 0.60). Το `F_F` **per-window** (L7.5· absent ⇒
 * `FRAME_FACTOR` 0.70). Η ακτινοβολία **και** τα `F_hor`/`F_fin` εξαρτώνται από τον
 * προσανατολισμό (`azimuthDeg`)· **απουσία `azimuthDeg` ⇒ orientation-agnostic μέσος**
 * (zero-regression L7.1). Triad σκίασης `F_hor` (ορίζοντας) & `F_fin` (πλευρικά πτερύγια)
 * — **precedence geometry > manual** (Slice D/E): per-window geometry `b.horizonShadingFactor`
 * (γειτονικές μάζες, Slice E) & `b.finShadingFactor` (κάθετοι τοίχοι, Slice D) **>** το
 * manual per-space level (Slice C, default `none` ⇒ 1.0)· πολλαπλασιάζονται με το generic
 * `obstruction` (L7.3 v1) & το per-window geometry `F_ov` (Slice B). Area/azimuth/F_ov/
 * F_hor/F_fin/g/F_F από τα ήδη-resolved boundaries — μηδέν re-resolve.
 */
function solarGainKWh(
  result: SpaceHeatLoadResult,
  zone: ClimateZone,
  shading: GlazingShading,
): number {
  let total = 0;
  for (const b of result.boundaries) {
    if (b.kind !== 'window' || b.condition !== 'external-air') continue;
    const orientation = b.azimuthDeg != null ? azimuthToOrientation(b.azimuthDeg) : undefined;
    const irradiation =
      orientation !== undefined ? getSeasonalSolarIrradiation(zone, orientation) : getSeasonalSolarIrradiation(zone);
    const g = b.solarFactorG ?? GLAZING_SOLAR_FACTOR_G; // L7.4 (absent ⇒ 0.60)
    const frameFactor = b.frameFactorF ?? FRAME_FACTOR; // L7.5 (absent ⇒ 0.70)
    const overhang = b.overhangShadingFactor ?? 1; // L7.3 Slice B (absent ⇒ 1.0)
    // L7.3 Slice E: per-window geometry `F_hor` (γειτονικές μάζες) **υπερισχύει** του
    // manual per-space level (Slice C) — absent-anchor, ΟΧΙ multiply (ίδιο φυσικό
    // εμπόδιο· double-count). Absent geometry ⇒ Slice C αμετάβλητο ⇒ zero-regression.
    const horizon =
      b.horizonShadingFactor ??
      (orientation !== undefined
        ? getHorizonShadingFactor(shading.horizonLevel, orientation)
        : getHorizonShadingFactor(shading.horizonLevel));
    // L7.3 Slice D: per-window geometry `F_fin` (κάθετοι τοίχοι) **υπερισχύει** του
    // manual per-space level (Slice C) — absent-anchor, ΟΧΙ multiply (ίδιο φυσικό
    // εμπόδιο· double-count). Absent geometry ⇒ Slice C αμετάβλητο ⇒ zero-regression.
    const fin =
      b.finShadingFactor ??
      (orientation !== undefined
        ? getFinShadingFactor(shading.finLevel, orientation)
        : getFinShadingFactor(shading.finLevel));
    total +=
      b.area * g * frameFactor * SHADING_FACTOR * shading.obstruction * horizon * overhang * fin * irradiation;
  }
  return total;
}

/** Per-space συντελεστές σκίασης υαλοπινάκων (generic obstruction + F_hor + F_fin levels). */
function resolveGlazingShading(space: ThermalSpaceEntity): GlazingShading {
  return {
    obstruction: getSolarShadingObstructionFactor(resolveSolarShadingLevel(space.params)),
    horizonLevel: resolveHorizonShadingLevel(space.params),
    finLevel: resolveFinShadingLevel(space.params),
  };
}

/**
 * kWh/περίοδο — ηλιακά κέρδη **ενός** αδιαφανούς εξωτ. στοιχείου μέσω της ενεργού
 * συλλεκτικής επιφάνειας `A_sol = α_S·R_se·U_c·A_c` (EN ISO 13790 §11.3.4 / ΤΟΤΕΕ
 * 20701-1): `Q = A_sol · obstruction · irradiation`. Κοινή φυσική τοίχου & στέγης
 * (SSoT) — **διαφέρει μόνο η πηγή `irradiation`** (τοίχος→προσανατολισμένη, στέγη→
 * οριζόντια). Η απορροφητικότητα `α_S` είναι **per-element** (per-space απόχρωση)·
 * **absent ⇒ `medium` (0.60)**.
 */
function opaqueApertureGainKWh(
  b: BoundaryHeatLoss,
  irradiation: number,
  obstruction: number,
): number {
  const alpha = b.solarAbsorptance ?? getSolarAbsorptance(DEFAULT_SURFACE_COLOR_LEVEL);
  const aSol = alpha * EXTERNAL_SURFACE_RESISTANCE_R_SE * b.uValue * b.area;
  return aSol * obstruction * irradiation;
}

/**
 * kWh/περίοδο — **απώλεια** long-wave ακτινοβολίας **ενός** αδιαφανούς εξωτ. στοιχείου
 * προς τον ουρανό (EN ISO 13790 §11.3.5): `Q_sky = F_r · Φ_r · hours/1000`, όπου η
 * στιγμιαία ροή `Φ_r = R_se·U_c·A_c·h_r·Δθ_er` (W, μέση περιόδου) και `F_r` ο
 * συντελεστής θέασης ουρανού (στέγη 1.0 / τοίχος 0.5). **Ανεξάρτητη** από `α_S`/
 * `azimuth`/`obstruction` (μη-ηλιακός όρος — εξαρτάται μόνο από `U`/`A`/`kind`).
 * Επιστρέφει **θετικό** αριθμό = απώλεια (αφαιρείται από τα κέρδη στον caller).
 */
function skyRadiationLossKWh(b: BoundaryHeatLoss, hours: number): number {
  const phiR =
    EXTERNAL_SURFACE_RESISTANCE_R_SE *
    b.uValue *
    b.area *
    EXTERNAL_RADIATIVE_COEFFICIENT_H_R *
    SKY_TEMP_DIFFERENCE_DELTA_THETA_ER;
  return (getSkyViewFactor(b.kind) * phiR * hours) / W_TO_KW;
}

/** Ανταλλαγή ακτινοβολίας αδιαφανών εξωτ. στοιχείων: ηλιακή απορρόφηση (+) & απώλεια ουρανού (+). */
interface OpaqueRadiationExchange {
  /** kWh/περίοδο — ηλιακή **απορρόφηση** (κέρδος, L7.6 τοίχοι + L7.7 στέγη). */
  readonly absorptionKWh: number;
  /** kWh/περίοδο — **απώλεια** ουρανού (long-wave, L7.8· θετικό = απώλεια). */
  readonly skyLossKWh: number;
}

/**
 * kWh/περίοδο — η πλήρης ανταλλαγή ακτινοβολίας των **αδιαφανών** εξωτ. στοιχείων
 * (`external-air`) σε **ΕΝΑ πέρασμα** (SSoT, ΟΧΙ τρίτη μηχανή): για κάθε `wall`/`roof`
 * αθροίζει **απορρόφηση** (`opaqueApertureGainKWh` — αμετάβλητη φυσική L7.6/L7.7·
 * τοίχος→προσανατολισμένη `I`, στέγη→οριζόντια `I`) **και** **απώλεια ουρανού**
 * (`skyRadiationLossKWh` — L7.8). Το net (`absorption − skyLoss`) το συνθέτει ο caller·
 * τα δύο μένουν ξεχωριστά για Revit-faithful breakdown. Window-only/εσωτ. ⇒ `{0,0}`.
 */
function opaqueRadiationExchange(
  result: SpaceHeatLoadResult,
  zone: ClimateZone,
  obstruction: number,
): OpaqueRadiationExchange {
  const hours = getHeatingSeasonHours(zone);
  let absorptionKWh = 0;
  let skyLossKWh = 0;
  for (const b of result.boundaries) {
    if (b.condition !== 'external-air') continue;
    if (b.kind === 'wall') {
      const irradiation =
        b.azimuthDeg != null
          ? getSeasonalSolarIrradiation(zone, azimuthToOrientation(b.azimuthDeg))
          : getSeasonalSolarIrradiation(zone);
      absorptionKWh += opaqueApertureGainKWh(b, irradiation, obstruction);
      skyLossKWh += skyRadiationLossKWh(b, hours);
    } else if (b.kind === 'roof') {
      absorptionKWh += opaqueApertureGainKWh(b, getHorizontalSolarIrradiation(zone), obstruction);
      skyLossKWh += skyRadiationLossKWh(b, hours);
    }
  }
  return { absorptionKWh, skyLossKWh };
}

/**
 * kWh/περίοδο — άθροισμα **απώλειας** long-wave ακτινοβολίας προς τον ουρανό όλων των
 * εξωτ. **υαλοπινάκων** (`window` & `external-air`) — L7.8-B, EN ISO 13790 §11.3.5.
 * **REUSE αυτολεξεί** την kind-agnostic `skyRadiationLossKWh` (το `getSkyViewFactor`
 * επιστρέφει `0.5` για `window` — ίδια γεωμετρία θέασης με τον τοίχο)· μηδέν νέα
 * radiation math. **Ξεχωριστό πέρασμα** από το `opaqueRadiationExchange`: τα παράθυρα
 * δεν έχουν opaque απορρόφηση (έχουν solar gain ξεχωριστά) → καθαρό SRP. Επιστρέφει
 * **θετικό** = απώλεια (αφαιρείται από τα κέρδη στον caller). Μη-window/εσωτ. ⇒ 0.
 */
function glazingSkyRadiationLoss(result: SpaceHeatLoadResult, zone: ClimateZone): number {
  const hours = getHeatingSeasonHours(zone);
  let total = 0;
  for (const b of result.boundaries) {
    if (b.kind !== 'window' || b.condition !== 'external-air') continue;
    total += skyRadiationLossKWh(b, hours);
  }
  return total;
}

/** Δυναμική παράμετρος αξιοποίησης ανά χώρο (L7.9): `a0` + σταθερά χρόνου `τ`. */
interface DynamicUtilisationParams {
  /** `a0 = a0,ref + τ/τ0`· `undefined` ⇒ baseline (simplified `a0=1.0`, zero-regression). */
  readonly a0: number | undefined;
  /** Σταθερά χρόνου `τ` (h)· `undefined` όταν δεν δηλώνεται κλάση μάζας. */
  readonly timeConstantHours: number | undefined;
}

/**
 * Geometry-derived εσωτερική θερμοχωρητικότητα `C_m = Σ κ_m·A_boundary` (J/K) από τα
 * stamped boundaries (L7.9-B, EN ISO 13790 §12.3.1.1). `0` αν κανένα boundary δεν φέρει
 * resolvable `κ_m` (custom/άγνωστα υλικά ⇒ fallback κατηγορία). Pure, idempotent.
 */
function geometryThermalCapacity(result: SpaceHeatLoadResult): number {
  let cm = 0;
  for (const b of result.boundaries) {
    if (b.arealHeatCapacityJperM2K && b.area > 0) cm += b.arealHeatCapacityJperM2K * b.area;
  }
  return cm;
}

/**
 * Δυναμικό `a0` της αξιοποίησης κερδών ανά χώρο (L7.9 + L7.9-B, EN ISO 13790 §12.2.1.1).
 * **Precedence του `C_m`:** (1) **geometry-derived** `Σ κ_m·A` αν >0 (L7.9-B, πραγματικά
 * υλικά) > (2) **κατηγορία** `capacity(level)·A_floor` αν δηλωθεί `thermalMassLevel` (L7.9
 * χονδρικό default) > (3) **absent** ⇒ `{ undefined, undefined }` (simplified `a0=1.0` ⇒
 * zero-regression). Με `C_m>0`: `τ = C_m/(H·3600)` → `a0 = a0,ref + τ/τ0`. Reuse `H` (ήδη
 * υπολογισμένο) — μηδέν re-resolve. **Zero-regression:** χωρίς stamped `κ_m` ⇒ ΑΚΡΙΒΩΣ το L7.9.
 */
function resolveDynamicUtilisation(
  result: SpaceHeatLoadResult,
  level: ThermalMassLevel | undefined,
  lossCoefficientWperK: number,
  floorAreaM2: number,
): DynamicUtilisationParams {
  const geometryCm = geometryThermalCapacity(result);
  const cmJPerK =
    geometryCm > 0 ? geometryCm : level ? getThermalMassCapacity(level) * floorAreaM2 : 0;
  if (!(cmJPerK > 0)) return { a0: undefined, timeConstantHours: undefined };
  const timeConstantHours = computeTimeConstantHours(cmJPerK, lossCoefficientWperK);
  return { a0: computeNumericParam(timeConstantHours), timeConstantHours };
}

/** Ανάλυση ετήσιων κερδών/απωλειών ακτινοβολίας ενός χώρου (όλοι οι όροι του balance). */
interface AnnualGainsBreakdown {
  /** kWh — εσωτερικά κέρδη (χρήση × εμβαδό × ώρες). */
  readonly internal: number;
  /** kWh — ηλιακά κέρδη υαλοπινάκων (L7.2-L7.5 + Slice B/C/D). */
  readonly solar: number;
  /** kWh — ηλιακή απορρόφηση αδιαφανών εξωτ. στοιχείων (L7.6 τοίχοι + L7.7 στέγη). */
  readonly opaqueSolar: number;
  /** kWh — απώλεια ουρανού αδιαφανών (L7.8· θετικό = απώλεια). */
  readonly skyLoss: number;
  /** kWh — απώλεια ουρανού υαλοπινάκων (L7.8-B· θετικό = απώλεια). */
  readonly glazingSkyLoss: number;
  /** kWh — καθαρά κέρδη `internal + solar + opaqueSolar − skyLoss − glazingSkyLoss`. */
  readonly net: number;
}

/**
 * kWh/περίοδο — η πλήρης ανάλυση κερδών/απωλειών ακτινοβολίας ενός χώρου (SSoT των όρων
 * του radiation balance): εσωτερικά + ηλιακά υαλοπινάκων + απορρόφηση αδιαφανών −
 * απώλειες ουρανού (αδιαφανή L7.8 + υαλοπίνακες L7.8-B). Το `net` είναι το αξιοποιήσιμο
 * άθροισμα που τροφοδοτεί τον `computeGainUtilisation` (μπορεί να γίνει αρνητικό σε
 * ακραίες περιπτώσεις — ο `γ≤0⇒η=1` το χειρίζεται). Pure, idempotent.
 */
function computeAnnualGains(
  space: ThermalSpaceEntity,
  result: SpaceHeatLoadResult,
  zone: ClimateZone,
): AnnualGainsBreakdown {
  const internal = internalGainKWh(space.params.useType, space.geometry.area, zone);
  const shading = resolveGlazingShading(space);
  const solar = solarGainKWh(result, zone, shading);
  const { absorptionKWh: opaqueSolar, skyLossKWh: skyLoss } = opaqueRadiationExchange(
    result,
    zone,
    shading.obstruction,
  );
  const glazingSkyLoss = glazingSkyRadiationLoss(result, zone);
  const net = internal + solar + opaqueSolar - skyLoss - glazingSkyLoss;
  return { internal, solar, opaqueSolar, skyLoss, glazingSkyLoss, net };
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
  const gains = computeAnnualGains(space, result, zone);
  const ratio = grossDemandKWh > 0 ? gains.net / grossDemandKWh : 0;
  const { a0, timeConstantHours } = resolveDynamicUtilisation(
    result, space.params.thermalMassLevel, lossCoefficientWperK, floorAreaM2,
  );
  const utilisation = computeGainUtilisation(ratio, a0);
  const netDemandKWh = Math.max(0, grossDemandKWh - utilisation * gains.net);
  return {
    spaceId: space.id,
    lossCoefficientWperK,
    floorAreaM2,
    grossDemandKWh,
    internalGainKWh: gains.internal,
    solarGainKWh: gains.solar,
    opaqueSolarGainKWh: gains.opaqueSolar,
    skyRadiationLossKWh: gains.skyLoss,
    glazingSkyRadiationLossKWh: gains.glazingSkyLoss,
    timeConstantHours,
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
  const totalOpaqueSolarGainKWh = rows.reduce((sum, r) => sum + r.opaqueSolarGainKWh, 0);
  const totalSkyRadiationLossKWh = rows.reduce((sum, r) => sum + r.skyRadiationLossKWh, 0);
  const totalGlazingSkyRadiationLossKWh = rows.reduce(
    (sum, r) => sum + r.glazingSkyRadiationLossKWh,
    0,
  );
  const totalAreaM2 = rows.reduce((sum, r) => sum + r.floorAreaM2, 0);
  const specificDemandKWhM2 = totalAreaM2 > 0 ? totalAnnualKWh / totalAreaM2 : 0;

  return {
    rows,
    totalAnnualKWh,
    totalGrossKWh,
    totalInternalGainKWh,
    totalSolarGainKWh,
    totalOpaqueSolarGainKWh,
    totalSkyRadiationLossKWh,
    totalGlazingSkyRadiationLossKWh,
    totalAreaM2,
    specificDemandKWhM2,
    energyClass: classifyEnergyDemand(specificDemandKWhM2),
    hdd,
    zone,
  };
}
