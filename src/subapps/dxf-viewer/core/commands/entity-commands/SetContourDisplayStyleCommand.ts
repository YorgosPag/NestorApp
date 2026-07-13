/**
 * SET CONTOUR DISPLAY STYLE COMMAND — ADR-650 M3 (per-contour display writer).
 *
 * Batch, undoable flip of the non-destructive `smoothDisplay` flag on N contour
 * lwpolylines (exact chords ↔ fitted Catmull-Rom curve — Civil 3D «Contour
 * Smoothing»). Purely display: `vertices` (the surveyed control points) are never
 * touched, so hit-test, grips and legal/Κτηματολόγιο export keep the EXACT
 * geometry regardless of style.
 *
 * Snapshots are built ONCE on first `execute()`, so `undo()`/`redo()` are pure
 * re-applies (BatchEntityPatchCommand contract). Persist via the shared
 * `signalEntitiesAttached` SSoT (ADR-401) — the display choice survives reload,
 * matching Civil 3D remembering its surface style.
 *
 * @see systems/topography/contour-display-store.ts — the current-style preference
 * @see rendering/entities/shared/geometry-smooth-display.ts — the curve builder
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import {
  EntityIdsBatchPatchCommand,
  type BatchPatchEntry,
} from './batch-entity-patch-command';

/** Per-entity snapshot: was it smoothed before / after. */
type SmoothState = boolean;

export class SetContourDisplayStyleCommand extends EntityIdsBatchPatchCommand<SmoothState> {
  readonly name = 'SetContourDisplayStyle';
  readonly type = 'set-contour-display-style';

  constructor(
    entityIds: readonly string[],
    private readonly smooth: boolean,
    sceneManager: ISceneManager,
  ) {
    super(entityIds, sceneManager, true);
  }

  protected buildPatches(): BatchPatchEntry<SmoothState>[] {
    const out: BatchPatchEntry<SmoothState>[] = [];
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as
        { smoothDisplay?: boolean } | undefined;
      if (!entity) continue;
      out.push({ entityId, prev: entity.smoothDisplay === true, next: this.smooth });
    }
    return out;
  }

  protected applyState(entry: BatchPatchEntry<SmoothState>, smooth: SmoothState): void {
    // Always write an explicit boolean (never `undefined`) — Firestore-safe.
    this.sceneManager.updateEntity(entry.entityId, { smoothDisplay: smooth } as unknown as Partial<SceneEntity>);
  }

  getDescription(): string {
    return `Set contour display ${this.smooth ? 'smooth' : 'exact'} on ${this.entityIds.length} contour(s)`;
  }
  // getAffectedEntityIds / validate inherited (EntityIdsBatchPatchCommand).

  protected serializeData(): Record<string, unknown> {
    return { entityIds: this.entityIds, smooth: this.smooth };
  }
}
