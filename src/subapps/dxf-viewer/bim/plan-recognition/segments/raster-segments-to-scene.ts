/**
 * ADR-929 Φ2 · Δ3 · Δ7 — τα τμήματα της εικόνας ως **είσοδος του αμετάβλητου `computeWallProposal`**.
 *
 * 🔑 **Στη σκηνή μόνο μέσω `rasterPixelToScene`** (Δ3): καμία δεύτερη απεικόνιση px → σκηνή.
 *
 * 🔑 **Παροδικές γραμμές, όχι οντότητες της σκηνής.** Ο πυρήνας του ADR-911 διαβάζει γραμμές με «χρώμα-ρόλο». Τα
 * τμήματα γίνονται γραμμές με δικό τους ρόλο ({@link RASTER_SEGMENT_ROLE_HEX}), **δίπλα** στις οντότητες της σκηνής.
 * Οι οντότητες της σκηνής χρειάζονται κι αυτές: κολόνες για την τοπολογία, υπάρχοντες τοίχοι για την ιδεμποτία
 * (`existing`). Τίποτα από αυτά δεν γράφεται. Η εγγραφή είναι η Φ5, με έγκριση ανθρώπου. Το id κάθε γραμμής είναι το
 * id του τμήματος, ώστε η κάλυψη και η επισήμανση να δείχνουν πίσω στην εικόνα (Δ9).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/segments/raster-segments-to-scene
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LineEntity } from '../../../types/entities';
import {
  rasterPixelToScene,
  type RasterPlacement,
} from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { SceneUnits } from '../../../hooks/drawing/wall-completion';
import type { EntityColorResolver } from '../../walls/same-color-rects';
import { createParallelPairStrategy, type WallDetectionStrategy } from '../../model-from-drawing/wall-detection-strategy';
import type { RasterSegment } from '../plan-recognition-types';

/** Ο ρόλος των γραμμών της εικόνας. Δεν είναι έγκυρο hex χρώματος, άρα δεν συμπίπτει ποτέ με γραμμή του σχεδίου. */
export const RASTER_SEGMENT_ROLE_HEX = 'plan-recognition:raster-segment';

/** Το layer των παροδικών γραμμών: δεν υπάρχει στη σκηνή, γιατί οι γραμμές δεν γράφονται ποτέ εκεί. */
const RASTER_SEGMENT_LAYER_ID = 'plan-recognition:transient';

/** Οι τρεις είσοδοι του `computeWallProposal` που αφορούν τις γραμμές. */
export interface RasterProposalLines {
  readonly entities: readonly Entity[];
  readonly colorOf: EntityColorResolver;
  readonly wallColorHex: string;
}

/** Ένα τμήμα στη σκηνή, με το id του. */
function sceneLine(segment: RasterSegment, placement: RasterPlacement): LineEntity {
  return {
    id: segment.id,
    type: 'line',
    layerId: RASTER_SEGMENT_LAYER_ID,
    color: RASTER_SEGMENT_ROLE_HEX,
    start: rasterPixelToScene(segment.start, placement),
    end: rasterPixelToScene(segment.end, placement),
  };
}

/**
 * Οι γραμμές της εικόνας δίπλα στις οντότητες της σκηνής, με ρόλο «τοίχος». Ο `colorOf` της σκηνής μένει ως έχει για
 * όλα τα άλλα.
 */
export function withRasterSegments(
  sceneEntities: readonly Entity[],
  sceneColorOf: EntityColorResolver,
  segments: readonly RasterSegment[],
  placement: RasterPlacement,
): RasterProposalLines {
  const lines = segments.map((s) => sceneLine(s, placement));
  const ids = new Set(lines.map((l) => l.id));
  return {
    entities: [...sceneEntities, ...lines],
    colorOf: (e) => (ids.has(e.id) ? RASTER_SEGMENT_ROLE_HEX : sceneColorOf(e)),
    wallColorHex: RASTER_SEGMENT_ROLE_HEX,
  };
}

/** Μονάδες σκηνής ανά px της αρχικής εικόνας, γύρω από ένα σημείο (η τοποθέτηση μπορεί να έχει άνισες κλίμακες). */
export function sceneUnitsPerPixel(placement: RasterPlacement, at: Point2D = { x: 0, y: 0 }): number {
  const o = rasterPixelToScene(at, placement);
  const x = rasterPixelToScene({ x: at.x + 1, y: at.y }, placement);
  const y = rasterPixelToScene({ x: at.x, y: at.y + 1 }, placement);
  return Math.max(Math.hypot(x.x - o.x, x.y - o.y), Math.hypot(y.x - o.x, y.y - o.y));
}

/**
 * Η ανοχή «ίδια ευθεία» για γραμμές από εικόνα, σε μονάδες σκηνής: `pixels` px της αρχικής εικόνας. Ένα pixel σάρωσης
 * είναι δεκάδες mm, όχι τα 5 mm της ανοχής κόμβων του διανυσματικού σχεδίου.
 */
export function rasterLineTolerance(placement: RasterPlacement, pixels: number): number {
  return pixels * sceneUnitsPerPixel(placement);
}

/**
 * Ανοχές γραμμών από εικόνα, σε px της **αρχικής** εικόνας (μετρημένες στη Φ2, ADR-929 §6.3):
 *   · «ίδια ευθεία»: 2 px. Θέση πινελιάς ±1 px μετά από ίσιωμα και δυαδοποίηση.
 *   · έλξη άκρων: 4 px. Σε λοξό κόμβο το άκρο χάνει μισή πινελιά / sin γωνίας, και σε σάρωση οι πινελιές είναι 1–3 px.
 */
export const RASTER_LINE_TOLERANCE_PX = 2;
export const RASTER_END_SNAP_PX = 4;

/** Η στρατηγική ζευγών για γραμμές από εικόνα: οι ανοχές της σε px, μετατρεμμένες μέσω της τοποθέτησης (Δ3). */
export function rasterParallelPairStrategy(placement: RasterPlacement, sceneUnits: SceneUnits): WallDetectionStrategy {
  return createParallelPairStrategy({
    sceneUnits,
    lineTolerance: rasterLineTolerance(placement, RASTER_LINE_TOLERANCE_PX),
    endSnapReach: rasterLineTolerance(placement, RASTER_END_SNAP_PX),
  });
}
