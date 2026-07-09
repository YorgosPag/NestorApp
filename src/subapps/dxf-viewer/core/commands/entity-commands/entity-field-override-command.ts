/**
 * @module core/commands/entity-commands/entity-field-override-command
 * @description Template-Method base (SSoT) for single-entity «set/clear an
 * override field» commands (per-face appearance, per-face finish, entity-level
 * appearance map).
 *
 * These commands set or clear ONE override on ONE entity, with a lazy previous
 * snapshot: the current value is captured on the FIRST `execute()` so `undo`/
 * `redo` are pure re-applies. The base owns that state machine — resolve once,
 * apply `next` (execute/redo) / `prev` (undo), persist via `signalEntitiesAttached`
 * — while a concrete command supplies only {@link snapshotStates} (read current
 * + compute next, or abort) and {@link writeValue} (the scene write).
 *
 * `snapshotStates()` may return `null` to abort with no history effect (entity
 * missing, or a semantic no-op such as «no active finish to paint»); in that
 * case `execute` is inert and `undo`/`redo` do nothing. `writeValue()` returns
 * `false` when nothing was written, and the persistence signal is then skipped.
 *
 * Adopts the generic {@link BaseCommand} root (id/timestamp/`redo`/`serialize`
 * envelope + no-merge default).
 *
 * @see ADR-617 (entity-command SSoT)
 * @see ./SetFaceAppearanceCommand.ts ./SetFinishFaceOverrideCommand.ts — reference leaves
 * @since 2026-07-09
 */

import type { ISceneManager } from '../interfaces';
import { BaseCommand } from '../base-command';
import { signalEntitiesAttached } from './attach-persist-signal';

/**
 * Shared `validate()` for a per-face override keyed by `faceKey` — used by both
 * the body writer (`SetFaceAppearanceCommand`) and the skin writer
 * (`SetFinishFaceOverrideCommand`), whose field differs but whose faceKey
 * contract is identical.
 */
export function validateFaceKeyOverride(entityId: string, faceKey: string): string | null {
  if (!entityId) return 'Entity id is required';
  if (!faceKey) return 'faceKey is required';
  return null;
}

/** Shared serialized `data` payload for a per-face override keyed by `faceKey`. */
export function faceKeyOverrideData(entityId: string, faceKey: string, value: unknown): Record<string, unknown> {
  return { entityId, faceKey, value };
}

/**
 * Abstract base for a lazy-snapshot, single-entity field-override command.
 *
 * @typeParam TValue the override value written to the entity (a map, a spec…).
 */
export abstract class EntityFieldOverrideCommand<TValue> extends BaseCommand {
  protected prev: TValue | undefined;
  protected next: TValue | undefined;
  private resolved = false;
  private wasExecuted = false;

  constructor(
    protected readonly entityId: string,
    protected readonly sceneManager: ISceneManager,
  ) {
    super();
  }

  /**
   * Read the live field value and compute the next value. Return `null` to
   * abort (entity missing, or a semantic no-op) — the command then does nothing.
   */
  protected abstract snapshotStates(): { prev: TValue | undefined; next: TValue | undefined } | null;

  /**
   * Write `value` to the entity. Return `false` when nothing was written (the
   * persistence signal is then skipped).
   */
  protected abstract writeValue(value: TValue | undefined): boolean;

  execute(): void {
    if (!this.resolved) {
      this.resolved = true;
      const snap = this.snapshotStates();
      if (!snap) return;
      this.prev = snap.prev;
      this.next = snap.next;
      this.wasExecuted = true;
    }
    if (this.wasExecuted) this.apply(this.next);
  }

  undo(): void {
    if (this.wasExecuted) this.apply(this.prev);
  }
  // redo() inherited from BaseCommand → execute() → (resolved) → apply(next).

  private apply(value: TValue | undefined): void {
    if (this.writeValue(value)) {
      signalEntitiesAttached(this.sceneManager, [this.entityId]);
    }
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }
}
