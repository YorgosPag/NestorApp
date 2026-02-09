/**
 * =============================================================================
 * WHISPER VOICE TRANSCRIPTION SERVICE (ADR-156)
 * =============================================================================
 *
 * Transcribes Telegram voice messages using OpenAI Whisper API.
 * Downloads .ogg from Telegram → POSTs to /v1/audio/transcriptions → returns text.
 *
 * Cost: ~$0.006/minute — effectively free for business use.
 * Uses existing OPENAI_API_KEY (already in Vercel env).
 *
 * @module api/communications/webhooks/telegram/telegram/whisper-transcription
 * @enterprise ADR-156 - Voice Message Transcription
 */

import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { getTelegramFile, downloadTelegramFile } from './media-download';

// ============================================================================
// TYPES
// ============================================================================

/** Result of voice transcription */
export interface TranscriptionResult {
  success: boolean;
  text: string;
  error?: string;
}

// ============================================================================
// MAIN TRANSCRIPTION FUNCTION
// ============================================================================

/**
 * Transcribe a Telegram voice message using OpenAI Whisper API.
 *
 * Flow: getTelegramFile(fileId) → downloadTelegramFile(path) → POST Whisper API
 *
 * @param fileId - Telegram file_id from message.voice.file_id
 * @param language - ISO 639-1 language hint (default: 'el' for Greek)
 * @returns TranscriptionResult with transcribed text or error
 */
export async function transcribeVoiceMessage(
  fileId: string,
  language?: string
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('🎤 [Whisper] OPENAI_API_KEY not configured');
    return { success: false, text: '', error: 'OPENAI_API_KEY not configured' };
  }

  // 1. Get file info from Telegram
  const fileInfo = await getTelegramFile(fileId);
  if (!fileInfo || !fileInfo.file_path) {
    console.error('🎤 [Whisper] Could not get file path from Telegram');
    return { success: false, text: '', error: 'Telegram getFile failed' };
  }

  // 2. Download .ogg buffer from Telegram
  const buffer = await downloadTelegramFile(fileInfo.file_path);
  if (!buffer) {
    console.error('🎤 [Whisper] Could not download voice file');
    return { success: false, text: '', error: 'Voice file download failed' };
  }

  console.log(`🎤 [Whisper] Downloaded voice file: ${buffer.length} bytes`);

  // 3. Build multipart/form-data for Whisper API
  const { WHISPER_MODEL, WHISPER_TIMEOUT_MS, WHISPER_DEFAULT_LANGUAGE } =
    AI_ANALYSIS_DEFAULTS.OPENAI;
  const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
  const lang = language ?? WHISPER_DEFAULT_LANGUAGE;

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: 'audio/ogg' }), 'voice.ogg');
  formData.append('model', WHISPER_MODEL);
  formData.append('language', lang);
  formData.append('response_format', 'json');

  // 4. POST to Whisper API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`🎤 [Whisper] API error ${response.status}: ${errorBody}`);
      return { success: false, text: '', error: `Whisper API ${response.status}` };
    }

    const result: { text: string } = await response.json();
    const transcribedText = result.text?.trim() ?? '';

    if (!transcribedText) {
      console.warn('🎤 [Whisper] Empty transcription returned');
      return { success: false, text: '', error: 'Empty transcription' };
    }

    console.log(`🎤 [Whisper] Transcribed (${transcribedText.length} chars): "${transcribedText.substring(0, 80)}..."`);
    return { success: true, text: transcribedText };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.includes('abort');
    console.error(`🎤 [Whisper] ${isTimeout ? 'Timeout' : 'Error'}: ${message}`);
    return {
      success: false,
      text: '',
      error: isTimeout ? 'Whisper API timeout' : message,
    };
  }
}
