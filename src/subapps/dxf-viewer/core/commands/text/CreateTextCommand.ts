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
 */

import type {
  ICommand,
  ISceneManager,
  SerializedCommand,
} from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode } from '../../../text-engine/types';
import type { Point2D } from '../../../rendering/types/Types';
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

export class CreateTextCommand implements ICommand {
  readonly id: string;
  readonly name = 'CreateText';
  readonly type = 'create-text';
  readonly timestamp: number;

  private entity: DxfTextSceneEntity | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: CreateTextCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
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
      };
    }
    this.sceneManager.addEntity(this.entity);
    this.wasExecuted = true;
    this.auditRecorder.record({
      entityId: this.entity.id,
      action: 'created',
      changes: [{ field: 'entity', oldValue: null, newValue: this.entity.type }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.entity || !this.wasExecuted) return;
    this.sceneManager.removeEntity(this.entity.id);
    this.auditRecorder.record({
      entityId: this.entity.id,
      action: 'deleted',
      changes: [{ field: 'entity', oldValue: this.entity.type, newValue: null }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  redo(): void {
    if (!this.entity) return;
    this.sceneManager.addEntity(this.entity);
    this.auditRecorder.record({
      entityId: this.entity.id,
      action: 'created',
      changes: [{ field: 'entity', oldValue: null, newValue: this.entity.type }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    const entityType = this.entity?.type ?? pickEntityType(this.input.textNode);
    return `Create ${entityType.toUpperCase()}`;
  }

  getCreatedEntity(): DxfTextSceneEntity | null {
    return this.entity;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        position: this.input.position,
        layer: this.input.layer,
        textNode: this.input.textNode as unknown as Record<string, unknown>,
        entityId: this.entity?.id,
      },
      version: 1,
    };
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
}
