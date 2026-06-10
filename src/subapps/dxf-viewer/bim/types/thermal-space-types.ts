/**
 * BIM Thermal Space — Type Schema (ADR-422 L0).
 *
 * `ThermalSpaceEntity` — αναλυτικός θερμικός χώρος (Revit *Space*, `IfcSpace`):
 * ένα κλειστό πολύγωνο που περικλείει δωμάτιο, φέρει **χρήση** (`useType`),
 * **θερμοκρασία σχεδιασμού** (setpoint Ti), **εναλλαγές αέρα** (ACH) και **ύψος**
 * → όγκο. Είναι το θεμέλιο της μηχανολογικής μελέτης θέρμανσης (ΤΟΤΕΕ 20701-1,
 * βάση EN 12831): χωρίς θερμικό χώρο δεν υπάρχει per-room φορτίο.
 *
 * Αρχιτεκτονική απόφαση (ADR-422 D1): Η Revit ξεχωρίζει **Room** (αρχιτεκτονικό)
 * από **Space** (αναλυτικό HVAC). Το `FloorFinish` (`IfcCovering`) είναι θερμικά
 * αδρανές — λάθος να κουβαλά HVAC δεδομένα. Άρα ΝΕΟ entity `thermal-space`
 * (`IfcSpace`), area-based mirror του `floor-finish`/`mep-underfloor`.
 *
 * SSoT:
 *   - `footprint` (κλειστό πολύγωνο, CCW, world mm) = το όριο του χώρου. Στο L0
 *     παράγεται με Revit «Place Space» (κλικ μέσα στο δωμάτιο → auto-fill από τον
 *     κλειστό βρόχο τοίχων) και αποθηκεύεται ως snapshot.
 *   - `useType` (= το entity `kind`) → default setpoint Ti + ACH μέσω
 *     `thermal-space-use-catalog` (ΤΟΤΕΕ). `setpointTempC`/`airChangesPerHour`
 *     είναι **per-space overrides** (Revit «type default, instance override»).
 *   - `ThermalSpaceGeometry` (area/perimeter/volume/bbox) = cache, re-derivable
 *     από params — ΠΟΤΕ mutated by consumers.
 *
 * @see ./floor-finish-types (το area-entity template)
 * @see ../thermal/thermal-space-use-catalog (ΤΟΤΕΕ χρήση → setpoint/ACH)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { BimEntity, BoundingBox3D, Polygon3D } from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import { mmScaleFor } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import { polygonArea, polygonPerimeter, polygonBbox } from '../geometry/shared/polygon-utils';
import type {
  AirTightnessLevel,
  ReheatMode,
  ThermalBridgeLevel,
  VentilationSystem,
} from '../thermal/heat-load/heat-load-config';
import type {
  FinShadingLevel,
  HorizonShadingLevel,
  SolarShadingLevel,
  SurfaceColorLevel,
  ThermalMassLevel,
} from '../thermal/heat-load/annual-gains-config';

// ─── Χρήση χώρου (ΤΟΤΕΕ 20701-1) ────────────────────────────────────────────────

/**
 * Χρήση θερμικού χώρου — ο discriminator/`kind` του entity (όπως floor-finish kind
 * = materialId). Καθορίζει default setpoint Ti + ACH μέσω `thermal-space-use-catalog`.
 * Καλύπτει τις βασικές χρήσεις κατοικίας/γραφείου της ΤΟΤΕΕ 20701-1· νέες χρήσεις
 * προστίθενται εδώ + στο catalog χωρίς νέο EntityType.
 */
export type ThermalSpaceUseType =
  | 'bedroom'
  | 'living-room'
  | 'kitchen'
  | 'bathroom'
  | 'wc'
  | 'hallway'
  | 'office'
  | 'generic';

export const THERMAL_SPACE_USE_TYPES: readonly ThermalSpaceUseType[] = [
  'bedroom',
  'living-room',
  'kitchen',
  'bathroom',
  'wc',
  'hallway',
  'office',
  'generic',
] as const;

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

