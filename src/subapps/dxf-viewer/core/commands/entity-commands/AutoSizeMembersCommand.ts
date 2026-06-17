/**
 * AUTO-SIZE MEMBERS COMMAND — ADR-475 (auto διαστασιολόγηση διατομής).
 *
 * Batch, undoable αυτόματη διαστασιολόγηση N δοκαριών: κάθε AUTO δοκάρι παίρνει την
 * **ελάχιστη επαρκή** διατομή (EC2 §7.4.2 βέλος + ULS κάμψη/διάτμηση) μέσω του SSoT
 * `buildBeamSizePatch`. Revit-grade serviceability-driven sizing — το `depth` γίνεται
 * **persisted** γεωμετρία (σε αντίθεση με τον additive/derived οπλισμό).
 *
 * **Geometry-mutating:** αλλάζει `depth` → το `applyPatch` ξανα-υπολογίζει `geometry`
 * (bbox/volume) + `validation` atomically μέσω `computeBeamGeometry`+`validateBeamParams`
 * (mirror `UpdateBeamParamsCommand`) ώστε render/BOQ να μην αποκλίνουν.
 *
 * Per-member snapshots χτίζονται ΜΙΑ φορά στο πρώτο `execute()`· `undo`/`redo` =
 * pure re-applies (idempotent). Idempotent ΚΑΙ ως προς converged/locked μέλη (skip
 * μέσω convergence guard / `autoSized:false`). Το `prev` κρατά τα αρχικά params
 * αυτούσια → το undo δεν εισάγει explicit `undefined` (Firestore-safe).
 *
 * @see core/commands/entity-commands/AutoReinforceOrganismCommand.ts — το pattern mirror
 * @see bim/structural/sizing/beam-size-patch.ts — buildBeamSizePatch (SSoT)
 * @see core/commands/entity-commands/UpdateBeamParamsCommand.ts — το geometry recompute mirror
 * @see docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { Entity } from '../../../types/entities';
import type { BeamGeometry, BeamParams } from '../../../bim/types/beam-types';
import type { StructuralCodeProvider } from '../../../bim/structural/codes/structural-code-types';
import { buildBeamSizePatch } from '../../../bim/structural/sizing/beam-size-patch';
import { computeBeamGeometry } from '../../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../../bim/validators/beam-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';

interface SizePatchEntry {
  readonly entityId: string;
  readonly prev: BeamParams;
  readonly next: BeamParams;
}

export class AutoSizeMembersCommand implements ICommand {
  readonly id: string;
  readonly name = 'AutoSizeMembers';
  readonly type = 'auto-size-members';
  readonly timestamp: number;

  /** Built once on first execute() from live scene; reused by undo/redo. */
  private patches: SizePatchEntry[] = [];
  private wasExecuted = false;

  constructor(
    private readonly entityIds: readonly string[],
    private readonly sceneManager: ISceneManager,
    private readonly provider: StructuralCodeProvider,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.patches.length === 0) this.buildPatches();
    for (const p of this.patches) this.applyPatch(p.entityId, p.next);
    this.wasExecuted = this.patches.length > 0;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    for (const p of this.patches) this.applyPatch(p.entityId, p.prev);
  }

  redo(): void {
    for (const p of this.patches) this.applyPatch(p.entityId, p.next);
  }

  /** Snapshot live params per beam → {prev, next}. Skips non-beam / locked / converged. */
  private buildPatches(): void {
    for (const entityId of this.entityIds) {
      const entity = this.sceneManager.getEntity(entityId) as unknown as Entity | undefined;
      if (!entity) continue;
      const patch = buildBeamSizePatch(entity, this.provider);
      if (!patch) continue; // idempotent: μη-δοκάρι / locked / converged
      this.patches.push({ entityId, prev: patch.prev, next: patch.next });
    }
  }

  /** Geometry-mutating apply — depth αλλάζει → recompute geometry+validation atomically. */
  private applyPatch(entityId: string, params: BeamParams): void {
    const geometry: BeamGeometry = computeBeamGeometry(params);
    const validation = validateBeamParams(params).bimValidation;
    this.sceneManager.updateEntity(entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  /** Ids που πράγματι διαστασιολογήθηκαν (μετά το build) — για emit/persist. */
  getResizedEntityIds(): string[] {
    if (this.patches.length === 0) this.buildPatches();
    return this.patches.map((p) => p.entityId);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Auto-size ${this.patches.length} beam(s)`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.entityIds];
  }

  validate(): string | null {
    if (this.entityIds.length === 0) return 'At least one entity id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityIds: [...this.entityIds] },
      version: 1,
    };
  }
}
