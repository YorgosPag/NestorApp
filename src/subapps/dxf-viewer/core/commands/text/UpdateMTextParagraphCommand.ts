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
 *
 * ADR-614 — command lifecycle inherited from {@link DxfTextNodeMutationCommand}.
 */

import type { DxfTextNode, TextParagraph, TextJustification, LineSpacingMode } from '../../../text-engine/types';
import { buildShallowDiff } from './diff-helpers';
import {
  DxfTextNodeMutationCommand,
  type TextNodeMutationResult,
} from './dxf-text-command-base';

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

export class UpdateMTextParagraphCommand extends DxfTextNodeMutationCommand<UpdateMTextParagraphCommandInput> {
  readonly name = 'UpdateMTextParagraph';
  readonly type = 'update-mtext-paragraph';

  protected applyMutation(
    _entity: unknown,
    node: DxfTextNode,
    snapshot: DxfTextNode,
  ): TextNodeMutationResult {
    const nextNode: DxfTextNode = {
      ...node,
      paragraphs: applyParagraphPatch(
        node.paragraphs,
        this.input.patch,
        this.input.paragraphIndex,
      ),
      columns: this.input.columns ?? node.columns,
      ...(this.input.attachment !== undefined && { attachment: this.input.attachment }),
      ...(this.input.lineSpacing !== undefined && { lineSpacing: this.input.lineSpacing }),
    };
    return {
      updates: { textNode: nextNode },
      changes: buildShallowDiff(
        snapshot as unknown as Record<string, unknown>,
        nextNode as unknown as Record<string, unknown>,
      ),
    };
  }

  getDescription(): string {
    const target =
      this.input.paragraphIndex !== undefined
        ? `paragraph #${this.input.paragraphIndex}`
        : 'all paragraphs';
    return `Update MTEXT ${target}`;
  }

  protected validatePayload(): string | null {
    const hasParaPatch = this.input.patch && Object.keys(this.input.patch).length > 0;
    const hasColumns = this.input.columns !== undefined;
    const hasAttachment = this.input.attachment !== undefined;
    const hasLineSpacing = this.input.lineSpacing !== undefined;
    if (!hasParaPatch && !hasColumns && !hasAttachment && !hasLineSpacing) {
      return 'patch, columns, attachment, or lineSpacing is required';
    }
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.input.entityId,
      patch: this.input.patch as unknown as Record<string, unknown>,
      columns: this.input.columns as unknown as Record<string, unknown> | undefined,
      attachment: this.input.attachment,
      lineSpacing: this.input.lineSpacing as unknown as Record<string, unknown> | undefined,
      paragraphIndex: this.input.paragraphIndex,
    };
  }
}
