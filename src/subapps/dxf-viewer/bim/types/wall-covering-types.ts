/**
 * BIM Wall Covering — Type Schema (ADR-511).
 *
 * `WallCoveringEntity` — ξεχωριστή οντότητα «φινίρισμα τοίχου» ανά **δωμάτιο / παρειά**:
 * ο δομικός τοίχος (`WallEntity`) μένει **ΕΝΑΣ, SSoT, ΑΘΙΚΤΟΣ**, και επάνω του ζουν N
 * περιοχές covering — η καθεμία κρατά `hostWallId` + `faceSide` (inner/outer) + along-axis
 * `span` + ύψος + ένα **compound layered assembly** (μπογιά=surface 0πάχος· σοβάς/knauf/
 * πλακίδια=body layers). Revit: `IfcCovering` (CLADDING/INTERIOR) — αλλά πιο ευέλικτο: μία
 * οντότητα καλύπτει ΚΑΙ surface paint ΚΑΙ layered covering μέσω `layers[]` (όχι το Paint/Parts
 * δίπολο του Revit).
 *
 * **Κλειδωμένη απόφαση (Giorgio):** τα όρια ακολουθούν ΔΩΜΑΤΙΑ (IfcSpace), ΟΧΙ κολώνες — ένα
 * όριο δωματίου μπορεί να πέφτει στη ΜΕΣΗ φατνώματος. ΧΩΡΙΣ split του δομικού τοίχου.
 *
 * Geometry cache = **scalar quantities** (length/height/area/totalThickness), derived από
 * params ΜΟΝΟ (pure). Το strip-outline polygon (2D/3D render) υπολογίζεται **live** από τον
 * host τοίχο στον renderer/converter — ΟΧΙ αποθηκευμένο εδώ (αποφεύγει stale geometry όταν
 * ο τοίχος μετακινείται).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see bim/types/floor-finish-types.ts — το πρότυπο (IfcCovering FLOORING)
 */

import type { BimEntity, BoundingBox3D, Point3D } from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';

// ─── Material ID ──────────────────────────────────────────────────────────────

/** Stable IDs για built-in υλικά φινιρίσματος τοίχου (catalog SSoT). */
export type WallCoveringMaterialId =
  | 'paint-white'
  | 'paint-red'
  | 'paint-green'
  | 'paint-blue'
  | 'plaster-traditional'
  | 'knauf-gypsum-board'
  | 'tile-ceramic'
  | 'adhesive-mortar';

export const WALL_COVERING_MATERIAL_IDS: readonly WallCoveringMaterialId[] = [
  'paint-white',
  'paint-red',
  'paint-green',
  'paint-blue',
  'plaster-traditional',
  'knauf-gypsum-board',
  'tile-ceramic',
  'adhesive-mortar',
] as const;

// ─── Hatch type ───────────────────────────────────────────────────────────────

/** 2D plan hatch style ανά οικογένεια υλικού. */
export type WallCoveringHatchType = 'solid' | 'tile' | 'plaster' | 'board';

// ─── Layer function (IfcMaterialLayer.LayerFunction) ──────────────────────────

/** Ρόλος στρώσης μέσα στο assembly (IFC IfcMaterialLayer function). */
export type WallCoveringLayerFunction = 'surface' | 'body' | 'adhesive' | 'membrane';

// ─── Face side ────────────────────────────────────────────────────────────────

/** Ποια παρειά του τοίχου ντύνει το covering (inner = innerEdge, outer = outerEdge). */
export type WallCoveringFaceSide = 'inner' | 'outer';

// ─── Covering kind (coarse class — BimEntity.kind, για filter/BOQ) ────────────

/** Χονδρική κλάση του φινιρίσματος (παράγεται από το assembly). */
export type WallCoveringKind = 'paint' | 'plaster' | 'knauf' | 'tiles' | 'mixed';

// ─── Layer ────────────────────────────────────────────────────────────────────

/**
 * Μία στρώση του compound assembly.
 *   - `materialId` — built-in catalog ID.
 *   - `thicknessMm` — mm (0 για surface paint).
 *   - `function` — surface / body / adhesive / membrane (IFC layer function).
 *   - `colorOverride?` — custom χρώμα μπογιάς (hex, π.χ. «#C0392B») όταν θες απόχρωση
 *     εκτός catalog· undefined → χρώμα του υλικού από το catalog.
 */
export interface WallCoveringLayer {
  readonly materialId: WallCoveringMaterialId;
  readonly thicknessMm: number;
  readonly function: WallCoveringLayerFunction;
  readonly colorOverride?: string;
}

// ─── Parameters ───────────────────────────────────────────────────────────────

/**
 * Παράμετροι φινιρίσματος τοίχου. Όλα τα γραμμικά σε mm.
 *
 *   - `hostWallId` — FK → `WallEntity.id` (ο δομικός τοίχος μένει SSoT, άθικτος).
 *   - `faceSide` — 'inner' | 'outer' (ποια παρειά ντύνεται).
 *   - `spanStartMm` / `spanEndMm` — along-axis extent στον άξονα του τοίχου [0..L].
 *   - `heightBottomMm` / `heightTopMm` — κατακόρυφη έκταση (default 0 → καθαρό ύψος ορόφου).
 *   - `layers` — ordered compound assembly (≥1). Surface paint = 0πάχος· σοβάς/knauf/πλακίδια = body.
 *   - `spaceId?` — FK → `ThermalSpaceEntity.id` (το δωμάτιο που όρισε το extent· optional σε manual).
 *   - `name?` — user label (π.χ. «Μπάνιο - πλακάκια»).
 *   - `sceneUnits` — canvas coordinate unit. Default 'mm'.
 *   - `floorId?` — FK → Floor.id (ADR-420 scope).
 */
