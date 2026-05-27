/**
 * @fileoverview VISION-tier photo progress analyzer for UC-017 (ADR-034 §12)
 * Calls OpenAI vision model to estimate construction progress % from site photos.
 */

import 'server-only';

import { generateText } from 'ai';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { PhotoProgressResult } from '../gantt-ai-types';

const logger = createModuleLogger('UC_017_PHOTO_ANALYZER');

const SYSTEM_PROMPT = `You are a construction site inspector AI. Analyze the provided site photo(s) and estimate construction progress.
Return a JSON object ONLY:
{ "estimatedProgress": number (0-100), "confidence": number (0-100), "observations": string[], "detectedElements": string[] }
observations and detectedElements in Greek. Be conservative — only count visible completed work.`;

const FALLBACK_RESULT: PhotoProgressResult = {
  estimatedProgress: 0,
  confidence: 0,
  observations: ['Δεν ήταν δυνατή η ανάλυση της φωτογραφίας.'],
  detectedElements: [],
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Estimate construction progress from site photos using OpenAI Vision.
 * Falls back to a zero-confidence result on failure.
 */
export async function analyzePhotoProgress(photoUrls: string[]): Promise<PhotoProgressResult> {
  if (photoUrls.length === 0) {
    return { ...FALLBACK_RESULT, observations: ['Δεν παρέχθηκαν φωτογραφίες.'] };
  }

  try {
    const openai = getOpenAIProvider();
    const imageContent = buildImageContent(photoUrls.slice(0, 3));

    const { text } = await generateText({
      model: openai(AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL),
      messages: [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: SYSTEM_PROMPT },
            ...imageContent,
          ],
        },
      ],
      maxOutputTokens: 500,
    });

    return parsePhotoResponse(text);
  } catch (error) {
    logger.warn('UC-017 photo analysis failed', { error: getErrorMessage(error) });
    return FALLBACK_RESULT;
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildImageContent(
  urls: string[]
): Array<{ type: 'image'; image: URL }> {
  return urls
    .filter(url => url.startsWith('https://'))
    .map(url => ({ type: 'image' as const, image: new URL(url) }));
}

function parsePhotoResponse(text: string): PhotoProgressResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return FALLBACK_RESULT;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const estimatedProgress = clamp(Number(parsed.estimatedProgress ?? 0), 0, 100);
    const confidence = clamp(Number(parsed.confidence ?? 0), 0, 100);
    const observations = Array.isArray(parsed.observations)
      ? (parsed.observations as unknown[]).filter(s => typeof s === 'string') as string[]
      : [];
    const detectedElements = Array.isArray(parsed.detectedElements)
      ? (parsed.detectedElements as unknown[]).filter(s => typeof s === 'string') as string[]
      : [];

    if (isNaN(estimatedProgress)) return FALLBACK_RESULT;

    return { estimatedProgress, confidence, observations, detectedElements };
  } catch {
    return FALLBACK_RESULT;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
