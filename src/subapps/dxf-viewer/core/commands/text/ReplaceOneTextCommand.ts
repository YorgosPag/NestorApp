/**
 * ADR-344 Phase 6.A — ReplaceOneTextCommand.
 *
 * Replaces a single match at a specific location inside one entity.
 * Used by the Find&Replace UI when the user presses "Replace" (not
 * "Replace All"). Exactly one audit entry per execution.
 *
 * ADR-614 — command lifecycle inherited from {@link DxfTextNodeMutationCommand}.
 * The snapshot is the RAW `entity.textNode` (no `ensureTextNode`), so
 * {@link readNode} is overridden.
 */

import type { DxfTextSceneEntity } from './types';
import type { DxfTextNode } from '../../../text-engine/types';
import { replaceAt, type MatchLocation } from './text-match-engine';
import {
  DxfTextNodeMutationCommand,
  type TextNodeMutationResult,
} from './dxf-text-command-base';

export interface ReplaceOneTextCommandInput {
  readonly entityId: string;
  readonly location: MatchLocation;
  readonly replacement: string;
  /** Original matched text (audit + redo verification). */
  readonly originalText: string;
}

export class ReplaceOneTextCommand extends DxfTextNodeMutationCommand<ReplaceOneTextCommandInput> {
  readonly name = 'ReplaceOneText';
  readonly type = 'replace-one-text';

  protected readNode(entity: DxfTextSceneEntity): DxfTextNode {
    return entity.textNode;
  }

  protected applyMutation(_entity: unknown, node: DxfTextNode): TextNodeMutationResult | null {
    const { node: nextNode, replaced } = replaceAt(
      node,
      this.input.location,
      this.input.replacement,
    );
    if (!replaced) return null;
    return {
      updates: { textNode: nextNode },
      changes: [
        { field: 'text', oldValue: this.input.originalText, newValue: this.input.replacement },
        { field: 'paragraph', oldValue: null, newValue: this.input.location.paragraphIndex },
        { field: 'run', oldValue: null, newValue: this.input.location.runIndex },
      ],
    };
  }

  getDescription(): string {
    return `Replace "${this.input.originalText}" → "${this.input.replacement}"`;
  }

  protected validatePayload(): string | null {
    if (this.input.location.start >= this.input.location.end) {
      return 'location end must be greater than start';
    }
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.input.entityId,
      location: this.input.location as unknown as Record<string, unknown>,
      replacement: this.input.replacement,
      originalText: this.input.originalText,
    };
  }
}
