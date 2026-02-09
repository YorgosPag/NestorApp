/**
 * =============================================================================
 * VOICE TRANSCRIPTION API — OpenAI Whisper (ADR-161)
 * =============================================================================
 *
 * Server-side endpoint for voice-to-text transcription.
 * Receives audio blob from client MediaRecorder → sends to Whisper API → returns text.
 *
 * Following existing patterns:
 * - Auth: withAuth from @/lib/auth (same as error-report, fix-projects)
 * - Rate limit: withHeavyRateLimit (10 req/min — audio processing is expensive)
 * - Whisper config: AI_ANALYSIS_DEFAULTS.OPENAI (same as ADR-156)
 *
 * @endpoint POST /api/voice/transcribe
 * @enterprise ADR-161 - Global Voice Assistant
 * @security Authenticated users only, rate limited, file validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('VOICE_TRANSCRIBE');

// =============================================================================
// TYPES (Protocol: ZERO any)
// =============================================================================

interface TranscribeResponse {
  success: boolean;
  text: string;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum audio file size: 25MB (Whisper API limit) */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Allowed MIME type prefix */
const ALLOWED_MIME_PREFIX = 'audio/';

// =============================================================================
// HANDLER
// =============================================================================

/**
 * POST /api/voice/transcribe
 *
 * Accepts FormData with a single audio file, transcribes via Whisper API.
 * Returns JSON with transcribed text.
 */
export const POST = withHeavyRateLimit(
  withAuth<TranscribeResponse>(
    async (
      request: NextRequest,
      authCtx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse<TranscribeResponse>> => {
      // 1. Parse FormData
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return NextResponse.json(
          { success: false, text: '', error: 'Invalid form data' },
          { status: 400 }
        );
      }

      // 2. Extract audio file
      const file = formData.get('file');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { success: false, text: '', error: 'No audio file provided' },
          { status: 400 }
        );
      }

      // 3. Validate file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, text: '', error: 'File too large (max 25MB)' },
          { status: 413 }
        );
      }

      if (file.size === 0) {
        return NextResponse.json(
          { success: false, text: '', error: 'Empty audio file' },
          { status: 400 }
        );
      }

      // 4. Validate MIME type
      if (!file.type.startsWith(ALLOWED_MIME_PREFIX)) {
        return NextResponse.json(
          { success: false, text: '', error: 'Invalid file type (audio/* required)' },
          { status: 415 }
        );
      }

      // 5. Check OpenAI API key
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        logger.error('OPENAI_API_KEY not configured');
        return NextResponse.json(
          { success: false, text: '', error: 'Transcription service unavailable' },
          { status: 503 }
        );
      }

      // 6. Send to Whisper API
      const { WHISPER_MODEL, WHISPER_TIMEOUT_MS, WHISPER_DEFAULT_LANGUAGE } =
        AI_ANALYSIS_DEFAULTS.OPENAI;
      const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;

      const whisperForm = new FormData();
      whisperForm.append('file', file, (file as File).name || 'voice.webm');
      whisperForm.append('model', WHISPER_MODEL);
      whisperForm.append('language', WHISPER_DEFAULT_LANGUAGE);
      whisperForm.append('response_format', 'json');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

        const whisperResponse = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: whisperForm,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!whisperResponse.ok) {
          const errorBody = await whisperResponse.text();
          logger.error(`Whisper API ${whisperResponse.status}: ${errorBody}`);
          return NextResponse.json(
            { success: false, text: '', error: 'Transcription failed' },
            { status: 502 }
          );
        }

        const result: { text: string } = await whisperResponse.json();
        const transcribedText = result.text?.trim() ?? '';

        if (!transcribedText) {
          logger.warn(`Empty transcription for user ${authCtx.uid}`);
          return NextResponse.json(
            { success: false, text: '', error: 'No speech detected' },
            { status: 200 }
          );
        }

        logger.info(
          `Transcribed ${transcribedText.length} chars for user ${authCtx.uid}`
        );

        return NextResponse.json({
          success: true,
          text: transcribedText,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isTimeout = message.includes('abort');

        logger.error(`${isTimeout ? 'Timeout' : 'Error'}: ${message}`);

        return NextResponse.json(
          {
            success: false,
            text: '',
            error: isTimeout ? 'Transcription timeout' : 'Transcription failed',
          },
          { status: isTimeout ? 504 : 500 }
        );
      }
    }
  )
);
