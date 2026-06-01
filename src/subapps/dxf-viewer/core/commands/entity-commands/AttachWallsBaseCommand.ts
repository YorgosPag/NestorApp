/**
 * ATTACH WALLS BASE COMMAND — ADR-401 (γ) (base auto-attach UX).
 *
 * Batch, undoable «Attach Base to Structural» for N walls onto ONE structural
 * host (foundation beam / slab). Sets each wall's `baseBinding='attached'` and
 * appends the host id to `attachBaseToIds`, then recomputes `geometry` +
 * `validation` and cascades hosted openings — atomically, mirroring
 * `AttachWallsTopCommand` (single recompute SSoT). One command = ONE undo entry.
 *
 * EXACT mirror of `AttachWallsTopCommand`: only the binding direction differs
 * (base/upper-envelope vs top/lower-envelope). Per-wall snapshots (prev/next)
 * are built ONCE on first `execute()`, so `undo()`/`redo()` are pure re-applies.
 *
 * NOTE: beam/slab creation itself is NOT a command (direct `appendEntityToScene`),
 * so undo of this command detaches the walls while the host stays (Revit parity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts — the top (lower-envelope) twin
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
// ADR-363 §5.4 — after each wall geometry patch, recompute its hosted openings.
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';
// ADR-401 — persist the binding change (auto-attach targets non-selected walls).
import { signalEntitiesAttached } from './attach-persist-signal';

/** A wall to attach + its `kind` (needed for the geometry recompute). */
export interface WallBaseAttachTarget {
  readonly wallId: string;
  readonly kind: WallKind;
}

interface WallBaseAttachPatch {
  readonly wallId: string;
  readonly kind: WallKind;
  readonly prev: WallParams;
  readonly next: WallParams;
}

export class AttachWallsBaseCommand implements ICommand {
  readonly id: string;
  readonly name = 'AttachWallsBase';
  readonly type = 'attach-walls-base';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: WallBaseAttachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly hostId: string,
    private readonly targets: readonly WallBaseAttachTarget[],
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.wallId, p.next, p.kind);
    this.wasExecuted = this.patches.length > 0;
    this.cascade();
    this.signalPersist();
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.wallId, p.prev, p.kind);
    this.cascade();
    this.signalPersist();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.wallId, p.next, p.kind);
    this.cascade();
    this.signalPersist();
  }

  /** Snapshot live params per target → {prev, next} (attached + host appended). */
  private buildPatches(): void {
    for (const { wallId, kind } of this.targets) {
      const entity = this.sceneManager.getEntity(wallId) as unknown as { params?: WallParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      const ids = prev.attachBaseToIds ?? [];
      const nextIds = ids.includes(this.hostId) ? ids : [...ids, this.hostId];
      const next: WallParams = { ...prev, baseBinding: 'attached', attachBaseToIds: nextIds };
      this.patches.push({ wallId, kind, prev, next });
    }
  }

  private applyPatch(wallId: string, params: WallParams, kind: WallKind): void {
    const geometry: WallGeometry = computeWallGeometry(params, kind);
    const validation = validateWallParams(params).bimValidation;
    this.sceneManager.updateEntity(wallId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  private cascade(): void {
    if (this.patches.length === 0) return;
    cascadeHostedOpeningsForWalls(this.patches.map((p) => p.wallId), this.sceneManager);
  }

  /** ADR-401 — broadcast the patched walls so the persistence layer saves them. */
  private signalPersist(): void {
    signalEntitiesAttached(this.sceneManager, this.patches.map((p) => p.wallId));
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Attach ${this.targets.length} wall(s) base to host`;
  }

  getAffectedEntityIds(): string[] {
    return this.targets.map((t) => t.wallId);
  }

  validate(): string | null {
    if (!this.hostId) return 'Host entity ID is required';
    if (this.targets.length === 0) return 'At least one wall target is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        hostId: this.hostId,
        targets: this.targets,
      },
      version: 1,
    };
  }
}
