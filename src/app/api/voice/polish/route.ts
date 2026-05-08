/**
 * =============================================================================
 * VOICE POLISH API — AI text formatting for voice transcripts (ADR-342)
 * =============================================================================
 *
 * POST /api/voice/polish
 * Takes raw Whisper transcript → returns formatted, clean text via gpt-4o-mini.
 * Used by VoiceMicButton after transcription to improve readability.
 *
 * Auth: withAuth (authenticated users only)
 * Rate: withStandardRateLimit (20 req/min)
 * Fallback: client falls back to raw text on any error
 *
 * @endpoint POST /api/voice/polish
 * @enterprise ADR-342 - Voice Input Field SSoT
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('VOICE_POLISH');

// =============================================================================
// TYPES (ZERO any)
// =============================================================================

interface PolishRequest {
  text: string;
}

interface PolishResponse {
  success: boolean;
  text: string;
  error?: string;
}

interface OpenAICompletion {
  choices: Array<{ message: { content: string | null } }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TEXT_LENGTH = 2000;

const SYSTEM_PROMPT =
  'You are a text formatter for a CRM calendar application. ' +
  'Take a raw voice transcript and return a clean, professional event description. ' +
  'Fix punctuation, remove filler words (um, uh, basically), structure into clear sentences. ' +
  'Keep the original language (Greek or English). Do NOT add new information. ' +
  'Return ONLY the formatted text, nothing else.';

// =============================================================================
// HANDLER
// =============================================================================

export const POST = withStandardRateLimit(
  withAuth<PolishResponse>(
    async (
      request: NextRequest,
      authCtx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse<PolishResponse>> => {
      // 1. Parse body
      let body: PolishRequest;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, text: '', error: 'Invalid JSON' },
          { status: 400 }
        );
      }

      // 2. Validate text
      const { text } = body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return NextResponse.json(
          { success: false, text: '', error: 'No text provided' },
          { status: 400 }
        );
      }

      if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          { success: false, text: '', error: 'Text too long (max 2000 chars)' },
          { status: 413 }
        );
      }

      // 3. Check API key
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        logger.error('OPENAI_API_KEY not configured');
        return NextResponse.json(
          { success: false, text: '', error: 'Service unavailable' },
          { status: 503 }
        );
      }

      // 4. Call OpenAI
      const { TEXT_MODEL, BASE_URL, TIMEOUT_MS } = AI_ANALYSIS_DEFAULTS.OPENAI;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: TEXT_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: text.trim() },
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errBody = await response.text();
          logger.error(`OpenAI ${response.status}: ${errBody}`);
          return NextResponse.json(
            { success: false, text: '', error: 'Polish failed' },
            { status: 502 }
          );
        }

        const data: OpenAICompletion = await response.json();
        const polished = data.choices[0]?.message?.content?.trim() ?? '';

        if (!polished) {
          return NextResponse.json({ success: true, text: text.trim() });
        }

        logger.info(`Polished ${text.length}→${polished.length} chars for user ${authCtx.uid}`);
        return NextResponse.json({ success: true, text: polished });
      } catch (err) {
        const message = getErrorMessage(err);
        const isTimeout = message.includes('abort');
        logger.error(`${isTimeout ? 'Timeout' : 'Error'}: ${message}`);
        return NextResponse.json(
          { success: false, text: '', error: isTimeout ? 'Timeout' : 'Polish failed' },
          { status: isTimeout ? 504 : 500 }
        );
      }
    }
  )
);
