/**
 * ADR-344 Phase 6.A — UpdateTextStyleCommand.
 *
 * Patches run-level style across every run of every paragraph in a single
 * TEXT/MTEXT entity. Used by the toolbar (bold, italic, color, height,
 * font, …) when the user has no in-document selection — the patch is
 * applied uniformly. Selection-aware partial updates are produced by
 * the TipTap editor and serialized through Phase 4, not here.
 *
 * ADR-614 — lifecycle (resolve → guard → snapshot → commit → audit / undo)
 * is inherited from {@link DxfTextNodeMutationCommand}; only the run-style
 * patch + merge behaviour live here.
 */

import type { ICommand } from '../interfaces';
import type { TextRunStyle, DxfTextNode, TextParagraph, TextRun, TextStack } from '../../../text-engine/types';
import { buildShallowDiff } from './diff-helpers';
import {
  DxfTextNodeMutationCommand,
  mergePatchInputs,
  validateNonEmptyPatch,
  describePatchFields,
  type TextNodeMutationResult,
} from './dxf-text-command-base';

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

export class UpdateTextStyleCommand extends DxfTextNodeMutationCommand<UpdateTextStyleCommandInput> {
  readonly name = 'UpdateTextStyle';
  readonly type = 'update-text-style';

  protected applyMutation(
    _entity: unknown,
    node: DxfTextNode,
    snapshot: DxfTextNode,
  ): TextNodeMutationResult {
    const nextNode: DxfTextNode = {
      ...node,
      paragraphs: applyToRuns(node.paragraphs, this.input.patch),
    };
    return {
      updates: { textNode: nextNode },
      changes: buildShallowDiff(
        snapshot as unknown as Record<string, unknown>,
        nextNode as unknown as Record<string, unknown>,
      ),
    };
  }

  canMergeWith(other: ICommand): boolean {
    if (other.type !== this.type) return false;
    return (other as UpdateTextStyleCommand).input.entityId === this.input.entityId;
  }

  mergeWith(other: ICommand): ICommand {
    const merged = mergePatchInputs(this.input, (other as UpdateTextStyleCommand).input);
    return new UpdateTextStyleCommand(merged, this.sceneManager, this.layerProvider, this.auditRecorder);
  }

  protected validatePayload(): string | null {
    return validateNonEmptyPatch(this.input.patch);
  }

  getDescription(): string {
    return describePatchFields('Update text style', this.input.patch);
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId, patch: this.input.patch };
  }
}
