/**
 * OFFSET ENTITY COMMAND — ADR-510 Φ4d
 *
 * Undoable atomic command for a single OFFSET commit. AutoCAD OFFSET adds ONE
 * parallel copy per click (Q10 — one undo step per offset); the optional «Erase»
 * option also deletes the source. Far simpler than TRIM (no per-pick operation
 * union): the finished copy is computed by the tool and carried here verbatim.
 *
 *   execute → addEntity(copy)            (+ removeEntity(source) when erase)
 *   undo    → removeEntity(copy)         (+ addEntity(source) when erase)
 *
 * Mutates the scene ONLY through the injected {@link ISceneManager}
 * (LevelSceneManagerAdapter) — same boundary as every other entity command.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4d
 */

import { generateEntityId } from '@/services/enterprise-id.service';
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { noopAuditRecorder, type IDxfTextAuditRecorder } from '../text/types';
import type { Entity } from '../../../types/entities';

export interface OffsetCommandParams {
  /** The offset copy, already built with a fresh enterprise id. */
  readonly copy: Readonly<Entity>;
  /** The source entity (kept for erase-mode undo restore). */
  readonly source: Readonly<Entity>;
  /** AutoCAD OFFSET «Erase» — delete the source after offsetting. */
  readonly erase: boolean;
  /** The side-pick point (audit only). */
  readonly pickPoint: { x: number; y: number };
}

export class OffsetEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'OffsetEntity';
  readonly type = 'offset-entity';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly params: OffsetCommandParams,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.sceneManager.addEntity(this.params.copy as unknown as SceneEntity);
    if (this.params.erase) this.sceneManager.removeEntity(this.params.source.id);
    this.wasExecuted = true;
    this.recordAudit('offset');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.sceneManager.removeEntity(this.params.copy.id);
    if (this.params.erase) this.sceneManager.addEntity(this.params.source as unknown as SceneEntity);
    this.recordAudit('offset-undo');
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Offset entity ${this.params.source.id}${this.params.erase ? ' (erase source)' : ''}`;
  }

  getAffectedEntityIds(): string[] {
    return this.params.erase
      ? [this.params.copy.id, this.params.source.id]
      : [this.params.copy.id];
  }

  validate(): string | null {
    if (!this.params.copy?.id) return 'Offset copy is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        copy: this.params.copy as unknown as Record<string, unknown>,
        source: this.params.source as unknown as Record<string, unknown>,
        erase: this.params.erase,
        pickPoint: this.params.pickPoint,
      },
      version: 1,
    };
  }

  private recordAudit(op: 'offset' | 'offset-undo'): void {
    this.auditRecorder.record({
      entityId: this.id,
      action: 'updated',
      changes: [
        { field: 'op', oldValue: null, newValue: op },
        { field: 'sourceId', oldValue: null, newValue: this.params.source.id },
        { field: 'copyId', oldValue: null, newValue: this.params.copy.id },
        { field: 'erase', oldValue: null, newValue: this.params.erase },
        { field: 'pickPoint', oldValue: null, newValue: this.params.pickPoint },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }
}
