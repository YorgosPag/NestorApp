/**
 * ADR-911 × ADR-929 Φ5 — **από πού έρχονται οι γραμμές** της πρότασης τοίχων. Η ΜΙΑ ραφή ανάμεσα στον βοηθό
 * «Μοντέλο από το σχέδιο» και την αναγνώριση κάτοψης από εικόνα: η μηχανή τοίχων (`computeWallProposal`), η
 * προεπισκόπηση, οι ομάδες πάχους και η έγκριση μένουν **ίδιες**· αλλάζει μόνο η είσοδος.
 *
 *   · `scene`  — οι γραμμές του σχεδίου με το χρώμα-ρόλο που έδειξε ο άνθρωπος (η αρχική ροή του ADR-911).
 *   · `raster` — τα τμήματα της εικόνας του υποβάθρου (Φ2, μετά τη συνόρθωση της Φ4), ως παροδικές γραμμές
 *                (`withRasterSegments`) με τη στρατηγική ζευγών παρειών (`rasterParallelPairStrategy`, Δ7).
 *
 * 🔑 Η **τοποθέτηση** της εικόνας διαβάζεται ΤΗ ΣΤΙΓΜΗ της πράξης (`getFloorBackground`), όχι όταν έγινε η
 *   αναγνώριση: μια βαθμονόμηση στο μεταξύ αλλάζει τη θέση των τοίχων, και η έγκριση πρέπει να γράψει ό,τι
 *   φαίνεται τώρα. Γι' αυτό η πηγή κρατά `floorId`, όχι placement.
 *
 * Zero React. Καθαρό ως προς τη σκηνή· διαβάζει μόνο το store υποβάθρων.
 *
 * @see ./model-from-drawing-session.ts (ο μόνος καταναλωτής)
 * @see ../../bim/plan-recognition/segments/raster-segments-to-scene.ts
 */

import type { Entity, SceneLayer } from '../../types/entities';
import type { RasterSegment } from '../../bim/plan-recognition/plan-recognition-types';
import type { WallDetectionStrategy } from '../../bim/model-from-drawing/wall-detection-strategy';
import type { EntityColorResolver } from '../../bim/walls/same-color-rects';
import {
  rasterLineTolerance,
  rasterParallelPairStrategy,
  withRasterSegments,
} from '../../bim/plan-recognition/segments/raster-segments-to-scene';
import { getFloorBackground } from '../../floorplan-background/stores/floorplanBackgroundStore';
import type { RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { resolveEntityColorHex } from '../selection/select-similar-by-color';
import type { LiveScene } from './model-from-drawing-live';

export type ProposalLineSource =
  | { readonly kind: 'scene' }
  | {
      readonly kind: 'raster';
      /** Η αναγνώριση από την οποία προήλθαν τα τμήματα: νέα αναγνώριση ⇒ νέα πρόταση. */
      readonly recognitionId: string;
      readonly floorId: string;
      /** Σε `raster-px` της αρχικής εικόνας. */
      readonly segments: readonly RasterSegment[];
    };

export const SCENE_LINE_SOURCE: ProposalLineSource = { kind: 'scene' };

/** Οι είσοδοι γραμμών του `computeWallProposal`. */
export interface ResolvedProposalLines {
  readonly entities: readonly Entity[];
  readonly colorOf: EntityColorResolver;
  readonly wallColorHex: string;
  readonly strategy?: WallDetectionStrategy;
  /** ADR-929 Φ5.2δ — πηγή-εικόνα: ανοχή ομαδοποίησης πάχους (mm) από το μέγεθος του pixel. */
  readonly thicknessToleranceMm?: number;
}

/** Η τρέχουσα τοποθέτηση της εικόνας ενός ορόφου, ή `null` αν ο όροφος δεν έχει (πια) υπόβαθρο. */
export function currentRasterPlacement(floorId: string): RasterPlacement | null {
  const background = getFloorBackground(floorId);
  return background ? { transform: background.transform, naturalBounds: background.naturalBounds } : null;
}

/**
 * Είναι η **θέση** της εικόνας στη σκηνή μετρικά σωστή; Μόνο η βαθμονόμηση του viewer (ADR-340) κλιμακώνει την
 * τοποθέτηση· η κλίμακα της συλλογής (`scale`) είναι μεταδεδομένο και δεν τη μετακινεί. Χωρίς αυτήν η προεπισκόπηση
 * ταιριάζει οπτικά με την εικόνα (ίδια τοποθέτηση), αλλά μήκη και πάχη σε mm θα ήταν λάθος ⇒ καμία εγγραφή.
 */
export function isRasterPlacementCalibrated(source: ProposalLineSource): boolean {
  if (source.kind === 'scene') return true;
  return (getFloorBackground(source.floorId)?.calibration ?? null) !== null;
}

/**
 * ADR-929 Φ5.2δ — πόσα mm είναι ±1,5 pixel της εικόνας με την τρέχουσα τοποθέτηση (ο μεγαλύτερος άξονας): ο θόρυβος
 * ψηφιοποίησης του πάχους, δηλαδή το εύρος του πυρήνα των ομάδων (Φ5.2ε). Το μέγεθος του pixel έρχεται από το ΕΝΑ
 * `sceneUnitsPerPixel` (μέσω `rasterLineTolerance`) — όχι από δεύτερο υπολογισμό πάνω στον affine πίνακα.
 */
function rasterThicknessToleranceMm(placement: RasterPlacement, sceneUnits: SceneUnits): number {
  const tolerance = rasterLineTolerance(placement, MODEL_FROM_DRAWING_LIMITS.RASTER_THICKNESS_TOLERANCE_PX);
  return tolerance / mmToSceneUnits(sceneUnits);
}

/**
 * Οι γραμμές της πρότασης για την πηγή. `null` ⇒ δεν υπάρχει ακόμα τι να προταθεί (καμία απόφαση χρώματος για
 * τη σκηνή, ή χαμένο υπόβαθρο για την εικόνα).
 */
export function resolveProposalLines(
  source: ProposalLineSource,
  live: LiveScene,
  wallColorHex: string | null,
  layersById: Record<string, SceneLayer>,
): ResolvedProposalLines | null {
  const sceneColorOf: EntityColorResolver = (e) => resolveEntityColorHex(e, layersById);
  if (source.kind === 'scene') {
    return wallColorHex ? { entities: live.entities, colorOf: sceneColorOf, wallColorHex } : null;
  }
  const placement = currentRasterPlacement(source.floorId);
  if (!placement) return null;
  return {
    ...withRasterSegments(live.entities, sceneColorOf, source.segments, placement),
    strategy: rasterParallelPairStrategy(placement, live.sceneUnits),
    thicknessToleranceMm: rasterThicknessToleranceMm(placement, live.sceneUnits),
  };
}
