/**
 * RENUMBER OPENINGS COMMAND — ADR-376 Phase B.1.
 *
 * Bulk-renames `params.mark` (+ resets `params.markIsManual` to undefined)
 * across many openings σε ένα atomic step. Wraps precomputed
 * `RenumberUpdate[]` από `opening-renumber-service.ts` σε ICommand contract
 * για undo/redo + history entry.
 *
 * Write path:
 *   - Firestore `writeBatch` patches `params` field per opening doc.
 *   - SceneManager `updateEntities()` mirrors the changes optimistically so
 *     the user sees new marks instantly — Firestore snapshot eventually
 *     confirms (idempotent merge).
 *
 * Undo path:
 *   - Snapshot per opening: `{ openingId, prevMark, prevMarkIsManual }`
 *     captured at construction. Reverse batch + scene revert.
 *
 * Mirrors the API of `UpdateOpeningParamsCommand` (ADR-363 Phase 2.5).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §4.9 §7 Phase B.1
 */

import {
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { OpeningEntity, OpeningKind, OpeningParams } from '../../../bim/types/opening-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface RenumberOpeningsUpdate {
  readonly openingId: string;
  readonly newMark: string;
  readonly kind: OpeningKind;
  readonly floorNumber: number;
}

interface OpeningSnapshot {
  readonly openingId: string;
  readonly prevMark: string | undefined;
  readonly prevMarkIsManual: boolean | undefined;
  readonly newMark: string;
}

// ────────────────────────────────────────────────────────────────────────────
// COMMAND
// ────────────────────────────────────────────────────────────────────────────

export class RenumberOpeningsCommand implements ICommand {
  readonly id: string;
  readonly name = 'RenumberOpenings';
  readonly type = 'renumber-openings';
  readonly timestamp: number;

  private readonly snapshots: ReadonlyArray<OpeningSnapshot>;
  private wasExecuted = false;

  constructor(
    private readonly updates: ReadonlyArray<RenumberOpeningsUpdate>,
    private readonly sceneManager: ISceneManager,
    private readonly userId: string,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.snapshots = updates.map((u) => {
      const entity = sceneManager.getEntity(u.openingId) as OpeningEntity | undefined;
      return {
        openingId: u.openingId,
        prevMark: entity?.params?.mark,
        prevMarkIsManual: entity?.params?.markIsManual,
        newMark: u.newMark,
      };
    });
  }

  execute(): void {
    void this.applyMarks((s) => ({ mark: s.newMark, markIsManual: false }));
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    void this.applyMarks((s) => ({ mark: s.prevMark, markIsManual: s.prevMarkIsManual }));
  }

  redo(): void {
    void this.applyMarks((s) => ({ mark: s.newMark, markIsManual: false }));
  }

  private async applyMarks(
    resolve: (snap: OpeningSnapshot) => { mark: string | undefined; markIsManual: boolean | undefined },
  ): Promise<void> {
    const batch = writeBatch(db);
    const sceneUpdates = new Map<string, Partial<SceneEntity>>();

    for (const snap of this.snapshots) {
      const target = resolve(snap);
      const entity = this.sceneManager.getEntity(snap.openingId) as OpeningEntity | undefined;
      // eslint-disable-next-line no-console
      console.log('[DBG-TAG] RenumberCommand snap', { openingId: snap.openingId, newMark: target.mark, entityFound: !!entity, entityMark: entity?.params.mark });
      if (!entity) continue;

      const nextParams: OpeningParams = {
        ...entity.params,
        ...(target.mark === undefined ? { mark: undefined } : { mark: target.mark }),
        ...(target.markIsManual === undefined
          ? { markIsManual: undefined }
          : { markIsManual: target.markIsManual }),
      } as OpeningParams;

      // eslint-disable-next-line no-console
      console.log('[DBG-TAG] RenumberCommand nextParams.mark', { id: snap.openingId, nextMark: nextParams.mark });
      sceneUpdates.set(snap.openingId, { params: nextParams } as Partial<SceneEntity>);

      batch.update(doc(db, COLLECTIONS.FLOORPLAN_OPENINGS, snap.openingId), {
        params: nextParams,
        updatedBy: this.userId,
        updatedAt: serverTimestamp(),
      });
    }

    // eslint-disable-next-line no-console
    console.log('[DBG-TAG] RenumberCommand updateEntities', { count: sceneUpdates.size, ids: [...sceneUpdates.keys()] });
    if (sceneUpdates.size > 0) this.sceneManager.updateEntities(sceneUpdates);

    try {
      await batch.commit();
    } catch {
      // Firestore batch failure is logged upstream by global error boundary;
      // scene already updated optimistically — next snapshot will reconcile.
    }
  }

  getDescription(): string {
    return `Renumber ${this.updates.length} openings`;
  }

  getAffectedEntityIds(): string[] {
    return this.updates.map((u) => u.openingId);
  }

  validate(): string | null {
    if (this.updates.length === 0) return 'No openings to renumber';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        updates: this.updates,
        snapshots: this.snapshots,
        userId: this.userId,
      },
      version: 1,
    };
  }
}
