/**
 * ATTACH WALLS TOP COMMAND — ADR-401 Phase D (auto-attach UX).
 *
 * Batch, undoable «Attach Top to Structural» for N walls onto ONE structural
 * host (beam / slab). Sets each wall's `topBinding='attached'` and appends the
 * host id to `attachTopToIds`, then recomputes `geometry` + `validation` and
 * cascades hosted openings — atomically, mirroring `UpdateWallParamsCommand`
 * (single recompute SSoT). One command = ONE undo entry (Revit "Attach Top").
 *
 * Per-wall snapshots (prev/next params) are built ONCE on first `execute()` from
 * the live scene, so `undo()`/`redo()` are pure re-applies (idempotent, no
 * re-snapshot drift). The host id is kept on `attachTopToIds` even after undo of
 * the host deletion (ADR-401 Phase C round-trip) — here we only ADD on attach.
 *
 * NOTE: beam/slab creation itself is NOT a command (direct `appendEntityToScene`),
 * so undo of this command detaches the walls while the host stays — the attach
 * is its own undo step (Revit parity).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §6 Phase D
 * @see core/commands/entity-commands/UpdateWallParamsCommand.ts — the single-wall mirror
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
// ADR-363 §5.4 — after each wall geometry patch, recompute its hosted openings.
import { cascadeHostedOpeningsForWalls } from '../../../bim/walls/wall-opening-coordinator';

/** A wall to attach + its `kind` (needed for the geometry recompute). */
export interface WallAttachTarget {
  readonly wallId: string;
  readonly kind: WallKind;
}

interface WallAttachPatch {
  readonly wallId: string;
  readonly kind: WallKind;
  readonly prev: WallParams;
  readonly next: WallParams;
}

export class AttachWallsTopCommand implements ICommand {
  readonly id: string;
  readonly name = 'AttachWallsTop';
  readonly type = 'attach-walls-top';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: WallAttachPatch[] = [];
  private wasExecuted = false;

  constructor(
    private readonly hostId: string,
    private readonly targets: readonly WallAttachTarget[],
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
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.wallId, p.prev, p.kind);
    this.cascade();
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.wallId, p.next, p.kind);
    this.cascade();
  }

  /** Snapshot live params per target → {prev, next} (attached + host appended). */
  private buildPatches(): void {
    for (const { wallId, kind } of this.targets) {
      const entity = this.sceneManager.getEntity(wallId) as unknown as { params?: WallParams } | undefined;
      const prev = entity?.params;
      if (!prev) continue;
      const ids = prev.attachTopToIds ?? [];
      const nextIds = ids.includes(this.hostId) ? ids : [...ids, this.hostId];
      const next: WallParams = { ...prev, topBinding: 'attached', attachTopToIds: nextIds };
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

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Attach ${this.targets.length} wall(s) top to host`;
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
