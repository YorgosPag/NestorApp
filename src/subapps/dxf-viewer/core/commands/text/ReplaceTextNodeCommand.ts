/**
 * ADR-344 Phase 6.E — ReplaceTextNodeCommand.
 *
 * Atomic replacement of the entire DxfTextNode on a single TEXT/MTEXT
 * entity. Used as the "content carrier" inside the TipTap commit
 * pipeline (Phase 6.E Layer 3): the diff engine emits one of these
 * whenever paragraph structure or run content changes — fields that
 * `UpdateMTextParagraphCommand` cannot patch because its `ParagraphPatch`
 * type intentionally excludes `runs`.
 *
 * AutoCAD parity: equivalent to the `MTEXTEDIT` undo entry — one entry
 * regardless of how many characters changed inside the editor session.
 *
 * ADR-614 — command lifecycle inherited from {@link DxfTextNodeMutationCommand}.
 */

import type { DxfTextNode } from '../../../text-engine/types';
import {
  DxfTextNodeMutationCommand,
  type TextNodeMutationResult,
} from './dxf-text-command-base';

export interface ReplaceTextNodeCommandInput {
  readonly entityId: string;
  readonly nextNode: DxfTextNode;
}

export class ReplaceTextNodeCommand extends DxfTextNodeMutationCommand<ReplaceTextNodeCommandInput> {
  readonly name = 'ReplaceTextNode';
  readonly type = 'replace-text-node';

  protected applyMutation(): TextNodeMutationResult {
    return {
      updates: { textNode: this.input.nextNode },
      changes: [{ field: 'textNode', oldValue: 'replaced', newValue: 'replaced' }],
    };
  }

  getDescription(): string {
    return `Replace text node (${this.input.entityId})`;
  }

  protected validatePayload(): string | null {
    if (!this.input.nextNode) return 'nextNode is required';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityId: this.input.entityId,
      nextNode: this.input.nextNode as unknown as Record<string, unknown>,
    };
  }
}
