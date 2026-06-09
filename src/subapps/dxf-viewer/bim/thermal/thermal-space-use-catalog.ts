/**
 * ADR-422 L0 — Κατάλογος χρήσεων θερμικού χώρου (ΤΟΤΕΕ 20701-1) — config SSoT.
 *
 * Config-only (τιμές κανονισμού· μηδέν logic-heavy). SSoT για τις **default**
 * παραμέτρους σχεδιασμού ανά χρήση χώρου:
 *   - `setpointTempC` — εσωτερική θερμοκρασία σχεδιασμού χειμώνα Ti (°C), ΤΟΤΕΕ
 *     20701-1 §2 (θερμοκρασίες σχεδιασμού εσωτερικού χώρου).
 *   - `airChangesPerHour` — ελάχιστος νωπός αέρας / εναλλαγές n (1/h) για τον
 *     υπολογισμό απωλειών αερισμού (Φ_ventilation = 0.34·n·V·ΔΤ, EN 12831 /
 *     ΤΟΤΕΕ 20701-1).
 *
 * Οι τιμές είναι αντιπροσωπευτικές κανονιστικές defaults — εύκολα editable και
 * **override-able ανά χώρο** (`ThermalSpaceParams.setpointTempC` /
 * `.airChangesPerHour`), Revit «type default, instance override» (ADR-422 D1/D2).
 *
 * ⚠️ Οι τιμές αερισμού εξαρτώνται από τον τύπο κτιρίου/αεροστεγανότητα· ο μελετητής
 * τις προσαρμόζει ανά έργο. Οι defaults καλύπτουν τυπική κατοικία/γραφείο.
 *
 * @see ../types/thermal-space-types (ThermalSpaceUseType — ο discriminator)
 * @see ./kenak-thermal-config (κλιματικές ζώνες + όρια U — το άλλο σκέλος ΚΕΝΑΚ)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §D2
 */

import type {
  ThermalSpaceParams,
  ThermalSpaceUseType,
} from '../types/thermal-space-types';
import { THERMAL_SPACE_USE_TYPES } from '../types/thermal-space-types';
import {
  DEFAULT_REHEAT_MODE,
  DEFAULT_THERMAL_BRIDGE_LEVEL,
  getReheatFactor,
  getThermalBridgeSurcharge,
} from './heat-load/heat-load-config';
import {
  DEFAULT_SOLAR_SHADING_LEVEL,
  DEFAULT_SURFACE_COLOR_LEVEL,
  type SolarShadingLevel,
  type SurfaceColorLevel,
} from './heat-load/annual-gains-config';

/** Default παράμετροι σχεδιασμού μιας χρήσης χώρου (ΤΟΤΕΕ 20701-1). */
export interface ThermalSpaceUseDefaults {
  readonly id: ThermalSpaceUseType;
  /** i18n key (dxf-viewer-shell namespace, N.11). */
  readonly labelKey: string;
  /** °C — εσωτερική θερμοκρασία σχεδιασμού χειμώνα (Ti). */
  readonly setpointTempC: number;
  /** 1/h — εναλλαγές αέρα (n) για απώλειες αερισμού. */
  readonly airChangesPerHour: number;
}

/**
 * ΤΟΤΕΕ 20701-1 defaults ανά χρήση. SSoT — το catalog ορίζει τη ΣΕΙΡΑ εμφάνισης
 * στο dropdown (Record + array helper παρακάτω).
 */
export const THERMAL_SPACE_USE_DEFAULTS: Readonly<
  Record<ThermalSpaceUseType, ThermalSpaceUseDefaults>
> = {
  bedroom: {
    id: 'bedroom',
    labelKey: 'thermalSpace.useTypes.bedroom',
    setpointTempC: 20,
    airChangesPerHour: 0.75,
  },
  'living-room': {
    id: 'living-room',
    labelKey: 'thermalSpace.useTypes.living-room',
    setpointTempC: 20,
    airChangesPerHour: 0.75,
  },
  kitchen: {
    id: 'kitchen',
    labelKey: 'thermalSpace.useTypes.kitchen',
    setpointTempC: 20,
    airChangesPerHour: 1.5,
  },
  bathroom: {
    id: 'bathroom',
    labelKey: 'thermalSpace.useTypes.bathroom',
    setpointTempC: 24,
    airChangesPerHour: 1.5,
  },
  wc: {
    id: 'wc',
    labelKey: 'thermalSpace.useTypes.wc',
    setpointTempC: 18,
    airChangesPerHour: 1.5,
  },
  hallway: {
    id: 'hallway',
    labelKey: 'thermalSpace.useTypes.hallway',
    setpointTempC: 18,
    airChangesPerHour: 0.5,
  },
  office: {
    id: 'office',
    labelKey: 'thermalSpace.useTypes.office',
    setpointTempC: 20,
    airChangesPerHour: 0.75,
  },
  generic: {
    id: 'generic',
    labelKey: 'thermalSpace.useTypes.generic',
    setpointTempC: 20,
    airChangesPerHour: 0.75,
  },
};

