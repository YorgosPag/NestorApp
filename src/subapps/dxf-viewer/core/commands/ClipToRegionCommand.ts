/**
 * ClipToRegionCommand — wraps the "clip to region" operation in the undo/redo system.
 *
 * Stores a before/after snapshot of the DXF scene and the overlay polygon changes
 * so the operation is fully reversible via CommandHistory.
 *
 * Pattern: snapshot command (cannot mathematically invert a destructive clip).
 * - execute / redo: apply clipped scene + overlay changes
 * - undo:           restore original scene + restore each overlay via store.restore()
 */

import type { ICommand, SerializedCommand } from './interfaces';
import type { SceneModel } from '../../types/scene';
import type { Overlay } from '../../overlays/types';
import { generateEntityId } from '../../systems/entity-creation/utils';

// ── Minimal overlay-store interface (only what we need) ────────────────────────

interface OverlayStoreMutations {
  remove: (id: string) => Promise<void>;
  update: (id: string, patch: { polygon: Array<[number, number]> }) => Promise<void>;
  restore: (overlay: Overlay) => Promise<void>;
}

// ── Per-overlay change record ──────────────────────────────────────────────────

export interface OverlayClipChange {
  readonly before: Overlay;
  /** null → overlay was fully outside the rect and was removed. */
  readonly after: Array<[number, number]> | null;
}

// ── Command ───────────────────────────────────────────────────────────────────

export class ClipToRegionCommand implements ICommand {
  readonly id: string;
  readonly name = 'ClipToRegion';
  readonly type = 'clip-to-region';
  readonly timestamp: number;

  constructor(
    private readonly levelId: string,
    private readonly beforeScene: SceneModel,
    private readonly clippedScene: SceneModel,
    private readonly overlayChanges: readonly OverlayClipChange[],
    private readonly setLevelScene: (levelId: string, scene: SceneModel) => void,
    private readonly overlayStore: OverlayStoreMutations,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.setLevelScene(this.levelId, this.clippedScene);
    this.applyOverlayChanges();
  }

  undo(): void {
    this.setLevelScene(this.levelId, this.beforeScene);
    // restore() upserts — works for both updated and deleted overlays.
    for (const { before } of this.overlayChanges) {
      void this.overlayStore.restore(before);
    }
  }

  redo(): void {
    this.setLevelScene(this.levelId, this.clippedScene);
    this.applyOverlayChanges();
  }

  private applyOverlayChanges(): void {
    for (const { before, after } of this.overlayChanges) {
      if (after === null) {
        void this.overlayStore.remove(before.id);
      } else {
        void this.overlayStore.update(before.id, { polygon: after });
      }
    }
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return 'Clip to Region';
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        levelId: this.levelId,
        entityCount: this.clippedScene.entities.length,
        overlayChanges: this.overlayChanges.length,
      },
      version: 1,
    };
  }

  validate(): string | null {
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [];
  }
}
