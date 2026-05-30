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
  try {
    const floorNumber = await resolveFloorNumber(deps);
    if (floorNumber === null) return entity;
    const mark = await allocateMarkForKind(entity.params.kind, floorNumber, deps);
    return patchSceneMark(entity, mark, levelId, deps);
  } catch {
    // Non-fatal — persist χωρίς mark, lazy-allocate σε επόμενο placement
    // ή μέσω migration script (`npm run bim:migrate:opening-tags`).
    return entity;
  }
}

/**
 * ADR-363 §5.4 — re-align an AUTO mark με τον τρέχοντα τύπο του κουφώματος όταν
 * αλλάζει ο τύπος (π.χ. πόρτα→παράθυρο: `Θ.101`→`Π.001`). Industry pattern
 * (ArchiCAD / Revit auto-tag): το ταμπελάκι ακολουθεί την κατηγορία.
 *
 * Skip — επιστρέφει το entity ως έχει — όταν:
 *   - το mark είναι χειροκίνητο (`markIsManual`) — σεβασμός της επιλογής χρήστη,
 *   - δεν υπάρχει ακόμη mark (πρώτη ανάθεση = `allocateMarkAndPatchScene`),
 *   - το prefix ήδη ταιριάζει με τον τύπο (κανένα mismatch).
 *
 * Re-allocates μέσω του ΙΔΙΟΥ `OpeningMarkService` (επόμενο ελεύθερο νούμερο της
 * νέας σειράς), reuse του floor-number lookup με την πρώτη ανάθεση.
 */
export async function syncMarkToKindAndPatchScene(
  entity: OpeningEntity,
  deps: AllocateOpeningMarkDeps,
): Promise<OpeningEntity> {
  if (entity.params.markIsManual) return entity;
  const mark = entity.params.mark;
  if (!mark) return entity;
  const kind = entity.params.kind;
  const expectedPrefix = deps.t(`opening.tag.prefix.${kind}`);
  if (mark.startsWith(`${expectedPrefix}.`)) return entity;
  const levelId = deps.levelManager.currentLevelId;
  if (!levelId) return entity;
  try {
    const floorNumber = await resolveFloorNumber(deps);
    if (floorNumber === null) return entity;
    const newMark = await allocateMarkForKind(kind, floorNumber, deps);
    return patchSceneMark(entity, newMark, levelId, deps);
  } catch {
    return entity;
  }
}

// ─── Shared internals ────────────────────────────────────────────────────────

/** Resolve the signed `FloorDocument.number` for the current level, or null. */
async function resolveFloorNumber(deps: AllocateOpeningMarkDeps): Promise<number | null> {
  const levelId = deps.levelManager.currentLevelId;
  if (!levelId) return null;
  const level = deps.levelManager.levels.find((l) => l.id === levelId);
  if (!level?.floorId) {
    // Blank-canvas / non-wizard placement — pending Phase B per handoff Α.
    // eslint-disable-next-line no-console
    console.warn('[opening-mark] skipped allocation: level.floorId missing');
    return null;
  }
  const floorSnap = await getDoc(doc(db, COLLECTIONS.FLOORS, level.floorId));
  const floorNumber = (floorSnap.data() as { number?: number } | undefined)?.number;
  return typeof floorNumber === 'number' ? floorNumber : null;
}

/** Allocate the next free mark for `(kind, floorNumber)` via the SSoT service. */
function allocateMarkForKind(
  kind: OpeningEntity['params']['kind'],
  floorNumber: number,
  deps: AllocateOpeningMarkDeps,
): Promise<string> {
  return getOpeningMarkService().allocateMark({
    companyId: deps.companyId,
    projectId: deps.projectId,
    floorplanId: deps.floorplanId,
    floorNumber,
    kind,
    kindPrefix: deps.t(`opening.tag.prefix.${kind}`),
    basementPrefix: deps.t('opening.tag.basementPrefix'),
  });
}

/** Optimistically patch `params.mark` into the scene + return the new entity. */
function patchSceneMark(
  entity: OpeningEntity,
  mark: string,
  levelId: string,
  deps: AllocateOpeningMarkDeps,
): OpeningEntity {
  const finalEntity = { ...entity, params: { ...entity.params, mark } } as OpeningEntity;
  const scene = deps.levelManager.getLevelScene(levelId);
  if (scene) {
    const nextEntities = scene.entities.map((e) =>
      e.id === finalEntity.id ? finalEntity : e,
    );
    deps.levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
  }
  return finalEntity;
}
