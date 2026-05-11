/**
 * ADR-344 Phase 6.A — UpdateMTextParagraphCommand.
 *
 * Patches paragraph-level fields (justification, line spacing, indent,
 * margins, tabs, columns) on a single MTEXT entity. For TEXT entities
 * paragraph fields are not meaningful and the command no-ops on validate.
 *
 * `patch.paragraphIndex` selects a single paragraph; omit to apply the
 * patch to every paragraph (uniform). Columns live on the node, not the
 * paragraph, and are patched separately via `patch.columns`.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode, TextParagraph } from '../../../text-engine/types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
import { buildShallowDiff } from './diff-helpers';

type ParagraphFields = Omit<TextParagraph, 'runs'>;
export type ParagraphPatch = Partial<ParagraphFields>;

export interface UpdateMTextParagraphCommandInput {
  readonly entityId: string;
  readonly patch: ParagraphPatch;
  readonly columns?: DxfTextNode['columns'];
  /** When set, only this paragraph index is patched. Otherwise all paragraphs. */
  readonly paragraphIndex?: number;
}

function applyParagraphPatch(
  paragraphs: readonly TextParagraph[],
  patch: ParagraphPatch,
  index: number | undefined,
): readonly TextParagraph[] {
  return paragraphs.map((para, i) => {
    if (index !== undefined && i !== index) return para;
    return { ...para, ...patch };
  });
}

export class UpdateMTextParagraphCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMTextParagraph';
  readonly type = 'update-mtext-paragraph';
  readonly timestamp: number;

  private snapshot: DxfTextNode | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: UpdateMTextParagraphCommandInput,
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
    if (!this.snapshot) this.snapshot = entity.textNode;

    const nextNode: DxfTextNode = {
      ...entity.textNode,
      paragraphs: applyParagraphPatch(
        entity.textNode.paragraphs,
        this.input.patch,
        this.input.paragraphIndex,
      ),
      columns: this.input.columns ?? entity.textNode.columns,
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

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    const target =
      this.input.paragraphIndex !== undefined
        ? `paragraph #${this.input.paragraphIndex}`
        : 'all paragraphs';
    return `Update MTEXT ${target}`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        entityId: this.input.entityId,
        patch: this.input.patch as unknown as Record<string, unknown>,
        columns: this.input.columns as unknown as Record<string, unknown> | undefined,
        paragraphIndex: this.input.paragraphIndex,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    const hasParaPatch = this.input.patch && Object.keys(this.input.patch).length > 0;
    const hasColumns = this.input.columns !== undefined;
    if (!hasParaPatch && !hasColumns) return 'patch or columns is required';
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
