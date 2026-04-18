/**
 * =============================================================================
 * AI USAGE SERVICE — ADR-259A: Token Tracking + Daily Cap + Cost Protection
 * =============================================================================
 *
 * Tracks OpenAI token usage per user per month, enforces daily message caps
 * for customers, and calculates estimated costs.
 *
 * Firestore document structure:
 *   ai_usage/{aiu_channel_userId_YYYY-MM}
 *   One document per user per channel per month — atomic updates via FieldValue.increment()
 *
 * @module services/ai-pipeline/ai-usage
 * @see ADR-259A (OpenAI Usage Tracking + Cost Protection)
 */

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { AI_COST_CONFIG } from '@/config/ai-analysis-config';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { OpenAIUsage } from './agentic-loop';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('AI_USAGE');

// ============================================================================
// TYPES
// ============================================================================

/** Firestore document shape for ai_usage collection */
export interface AiUsageDocument {
  userId: string;
  channel: string;
  /** Format: YYYY-MM */
  month: string;
  /** Daily message counts: { '2026-03-23': 5, '2026-03-24': 12 } */
  dailyCounts: Record<string, number>;
  /** Daily token breakdown: { '2026-03-23': { prompt: 3000, completion: 800 } } */
  dailyTokens: Record<string, { prompt: number; completion: number }>;
  /** Aggregated monthly totals */
  totalTokens: { prompt: number; completion: number };
  /** Estimated cost in USD based on AI_COST_CONFIG.PRICING */
  estimatedCostUsd: number;
  /** Last update timestamp */
  updatedAt: FirebaseFirestore.Timestamp;
}

/** Result of daily cap check */
export interface DailyCapCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function getTodayKey(): string {
  return nowISO().slice(0, 10); // YYYY-MM-DD
}

function getCurrentMonth(): string {
  return nowISO().slice(0, 7); // YYYY-MM
}

/**
 * Calculate cost in USD for given token usage.
 * Uses the currently configured model from AI_ANALYSIS_DEFAULTS.
 */
export function calculateCost(usage: OpenAIUsage): number {
  // Default to gpt-4o-mini pricing (most common model)
  const pricing = AI_COST_CONFIG.PRICING['gpt-4o-mini'];
  const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.inputPer1MTokens;
  const outputCost = (usage.completion_tokens / 1_000_000) * pricing.outputPer1MTokens;
  return inputCost + outputCost;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Record token usage after an agentic loop execution.
 * Uses atomic FieldValue.increment() for concurrent safety.
 * Creates the document if it doesn't exist (merge: true).
 */
export async function recordUsage(
  userId: string,
  channel: string,
  usage: OpenAIUsage,
): Promise<void> {
  try {
    const db = getAdminFirestore();
    const month = getCurrentMonth();
    const today = getTodayKey();
    const idService = enterpriseIdService;
    const docId = idService.generateAiUsageDocId(channel, userId, month);
    const cost = calculateCost(usage);

    const docRef = db.collection(COLLECTIONS.AI_USAGE).doc(docId);

    await docRef.set({
      userId,
      channel,
      month,
      [`dailyCounts.${today}`]: FieldValue.increment(1),
      [`dailyTokens.${today}.prompt`]: FieldValue.increment(usage.prompt_tokens),
      [`dailyTokens.${today}.completion`]: FieldValue.increment(usage.completion_tokens),
      ['totalTokens.prompt']: FieldValue.increment(usage.prompt_tokens),
      ['totalTokens.completion']: FieldValue.increment(usage.completion_tokens),
      estimatedCostUsd: FieldValue.increment(cost),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    logger.info('Usage recorded', {
      userId,
      channel,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      costUsd: cost.toFixed(6),
    });
  } catch (error) {
    // Non-fatal: usage tracking failure must never break the pipeline
    logger.error('Failed to record usage', { userId, channel, error });
  }
}

/**
 * Check if a customer has exceeded their daily message cap.
 * Admin users are always allowed (checked at caller level).
 */
export async function checkDailyCap(
  userId: string,
  channel: string,
): Promise<DailyCapCheck> {
  const limit = AI_COST_CONFIG.LIMITS.CUSTOMER_DAILY_MESSAGE_CAP;

  try {
    const db = getAdminFirestore();
    const month = getCurrentMonth();
    const today = getTodayKey();
    const idService = enterpriseIdService;
    const docId = idService.generateAiUsageDocId(channel, userId, month);

    const docRef = db.collection(COLLECTIONS.AI_USAGE).doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { allowed: true, used: 0, limit };
    }

    const data = snap.data() as Partial<AiUsageDocument>;
    const used = data.dailyCounts?.[today] ?? 0;

    return {
      allowed: used < limit,
      used,
      limit,
    };
  } catch (error) {
    // On read failure, allow the message (fail-open for UX)
    logger.error('Failed to check daily cap — allowing message', { userId, channel, error });
    return { allowed: true, used: 0, limit };
  }
}

/**
 * Get monthly usage summary for a user.
 * Useful for admin dashboards and cost reporting.
 */
export async function getMonthlyUsage(
  userId: string,
  channel: string,
  month?: string,
): Promise<AiUsageDocument | null> {
  try {
    const db = getAdminFirestore();
    const targetMonth = month ?? getCurrentMonth();
    const idService = enterpriseIdService;
    const docId = idService.generateAiUsageDocId(channel, userId, targetMonth);

    const snap = await db.collection(COLLECTIONS.AI_USAGE).doc(docId).get();
    if (!snap.exists) return null;

    return snap.data() as AiUsageDocument;
  } catch (error) {
    logger.error('Failed to get monthly usage', { userId, channel, error });
    return null;
  }
}
