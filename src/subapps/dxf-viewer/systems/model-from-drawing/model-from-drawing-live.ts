/**
 * ADR-911 — η **ζωντανή σκηνή** όπως τη διαβάζουν οι ελεγκτές του βοηθού, και το δείγμα χρώματος
 * κάτω από ένα κλικ. ΕΝΑ σημείο για τους δύο ελεγκτές (τοίχοι · ανοίγματα): αν ο καθένας διάβαζε
 * τη σκηνή με τον δικό του τρόπο, «η σκηνή που φωτίστηκε» και «η σκηνή που γράφεται» θα μπορούσαν
 * να είναι δύο διαφορετικά πράγματα.
 *
 * Διαβάζεται ΤΗ ΣΤΙΓΜΗ της πράξης, ποτέ νωρίτερα. Zero React.
 *
 * @see ./model-from-drawing-session.ts (τοίχοι)
 * @see ./model-from-drawing-openings-session.ts (ανοίγματα)
 */

import type { Entity, SceneLayer } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { WallSceneAccessor } from '../../bim/walls/add-wall-to-scene';
import { extractLineSegments, pickSegmentAt } from '../../bim/walls/wall-in-region';
import { resolveEntityColorHex } from '../selection/select-similar-by-color';
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';

export interface LiveScene {
  readonly levelId: string;
  readonly entities: readonly Entity[];
  readonly sceneUnits: SceneUnits;
}

/** Ό,τι χρειάζεται ένα δείγμα χρώματος από τον κόσμο. */
export interface SampleDeps {
  readonly accessor: WallSceneAccessor;
  readonly layersById: Record<string, SceneLayer>;
  /** Ακτίνα επιλογής γραμμής-δείγματος, σε μονάδες κόσμου. */
  readonly pickTolerance: number;
}

/** Γιατί ένα κλικ δεν έδωσε χρώμα-ρόλο. */
export type SampleFailure = 'no-scene' | 'no-line' | 'no-color';

export function isSampleFailure(sampled: string): sampled is SampleFailure {
  return sampled === 'no-scene' || sampled === 'no-line' || sampled === 'no-color';
}

export function readLiveScene(accessor: WallSceneAccessor): LiveScene | null {
  const levelId = accessor.currentLevelId;
  const scene = levelId ? accessor.getLevelScene(levelId) : null;
  if (!levelId || !scene) return null;
  return { levelId, entities: (scene.entities ?? []) as readonly Entity[], sceneUnits: resolveSceneUnits(scene) };
}

/**
 * Το αποδιδόμενο χρώμα της γραμμής κάτω από το `point`, ή ο λόγος που δεν βρέθηκε. Με `curves`
 * το δείγμα πιάνει και καμπύλες (το τόξο του φύλλου μιας πόρτας ΕΙΝΑΙ σύμβολο κουφώματος)· οι
 * τοίχοι δειγματίζονται μόνο από ευθείες.
 */
export function sampleColorAt(point: Point2D, deps: SampleDeps, curves: boolean): string | SampleFailure {
  const live = readLiveScene(deps.accessor);
  if (!live) return 'no-scene';
  const segments = extractLineSegments(live.entities, { tessellateCurves: curves });
  const segment = pickSegmentAt(point, segments, deps.pickTolerance);
  const entity = segment ? live.entities.find((e) => e.id === segment.id) : undefined;
  if (!entity) return 'no-line';
  return resolveEntityColorHex(entity, deps.layersById) ?? 'no-color';
}
