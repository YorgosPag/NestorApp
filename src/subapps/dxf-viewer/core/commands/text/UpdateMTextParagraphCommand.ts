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
import type { DxfTextNode, TextParagraph, TextJustification, LineSpacingMode } from '../../../text-engine/types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName } from '../../../stores/LayerStore';
import { buildShallowDiff } from './diff-helpers';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';

type ParagraphFields = Omit<TextParagraph, 'runs'>;
export type ParagraphPatch = Partial<ParagraphFields>;

export interface UpdateMTextParagraphCommandInput {
  readonly entityId: string;
  readonly patch: ParagraphPatch;
  readonly columns?: DxfTextNode['columns'];
  /** 9-point attachment point (node-level). Updates textNode.attachment. */
  readonly attachment?: TextJustification;
  /**
   * ADR-557 — node-level line spacing `{ mode, factor }`. Updates
   * `textNode.lineSpacing`, the SINGLE field the renderer reads
   * (`bim/text/text-lines.ts` → `resolveLineSpacingRatio` → `TextRenderer`).
   * Deliberately node-level (NOT the per-paragraph `lineSpacingMode/Factor` on
   * `ParagraphPatch`, which the renderer ignores — that mismatch is why the
   * ribbon «Διάστιχο» previously did nothing). Mirror of `attachment` above.
   */
  readonly lineSpacing?: { readonly mode: LineSpacingMode; readonly factor: number };
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
    // ADR-358 Phase 9D-3b: id-first via LayerStore, name fallback
    assertCanEditLayer({ layerName: resolveEntityLayerName(entity) ?? '', provider: this.layerProvider });
    const safeNode = ensureTextNode(entity);
    if (!this.snapshot) this.snapshot = safeNode;

    const nextNode: DxfTextNode = {
      ...safeNode,
      paragraphs: applyParagraphPatch(
        safeNode.paragraphs,
        this.input.patch,
        this.input.paragraphIndex,
      ),
      columns: this.input.columns ?? safeNode.columns,
      ...(this.input.attachment !== undefined && { attachment: this.input.attachment }),
      ...(this.input.lineSpacing !== undefined && { lineSpacing: this.input.lineSpacing }),
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
        attachment: this.input.attachment,
        lineSpacing: this.input.lineSpacing as unknown as Record<string, unknown> | undefined,
        paragraphIndex: this.input.paragraphIndex,
      },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    const hasParaPatch = this.input.patch && Object.keys(this.input.patch).length > 0;
    const hasColumns = this.input.columns !== undefined;
    const hasAttachment = this.input.attachment !== undefined;
    const hasLineSpacing = this.input.lineSpacing !== undefined;
    if (!hasParaPatch && !hasColumns && !hasAttachment && !hasLineSpacing) {
      return 'patch, columns, attachment, or lineSpacing is required';
    }
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