/** Λίστα defaults στη σειρά εμφάνισης (για dropdown options). */
export function listThermalSpaceUseTypes(): readonly ThermalSpaceUseDefaults[] {
  return THERMAL_SPACE_USE_TYPES.map((id) => THERMAL_SPACE_USE_DEFAULTS[id]);
}

/** Default παράμετροι μιας χρήσης (πάντα ορισμένο — exhaustive Record). */
export function getThermalSpaceUseDefaults(
  useType: ThermalSpaceUseType,
): ThermalSpaceUseDefaults {
  return THERMAL_SPACE_USE_DEFAULTS[useType];
}

/**
 * Effective setpoint Ti (°C) ενός χώρου: per-space override ?? default χρήσης.
 * Pure SSoT — το L1 (heat-load) διαβάζει ΜΟΝΟ από εδώ (ποτέ raw param).
 */
export function resolveThermalSpaceSetpointC(
  params: Pick<ThermalSpaceParams, 'useType' | 'setpointTempC'>,
): number {
  return params.setpointTempC ?? THERMAL_SPACE_USE_DEFAULTS[params.useType].setpointTempC;
}

/**
 * Effective εναλλαγές αέρα n (1/h): per-space override ?? default χρήσης.
 * Pure SSoT.
 */
export function resolveThermalSpaceAch(
  params: Pick<ThermalSpaceParams, 'useType' | 'airChangesPerHour'>,
): number {
  return (
    params.airChangesPerHour ?? THERMAL_SPACE_USE_DEFAULTS[params.useType].airChangesPerHour
  );
}

/**
 * Effective προσαύξηση θερμογεφυρών `ΔU_TB` (W/m²K): per-space override ?? `none`
 * (0). ADR-422 L1.5 — pure SSoT, default 0 ⇒ zero-regression.
 */
export function resolveThermalSpaceThermalBridgeSurcharge(
  params: Pick<ThermalSpaceParams, 'thermalBridgeLevel'>,
): number {
  return getThermalBridgeSurcharge(params.thermalBridgeLevel ?? DEFAULT_THERMAL_BRIDGE_LEVEL);
}

/**
 * Effective συντελεστής επανέναρξης `f_RH` (W/m²): per-space override ?? `continuous`
 * (0). ADR-422 L1.5 — pure SSoT, default 0 ⇒ zero-regression.
 */
export function resolveThermalSpaceReheatFactor(
  params: Pick<ThermalSpaceParams, 'reheatMode'>,
): number {
  return getReheatFactor(params.reheatMode ?? DEFAULT_REHEAT_MODE);
}

/**
 * Effective επίπεδο σκίασης εξωτ. εμποδίων: per-space override ?? `none`. ADR-422
 * L7.3 — pure SSoT· default `none` ⇒ obstruction 1.0 ⇒ zero-regression. Επιστρέφει
 * το **επίπεδο** (ο πολλαπλασιαστής προκύπτει με `getSolarShadingObstructionFactor`).
 */
export function resolveSolarShadingLevel(
  params: Pick<ThermalSpaceParams, 'solarShadingLevel'>,
): SolarShadingLevel {
  return params.solarShadingLevel ?? DEFAULT_SOLAR_SHADING_LEVEL;
}

/**
 * Effective απόχρωση εξωτ. τοίχων (ηλιακή απορρόφηση): per-space override ?? `medium`.
 * ADR-422 L7.6 — pure SSoT· default `medium` ⇒ α_S=0.6 (τυπικός σοβάς). Επιστρέφει το
 * **επίπεδο** (η απορροφητικότητα προκύπτει με `getSolarAbsorptance`).
 */
export function resolveWallSolarAbsorptanceLevel(
  params: Pick<ThermalSpaceParams, 'wallSolarAbsorptanceLevel'>,
): SurfaceColorLevel {
  return params.wallSolarAbsorptanceLevel ?? DEFAULT_SURFACE_COLOR_LEVEL;
}

/**
 * Effective απόχρωση στέγης/οριζόντιων αδιαφανών (ηλιακή απορρόφηση): per-space override
 * ?? `medium`. ADR-422 L7.7 — pure SSoT· default `medium` ⇒ α_S=0.6. Ξεχωριστό από τους
 * τοίχους (Revit per-element absorptance· οι στέγες συχνά σκούρες — ο μελετητής αλλάζει
 * σε `dark`). Επιστρέφει το **επίπεδο** (η απορροφητικότητα προκύπτει με `getSolarAbsorptance`).
 */
export function resolveRoofSolarAbsorptanceLevel(
  params: Pick<ThermalSpaceParams, 'roofSolarAbsorptanceLevel'>,
): SurfaceColorLevel {
  return params.roofSolarAbsorptanceLevel ?? DEFAULT_SURFACE_COLOR_LEVEL;
}