export interface WallCoveringParams {
  readonly hostWallId: string;
  readonly faceSide: WallCoveringFaceSide;
  readonly spanStartMm: number;
  readonly spanEndMm: number;
  readonly heightBottomMm: number;
  readonly heightTopMm: number;
  readonly layers: readonly WallCoveringLayer[];
  readonly spaceId?: string;
  readonly name?: string;
  readonly sceneUnits?: SceneUnits;
  readonly floorId?: string;
}

// ─── Geometry cache ───────────────────────────────────────────────────────────

/**
 * Computed scalar geometry. Returned by `computeWallCoveringGeometry()` — ΠΟΤΕ mutated
 * by consumers. SSoT = params. Το strip-outline polygon (render) υπολογίζεται live από
 * τον host τοίχο — ΟΧΙ εδώ.
 */
export interface WallCoveringGeometry {
  /** m. Μήκος κατά μήκος της παρειάς (spanEnd − spanStart). */
  readonly lengthM: number;
  /** m. Ύψος (heightTop − heightBottom). */
  readonly heightM: number;
  /** m². Εκτεθειμένη επιφάνεια φινιρίσματος (length × height) — BOQ. */
  readonly areaM2: number;
  /** mm. Συνολικό πάχος όλων των στρώσεων. */
  readonly totalThicknessMm: number;
  /**
   * Optional cached 2D strip outline (4 σημεία, world scene units) + bbox. Υπολογίζονται
   * από τον **host τοίχο** στο build/edit time (ADR-511 Slice B) ώστε selection / hit-test
   * να έχουν στόχο χωρίς πρόσβαση σε walls. Ο 2D **render** ΔΕΝ τα διαβάζει — υπολογίζει
   * live (`computeWallCoveringStrip`). Stale μόνο αν ο τοίχος μετακινηθεί χωρίς edit του
   * covering (καλύπτεται από το deferred move-cascade). Absent όταν ο host λείπει στο build.
   */
  readonly outline?: readonly Point3D[];
  readonly bbox?: BoundingBox3D;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

/**
 * Wall covering BIM entity. Λεπτό φινίρισμα σε μία παρειά δομικού τοίχου (Revit pattern).
 * IFC: `IfcCovering` (`PredefinedType=CLADDING` εξωτερικά / `INTERIOR` εσωτερικά).
 */
export interface WallCoveringEntity
  extends BimEntity<WallCoveringKind, WallCoveringParams, WallCoveringGeometry>,
    IfcEntityMixin {
  readonly type: 'wall-covering';
  readonly ifcType: 'IfcCovering';
}

// ─── Defaults & constants ─────────────────────────────────────────────────────

/** Default ύψος covering (mm) όταν δεν δίνεται — αντικαθίσταται από καθαρό ύψος ορόφου. */
export const DEFAULT_WALL_COVERING_HEIGHT_MM = 2700;

/** Default χαμηλό όριο (mm) — από το δάπεδο. */
export const DEFAULT_WALL_COVERING_BOTTOM_MM = 0;

/** Default assembly νέου covering: παραδοσιακός σοβάς + λευκή μπογιά. */
export const DEFAULT_WALL_COVERING_LAYERS: readonly WallCoveringLayer[] = [
  { materialId: 'plaster-traditional', thicknessMm: 20, function: 'body' },
  { materialId: 'paint-white', thicknessMm: 0, function: 'surface' },
] as const;

// ─── Geometry derivation (pure, params-only) ──────────────────────────────────

const MM_TO_M = 0.001;

/** Συνολικό πάχος του assembly (mm). Pure. */
export function totalCoveringThicknessMm(layers: readonly WallCoveringLayer[]): number {
  let sum = 0;
  for (const l of layers) sum += Math.max(0, l.thicknessMm);
  return sum;
}

/**
 * Χονδρική κλάση (`kind`) από το assembly: tiles > knauf > plaster > paint, αλλιώς mixed.
 * Pure. (Προτεραιότητα = το «βαρύτερο» υλικό ορίζει την κατηγορία για BOQ/filter.)
 */
export function resolveWallCoveringKind(layers: readonly WallCoveringLayer[]): WallCoveringKind {
  let hasPaint = false;
  let hasPlaster = false;
  let hasKnauf = false;
  let hasTiles = false;
  for (const l of layers) {
    if (l.materialId === 'tile-ceramic') hasTiles = true;
    else if (l.materialId === 'knauf-gypsum-board') hasKnauf = true;
    else if (l.materialId === 'plaster-traditional') hasPlaster = true;
    else if (l.materialId.startsWith('paint-')) hasPaint = true;
  }
  if (hasTiles) return 'tiles';
  if (hasKnauf) return 'knauf';
  if (hasPlaster) return hasPaint ? 'plaster' : 'plaster';
  if (hasPaint) return 'paint';
  return 'mixed';
}

/**
 * Pure geometry derivation από params ΜΟΝΟ. Called by `UpdateWallCoveringParamsCommand` —
 * consumers never call this directly (SSoT = params). Το render-time strip polygon
 * υπολογίζεται ξεχωριστά από τον host τοίχο.
 */
export function computeWallCoveringGeometry(
  params: Pick<WallCoveringParams, 'spanStartMm' | 'spanEndMm' | 'heightBottomMm' | 'heightTopMm' | 'layers'>,
): WallCoveringGeometry {
  const lengthMm = Math.max(0, params.spanEndMm - params.spanStartMm);
  const heightMm = Math.max(0, params.heightTopMm - params.heightBottomMm);
  const lengthM = lengthMm * MM_TO_M;
  const heightM = heightMm * MM_TO_M;
  return {
    lengthM,
    heightM,
    areaM2: lengthM * heightM,
    totalThicknessMm: totalCoveringThicknessMm(params.layers),
  };
}
