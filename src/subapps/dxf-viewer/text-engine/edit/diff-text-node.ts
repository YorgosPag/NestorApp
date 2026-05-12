/**
 * ADR-344 Phase 6.E — DxfTextNode diff → atomic ICommand list.
 *
 * Input: prev + next DxfTextNode (commit boundary from TipTap editor).
 * Output: ordered ICommand[] that, when wrapped in a CompoundCommand,
 * reproduces the same scene mutation atomically with a single undo step.
 *
 * Strategy (AutoCAD MTEXTEDIT parity):
 *
 *   1. If paragraph STRUCTURE changed (paragraph count, run count, run
 *      content text, stack nodes) → emit `ReplaceTextNodeCommand` only.
 *      Granular content edits are not first-class commands in ADR-344;
 *      a single atomic replace is the AutoCAD-grade behaviour and keeps
 *      undo semantics simple.
 *
 *   2. Otherwise, emit granular commands per changed surface:
 *        - rotation        → `UpdateTextGeometryCommand`
 *        - uniform style   → `UpdateTextStyleCommand` (delta vs prev[0])
 *        - paragraph meta  → `UpdateMTextParagraphCommand` per paragraph
 *
 * Caller wraps the returned list in a CompoundCommand (`new
 * CompoundCommand('Edit text', diff(...))`).
 */

import type { ICommand, ISceneManager } from '../../core/commands';
import {
  UpdateTextStyleCommand,
  UpdateTextGeometryCommand,
  UpdateMTextParagraphCommand,
  ReplaceTextNodeCommand,
  type TextStylePatch,
  type GeometryPatch,
  type ParagraphPatch,
  type IDxfTextAuditRecorder,
  type ILayerAccessProvider,
} from '../../core/commands/text';
import type {
  DxfTextNode,
  TextRunStyle,
  TextParagraph,
  TextRun,
  TextStack,
} from '../types';

export interface DiffServices {
  readonly sceneManager: ISceneManager;
  readonly layerProvider: ILayerAccessProvider;
  readonly auditRecorder: IDxfTextAuditRecorder;
}

function isStack(item: TextRun | TextStack): item is TextStack {
  return (item as TextStack).top !== undefined;
}

function runsContentChanged(
  prev: readonly (TextRun | TextStack)[],
  next: readonly (TextRun | TextStack)[],
): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (isStack(a) || isStack(b)) {
      if (isStack(a) !== isStack(b)) return true;
      // Stack equality is opaque here; defer to atomic replace.
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
      continue;
    }
    if (a.text !== b.text) return true;
  }
  return false;
}

function paragraphsContentChanged(
  prev: readonly TextParagraph[],
  next: readonly TextParagraph[],
): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (runsContentChanged(prev[i]!.runs, next[i]!.runs)) return true;
  }
  return false;
}

function styleKeysChanged(
  a: TextRunStyle | undefined,
  b: TextRunStyle | undefined,
): Partial<TextRunStyle> {
  const patch: Partial<TextRunStyle> = {};
  if (!a || !b) return patch;
  const keys: (keyof TextRunStyle)[] = [
    'fontFamily',
    'bold',
    'italic',
    'underline',
    'overline',
    'strikethrough',
    'height',
    'widthFactor',
    'obliqueAngle',
    'tracking',
  ];
  for (const k of keys) {
    if (!Object.is(a[k], b[k])) {
      (patch as Record<string, unknown>)[k] = b[k];
    }
  }
  // Colour is a discriminated union — shallow JSON comparison is acceptable.
  if (JSON.stringify(a.color) !== JSON.stringify(b.color)) {
    patch.color = b.color;
  }
  return patch;
}

function firstRunStyle(node: DxfTextNode): TextRunStyle | undefined {
  const p = node.paragraphs[0];
  if (!p) return undefined;
  const r = p.runs[0];
  if (!r || isStack(r)) return undefined;
  return r.style;
}

function paragraphPatchOf(
  prev: TextParagraph,
  next: TextParagraph,
): ParagraphPatch | null {
  const patch: ParagraphPatch = {};
  if (!Object.is(prev.indent, next.indent)) patch.indent = next.indent;
  if (!Object.is(prev.leftMargin, next.leftMargin)) patch.leftMargin = next.leftMargin;
  if (!Object.is(prev.rightMargin, next.rightMargin)) patch.rightMargin = next.rightMargin;
  if (!Object.is(prev.justification, next.justification)) {
    patch.justification = next.justification;
  }
  if (!Object.is(prev.lineSpacingMode, next.lineSpacingMode)) {
    patch.lineSpacingMode = next.lineSpacingMode;
  }
  if (!Object.is(prev.lineSpacingFactor, next.lineSpacingFactor)) {
    patch.lineSpacingFactor = next.lineSpacingFactor;
  }
  if (JSON.stringify(prev.tabs) !== JSON.stringify(next.tabs)) {
    patch.tabs = next.tabs;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Compute the ordered command list that transforms `prev` into `next`
 * on `entityId`. Caller wraps in CompoundCommand for atomic undo.
 */
export function diffTextNode(
  entityId: string,
  prev: DxfTextNode,
  next: DxfTextNode,
  services: DiffServices,
): ICommand[] {
  const { sceneManager, layerProvider, auditRecorder } = services;

  // Step 1 — content/structure change → atomic full replace.
  if (paragraphsContentChanged(prev.paragraphs, next.paragraphs)) {
    return [
      new ReplaceTextNodeCommand(
        { entityId, nextNode: next },
        sceneManager,
        layerProvider,
        auditRecorder,
      ),
    ];
  }

  const commands: ICommand[] = [];

  // Step 2a — geometry (rotation).
  if (!Object.is(prev.rotation, next.rotation)) {
    const patch: GeometryPatch = { rotation: next.rotation };
    commands.push(
      new UpdateTextGeometryCommand(
        { entityId, patch },
        sceneManager,
        layerProvider,
        auditRecorder,
      ),
    );
  }

  // Step 2b — uniform style delta (first run is representative).
  const styleDelta = styleKeysChanged(firstRunStyle(prev), firstRunStyle(next));
  if (Object.keys(styleDelta).length > 0) {
    commands.push(
      new UpdateTextStyleCommand(
        { entityId, patch: styleDelta as TextStylePatch },
        sceneManager,
        layerProvider,
        auditRecorder,
      ),
    );
  }

  // Step 2c — per-paragraph meta diff.
  for (let i = 0; i < prev.paragraphs.length; i++) {
    const patch = paragraphPatchOf(prev.paragraphs[i]!, next.paragraphs[i]!);
    if (!patch) continue;
    commands.push(
      new UpdateMTextParagraphCommand(
        { entityId, patch, paragraphIndex: i },
        sceneManager,
        layerProvider,
        auditRecorder,
      ),
    );
  }

  return commands;
}
