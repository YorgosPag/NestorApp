/**
 * ADR-376 Phase A — opening `params.mark` lazy allocator + optimistic scene
 * patch. Extracted από `useOpeningPersistence.allocateAndPersistOpening` για
 * 500-line cap (CLAUDE.md N.7.1). Pure (apart από Firestore read + scene
 * mutation via LevelManager).
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getOpeningMarkService } from '../services/opening-mark-service';
import type { OpeningEntity } from '../types/opening-types';
import type { SceneModel } from '../../types/entities';
import type { Level } from '../../systems/levels/config';

export interface OpeningAllocatorLevelManager {
  readonly currentLevelId: string | null;
  readonly levels: readonly Level[];
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface AllocateOpeningMarkDeps {
  readonly companyId: string;
  readonly projectId: string;
  readonly floorplanId: string;
  readonly levelManager: OpeningAllocatorLevelManager;
  readonly t: (k: string) => string;
}

export async function allocateMarkAndPatchScene(
  entity: OpeningEntity,
  deps: AllocateOpeningMarkDeps,
): Promise<OpeningEntity> {
  if (entity.params.mark !== undefined) return entity;
  const levelId = deps.levelManager.currentLevelId;
  if (!levelId) return entity;
  const level = deps.levelManager.levels.find((l) => l.id === levelId);
  if (!level?.floorId) {
    // Blank-canvas / non-wizard placement — pending Phase B per handoff Α.
    // eslint-disable-next-line no-console
    console.warn('[opening-mark] skipped allocation: level.floorId missing');
    return entity;
  }
  try {
    const floorSnap = await getDoc(doc(db, COLLECTIONS.FLOORS, level.floorId));
    const floorNumber = (floorSnap.data() as { number?: number } | undefined)?.number;
    if (typeof floorNumber !== 'number') return entity;
    const mark = await getOpeningMarkService().allocateMark({
      companyId: deps.companyId,
      projectId: deps.projectId,
      floorplanId: deps.floorplanId,
      floorNumber,
      kind: entity.kind,
      kindPrefix: deps.t(`opening.tag.prefix.${entity.kind}`),
      basementPrefix: deps.t('opening.tag.basementPrefix'),
    });
    const finalEntity = { ...entity, params: { ...entity.params, mark } } as OpeningEntity;
    const scene = deps.levelManager.getLevelScene(levelId);
    if (scene) {
      const nextEntities = scene.entities.map((e) =>
        e.id === finalEntity.id ? finalEntity : e,
      );
      deps.levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }
    return finalEntity;
  } catch {
    // Non-fatal — persist χωρίς mark, lazy-allocate σε επόμενο placement
    // ή μέσω migration script (`npm run bim:migrate:opening-tags`).
    return entity;
  }
}
