/**
 * SET BULGE COMMAND — ADR-510 Φ3c (polyline segment arc curvature)
 *
 * Sets the per-segment `bulges[segIndex]` of a plain DXF polyline:
 *   - Convert-to-Arc  → `newBulge ≠ 0` (default quarter-circle, then grip-tuned).
 *   - Convert-to-Line → `newBulge = 0`.
 *   - Live bulge-drag → `newBulge = bulgeFromApexPoint(p0, p1, cursor)` per sample.
 *
 * Mirrors {@link MoveVertexCommand}: same drag-merge gate (`canMergeDragSamples`
 * + `isDragging`) so a continuous curvature drag collapses to ONE undo step,
 * while two DISTINCT edits of the same segment stay separate. Structural edits
 * go through the generic `ISceneManager.updateEntity({ bulges })` seam (the same
 * one {@link PolylineVertexCommand} uses) — no interface extension, the
 * `bulges` array stays index-aligned with `vertices`.
 *
 * @see geometry-bulge-utils — bulge math SSoT (Φ3a)
 * @see PolylineVertexCommand — add/remove vertex (keeps bulges index-aligned)
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { canMergeDragSamples } from '../merge-window';
// SSoT polyline shape (same canonical type PolylineVertexCommand uses — no ad-hoc duplicate).
import type { PolylineEntity, LWPolylineEntity } from '../../../types/entities';

type PolyReadView = Pick<PolylineEntity | LWPolylineEntity, 'vertices' | 'closed' | 'bulges'>;

/**
 * Command that sets one polyline segment's bulge factor.
 */
export class SetBulgeCommand implements ICommand {
  readonly id: string;
  readonly name = 'SetBulge';
  readonly type = 'set-bulge';
  readonly timestamp: number;

  constructor(
    private readonly entityId: string,
    private readonly segIndex: number,
    private readonly oldBulge: number,
    private readonly newBulge: number,
    private readonly sceneManager: ISceneManager,
    /**
     * True only for per-frame samples of a live curvature drag. Two DISTINCT
     * edits of the same segment (both `false`) must NOT coalesce — mirrors the
     * vertex/transform families' `isDragging` gate (ADR-507 §8).
     */
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  /**
   * Build a `bulges` array index-aligned with the entity's segments, preserving
   * existing values, with `bulges[segIndex] = value`. Segment count = vertices
   * (closed) or vertices − 1 (open); padded with 0 (straight).
   */
  private buildBulges(value: number): number[] | null {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as PolyReadView | undefined;
    if (!entity || !Array.isArray(entity.vertices)) return null;
    const vLen = entity.vertices.length;
    if (vLen < 2) return null;
    const segCount = entity.closed ? vLen : vLen - 1;
    if (this.segIndex < 0 || this.segIndex >= segCount) return null;
    const next = new Array<number>(segCount);
    for (let i = 0; i < segCount; i += 1) next[i] = entity.bulges?.[i] ?? 0;
    next[this.segIndex] = value;
    return next;
  }

  private apply(value: number): void {
    const bulges = this.buildBulges(value);
    if (!bulges) return;
    this.sceneManager.updateEntity(this.entityId, { bulges } as Partial<SceneEntity>);
  }

  execute(): void {
    this.apply(this.newBulge);
  }

  undo(): void {
    this.apply(this.oldBulge);
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return this.newBulge === 0
      ? `Convert segment ${this.segIndex} to line`
      : `Set bulge ${this.segIndex} → ${this.newBulge.toFixed(3)}`;
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof SetBulgeCommand)) return false;
    if (other.entityId !== this.entityId || other.segIndex !== this.segIndex) return false;
    // Coalesce only live-drag samples within the merge window — distinct edits stay separate. SSoT.
    return canMergeDragSamples(this, other, this.isDragging, other.isDragging);
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as SetBulgeCommand;
    return new SetBulgeCommand(
      this.entityId,
      this.segIndex,
      this.oldBulge, // keep original old bulge
      o.newBulge, // use latest target
      this.sceneManager,
      true, // merged result stays a drag so subsequent samples keep coalescing
    );
  }

  getEntityId(): string {
    return this.entityId;
  }

  getSegIndex(): number {
    return this.segIndex;
  }

  getNewBulge(): number {
    return this.newBulge;
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity ID is required';
    if (this.segIndex < 0) return 'Segment index must be non-negative';
    if (!Number.isFinite(this.newBulge)) return 'Bulge must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.entityId,
        segIndex: this.segIndex,
        oldBulge: this.oldBulge,
        newBulge: this.newBulge,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
