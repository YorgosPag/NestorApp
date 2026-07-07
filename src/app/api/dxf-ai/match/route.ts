/**
 * @module api/dxf-ai/match
 * @description ADR-581 §12 — Optional AI intent layer for «Αντιγραφή Ιδιοτήτων».
 *
 * Receives a natural-language instruction + the deterministic engine's offered
 * roles, and returns a validated intent: WHICH roles to transfer vs preserve.
 * The LLM never produces values (ADR-185) — the client feeds the returned role
 * set into the deterministic `applyMatchTransfer`.
 *
 * Single forced tool call (`plan_match_properties`) → zod-validated → hallucinated
 * roles dropped. Shares the OpenAI caller (`dxf-openai-call.ts`) with the Drawing
 * Assistant route (zero drift). Gated behind `withAuth` + standard rate-limit.
 *
 * @see ADR-581 §12 · ADR-185
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeJsonParse } from '@/lib/json-utils';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { sanitizeForPromptInjection } from '@/services/ai-pipeline/shared/prompt-sanitizer';
import { DXF_AI_LIMITS } from '@/subapps/dxf-viewer/config/ai-assistant-config';
import {
  callOpenAI,
  type ChatCompletionMessage,
} from '@/subapps/dxf-viewer/ai-assistant/dxf-openai-call';
import {
  MATCH_INTENT_TOOL,
  validateMatchIntent,
  type MatchAiRequest,
  type MatchAiResponse,
} from '@/subapps/dxf-viewer/ai-assistant/match-tool-definitions';

export const maxDuration = 60;

const logger = createModuleLogger('DXF_AI_MATCH');

/** Guard against oversized offered-role lists (prompt bloat / abuse). */
const MAX_OFFERED_ROLES = 64;
const MAX_TARGET_TYPES = 16;

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(
  body: unknown,
): { valid: true; data: MatchAiRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }
  const req = body as Record<string, unknown>;

  if (typeof req.message !== 'string' || req.message.trim().length === 0) {
    return { valid: false, error: 'Message is required' };
  }
  if (req.message.length > DXF_AI_LIMITS.MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds ${DXF_AI_LIMITS.MAX_MESSAGE_LENGTH} characters` };
  }
  if (!Array.isArray(req.offeredRoles) || req.offeredRoles.length === 0) {
    return { valid: false, error: 'offeredRoles is required' };
  }
  const offeredRoles = req.offeredRoles.filter((r): r is string => typeof r === 'string');
  if (offeredRoles.length === 0) {
    return { valid: false, error: 'offeredRoles must contain role identifiers' };
  }
  const targetTypes = Array.isArray(req.targetTypes)
    ? req.targetTypes.filter((t): t is string => typeof t === 'string').slice(0, MAX_TARGET_TYPES)
    : [];

  return {
    valid: true,
    data: {
      message: req.message,
      offeredRoles: offeredRoles.slice(0, MAX_OFFERED_ROLES),
      sourceType: typeof req.sourceType === 'string' ? req.sourceType : null,
      targetTypes,
    },
  };
}

// ============================================================================
// PROMPT
// ============================================================================

function buildMatchIntentPrompt(req: MatchAiRequest): string {
  const sourceType = req.sourceType ?? 'object';
  const targets = req.targetTypes.length > 0 ? req.targetTypes.join(', ') : sourceType;
  return [
    'You are a property-copy planner for a CAD/BIM editor.',
    `A user is copying properties from a ${sourceType} onto: ${targets}.`,
    'Call the plan_match_properties tool exactly once.',
    'You may ONLY use these offered role identifiers (verbatim):',
    req.offeredRoles.map((r) => `  - ${r}`).join('\n'),
    'Rules:',
    '- Never invent role identifiers outside the offered list.',
    '- Never output numeric values — the engine computes all values deterministically.',
    '- transferRoles = roles to copy (empty means copy every offered role).',
    '- preserveRoles = roles to leave untouched on the targets.',
  ].join('\n');
}

// ============================================================================
// HANDLER
// ============================================================================

async function handler(
  request: NextRequest,
  _ctx: AuthContext,
  _cache: PermissionCache,
): Promise<NextResponse<MatchAiResponse | { error: string }>> {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as unknown;
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const data = validation.data;

    // OWASP LLM01 — neutralise injection attempts in the free-text instruction.
    const safeMessage = sanitizeForPromptInjection(data.message, DXF_AI_LIMITS.MAX_MESSAGE_LENGTH);

    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: buildMatchIntentPrompt(data) },
      { role: 'user', content: safeMessage },
    ];

    const { message } = await callOpenAI(
      messages,
      [MATCH_INTENT_TOOL],
      AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS,
      {
        toolChoice: { type: 'function', function: { name: MATCH_INTENT_TOOL.function.name } },
        parallelToolCalls: false,
      },
    );

    const toolCall = message.tool_calls?.[0];
    if (!toolCall) {
      return NextResponse.json({ error: 'AI did not return a plan' }, { status: 502 });
    }

    const rawArgs = safeJsonParse<unknown>(toolCall.function.arguments, null);
    const validated = validateMatchIntent(rawArgs, data.offeredRoles);
    if (!validated) {
      return NextResponse.json({ error: 'AI returned an invalid plan' }, { status: 502 });
    }

    const processingTimeMs = Date.now() - startTime;
    if (validated.rejectedRoles.length > 0) {
      logger.warn(`Dropped ${validated.rejectedRoles.length} hallucinated role(s): ${validated.rejectedRoles.join(', ')}`);
    }
    logger.info(`Match intent: transfer=${validated.intent.transferRoles.length} preserve=${validated.intent.preserveRoles.length} (${processingTimeMs}ms)`);

    return NextResponse.json({
      intent: validated.intent,
      rejectedRoles: validated.rejectedRoles,
      processingTimeMs,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    logger.error(`DXF AI match error: ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// ============================================================================
// EXPORT
// ============================================================================

const rateLimitedHandler = withStandardRateLimit(
  withAuth<MatchAiResponse | { error: string }>(handler),
);

export const POST = rateLimitedHandler;
