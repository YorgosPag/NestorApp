/**
 * =============================================================================
 * PROPERTY DESCRIPTION GENERATOR — server-only AI service
 * =============================================================================
 *
 * Generates a Greek marketing description for a property unit from its
 * structured data, using OpenAI via the Vercel AI SDK.
 *
 * One-shot completion (not agentic — no tools, no iterations). Keeps the
 * pipeline simple because the output is pure text with no side effects.
 *
 * @module services/ai/property-description-generator.service
 * @see ADR (next) — AI Property Description Generator
 */

import 'server-only';
import { generateText } from 'ai';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { AI_ANALYSIS_DEFAULTS, AI_ANALYSIS_PROMPTS, AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { buildPropertyUserPrompt } from '@/services/ai/property-prompt-builder';
import type { Property } from '@/types/property';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { captureMessage as sentryCaptureMessage } from '@/lib/telemetry/sentry';

const logger = createModuleLogger('PROPERTY_DESCRIPTION_GENERATOR');

export type PropertyDescriptionLocale = 'el' | 'en';

export interface GeneratePropertyDescriptionOptions {
  /** Output language. Default: 'el' */
  locale?: PropertyDescriptionLocale;
  /** Override model — defaults to AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL */
  model?: string;
  /** Correlation ID for tracing (companyId, userId, requestId, ...) */
  requestContext?: Record<string, string | number | undefined>;
}

export interface GeneratePropertyDescriptionResult {
  description: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
}

export class PropertyDescriptionGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PropertyDescriptionGenerationError';
  }
}

/**
 * Generate a short marketing description for a property.
 *
 * @throws PropertyDescriptionGenerationError on OpenAI errors, timeouts, or empty output.
 */
export async function generatePropertyDescription(
  property: Property,
  options: GeneratePropertyDescriptionOptions = {}
): Promise<GeneratePropertyDescriptionResult> {
  const locale = options.locale ?? 'el';
  const model = options.model ?? AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;
  const start = Date.now();

  const userPrompt = buildPropertyUserPrompt(property, locale);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS);

  try {
    const result = await generateText({
      model: getOpenAIProvider()(model),
      system: AI_ANALYSIS_PROMPTS.PROPERTY_DESCRIPTION_SYSTEM,
      prompt: userPrompt,
      temperature: AI_COST_CONFIG.LIMITS.PROPERTY_DESCRIPTION_TEMPERATURE,
      maxOutputTokens: AI_COST_CONFIG.LIMITS.PROPERTY_DESCRIPTION_MAX_TOKENS,
      abortSignal: controller.signal,
      maxRetries: AI_ANALYSIS_DEFAULTS.OPENAI.MAX_RETRIES,
    });

    clearTimeout(timeout);

    const description = (result.text ?? '').trim();
    if (!description) {
      throw new PropertyDescriptionGenerationError('Empty description returned from model');
    }

    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const durationMs = Date.now() - start;

    logger.info('Property description generated', {
      propertyId: property.id,
      model,
      locale,
      inputTokens,
      outputTokens,
      durationMs,
      ...options.requestContext,
    });

    return {
      description,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      durationMs,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof PropertyDescriptionGenerationError) {
      throw error;
    }

    const isAbort = error instanceof Error && error.name === 'AbortError';
    const message = isAbort
      ? 'OpenAI request timed out'
      : error instanceof Error
      ? error.message
      : 'Unknown AI generation error';

    logger.error('Property description generation failed', {
      propertyId: property.id,
      model,
      durationMs: Date.now() - start,
      error: message,
      ...options.requestContext,
    });

    sentryCaptureMessage('Property description generation failed', 'error', {
      tags: { component: 'property-description-generator', model },
      extra: {
        propertyId: property.id,
        errorMessage: message,
        ...options.requestContext,
      },
    });

    throw new PropertyDescriptionGenerationError(message, error);
  }
}
