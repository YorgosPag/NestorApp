/**
 * REPLACE-ENTITIES-WITH-CONTAINER COMMAND — SSoT base (ADR-575 §7)
 *
 * The undoable lifecycle shared by every command that swaps N scene entities for
 * ONE composite container and back (JOIN → merged polyline, GROUP → `type:'group'`
 * block). Both had ~95% identical execute/undo/redo; this abstract base owns the
 * invariant lifecycle ONCE (Template Method — the GoF Command + Template Method
 * combo Autodesk/SAP-grade command hierarchies use), on top of the existing
 * `entity-source-extraction` extract/restore SSoT.
 *
 * Lifecycle (idempotent — the SAME container id is reused across redo):
 *   - execute(): collect sources → extract (snapshot + remove) → buildContainer
 *     (once) → add container
 *   - undo():    remove container → restore sources
 *   - redo():    remove sources again → re-add the SAME container
 *
 * Subclasses supply ONLY what differs: `name`/`type`, the `buildContainer` hook
 * (JOIN returns a pre-built entity, GROUP builds one from the snapshots),
 * `getDescription`/`validate`/`serialize`, and optionally `minMembers`.
 *
 * NOTE — `CreateArrayCommand` intentionally does NOT extend this: it uses a
 * different redo strategy (re-extract, not reuse-snapshot) and a parametrized
 * factory. It already shares the same extract/restore SSoT, which is enough.
 *
 * @see core/commands/entity-commands/entity-source-extraction.ts (extract/restore SSoT)
 * @see ADR-575: Join/Group inverse of Explode
 * @see ADR-032: Command History / Undo-Redo
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { deepClone } from '../../../utils/clone-utils';
import { extractSourcesFromScene, restoreSourcesToScene } from './entity-source-extraction';

export abstract class ReplaceEntitiesWithContainerCommand implements ICommand {
  readonly id: string;
  readonly timestamp: number;
  abstract readonly name: string;
  abstract readonly type: string;

  /** Deep-cloned snapshots of the original sources (for undo). */
  protected snapshots: Entity[] = [];
  /** The container — built ONCE (first execute) and reused on redo (stable id). */
  protected container: SceneEntity | null = null;
  protected wasExecuted = false;

  constructor(
    protected readonly sourceEntityIds: readonly string[],
    protected readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /** Minimum sources required for the op to run; below it, execute is a no-op. */
  protected get minMembers(): number {
    return 1;
  }

  /**
   * Build the container from the just-extracted snapshots. Called ONCE on the
   * first execute; the result is cached on `this.container` and reused on redo.
   * Return `null` to abort (sources are restored, no container added).
   */
  protected abstract buildContainer(snapshots: Entity[]): SceneEntity | null;

  execute(): void {
    const sources = this.collectSources();
    if (sources.length < this.minMembers) return; // no-op — nothing to contain

    this.snapshots = extractSourcesFromScene(sources, this.sceneManager);
    const container = this.buildContainer(this.snapshots);
    if (!container) {
      restoreSourcesToScene(this.snapshots, this.sceneManager);
      this.snapshots = [];
      return;
    }
    this.container = container;
    this.sceneManager.addEntity(deepClone(container) as unknown as SceneEntity);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted || !this.container) return;
    this.sceneManager.removeEntity(this.container.id);
    restoreSourcesToScene(this.snapshots, this.sceneManager);
  }

  redo(): void {
    if (!this.container) return;
    for (const snapshot of this.snapshots) this.sceneManager.removeEntity(snapshot.id);
    this.sceneManager.addEntity(deepClone(this.container) as unknown as SceneEntity);
  }

  getAffectedEntityIds(): string[] {
    return [...this.sourceEntityIds, ...(this.container ? [this.container.id] : [])];
  }

  canMergeWith(): boolean {
    return false;
  }

  abstract getDescription(): string;
  abstract validate(): string | null;
  abstract serialize(): SerializedCommand;

  /** Id of the created container (for post-op reselect). Null before execute. */
  protected get createdContainerId(): string | null {
    return this.container?.id ?? null;
  }

  private collectSources(): Entity[] {
    const sources: Entity[] = [];
    for (const entityId of this.sourceEntityIds) {
      const entity = this.sceneManager.getEntity(entityId);
      if (entity) sources.push(entity as unknown as Entity);
    }
    return sources;
  }
}
