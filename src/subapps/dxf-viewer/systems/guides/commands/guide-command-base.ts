/**
 * @module systems/guides/commands/guide-command-base
 * @description Template-Method bases for the guide command family.
 *
 * Two recurring lifecycles are centralised here so the concrete commands stay
 * thin (only their name/type, build logic and serialized payload):
 * - {@link CreatedGuidesCommand} — commands that ADD guides (create / entity /
 *   pattern). Execute builds once then restores on redo; undo removes them.
 * - {@link BatchRotateGuidesCommand} — commands that rotate a SET of guides
 *   around a pivot, snapshotting originals for undo.
 *
 * @see ADR-613 (Guide command SSoT)
 * @see ./base-command via ../../../core/commands/base-command (generic ICommand base)
 * @since 2026-07-09
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { BaseCommand } from '../../../core/commands/base-command';
import { computeRotatedGuideEndpoints, type GuideEndpoints } from './guide-command-geometry';

// ============================================================================
// CREATED-GUIDES LIFECYCLE (add commands)
// ============================================================================

/**
 * Base for commands that create one or more guides. Subclasses implement only
 * {@link buildGuides} (run once on first execute); the base handles the
 * redo-restore / undo-remove / affected-ids lifecycle.
 */
export abstract class CreatedGuidesCommand extends BaseCommand {
  protected createdGuides: Guide[] = [];

  protected constructor(protected readonly store: GuideStore) {
    super();
  }

  /** Produce the guides to add. Called once, on the first execution. */
  protected abstract buildGuides(): Guide[];

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }
    this.createdGuides = this.buildGuides();
  }

  undo(): void {
    for (const guide of this.createdGuides) {
      this.store.removeGuideById(guide.id);
    }
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map((g) => g.id);
  }

  /** First created guide (convenience for single-guide create commands). */
  getCreatedGuide(): Guide | null {
    return this.createdGuides[0] ?? null;
  }
}

// ============================================================================
// BATCH-ROTATE LIFECYCLE (rotate all / group)
// ============================================================================

/**
 * Base for commands that rotate a set of guides around a pivot. Subclasses
 * pass the guide set to the constructor (via `super`); the base pre-computes
 * rotated endpoints and owns the snapshot-based execute/undo lifecycle.
 */
export abstract class BatchRotateGuidesCommand extends BaseCommand {
  protected readonly rotatedEndpoints = new Map<string, GuideEndpoints>();
  protected originalSnapshots: Guide[] = [];

  protected constructor(
    protected readonly store: GuideStore,
    protected readonly pivot: Point2D,
    protected readonly angleDeg: number,
    guides: readonly Guide[],
  ) {
    super();
    for (const guide of guides) {
      this.rotatedEndpoints.set(guide.id, computeRotatedGuideEndpoints(guide, pivot, angleDeg));
    }
  }

  execute(): void {
    const isFirstExecution = this.originalSnapshots.length === 0;
    for (const [guideId, endpoints] of this.rotatedEndpoints) {
      const snapshot = this.store.replaceGuideWithRotated(guideId, endpoints.start, endpoints.end);
      if (snapshot && isFirstExecution) {
        this.originalSnapshots.push(snapshot);
      }
    }
  }

  undo(): void {
    for (let i = this.originalSnapshots.length - 1; i >= 0; i--) {
      this.store.restoreGuideSnapshot(this.originalSnapshots[i]);
    }
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.rotatedEndpoints.keys());
  }
}
