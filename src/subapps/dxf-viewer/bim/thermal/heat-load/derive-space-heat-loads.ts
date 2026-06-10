/**
 * ADR-422 L1 — Orchestration του heat-load engine πάνω σε scene entities (PURE).
 *
 * «Κόλλημα» μεταξύ scene model και του καθαρού engine: για κάθε `thermal-space`
 * του ορόφου συναρμολογεί το `SpaceHeatLoadInput` (Ti/n από το ΤΟΤΕΕ catalog,
 * Te/storey/exterior-walls από τον caller) μέσω του `space-boundary-resolver` και
 * τρέχει το `computeSpaceHeatLoad`. Επιστρέφει Map<spaceId, αποτέλεσμα> + εύρος
 * ειδικού φορτίου (για το heat-map) + άθροισμα κτιρίου.
 *
 * Μηδέν React/store/persistence — όλα τα entities + το `Te`/storey/exterior set
 * δίνονται από τον caller (`useHeatLoadInputs`). Idempotent.
 *
 * @see ./space-boundary-resolver (scene → HeatLoadBoundary[])
 * @see ./heat-load-engine (computeSpaceHeatLoad — pure math)
 * @see ../../../hooks/data/useHeatLoadInputs (παράγει τα inputs από το scene)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L1)
 */

import type { WallEntity } from '../../types/wall-types';
import type { OpeningEntity } from '../../types/opening-types';
import type { ThermalSpaceEntity } from '../../types/thermal-space-types';
import { computeThermalSpaceGeometry } from '../../types/thermal-space-types';
import {
  resolveThermalSpaceSetpointC,
  resolveThermalSpaceAch,
  resolveThermalSpaceThermalBridgeSurcharge,
  resolveThermalSpaceReheatFactor,
  resolveThermalSpaceAirTightnessN50,
  resolveThermalSpaceHeatRecovery,
} from '../thermal-space-use-catalog';
import { resolveSpaceBoundaries, type StoreyPosition } from './space-boundary-resolver';
import { computeSpaceHeatLoad } from './heat-load-engine';
import {
  computeDesignVentilationRate,
  computeEffectiveVentilationRate,
  computeInfiltrationRate,
} from './ventilation-model';
import {
  getWindShieldingCoefficient,
  HEIGHT_CORRECTION_FACTOR_EPSILON,
} from './heat-load-config';
import type { SpaceHeatLoadResult } from './heat-load-types';
import type { OverhangOutline } from './solar-overhang-geometry';
import type { HorizonObstacle } from './solar-horizon-geometry';

/** Active-floor context που χρειάζεται το engine (δίνεται από `useHeatLoadInputs`). */
export interface SpaceHeatLoadDeriveInputs {
  /** Τοίχοι ορόφου (με geometry.innerEdge/outerEdge + params.dna). */
  readonly walls: readonly WallEntity[];
  /** Κουφώματα ορόφου. */
  readonly openings: readonly OpeningEntity[];
  /** Σύνολο id εξωτερικών τοίχων (από envelope shell). */
  readonly exteriorWallIds: ReadonlySet<string>;
  /** Θέση ορόφου στη στοίβα (δάπεδο/οροφή condition). */
  readonly storeyPosition: StoreyPosition;
  /** °C — θερμοκρασία σχεδιασμού εξωτ. αέρα Te (κλιματική ζώνη). */
  readonly outdoorTempC: number;
  /** Ανοχή αντιστοίχισης footprint→τοίχου (scene units). */
  readonly tol: number;
  /**
   * Outlines οριζόντιων προβόλων **πάνω** από τα παράθυρα (active-floor roof slabs +
   * cross-floor floor slabs των άνω ορόφων, world XY) — geometry-derived overhang
   * shading `F_ov` (ADR-422 L7.3 Slice B). Absent/κενό ⇒ zero-regression.
   */
  readonly overhangOutlines?: readonly OverhangOutline[];
  /**
   * Μάζες **γειτονικών κτιρίων** ως εμπόδια ορίζοντα (footprints στο ενεργό scene frame
   * μέσω ADR-369 site placement + απόλυτο ύψος κορυφής) — geometry-derived horizon shading
   * `F_hor` (ADR-422 L7.3 Slice E). Absent/κενό ⇒ fallback Slice C ⇒ zero-regression.
   */
  readonly horizonObstacleOutlines?: readonly HorizonObstacle[];
  /**
   * METRES — απόλυτο ύψος βάσης του ενεργού ορόφου στο site datum (ADR-369:
   * `building.baseElevation + floor.elevation`) — αναφορά ύψους ανοίγματος για τη σκίαση
   * ορίζοντα (Slice E). Absent ⇒ 0.
   */
  readonly apertureBaseElevationM?: number;
}

