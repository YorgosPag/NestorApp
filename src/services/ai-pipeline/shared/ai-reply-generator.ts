/**
 * =============================================================================
 * 🏢 ENTERPRISE: AI REPLY GENERATOR
 * =============================================================================
 *
 * Centralized utility for generating dynamic, context-aware email replies
 * using OpenAI. Used by UC modules to create natural-sounding replies instead
 * of static templates.
 *
 * Split (ADR-065 Phase 5):
 * - ai-reply-prompts.ts → System prompts, types, prompt builders
 * - ai-reply-openai.ts  → OpenAI Responses API call layer
 * - ai-reply-generator.ts (this) → Public functions, validation, composition
 *
 * @module services/ai-pipeline/shared/ai-reply-generator
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-169 (Modular AI Architecture)
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { PIPELINE_REPLY_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { callOpenAI } from './ai-reply-openai';
import {
  SYSTEM_PROMPTS,
  COMPOSITE_REPLY_SYSTEM_PROMPT,
  buildUserPrompt,
  buildCompositeUserPrompt,
} from './ai-reply-prompts';

// Re-export types for backward compatibility
export type {
  AIReplyContext,
  AIReplyResult,
  CompositeReplyInput,
} from './ai-reply-prompts';

import type {
  AIReplyContext,
  AIReplyResult,
  CompositeReplyInput,
} from './ai-reply-prompts';

const logger = createModuleLogger('ai-reply-generator');

// ============================================================================
// REPLY VALIDATION
// ============================================================================

/**
 * Basic sanity checks on the AI-generated reply.
 * Ensures it looks like a valid Greek professional email.
 */
function validateReply(text: string): boolean {
  if (!text.includes('Αγαπητ') && !text.includes('αγαπητ')) {
    return false;
  }

  if (/<[a-z/][^>]*>/i.test(text)) {
    return false;
  }

  if (/^#{1,6}\s/m.test(text) || /\*\*[^*]+\*\*/m.test(text)) {
    return false;
  }

  if (text.length > PIPELINE_REPLY_CONFIG.MAX_REPLY_CHARS) {
    return false;
  }

  if (text.length < 50) {
    return false;
  }

  return true;
}

// ============================================================================
// ADMIN CONVERSATIONAL REPLY (ADR-145: Smart Fallback)
// ============================================================================

/**
 * Generate a conversational AI reply for admin general questions.
 *
 * Unlike email replies, this does NOT require "Αγαπητέ" greeting format.
 * Used by UC-014 when admin asks a non-business question.
 */
export async function generateAdminConversationalReply(
  message: string,
  requestId: string,
): Promise<{ replyText: string | null; aiGenerated: boolean; durationMs: number }> {
  const startTime = Date.now();
  const systemPrompt = SYSTEM_PROMPTS.admin_conversational;
  const userPrompt = `Ο ιδιοκτήτης ρωτάει:\n${message.slice(0, 500)}\n\nΑπάντησε.`;

  try {
    const replyText = await callOpenAI(systemPrompt, userPrompt, requestId);
    const durationMs = Date.now() - startTime;

    if (!replyText || replyText.length < 5) {
      logger.warn('Admin conversational reply returned empty', { requestId, durationMs });
      return { replyText: null, aiGenerated: false, durationMs };
    }

    if (/<[a-z/][^>]*>/i.test(replyText) || replyText.length > 2000) {
      logger.warn('Admin conversational reply failed basic validation', { requestId, durationMs });
      return { replyText: null, aiGenerated: false, durationMs };
    }

    logger.info('Admin conversational reply succeeded', {
      requestId, durationMs, replyLength: replyText.length,
    });

    return { replyText, aiGenerated: true, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Admin conversational reply failed', {
      requestId, error: getErrorMessage(error), durationMs,
    });
    return { replyText: null, aiGenerated: false, durationMs };
  }
}

// ============================================================================
// COMPOSITE REPLY — Multi-Intent (ADR-131)
// ============================================================================

/**
 * Generate a composite reply by merging multiple module-specific draft replies
 * into ONE unified, natural-sounding email.
 *
 * Single-reply shortcut: if only 1 module reply, returns it directly (zero overhead).
 */
export async function generateCompositeReply(
  input: CompositeReplyInput,
  requestId: string,
): Promise<AIReplyResult> {
  if (input.moduleReplies.length <= 1) {
    return {
      replyText: input.moduleReplies[0]?.draftReply ?? '',
      aiGenerated: input.moduleReplies.length > 0,
      model: null,
      durationMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    const userPrompt = buildCompositeUserPrompt(input);

    logger.info('Composite reply generation started', {
      requestId,
      moduleCount: input.moduleReplies.length,
      useCases: input.moduleReplies.map(r => r.useCase).join(','),
    });

    const replyText = await callOpenAI(COMPOSITE_REPLY_SYSTEM_PROMPT, userPrompt, requestId);
    const durationMs = Date.now() - startTime;

    if (!replyText || !validateReply(replyText)) {
      logger.warn('Composite reply failed validation — using concatenation fallback', {
        requestId, durationMs,
      });
      const fallbackText = input.moduleReplies.map(r => r.draftReply).join('\n\n');
      return { replyText: fallbackText, aiGenerated: false, model: null, durationMs };
    }

    logger.info('Composite reply generation succeeded', {
      requestId, durationMs, model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      replyLength: replyText.length,
    });

    return {
      replyText,
      aiGenerated: true,
      model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Composite reply unexpected error — using concatenation fallback', {
      requestId, error: getErrorMessage(error), durationMs,
    });

    const fallbackText = input.moduleReplies.map(r => r.draftReply).join('\n\n');
    return { replyText: fallbackText, aiGenerated: false, model: null, durationMs };
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Generate a dynamic AI reply for a customer email.
 *
 * Calls OpenAI to produce a natural, context-aware reply in Greek.
 * If ANYTHING fails, falls back to the provided static template function.
 *
 * @param context — Use case, sender info, original message, module-specific data
 * @param fallbackFn — Static template function (e.g. buildAppointmentReply)
 * @param requestId — Pipeline request ID for logging/correlation
 */
export async function generateAIReply(
  context: AIReplyContext,
  fallbackFn: () => string,
  requestId: string,
): Promise<AIReplyResult> {
  const startTime = Date.now();

  try {
    const systemPrompt = SYSTEM_PROMPTS[context.useCase];
    const userPrompt = buildUserPrompt(context);

    logger.info('AI reply generation started', {
      requestId, useCase: context.useCase, senderName: context.senderName,
    });

    const replyText = await callOpenAI(systemPrompt, userPrompt, requestId);
    const durationMs = Date.now() - startTime;

    if (!replyText) {
      logger.warn('AI reply generation returned empty — using fallback', { requestId, durationMs });
      return { replyText: fallbackFn(), aiGenerated: false, model: null, durationMs };
    }

    if (!validateReply(replyText)) {
      logger.warn('AI reply failed validation — using fallback', {
        requestId, durationMs, replyLength: replyText.length,
      });
      return { replyText: fallbackFn(), aiGenerated: false, model: null, durationMs };
    }

    logger.info('AI reply generation succeeded', {
      requestId, durationMs, model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      replyLength: replyText.length,
    });

    return {
      replyText,
      aiGenerated: true,
      model: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('AI reply generation unexpected error — using fallback', {
      requestId, error: getErrorMessage(error), durationMs,
    });

    return { replyText: fallbackFn(), aiGenerated: false, model: null, durationMs };
  }
}
