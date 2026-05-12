/**
 * ADR-344 Phase 12 — POST /api/dxf/text/ai/command
 *
 * Receives a natural-language DXF text editing instruction, calls
 * OpenAI Responses API with a strict json_schema (intent-schema.ts),
 * returns a flat TextAIIntentFlat JSON object.
 *
 * Auth: withAuth (dxf:files:view — same gate as text-templates).
 * Rate: withHeavyRateLimit (10 req/min — AI calls are expensive).
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { isRecord } from '@/lib/type-guards';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { TEXT_AI_SYSTEM_PROMPT } from '@/subapps/dxf-viewer/text-engine/ai/system-prompt';
import { TEXT_AI_INTENT_SCHEMA } from '@/subapps/dxf-viewer/text-engine/ai/intent-schema';
import type { TextAIIntentFlat } from '@/subapps/dxf-viewer/text-engine/ai/text-ai-types';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('DxfTextAICommand');

interface CommandRequest {
  readonly text?: unknown;
}

interface CommandResponse {
  readonly success: boolean;
  readonly intent?: TextAIIntentFlat;
  readonly error?: string;
}

function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const output = payload.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!isRecord(item) || item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const entry of content) {
      if (!isRecord(entry) || entry.type !== 'output_text') continue;
      if (typeof entry.text === 'string' && entry.text.trim()) return entry.text.trim();
    }
  }
  return null;
}

async function callOpenAIIntent(
  text: string,
  apiKey: string,
  baseUrl: string,
): Promise<TextAIIntentFlat> {
  const { TEXT_MODEL, TIMEOUT_MS } = AI_ANALYSIS_DEFAULTS.OPENAI;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = {
    model: TEXT_MODEL,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: TEXT_AI_SYSTEM_PROMPT }] },
      { role: 'user', content: [{ type: 'input_text', text }] },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: TEXT_AI_INTENT_SCHEMA.name,
        description: TEXT_AI_INTENT_SCHEMA.description,
        strict: TEXT_AI_INTENT_SCHEMA.strict,
        schema: TEXT_AI_INTENT_SCHEMA.schema as Record<string, unknown>,
      },
    },
  };

  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`);
    }

    const payload: unknown = await response.json();
    const rawText = extractOutputText(payload);
    if (!rawText) throw new Error('Empty OpenAI response');

    const parsed = safeJsonParse(rawText) as TextAIIntentFlat | null;
    if (!parsed || typeof parsed.command !== 'string') throw new Error('Invalid intent shape');
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withHeavyRateLimit(
  withAuth<CommandResponse>(
    async (
      request: NextRequest,
      authCtx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<CommandResponse>> => {
      let body: CommandRequest;
      try {
        body = (await request.json()) as CommandRequest;
      } catch {
        return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
      }

      if (typeof body.text !== 'string' || !body.text.trim()) {
        return NextResponse.json({ success: false, error: 'text_required' }, { status: 400 });
      }

      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        logger.error('OPENAI_API_KEY not configured');
        return NextResponse.json({ success: false, error: 'ai_unavailable' }, { status: 503 });
      }

      try {
        const intent = await callOpenAIIntent(
          body.text.trim(),
          apiKey,
          AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL,
        );
        logger.info(`Intent resolved: ${intent.command} for uid ${authCtx.uid}`);
        return NextResponse.json({ success: true, intent });
      } catch (err) {
        const message = getErrorMessage(err);
        const isTimeout = message.includes('abort');
        logger.error(`AI command ${isTimeout ? 'timeout' : 'error'}: ${message}`);
        return NextResponse.json(
          { success: false, error: isTimeout ? 'ai_timeout' : 'ai_error' },
          { status: isTimeout ? 504 : 502 },
        );
      }
    },
    { permissions: 'dxf:files:view' },
  ),
);
