/**
 * Wall Covering — Room partition SSoT (ADR-511 Slice C «το μαγικό»).
 *
 * Δοθέντος ενός τοίχου + παρειάς + των IfcSpaces (θερμικών χώρων), κατατέμνει την παρειά σε
 * **μία περιοχή ανά δωμάτιο**: για κάθε space footprint, προβάλλει τη γραμμή της παρειάς πάνω
 * στο πολύγωνο του δωματίου (`coveredIntervals` SSoT) → τα διαστήματα όπου η παρειά βρίσκεται
 * ΜΕΣΑ στο δωμάτιο → ένα region ανά (δωμάτιο, interval). Τα όρια ακολουθούν ΔΩΜΑΤΙΑ (όχι
 * κολώνες) — ένα όριο μπορεί να πέφτει στη μέση φατνώματος (κλειδωμένη απόφαση Giorgio).
 *
 * Reuse `coveredIntervals` (segment∩polygon, t∈[0,1]) + `wallCoveringFaceLine`. Pure.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see bim/geometry/shared/segment-polygon-coverage.ts — coveredIntervals SSoT
 */

import type { WallCoveringFaceSide } from '../types/wall-covering-types';
import type { ThermalSpaceUseType } from '../types/thermal-space-types';
import type { WallCoveringHost } from './wall-covering-strip-geometry';
import { wallCoveringFaceLine } from './wall-covering-strip-geometry';
import { coveredIntervals } from '../geometry/shared/segment-polygon-coverage';
import { mmScaleFor } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';

/** Δομικό minimum ενός θερμικού χώρου (το ικανοποιεί το `ThermalSpaceEntity`). */
export interface RoomSpaceLike {
  readonly id: string;
  readonly params: {
    readonly footprint: { readonly vertices: readonly { readonly x: number; readonly y: number }[] };
    readonly useType: ThermalSpaceUseType;
  };
}

/** Μία περιοχή φινιρίσματος ανά δωμάτιο (κατά μήκος της παρειάς). */
export interface WallCoveringRoomRegion {
  readonly spaceId: string;
  readonly useType: ThermalSpaceUseType;
  readonly spanStartMm: number;
  readonly spanEndMm: number;
}

export interface PartitionOptions {
  readonly sceneUnits?: SceneUnits;
  /** Ελάχιστο μήκος region (mm) — μικρότερα παραλείπονται ως αριθμητικό noise. Default 50. */
  readonly minRegionMm?: number;
}

const DEFAULT_MIN_REGION_MM = 50;

/**
 * Κατατέμνει την παρειά του τοίχου σε regions, ένα ανά δωμάτιο που την «ακουμπά». Επιστρέφει
 * άδειο όταν η γεωμετρία τοίχου λείπει ή κανένα δωμάτιο δεν καλύπτει την παρειά. Ταξινομημένο
 * κατά `spanStartMm`.
 */
export function partitionWallByRooms(
  wall: WallCoveringHost,
  faceSide: WallCoveringFaceSide,
  spaces: readonly RoomSpaceLike[],
  options: PartitionOptions = {},
): WallCoveringRoomRegion[] {
  const face = wallCoveringFaceLine(wall, faceSide);
  if (!face) return [];

  const sceneUnits = options.sceneUnits ?? 'mm';
  const minRegionMm = options.minRegionMm ?? DEFAULT_MIN_REGION_MM;
  const mmToScene = mmScaleFor({ sceneUnits });

  const faceLenScene = Math.hypot(face.b.x - face.a.x, face.b.y - face.a.y);
  if (faceLenScene < 1e-6) return [];
  const faceLenMm = faceLenScene / mmToScene;

  const regions: WallCoveringRoomRegion[] = [];
  for (const space of spaces) {
    const poly = space.params?.footprint?.vertices;
    if (!poly || poly.length < 3) continue;
    const intervals = coveredIntervals(face.a, face.b, poly);
    for (const [t0, t1] of intervals) {
      const spanStartMm = t0 * faceLenMm;
      const spanEndMm = t1 * faceLenMm;
      if (spanEndMm - spanStartMm < minRegionMm) continue;
      regions.push({ spaceId: space.id, useType: space.params.useType, spanStartMm, spanEndMm });
    }
  }

  regions.sort((a, b) => a.spanStartMm - b.spanStartMm);
  return regions;
}