/**
 * Thermal space parameters. Linear measurements σε mm.
 *
 *   - `footprint` — closed polygon (CCW), world coords mm. Min 3 vertices.
 *   - `useType` — χρήση (ΤΟΤΕΕ) → default setpoint/ACH.
 *   - `setpointTempC?` — **override** θερμοκρασίας σχεδιασμού χειμώνα (°C). Absent ⇒
 *     default χρήσης από το catalog.
 *   - `airChangesPerHour?` — **override** εναλλαγών αέρα (1/h). Absent ⇒ default χρήσης.
 *   - `thermalBridgeLevel?` — **override** θερμογεφυρών (L1.5). Absent ⇒ `none`.
 *   - `reheatMode?` — **override** λειτουργίας/reheat (L1.5). Absent ⇒ `continuous`.
 *   - `airTightnessLevel?` — **override** αεροστεγανότητας κελύφους (L1.7, διείσδυση). Absent ⇒ `unspecified` (n50=0).
 *   - `ventilationSystem?` — **override** συστήματος αερισμού/ανάκτησης (L1.7). Absent ⇒ `natural` (η=0).
 *   - `solarShadingLevel?` — **override** σκίασης εξωτ. εμποδίων (L7.3, generic). Absent ⇒ `none`.
 *   - `horizonShadingLevel?` — **override** σκίασης ορίζοντα `F_hor` (L7.3 Slice C). Absent ⇒ `none`.
 *   - `finShadingLevel?` — **override** σκίασης πτερυγίων `F_fin` (L7.3 Slice C). Absent ⇒ `none`.
 *   - `wallSolarAbsorptanceLevel?` — **override** απόχρωσης εξωτ. τοίχων (L7.6). Absent ⇒ `medium`.
 *   - `roofSolarAbsorptanceLevel?` — **override** απόχρωσης στέγης/οριζόντιων (L7.7). Absent ⇒ `medium`.
 *   - `thermalMassLevel?` — **override** κλάσης θερμικής μάζας (L7.9). Absent ⇒ a0=1.0 (simplified).
 *   - `ceilingHeightMm` — mm, καθαρό ύψος χώρου (για όγκο = εμβαδό × ύψος).
 *   - `name?` — user label (π.χ. «Υπνοδωμάτιο 1»).
 *   - `sceneUnits` — canvas coordinate unit. Defaults to 'mm' (legacy compat).
 *   - `floorId?` — FK → Floor.id (storey reference, ADR-420 floor-scope).
 */
