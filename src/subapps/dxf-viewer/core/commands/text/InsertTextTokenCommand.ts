/**
 * ADR-344 Phase 7 (InsertTextToken) — Append special-character token to a TEXT/MTEXT entity.
 *
 * Token map: %%c → ⌀, %%d → °, %%p → ±, \S → ½.
 * Appends to the first TextRun of the first paragraph in the DxfTextNode AST
 * and mirrors the change to the flat `text` field for legacy renderer compatibility.
 *
 * AutoCAD parity: equivalent to MTEXT inline code insertion (%%C / %%D / %%P) + \S stack trigger.
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import type { DxfTextNode, TextParagraph, TextRun, TextStack } from '../../../text-engine/types';
import {
  noopAuditRecorder,
  type DxfTextSceneEntity,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from './types';
import { assertCanEditLayer } from './CanEditLayerGuard';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';

export interface InsertTextTokenCommandInput {
  readonly entityId: string;
  /** Raw token string: '%%c', '%%d', '%%p', or '\\S'. */
  readonly token: string;
}

const TOKEN_MAP = new Map<string, string>([
  ['%%c', '⌀'],
  ['%%d', '°'],
  ['%%p', '±'],
  ['\\S', '½'],
]);

function isTextRun(run: TextRun | TextStack): run is TextRun {
  return 'text' in run;
}

function appendToFirstRun(node: DxfTextNode, char: string): DxfTextNode {
  if (node.paragraphs.length === 0) return node;
  const firstPara = node.paragraphs[0];
  const runIdx = firstPara.runs.findIndex(isTextRun);
  if (runIdx === -1) return node;
  const run = firstPara.runs[runIdx] as TextRun;
  const updated: TextRun = { ...run, text: run.text + char };
  const newRuns = [
    ...firstPara.runs.slice(0, runIdx),
    updated,
    ...firstPara.runs.slice(runIdx + 1),
  ];
  const newPara: TextParagraph = { ...firstPara, runs: newRuns };
  return { ...node, paragraphs: [newPara, ...node.paragraphs.slice(1)] };
}

interface TokenInsertSnapshot {
  readonly textNode: DxfTextNode;
  readonly flatText: string | undefined;
}

export class InsertTextTokenCommand implements ICommand {
  readonly id: string;
  readonly name = 'InsertTextToken';
  readonly type = 'insert-text-token';
  readonly timestamp: number;

  private snapshot: TokenInsertSnapshot | null = null;
  private wasExecuted = false;

  constructor(
    private readonly input: InsertTextTokenCommandInput,
    private readonly sceneManager: ISceneManager,
    private readonly layerProvider: ILayerAccessProvider,
    private readonly auditRecorder: IDxfTextAuditRecorder = noopAuditRecorder,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    const entity = this.sceneManager.getEntity(this.input.entityId) as DxfTextSceneEntity | undefined;
    if (!entity) return;
    assertCanEditLayer({ layerName: entity.layer, provider: this.layerProvider });

    const char = TOKEN_MAP.get(this.input.token);
    if (!char) return;

    const safeNode = ensureTextNode(entity);
    const raw = entity as Record<string, unknown>;
    const flatText = typeof raw['text'] === 'string' ? raw['text'] : undefined;

    if (!this.snapshot) this.snapshot = { textNode: safeNode, flatText };

    const nextNode = appendToFirstRun(safeNode, char);
    const updates: Record<string, unknown> = { textNode: nextNode };
    if (flatText !== undefined) updates['text'] = flatText + char;

    this.sceneManager.updateEntity(this.input.entityId, updates);
    this.wasExecuted = true;

    this.auditRecorder.record({
      entityId: this.input.entityId,
      action: 'updated',
      changes: [{ field: 'textContent', oldValue: this.snapshot.textNode, newValue: nextNode }],
      commandName: this.name,
      timestamp: Date.now(),
    });
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    const updates: Record<string, unknown> = { textNode: this.snapshot.textNode };
    if (this.snapshot.flatText !== undefined) updates['text'] = this.snapshot.flatText;
    this.sceneManager.updateEntity(this.input.entityId, updates);
  }

  redo(): void {
    this.execute();
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    const char = TOKEN_MAP.get(this.input.token) ?? this.input.token;
    return `Insert "${char}" into text entity`;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.input.entityId, token: this.input.token },
      version: 1,
    };
  }

  validate(): string | null {
    if (!this.input.entityId) return 'entityId is required';
    if (!TOKEN_MAP.has(this.input.token)) return `Unknown token "${this.input.token}"`;
    return null;
  }

  getAffectedEntityIds(): string[] {
    return [this.input.entityId];
  }
}
