/**
 * BIM Space Separator — Type Schema (ADR-437).
 *
 * `SpaceSeparatorEntity` — γραμμή διαχωρισμού χώρου (Revit *Room/Space Separation
 * Line*, IFC `IfcVirtualElement`): μια **μη-δομική, room-bounding γραμμή** που
 * οριοθετεί/υποδιαιρεί έναν θερμικό χώρο **εκεί που δεν υπάρχει φυσικός τοίχος**
 * (open-plan, ανοιχτό πέρασμα, υποδιαίρεση ενιαίου χώρου σε δύο).
 *
 * Αρχιτεκτονική απόφαση (ADR-437 D-A): dedicated ΕΛΑΦΡΥ entity, ΟΧΙ reuse construction
 * `line` (σημασιολογικά διακριτό: διαχωριστής ≠ βοηθητική γραμμή, όπως η Revit τα
 * κρατά ξεχωριστά). Μη-δομικό — ΜΗΔΕΝ πάχος/φορτίο/DNA. IFC: `IfcVirtualElement`
 * (virtual boundary, σωστά αόρατο σε 3D).
 *
 * 🔑 ΧΡΥΣΟ ΕΥΡΗΜΑ (ADR-437): η ανίχνευση περιοχής (`extractLineSegments`) ΗΔΗ
 * καταναλώνει γενικά line segments. Ο διαχωριστής εκθέτει `params.start`/`params.end`
 * → ένας branch `isSpaceSeparatorEntity` τον κάνει ορατό στον detector, οπότε ο
 * θερμικός χώρος κλείνει/υποδιαιρεί περιοχές πάνω σε διαχωριστές ΟΠΩΣ πάνω σε τοίχους.
 *
 * SSoT:
 *   - `start`/`end` (Point3D, world scene-units) = τα δύο άκρα της γραμμής.
 *   - `SpaceSeparatorGeometry` (bbox/length) = cache, re-derivable από params —
 *     ΠΟΤΕ mutated by consumers.
 *
 * @see ./thermal-space-types (το L0 entity που οριοθετεί ο διαχωριστής)
 * @see ../walls/wall-in-region (`extractLineSegments` — η πύλη στο region detection)
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 */

import type { BimEntity, BoundingBox3D, Point3D } from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import { mmScaleFor } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';
import { polygonBbox } from '../geometry/shared/polygon-utils';

// ─── Kind (discriminator) ──────────────────────────────────────────────────────

/**
 * Διακριτικό είδος διαχωριστή — ο `kind` του entity. Στο v1 υπάρχει ένα μόνο είδος
 * (`room-bounding`)· νέα είδη (π.χ. area/zone separators) προστίθενται εδώ χωρίς νέο
 * EntityType.
 */
export type SpaceSeparatorKind = 'room-bounding';

export const DEFAULT_SPACE_SEPARATOR_KIND: SpaceSeparatorKind = 'room-bounding';

// ─── Parameters (user-editable SSoT) ──────────────────────────────────────────

/**
 * Space separator parameters. Linear measurements σε scene units (default mm).
 *
 *   - `start`/`end` — τα δύο άκρα της γραμμής (world coords). Μήκος > ε για έγκυρο.
 *   - `name?` — user label (προαιρετικό).
 *   - `sceneUnits` — canvas coordinate unit. Defaults to 'mm' (legacy compat).
 *   - `floorId?` — FK → Floor.id (storey reference, ADR-420 floor-scope).
 */
export interface SpaceSeparatorParams {
  readonly start: Point3D;
  readonly end: Point3D;
  readonly name?: string;
  readonly sceneUnits?: SceneUnits;
  readonly floorId?: string;
}

// ─── Geometry cache (derivable from params; SSoT = params) ────────────────────

/**
 * Computed space separator geometry. Returned by `computeSpaceSeparatorGeometry()` —
 * ΠΟΤΕ mutated by consumers. SSoT = params.
 */
export interface SpaceSeparatorGeometry {
  readonly bbox: BoundingBox3D;
  /** m. Μήκος του τμήματος start→end. */
  readonly length: number;
}

// ─── Entity (BIM generic instantiation) ───────────────────────────────────────

/**
 * Space separator BIM entity. Μη-δομική γραμμή οριοθέτησης χώρου (Revit Room
 * Separator). IFC: `IfcVirtualElement`. `kind` = `SpaceSeparatorKind`.
 */
export interface SpaceSeparatorEntity
  extends BimEntity<SpaceSeparatorKind, SpaceSeparatorParams, SpaceSeparatorGeometry>,
    IfcEntityMixin {
  readonly type: 'space-separator';
  readonly ifcType: 'IfcVirtualElement';
}

// ─── Defaults & constants ─────────────────────────────────────────────────────

/** Ελάχιστο μήκος (mm) για έγκυρο διαχωριστή — κάτω από αυτό = degenerate. */
export const MIN_SPACE_SEPARATOR_LENGTH_MM = 1;

// ─── Geometry derivation ──────────────────────────────────────────────────────

const MM_TO_M = 0.001;

/**
 * Pure geometry derivation. Καλείται από `UpdateSpaceSeparatorParamsCommand` /
 * factory — consumers ΠΟΤΕ απευθείας (SSoT = params). Idempotent.
 */
export function computeSpaceSeparatorGeometry(
  params: Pick<SpaceSeparatorParams, 'start' | 'end' | 'sceneUnits'>,
): SpaceSeparatorGeometry {
  const bbox = polygonBbox([params.start, params.end]);
  // Το μήκος είναι σε SCENE UNITS· μετατροπή σε μέτρα μέσω του sceneUnits SSoT
  // (mirror computeThermalSpaceGeometry). Για 'mm' scene ο factor είναι 1.
  const sceneToM = MM_TO_M / mmScaleFor(params);
  const lengthScene = Math.hypot(params.end.x - params.start.x, params.end.y - params.start.y);

  return {
    bbox,
    length: lengthScene * sceneToM,
  };
}

/** True αν ο διαχωριστής έχει έγκυρο (μη-degenerate) μήκος. */
export function isValidSpaceSeparatorLength(
  params: Pick<SpaceSeparatorParams, 'start' | 'end'>,
): boolean {
  const lengthScene = Math.hypot(params.end.x - params.start.x, params.end.y - params.start.y);
  return lengthScene > MIN_SPACE_SEPARATOR_LENGTH_MM;
}
