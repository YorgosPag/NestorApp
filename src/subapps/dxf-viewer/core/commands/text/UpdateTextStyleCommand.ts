/**
 * ADR-344 Phase 6.A — UpdateTextStyleCommand.
 *
 * Patches run-level style across every run of every paragraph in a single
 * TEXT/MTEXT entity. Used by the toolbar (bold, italic, color, height,
 * font, …) when the user has no in-document selection — the patch is
 * applied uniformly. Selection-aware partial updates are produced by
 * the TipTap editor and serialized through Phase 4, not here.
 *
 * Pre-execute: assertCanEditLayer (Q8). Audit (Q12) fires on success.
 * Idempotent: undo restores the snapshot captured on first execute().
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { TextRunStyle, DxfTextNode, TextParagraph, TextRun, TextStack } from '../../../text-engine/types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
import { buildShallowDiff } from './diff-helpers';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';

export type TextStylePatch = Partial<TextRunStyle>;

export interface UpdateTextStyleCommandInput {
  readonly entityId: string;
  readonly patch: TextStylePatch;
}

function isStack(item: TextRun | TextStack): item is TextStack {
  return (item as TextStack).top !== undefined;
}

function applyToRuns(
  paragraphs: readonly TextParagraph[],
  patch: TextStylePatch,
): readonly TextParagraph[] {
  return paragraphs.map((para) => ({
    ...para,
    runs: para.runs.map((item) => {
      if (isStack(item)) return item;
      return { ...item, style: { ...item.style, ...patch } };
    }),
  }));
}

export class UpdateTextStyleCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateTextStyle';
  readonly type = 'update-text-style';
  readonly timestamp: number;

  private snapshot: DxfTextNode | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: UpdateTextStyleCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.input.entityId) as
      | DxfTextSceneEntity
      | undefined;
    if (!entity) return;
    assertCanEditLayer({ layerName: entity.layer, provider: this.layerProvider });

    const safeNode = ensureTextNode(entity);
    if (!this.snapshot) this.snapshot = safeNode;
    const nextNode: DxfTextNode = {
      ...safeNode,
      paragraphs: applyToRuns(safeNode.paragraphs, this.input.patch),
    };
    this.sceneManager.updateEntity(this.input.entityId, { textNode: nextNode });
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: buildShallowDiff(
        this.snapshot as unknown as Record<string, unknown>,
        nextNode as unknown as Record<string, unknown>,
      ),
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    this.sceneManager.updateEntity(this.input.entityId, { textNode: this.snapshot });
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(other: ICommand): boolean {
    if (other.type !== this.type) return false;
    const o = other as UpdateTextStyleCommand;
    return o.input.entityId === this.input.entityId;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateTextStyleCommand;
    return new UpdateTextStyleCommand(
      { entityId: this.input.entityId, patch: { ...this.input.patch, ...o.input.patch } },
      this.sceneManager,
      this.layerProvider,
      this.auditRecorder,
    );
  }

  getDescription(): string {
    return `Update text style (${Object.keys(this.input.patch).join(', ') || 'no fields'})`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.input.entityId, patch: this.input.patch },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (!this.input.patch || Object.keys(this.input.patch).length === 0) {
      return 'patch must not be empty';
    }
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
