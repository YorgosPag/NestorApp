/**
 * ADR-344 Phase 6.A — CreateTextCommand.
 *
 * Creates a new DXF TEXT or MTEXT scene entity carrying a full DxfTextNode
 * AST. The entity type is selected automatically from the AST shape:
 *   - single paragraph + single run, no columns → 'text'
 *   - everything else (multi-paragraph, multi-run, columns, …) → 'mtext'
 *
 * Idempotent: execute() reuses the stored entity reference, so undo/redo
 * round-trips do not regenerate the ID. Audit (Q12): fire-and-forget on
 * successful execute() and redo(). Undo emits a 'deleted' audit entry so
 * the trail captures both directions.
 *
 * ADR-614 — a no-layer-provider outlier: extends the generic {@link BaseCommand}
 * (id/timestamp/redo→execute/serialize envelope) and reuses the shared
 * audit-envelope free helper. Its `redo` is BaseCommand's default (re-run
 * execute), which — since the entity is built once and cached — replays the
 * add + 'created' audit identically to the legacy bespoke redo.
 */

import type { ISceneManager } from '../interfaces';
import { BaseCommand } from '../base-command';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode } from '../../../text-engine/types';
import type { Point2D } from '../../../rendering/types/Types';
import { recordTextAudit } from './dxf-text-command-base';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
} from './types';

// ── Construction input ────────────────────────────────────────────────────────

export interface CreateTextCommandInput {
  readonly position: Point2D;
  readonly layer: string;
  readonly textNode: DxfTextNode;
  /** Reuse an existing ID (ADR-057). When omitted, generateEntityId() is used. */
  readonly existingId?: string;
  /** Force MTEXT type regardless of AST shape (e.g. mtext creation tool). */
  readonly forceType?: 'mtext';
  /** MTEXT bounding box width in world units. Only meaningful when forceType='mtext'. */
  readonly width?: number;
  /**
   * ADR-508 §text-parity — γωνία κλίσης (CCW μοίρες, DXF σύμβαση) από το 2-click place→rotate flow.
   * Γράφεται στο entity-level `rotation` (αυτό διαβάζει ο `TextRenderer`). Παραλείπεται/0 = οριζόντιο.
   */
  readonly rotation?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Decide TEXT vs MTEXT based on AST richness. */
function pickEntityType(node: DxfTextNode): 'text' | 'mtext' {
  if (node.columns) return 'mtext';
  if (node.paragraphs.length !== 1) return 'mtext';
  const onlyParagraph = node.paragraphs[0];
  if (onlyParagraph.runs.length !== 1) return 'mtext';
  return 'text';
}

// ── Command ───────────────────────────────────────────────────────────────────

export class CreateTextCommand extends BaseCommand {
  readonly name = 'CreateText';
  readonly type = 'create-text';

  private entity: DxfTextSceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: CreateTextCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    super();
  }

  /** Audit the created entity in either direction (created on add, deleted on remove). */
  private recordEntityAudit(action: 'created' | 'deleted'): void {
    if (!this.entity) return;
    const { id, type } = this.entity;
    recordTextAudit(
      this.auditRecorder,
      this.name,
      id,
      action,
      action === 'created'
        ? [{ field: 'entity', oldValue: null, newValue: type }]
        : [{ field: 'entity', oldValue: type, newValue: null }],
    );
  }

  execute(): void {
    if (!this.entity) {
      const entityType = this.input.forceType ?? pickEntityType(this.input.textNode);
      this.entity = {
        id: this.input.existingId ?? generateEntityId(),
        type: entityType,
        layer: this.input.layer,
        visible: true,
        position: this.input.position,
        textNode: this.input.textNode,
        ...(entityType === 'mtext' && this.input.width != null ? { width: this.input.width } : {}),
        // ADR-508 §text-parity — γωνία κλίσης (μόνο όταν ≠ 0· οριζόντιο κείμενο μένει καθαρό).
        ...(this.input.rotation ? { rotation: this.input.rotation } : {}),
      };
    }
    this.sceneManager.addEntity(this.entity);
    this.wasExecuted = true;
    this.recordEntityAudit('created');
  }

  undo(): void {
    if (!this.entity || !this.wasExecuted) return;
    this.sceneManager.removeEntity(this.entity.id);
    this.recordEntityAudit('deleted');
  }

  getDescription(): string {
    const entityType = this.entity?.type ?? pickEntityType(this.input.textNode);
    return `Create ${entityType.toUpperCase()}`;
  }

  getCreatedEntity(): DxfTextSceneEntity | null {
    return this.entity;
  }

  validate(): string | null {
    if (!this.input.layer) return 'Layer is required';
    if (!this.input.textNode || this.input.textNode.paragraphs.length === 0) {
      return 'TextNode must have at least one paragraph';
    }
    return null;
  }

  getAffectedEntityIds(): string[] {
    return this.entity ? [this.entity.id] : [];
  }

  protected serializeData(): Record<string, unknown> {
    return {
      position: this.input.position,
      layer: this.input.layer,
      textNode: this.input.textNode as unknown as Record<string, unknown>,
      entityId: this.entity?.id,
    };
  }
}