/** Συγκεντρωτικό αποτέλεσμα ορόφου: per-space φορτία + εύρος + άθροισμα. */
export interface SpaceHeatLoadDeriveResult {
  readonly results: ReadonlyMap<string, SpaceHeatLoadResult>;
  /** W/m² — ελάχιστο ειδικό φορτίο (heat-map cold). 0 αν κενό. */
  readonly minWperM2: number;
  /** W/m² — μέγιστο ειδικό φορτίο (heat-map hot). 0 αν κενό. */
  readonly maxWperM2: number;
  /** W — άθροισμα φορτίων όλων των χώρων (συνολικό κτιρίου ορόφου). */
  readonly totalW: number;
}

/** Φορτίο `Φ` ενός χώρου: resolver (όρια) → engine (αριθμητική). Idempotent. */
export function computeOneSpaceHeatLoad(
  space: ThermalSpaceEntity,
  inputs: SpaceHeatLoadDeriveInputs,
): SpaceHeatLoadResult {
  const { boundaries, exposedFacadeCount } = resolveSpaceBoundaries(space, {
    walls: inputs.walls,
    openings: inputs.openings,
    exteriorWallIds: inputs.exteriorWallIds,
    storeyPosition: inputs.storeyPosition,
    tol: inputs.tol,
    overhangOutlines: inputs.overhangOutlines,
    horizonObstacleOutlines: inputs.horizonObstacleOutlines,
    apertureBaseElevationM: inputs.apertureBaseElevationM,
  });
  const geometry = space.geometry ?? computeThermalSpaceGeometry(space.params);
  // L1.7: effective εναλλαγές αέρα `n_eff = max(n_inf, n_ven)` (EN 12831-1 §6.3.3) —
  // διαχωρισμός διείσδυσης (n50·#όψεων) ↔ σχεδιασμένου αερισμού (n_min μείον ανάκτηση η).
  // Defaults absent ⇒ n50=0 & η=0 ⇒ n_eff=n_min ⇒ byte-identical (zero-regression). Ο
  // engine μένει τυφλός: το n_eff περνά ως το υπάρχον `airChangesPerHour`.
  const nMin = resolveThermalSpaceAch(space.params);
  const n50 = resolveThermalSpaceAirTightnessN50(space.params);
  const shieldingE = getWindShieldingCoefficient(exposedFacadeCount);
  const heatRecoveryEta = resolveThermalSpaceHeatRecovery(space.params);
  const ventInput = {
    nMin,
    n50,
    shieldingE,
    heightEpsilon: HEIGHT_CORRECTION_FACTOR_EPSILON,
    heatRecoveryEta,
  };
  const airChangesPerHour = computeEffectiveVentilationRate(ventInput);
  // L1.8: σταθεροποίηση των 2 σκελών του split ως ξεχωριστά n (infiltration/designed)
  // ώστε ο engine να τα αποτυπώσει ως W (report breakdown). Το `airChangesPerHour=n_eff`
  // παραμένει το `max` (SSoT στο computeEffectiveVentilationRate) — μηδέν αλλαγή φορτίου.
  const infiltrationAch = computeInfiltrationRate(n50, shieldingE, HEIGHT_CORRECTION_FACTOR_EPSILON);
  const designedVentilationAch = computeDesignVentilationRate(nMin, heatRecoveryEta);
  return computeSpaceHeatLoad({
    spaceId: space.id,
    indoorTempC: resolveThermalSpaceSetpointC(space.params),
    outdoorTempC: inputs.outdoorTempC,
    airChangesPerHour,
    infiltrationAch,
    designedVentilationAch,
    volume: geometry.volume,
    floorArea: geometry.area,
    boundaries,
    thermalBridgeSurchargeWperM2K: resolveThermalSpaceThermalBridgeSurcharge(space.params),
    reheatFactorWperM2: resolveThermalSpaceReheatFactor(space.params),
  });
}

/** Φορτία ΟΛΩΝ των χώρων του ορόφου + εύρος ειδικού φορτίου + άθροισμα. */
export function deriveSpaceHeatLoads(
  spaces: readonly ThermalSpaceEntity[],
  inputs: SpaceHeatLoadDeriveInputs,
): SpaceHeatLoadDeriveResult {
  const results = new Map<string, SpaceHeatLoadResult>();
  let min = Infinity;
  let max = -Infinity;
  let totalW = 0;

  for (const space of spaces) {
    const result = computeOneSpaceHeatLoad(space, inputs);
    results.set(space.id, result);
    totalW += result.totalW;
    if (result.specificLoadWperM2 < min) min = result.specificLoadWperM2;
    if (result.specificLoadWperM2 > max) max = result.specificLoadWperM2;
  }

  if (results.size === 0) {
    min = 0;
    max = 0;
  }
  return { results, minWperM2: min, maxWperM2: max, totalW };
}