export interface ThermalSpaceParams {
  readonly footprint: Polygon3D;
  readonly useType: ThermalSpaceUseType;
  readonly setpointTempC?: number;
  readonly airChangesPerHour?: number;
  /** **override** επιπέδου θερμογεφυρών (L1.5). Absent ⇒ `none` (ΔU_TB=0). */
  readonly thermalBridgeLevel?: ThermalBridgeLevel;
  /** **override** λειτουργίας θέρμανσης/reheat (L1.5). Absent ⇒ `continuous` (f_RH=0). */
  readonly reheatMode?: ReheatMode;
  /** **override** αεροστεγανότητας κελύφους (L1.7, διείσδυση). Absent ⇒ `unspecified` (n50=0, n_inf=0). */
  readonly airTightnessLevel?: AirTightnessLevel;
  /** **override** συστήματος αερισμού/ανάκτησης (L1.7). Absent ⇒ `natural` (η=0, n_ven=n_min). */
  readonly ventilationSystem?: VentilationSystem;
  /** **override** σκίασης εξωτ. εμποδίων (L7.3, generic). Absent ⇒ `none` (obstruction=1.0). */
  readonly solarShadingLevel?: SolarShadingLevel;
  /** **override** σκίασης μακρινού ορίζοντα `F_hor` (L7.3 Slice C). Absent ⇒ `none` (1.0). */
  readonly horizonShadingLevel?: HorizonShadingLevel;
  /** **override** σκίασης πλευρικών πτερυγίων `F_fin` (L7.3 Slice C). Absent ⇒ `none` (1.0). */
  readonly finShadingLevel?: FinShadingLevel;
  /** **override** απόχρωσης εξωτ. τοίχων (L7.6). Absent ⇒ `medium` (α_S=0.6). */
  readonly wallSolarAbsorptanceLevel?: SurfaceColorLevel;
  /** **override** απόχρωσης στέγης/οριζόντιων αδιαφανών (L7.7). Absent ⇒ `medium` (α_S=0.6). */
  readonly roofSolarAbsorptanceLevel?: SurfaceColorLevel;
  /** **override** κλάσης θερμικής μάζας/αδράνειας (L7.9). Absent ⇒ a0=a0,ref=1.0 (simplified). */
  readonly thermalMassLevel?: ThermalMassLevel;
  readonly ceilingHeightMm: number;
  readonly name?: string;
  readonly sceneUnits?: SceneUnits;
  readonly floorId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ────────────────────

/**
 * Computed thermal space geometry. Returned by `computeThermalSpaceGeometry()` —
 * ΠΟΤΕ mutated by consumers. SSoT = params.
 */
export interface ThermalSpaceGeometry {
  readonly bbox: BoundingBox3D;
  /** m². Εμβαδό polygon (Shoelace). */
  readonly area: number;
  /** m. Περίμετρος polygon. */
  readonly perimeter: number;
  /** m³. Όγκος = εμβαδό × καθαρό ύψος (EN 12831 αερισμός). */
  readonly volume: number;
}

// ─── Entity (BIM generic instantiation) ───────────────────────────────────────

/**
 * Thermal space BIM entity. Αναλυτικός χώρος HVAC (Revit Space). IFC: `IfcSpace`.
 * `kind` = `ThermalSpaceUseType` (η χρήση, όπως floor-finish kind = materialId).
 */
export interface ThermalSpaceEntity
  extends BimEntity<ThermalSpaceUseType, ThermalSpaceParams, ThermalSpaceGeometry>,
    IfcEntityMixin {
  readonly type: 'thermal-space';
  readonly ifcType: 'IfcSpace';
}

// ─── Defaults & constants ─────────────────────────────────────────────────────

/** Default χρήση νέου θερμικού χώρου. */
export const DEFAULT_THERMAL_SPACE_USE_TYPE: ThermalSpaceUseType = 'generic';

/** Default καθαρό ύψος χώρου (mm) — fallback όταν δεν προκύπτει από τον όροφο. */
export const DEFAULT_THERMAL_SPACE_CEILING_HEIGHT_MM = 3000;

/** Min polygon vertices για έγκυρο footprint. */
export const MIN_THERMAL_SPACE_VERTICES = 3;

// ─── Geometry derivation ──────────────────────────────────────────────────────

const MM_TO_M = 0.001;

/**
 * Pure geometry derivation. Καλείται από `UpdateThermalSpaceParamsCommand` /
 * factory — consumers ΠΟΤΕ απευθείας (SSoT = params). Idempotent.
 */
export function computeThermalSpaceGeometry(
  params: Pick<ThermalSpaceParams, 'footprint' | 'ceilingHeightMm' | 'sceneUnits'>,
): ThermalSpaceGeometry {
  const verts = params.footprint.vertices;
  if (verts.length < MIN_THERMAL_SPACE_VERTICES) {
    return {
      bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      area: 0,
      perimeter: 0,
      volume: 0,
    };
  }

  const bbox = polygonBbox(verts);
  // ADR-422 unit-fix — the footprint is in SCENE UNITS (`params.sceneUnits`); convert
  // scene-unit area/perimeter to metres via the sceneUnits SSoT. `ceilingHeightMm` is a
  // mm scalar, so height→m is always ×MM_TO_M. For an 'mm' scene the factor is 1 (no
  // change — same fix as mep-underfloor / Φ11).
  const sceneToM = MM_TO_M / mmScaleFor(params);
  const areaM2 = polygonArea(verts) * sceneToM * sceneToM;
  const perimeterM = polygonPerimeter(verts) * sceneToM;
  const heightM = Math.max(0, params.ceilingHeightMm) * MM_TO_M;

  return {
    bbox,
    area: areaM2,
    perimeter: perimeterM,
    volume: areaM2 * heightM,
  };
}
