/**
 * ADR-344 Phase 7 (InsertTextToken) — Append special-character token to a TEXT/MTEXT entity.
 *
 * Token map: %%c → ⌀, %%d → °, %%p → ±, \S → ½.
 * Appends to the first TextRun of the first paragraph in the DxfTextNode AST
 * and mirrors the change to the flat `text` field for legacy renderer compatibility.
 *
 * AutoCAD parity: equivalent to MTEXT inline code insertion (%%C / %%D / %%P) + \S stack trigger.
 *
 * ADR-614 — boilerplate inherited from {@link DxfTextCommandBase}; the flat-text
 * mirror requires a richer snapshot, so execute/undo are bespoke here.
 */

import type { DxfTextNode, TextParagraph, TextRun, TextStack } from '../../../text-engine/types';
import { ensureTextNode } from '../../../text-engine/edit/ensure-text-node';
import { DxfTextCommandBase } from './dxf-text-command-base';

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

function resolveToken(token: string): string | undefined {
  if (TOKEN_MAP.has(token)) return TOKEN_MAP.get(token);
  // Accept raw Unicode codepoints (e.g. from SymbolPickerDialog).
  if ([...token].length === 1) return token;
  return undefined;
}

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

export class InsertTextTokenCommand extends DxfTextCommandBase<InsertTextTokenCommandInput> {
  readonly name = 'InsertTextToken';
  readonly type = 'insert-text-token';

  private snapshot: TokenInsertSnapshot | null = null;

  execute(): void {
    const entity = this.resolveEntity();
    if (!entity) return;

    const char = resolveToken(this.input.token);
    if (!char) return;

    const safeNode = ensureTextNode(entity);
    const raw = entity as Record<string, unknown>;
    const flatText = typeof raw['text'] === 'string' ? raw['text'] : undefined;

    if (!this.snapshot) this.snapshot = { textNode: safeNode, flatText };

    const nextNode = appendToFirstRun(safeNode, char);
    const updates: Record<string, unknown> = { textNode: nextNode };
    if (flatText !== undefined) updates['text'] = flatText + char;

    this.sceneManager.updateEntity(this.entityId, updates);
    this.wasExecuted = true;
    this.recordAudit('updated', [
      { field: 'textContent', oldValue: this.snapshot.textNode, newValue: nextNode },
    ]);
  }

  undo(): void {
    if (!this.snapshot || !this.wasExecuted) return;
    const updates: Record<string, unknown> = { textNode: this.snapshot.textNode };
    if (this.snapshot.flatText !== undefined) updates['text'] = this.snapshot.flatText;
    this.sceneManager.updateEntity(this.entityId, updates);
  }

  getDescription(): string {
    const char = resolveToken(this.input.token) ?? this.input.token;
    return `Insert "${char}" into text entity`;
  }

  protected validatePayload(): string | null {
    if (!resolveToken(this.input.token)) return `Unknown token "${this.input.token}"`;
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId, token: this.input.token };
  }
}
