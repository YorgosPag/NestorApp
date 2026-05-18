/**
 * UPDATE SLAB-OPENING PARAMS COMMAND — ADR-363 Phase 3.7.
 *
 * Patches `params` on existing `SlabOpeningEntity` και recomputes `geometry`
 * + `validation` atomically via `computeSlabOpeningGeometry()` +
 * `validateSlabOpeningParams()` ώστε ο renderer να μην αποκλίνει ποτέ από
 * τον parametric source of truth.
 *
 * Mirrors `UpdateOpeningParamsCommand` (ADR-031 merge pattern) — συνεχόμενα
 * drag samples εντός merge window καταρρέουν σε ένα undo entry. Host-slab
 * lookup re-resolved σε κάθε execute/undo/redo via
 * `sceneManager.getEntity(slabId)` ώστε η γεωμετρία να μένει σωστή ακόμα
 * κι αν το host slab επεξεργαστεί ανεξάρτητα.
 *
 * Soft-orphan policy (ADR-363 §5.5 §11.Q3): αν το host slab λείπει σε
 * execute time, το patch εφαρμόζεται αλλά geometry/validation επαναχρησιμοποιούν
 * το προηγούμενο known state — η persistence layer ξανα-υδραγωγεί όταν
 * έρθει το slab.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  SlabOpeningGeometry,
  SlabOpeningParams,
} from '../../../bim/types/slab-opening-types';
import type { SlabEntity } from '../../../bim/types/slab-types';
import { computeSlabOpeningGeometry } from '../../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../../bim/validators/slab-opening-validator';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateSlabOpeningParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateSlabOpeningParams';
  readonly type = 'update-slab-opening-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly slabOpeningId: string,
    private readonly params: SlabOpeningParams,
    private readonly previousParams: SlabOpeningParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPatch(this.params);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousParams);
  }

  redo(): void {
    this.applyPatch(this.params);
  }

  private applyPatch(params: SlabOpeningParams): void {
    const host = this.resolveHostSlab(params.slabId);
    const patch: Record<string, unknown> = { params };
    const geometry: SlabOpeningGeometry = computeSlabOpeningGeometry(params);
    patch.geometry = geometry;
    if (host) {
      const validation = validateSlabOpeningParams(params, host).bimValidation;
      patch.validation = validation;
    } else {
      // Soft-orphan: intrinsic validation only (no host-relative checks).
      const validation = validateSlabOpeningParams(params, null).bimValidation;
      patch.validation = validation;
    }
    this.sceneManager.updateEntity(this.slabOpeningId, patch as Partial<SceneEntity>);
  }

  private resolveHostSlab(slabId: string): SlabEntity | null {
    const raw = this.sceneManager.getEntity(slabId);
    if (!raw) return null;
    const candidate = raw as unknown as Partial<SlabEntity>;
    if (candidate.type !== 'slab' || !candidate.params || !candidate.geometry) return null;
    return candidate as SlabEntity;
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateSlabOpeningParamsCommand)) return false;
    if (other.slabOpeningId !== this.slabOpeningId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateSlabOpeningParamsCommand;
    return new UpdateSlabOpeningParamsCommand(
      this.slabOpeningId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update slab-opening params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.slabOpeningId];
  }

  validate(): string | null {
    if (!this.slabOpeningId) return 'Slab-opening entity ID is required';
    if (!this.params.slabId) return 'Slab-opening params.slabId is required';
    if (!this.params.outline || this.params.outline.vertices.length < 3) {
      return 'Slab-opening outline must have >= 3 vertices';
    }
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        slabOpeningId: this.slabOpeningId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
