/**
 * Recognize the CURRENT storey for an MEP auto-design bridge (Stage 0, ADR-425) — the one
 * «Generate» prelude shared by every auto-design ribbon bridge (pipe disciplines via
 * `create-ribbon-mep-auto-bridge`, electrical strong + weak).
 *
 * Returns `null` when there is no current level or its scene is not loaded (the bridge no-ops).
 */

import { resolveSceneUnits, type SceneUnits } from '../../../../utils/scene-units';
import {
  recognizeSceneFromRegistry,
  registerMepRecognition,
  type RecognitionModel,
} from '../../../../systems/recognition';
import type { LevelSceneWriter } from '../../../../systems/levels/level-scene-accessor';
import type { SceneModel } from '../../../../types/scene';

export interface RecognizedStorey {
  readonly levelId: string;
  readonly entities: SceneModel['entities'];
  readonly sceneUnits: SceneUnits;
  readonly model: RecognitionModel;
}

export function recognizeCurrentStorey(
  levelManager: Pick<LevelSceneWriter, 'currentLevelId' | 'getLevelScene'>,
): RecognizedStorey | null {
  const levelId = levelManager.currentLevelId;
  if (!levelId) return null;
  const scene = levelManager.getLevelScene(levelId);
  if (!scene) return null;
  const entities = scene.entities;
  const sceneUnits = resolveSceneUnits(scene);
  registerMepRecognition();
  const model = recognizeSceneFromRegistry({ entities, storeyId: levelId, sceneUnits });
  return { levelId, entities, sceneUnits, model };
}
