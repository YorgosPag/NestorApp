/**
 * CREATE MEP SEGMENTS COMMAND — ADR-426 Slice 2 (water-supply auto-design accept).
 *
 * Batch-creates N pre-built `MepSegmentEntity` (round pipes) in a SINGLE undoable
 * step, so an auto-generated water network drops onto the canvas as one Revit
 * transaction (one Ctrl+Z removes the whole run). Composed inside a
 * `CompoundCommand` together with the `CreateMepSystemCommand`(s) for cold/hot, so
 * "Generate water supply" = one atomic accept/undo.
 *
 * Why a dedicated command (not `CreateEntityCommand`): MEP-segment persistence +
 * the auto-fitting reconciler key off the `drawing:entity-created` EventBus
 * broadcast (the trigger `appendEntityToScene` emits for the manual pipe tool).
 * `CreateEntityCommand` only emits `drawing:complete` (overlay/DXF path) → a segment
 * created through it would never persist nor grow fittings. This command therefore
 * mirrors the canonical BIM append: scene via `ISceneManager`, Firestore via a
 * deferred `drawing:entity-created` per segment.
 *
 * Symmetric scene + Firestore across execute / undo / redo, with the EventBus
 * side-effects deferred to a microtask (precedent: `MergeColumnsCommand`) so they
 * run AFTER the synchronous `CommandHistory.execute` — the broadcast wakes the
 * fitting reconciler, which dispatches its OWN commands; emitting inline would nest
 * command dispatch.
 *
 * @see ./MergeColumnsCommand.ts — deferred-Firestore precedent
 * @see ../../../bim/mep-segments/add-mep-segment-to-scene.ts — manual-draw append SSoT
 * @see ../../../hooks/data/useMepSegmentPersistence.ts — create + delete listeners
 * @see docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { MepSegmentEntity } from '../../../bim/types/mep-segment-types';
import type { AnySceneEntity } from '../../../types/scene';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { EventBus } from '../../../systems/events/EventBus';

const MEP_SEGMENT_TOOL = 'mep-segment';

export class CreateMepSegmentsCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateMepSegments';
  readonly type = 'create-mep-segments';
  readonly timestamp: number;

  private readonly segments: readonly MepSegmentEntity[];
  private wasExecuted = false;

  constructor(
    segments: readonly MepSegmentEntity[],
    private readonly sceneManager: ISceneManager,
  ) {
    // Defensive deep-clone: snapshots stay independent of later live-scene edits
    // (mirror MergeColumnsCommand / DeleteEntityCommand snapshot semantics).
    this.segments = segments.map((s) => deepClone(s));
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyScene();
    this.wasExecuted = true;
    this.deferFirestore('apply');
  }

  redo(): void {
    this.applyScene();
    this.deferFirestore('apply');
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.revertScene();
    this.deferFirestore('revert');
  }

  /** scene: add every segment. */
  private applyScene(): void {
    for (const s of this.segments) {
      this.sceneManager.addEntity(deepClone(s) as unknown as SceneEntity);
    }
  }

  /** scene: remove every segment. */
  private revertScene(): void {
    for (const s of this.segments) this.sceneManager.removeEntity(s.id);
  }

  /**
   * Firestore side-effects, deferred to a microtask so they run after the
   * synchronous command dispatch (avoids nested `CommandHistory.execute` from the
   * fitting reconciler the broadcast wakes).
   */
  private deferFirestore(direction: 'apply' | 'revert'): void {
    const segments = this.segments;
    queueMicrotask(() => {
      if (direction === 'apply') {
        for (const s of segments) {
          EventBus.emit('drawing:entity-created', {
            entity: deepClone(s) as unknown as AnySceneEntity,
            tool: MEP_SEGMENT_TOOL,
          });
        }
      } else {
        for (const s of segments) {
          EventBus.emit('bim:mep-segment-delete-requested', { segmentId: s.id });
        }
      }
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Create ${this.segments.length} MEP pipe segments`;
  }

  getAffectedEntityIds(): string[] {
    return this.segments.map((s) => s.id);
  }

  validate(): string | null {
    if (this.segments.length === 0) return 'At least one segment is required';
    if (this.segments.some((s) => !s.id)) return 'Every segment must have an id';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { segmentIds: this.segments.map((s) => s.id) },
      version: 1,
    };
  }
}
