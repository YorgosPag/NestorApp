'use client';

/**
 * ADR-344 Phase 12 — Client-side AI command router.
 *
 * resolveIntent() → POSTs to /api/dxf/text/ai/command, returns TextAIIntentFlat.
 * buildCommandFromIntent() → constructs the ICommand from a resolved intent.
 * route() → convenience: resolveIntent + buildCommandFromIntent in one call.
 *
 * Note: replace_all / replace_one operate on the selected entity only (ctx.entityId).
 * Cross-drawing replace requires future wiring with a full entity query.
 *
 * update_paragraph maps to UpdateMTextParagraphCommand paragraph-level fields
 * (justification, spacing). Content replacement uses replace_one / replace_all.
 */

import type { ICommand } from '../../core/commands/interfaces';
import {
  CreateTextCommand,
  UpdateTextStyleCommand,
  UpdateTextGeometryCommand,
  UpdateMTextParagraphCommand,
  ReplaceOneTextCommand,
  ReplaceAllTextCommand,
  DeleteTextCommand,
} from '../../core/commands/text';
import type {
  CreateTextCommandInput,
  UpdateTextStyleCommandInput,
  TextStylePatch,
} from '../../core/commands/text';
import type { DxfTextNode, TextParagraph } from '../types';
import type { TextAIIntentFlat, TextAIContext, TextAIRouterResult } from './text-ai-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const JUSTIFICATION_MAP: Record<string, 0 | 1 | 2 | 3> = {
  LEFT: 0,
  CENTER: 1,
  RIGHT: 2,
  JUSTIFY: 3,
};

function resolveJustification(raw: string | null): 0 | 1 | 2 | 3 | undefined {
  if (!raw) return undefined;
  return JUSTIFICATION_MAP[raw.toUpperCase()];
}

function makeMinimalTextNode(
  content: string,
  style: Partial<TextStylePatch>,
): DxfTextNode {
  const run = {
    text: content,
    style: {
      fontFamily: style.fontFamily ?? 'Standard',
      bold: style.bold ?? false,
      italic: style.italic ?? false,
      underline: false,
      overline: false,
      strikethrough: false,
      height: style.height ?? 2.5,
      widthFactor: 1,
      obliqueAngle: 0,
      tracking: 1,
      color: style.color ?? { kind: 'ByLayer' as const },
    },
  };
  const paragraph: TextParagraph = {
    runs: [run],
    indent: 0,
    leftMargin: 0,
    rightMargin: 0,
    tabs: [],
    justification: 0,
    lineSpacingMode: 'multiple' as const,
    lineSpacingFactor: 1,
  };
  return {
    paragraphs: [paragraph],
    attachment: 'BL' as const,
    lineSpacing: { mode: 'multiple' as const, factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

// ── Intent → ICommand ─────────────────────────────────────────────────────────

function buildCommandFromIntent(
  intent: TextAIIntentFlat,
  ctx: TextAIContext,
): ICommand {
  const { entityId, scene, layerProvider, auditRecorder } = ctx;

  switch (intent.command) {
    case 'create_text': {
      const style: Partial<TextStylePatch> = {
        bold: intent.bold ?? undefined,
        italic: intent.italic ?? undefined,
        height: intent.height ?? undefined,
        fontFamily: intent.fontFamily ?? undefined,
      };
      const input: CreateTextCommandInput = {
        position: { x: intent.positionX ?? 0, y: intent.positionY ?? 0 },
        layer: intent.layer ?? '0',
        textNode: makeMinimalTextNode(intent.content ?? '', style),
      };
      return new CreateTextCommand(input, scene, auditRecorder);
    }

    case 'update_style': {
      const patch: TextStylePatch = {};
      if (intent.bold !== null) patch.bold = intent.bold ?? undefined;
      if (intent.italic !== null) patch.italic = intent.italic ?? undefined;
      if (intent.height !== null) patch.height = intent.height ?? undefined;
      if (intent.fontFamily !== null) patch.fontFamily = intent.fontFamily ?? undefined;
      if (intent.colorAci !== null && intent.colorAci !== undefined) {
        patch.color = { kind: 'ACI' as const, index: intent.colorAci };
      }
      const input: UpdateTextStyleCommandInput = { entityId, patch };
      return new UpdateTextStyleCommand(input, scene, layerProvider, auditRecorder);
    }

    case 'update_geometry': {
      const patch: Record<string, unknown> = {};
      if (intent.newPositionX !== null && intent.newPositionY !== null) {
        patch.position = { x: intent.newPositionX, y: intent.newPositionY };
      }
      if (intent.rotation !== null) patch.rotation = intent.rotation;
      return new UpdateTextGeometryCommand({ entityId, patch }, scene, layerProvider, auditRecorder);
    }

    case 'update_paragraph': {
      const justification = resolveJustification(intent.justification);
      const patch: Partial<Omit<TextParagraph, 'runs'>> = {};
      if (justification !== undefined) patch.justification = justification;
      return new UpdateMTextParagraphCommand(
        { entityId, patch, paragraphIndex: intent.paragraphIndex ?? undefined },
        scene,
        layerProvider,
        auditRecorder,
      );
    }

    case 'replace_one':
      return new ReplaceOneTextCommand(
        {
          entityId,
          pattern: intent.search ?? '',
          replacement: intent.replacement ?? '',
          matchOptions: { caseSensitive: intent.caseSensitive ?? false },
          matchIndex: intent.matchIndex ?? 0,
        },
        scene,
        layerProvider,
        auditRecorder,
      );

    case 'replace_all':
      return new ReplaceAllTextCommand(
        {
          entityIds: [entityId],
          pattern: intent.search ?? '',
          replacement: intent.replacement ?? '',
          matchOptions: { caseSensitive: intent.caseSensitive ?? false },
        },
        scene,
        layerProvider,
        auditRecorder,
      );

    case 'delete':
      return new DeleteTextCommand({ entityId }, scene, layerProvider, auditRecorder);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function resolveIntent(text: string): Promise<TextAIIntentFlat> {
  const response = await fetch('/api/dxf/text/ai/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const data: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }

  const data: { success: boolean; intent?: TextAIIntentFlat; error?: string } =
    await response.json();

  if (!data.success || !data.intent) {
    throw new Error(data.error ?? 'no_intent');
  }

  return data.intent;
}

export async function route(
  text: string,
  ctx: TextAIContext,
): Promise<TextAIRouterResult> {
  try {
    const intent = await resolveIntent(text);
    const command = buildCommandFromIntent(intent, ctx);
    return { ok: true, command };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    return { ok: false, error: message };
  }
}
