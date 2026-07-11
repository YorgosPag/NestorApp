'use client';

/**
 * ADR-632 CL-2 — cross-level εγγραφή auto «well» opening στον όροφο της **πλάκας**
 * ενώ ο ενεργός όροφος είναι άλλος (mirror `foundation-cross-level-writer`, ADR-459).
 *
 * Το single-level `useSlabOpeningPersistence` γράφει ΠΑΝΤΑ στο scope του ενεργού
 * ορόφου (ο first-save listener του πιάνει το `drawing:entity-created` της ενεργής
 * σκηνής) → ΔΕΝ μπορεί να persist-άρει opening που ανήκει σε **άλλον** όροφο. Αυτός
 * ο writer στήνει ένα `SlabOpeningFirestoreService` με το **scope του ορόφου-στόχου**
 * (`target.floorId/floorplanId`) και γράφει απευθείας, + μεταλλάσσει τη σκηνή του
 * ορόφου-στόχου ΟΤΑΝ είναι φορτωμένη (αλλιώς η Firestore subscription του
 * συγχρονίζει μόλις ο χρήστης πάει εκεί).
 *
 * **Derived-write (big-player, Revit/ArchiCAD):** το «well» opening είναι
 * associative/derived — heals σε κάθε reconcile, ανήκει στον engine, ΔΕΝ μπαίνει στο
 * undo stack. Firestore writes = fire-and-forget· errors μη-κρίσιμα (heal στο επόμενο
 * reconcile). Scene origin `'system-reconcile'` = δεν πυροδοτεί το DXF autosave του
 * ορόφου-στόχου (ADR-461/293 θόρυβος σε special/file-less levels).
 *
 * @see bim/slab-openings/slab-opening-firestore-service.ts — service + entityToSaveInput
 * @see bim/foundations/foundation-cross-level-writer.ts — το ίδιο pattern (πέδιλα, ADR-459)
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §8b
 */

import {
  createSlabOpeningFirestoreService,
  entityToSaveInput,
  type SlabOpeningFirestoreService,
} from '../slab-openings/slab-opening-firestore-service';
import { resolveBimPersistenceScope } from '../persistence/bim-floor-scope';
import {
  mutateLevelSceneEntities,
  type LevelSceneEntitiesIO,
} from '../../systems/levels/mutate-level-scene';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import type { AnySceneEntity } from '../../types/scene';

/** Auth/project scope (κοινό κτίριο — αλλάζει μόνο ο όροφος-στόχος). */
export interface StairwellOpeningWriteScope {
  readonly companyId: string | null | undefined;
  readonly projectId: string | null | undefined;
  readonly userId: string | null | undefined;
}

/** Ο όροφος-στόχος (της πλάκας) όπου ζει/γράφεται το opening. */
export interface StairwellOpeningWriteTarget {
  readonly levelId: string;
  readonly floorId: string | null;
  readonly floorplanId: string | null;
}

/** Cross-level εγγραφή «well» openings στον όροφο της πλάκας (Firestore + scene). */
export interface StairwellOpeningCrossLevelWriter {
  /** Δημιουργία ή ενημέρωση opening (setDoc overwrite — deterministic id, idempotent). */
  put(entity: SlabOpeningEntity): void;
  /** Διαγραφή opening (η σκάλα έφυγε / έπαψε η παράβαση). */
  remove(openingId: string): void;
}

/** Αντικαθιστά (ή προσθέτει) το entity με βάση το id — idempotent σε re-run. */
function upsertById(
  entities: readonly AnySceneEntity[],
  entity: AnySceneEntity,
): AnySceneEntity[] {
  const idx = entities.findIndex((e) => e.id === entity.id);
  if (idx < 0) return [...entities, entity];
  const next = entities.slice();
  next[idx] = entity;
  return next;
}

/**
 * Φτιάχνει writer για το scope του ορόφου-στόχου, ή `null` αν λείπει έγκυρο scope
 * (companyId/projectId/userId + floorId/floorplanId).
 */
export function createStairwellOpeningCrossLevelWriter(
  scope: StairwellOpeningWriteScope,
  target: StairwellOpeningWriteTarget,
  io: LevelSceneEntitiesIO,
): StairwellOpeningCrossLevelWriter | null {
  const resolved = resolveBimPersistenceScope({
    companyId: scope.companyId,
    projectId: scope.projectId,
    userId: scope.userId,
    floorId: target.floorId,
    floorplanId: target.floorplanId,
  });
  if (!resolved) return null;

  const svc: SlabOpeningFirestoreService = createSlabOpeningFirestoreService({
    companyId: resolved.companyId,
    projectId: resolved.projectId,
    floorplanId: resolved.floorplanId,
    floorId: resolved.floorId,
    userId: resolved.userId,
  });

  return {
    put(entity) {
      mutateLevelSceneEntities(
        io,
        target.levelId,
        (es) => upsertById(es, entity as unknown as AnySceneEntity),
        'system-reconcile',
      );
      // neverUpdate (ADR-594): save = setDoc overwrite — idempotent στο deterministic id.
      void svc.saveSlabOpening(entityToSaveInput(entity)).catch(() => {
        /* μη-κρίσιμο: heal στο επόμενο reconcile / επίσκεψη ορόφου */
      });
    },
    remove(openingId) {
      mutateLevelSceneEntities(
        io,
        target.levelId,
        (es) => es.filter((e) => e.id !== openingId),
        'system-reconcile',
      );
      void svc.deleteSlabOpening(openingId).catch(() => {
        /* μη-κρίσιμο */
      });
    },
  };
}
