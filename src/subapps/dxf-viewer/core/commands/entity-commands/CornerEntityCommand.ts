/**
 * CORNER ENTITY COMMAND — ADR-510 Φ4e/Φ4f
 *
 * Undoable atomic command shared by the FILLET and CHAMFER corner tools (AutoCAD
 * produces ONE undo step per corner). Both have the SAME shape — a list of geometry
 * updates (`trims`) plus an optional added connector entity — so this ONE command
 * serves both (SSoT, N.0.2). The `kind` only labels the audit/description.
 *   • fillet   → 0–2 line trims + 1 tangent ARC   (or a polyline replace)
 *   • chamfer  → 0–2 line trims + 1 bevel LINE     (or a polyline replace)
 *
 *   execute → updateEntity(newGeom) per trim   (+ addEntity(connector) when present)
 *   undo    → updateEntity(originalGeom) per trim (+ removeEntity(connector) when present)
 *
 * Mutates the scene ONLY through the injected {@link ISceneManager}. Geometry
 * restore uses the shared `geometryFromSnapshot` SSoT (excludeType).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4e/Φ4f
 */

import { generateEntityId } from '@/services/enterprise-id.service';
import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { noopAuditRecorder, type IDxfTextAuditRecorder } from '../text/types';
import type { Entity } from '../../../types/entities';
import { geometryFromSnapshot } from './snapshot-geometry';

export type CornerKind = 'fillet' | 'chamfer';

/** One entity whose geometry is replaced (a trimmed line, or the rounded/beveled polyline). */
export interface CornerTrimOp {
  readonly entityId: string;
  readonly originalGeom: Readonly<Entity>;
  readonly newGeom: Readonly<Entity>;
}

export interface CornerCommandParams {
  /** Which tool produced this command (audit/description only). */
  readonly kind: CornerKind;
  /** 0–2 line trims (two-lines) or 1 polyline replace (polyline mode). */
  readonly trims: ReadonlyArray<CornerTrimOp>;
  /** The connector to add — a fillet arc or a chamfer line (null for R=0 extend / polyline). */
  readonly addEntity: Readonly<Entity> | null;
  /** The corner pick point (audit only). */
  readonly pickPoint: { x: number; y: number };
}

export class CornerEntityCommand implements ICommand {
  readonly id: string;
  readonly name: string;
  readonly type = 'corner-entity';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly params: CornerCommandParams,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.name = params.kind === 'fillet' ? 'FilletEntity' : 'ChamferEntity';
  }

  execute(): void {
    for (const op of this.params.trims) {
      this.sceneManager.updateEntity(op.entityId, this.geometryUpdates(op.newGeom));
    }
    if (this.params.addEntity) this.sceneManager.addEntity(this.params.addEntity as unknown as SceneEntity);
    this.wasExecuted = true;
    this.recordAudit(this.params.kind);
  }

  undo(): void {
    if (!this.wasExecuted) return;
    if (this.params.addEntity) this.sceneManager.removeEntity(this.params.addEntity.id);
    for (let i = this.params.trims.length - 1; i >= 0; i--) {
      const op = this.params.trims[i];
      this.sceneManager.updateEntity(op.entityId, this.geometryUpdates(op.originalGeom));
    }
    this.recordAudit(`${this.params.kind}-undo` as const);
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    const n = this.params.trims.length;
    const verb = this.params.kind === 'fillet' ? 'Fillet' : 'Chamfer';
    return `${verb} ${n} ${n === 1 ? 'entity' : 'entities'}${this.params.addEntity ? ' + connector' : ''}`;
  }

  getAffectedEntityIds(): string[] {
    const ids = this.params.trims.map((op) => op.entityId);
    if (this.params.addEntity) ids.push(this.params.addEntity.id);
    return ids;
  }

  validate(): string | null {
    if (this.params.trims.length === 0 && !this.params.addEntity) return 'Corner op requires at least one change';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        kind: this.params.kind,
        trims: this.params.trims as unknown as Record<string, unknown>[],
        addEntity: this.params.addEntity as unknown as Record<string, unknown> | null,
        pickPoint: this.params.pickPoint,
      },
      version: 1,
    };
  }

  /** Geometry-only patch (no identity/type) — SSoT: snapshot-geometry. */
  private geometryUpdates(entity: Readonly<Entity>): Partial<SceneEntity> {
    return geometryFromSnapshot(entity as unknown as SceneEntity, { excludeType: true });
  }

  private recordAudit(op: string): void {
    this.auditRecorder.record({
      entityId: this.id,
      action: 'updated',
      changes: [
        { field: 'op', oldValue: null, newValue: op },
        { field: 'affectedEntityIds', oldValue: null, newValue: this.getAffectedEntityIds() },
        { field: 'connectorAdded', oldValue: null, newValue: this.params.addEntity?.id ?? null },
        { field: 'pickPoint', oldValue: null, newValue: this.params.pickPoint },
      ],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }
}
