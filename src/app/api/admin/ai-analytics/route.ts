/**
 * =============================================================================
 * ADMIN AI ANALYTICS ENDPOINT
 * =============================================================================
 *
 * GET /api/admin/ai-analytics
 *
 * Returns aggregated AI pipeline analytics:
 * - Total feedback counts (positive/negative/unrated)
 * - Satisfaction ratio
 * - Top patterns by score
 * - Tool failure rates
 * - Response latency (P50)
 * - Patterns learned this week
 *
 * @module api/admin/ai-analytics
 * @see ADR-173 (AI Self-Improvement System)
 * @rateLimit STANDARD (60 req/min)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { withAuth, type AuthenticatedHandler } from '@/lib/auth/middleware';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('AI_ANALYTICS_ENDPOINT');

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsResponse {
  feedback: {
    total: number;
    positive: number;
    negative: number;
    unrated: number;
    satisfactionRatio: number;
  };
  negativeCategoryBreakdown: Record<string, number>;
  topPatterns: Array<{
    id: string;
    queryTemplate: string;
    score: number;
    successCount: number;
    failureCount: number;
    patternType: string;
  }>;
  toolStats: Record<string, {
    totalCalls: number;
    successRate: number;
    failureRate: number;
  }>;
  latency: {
    p50Ms: number;
    sampleSize: number;
  };
  patternsThisWeek: number;
  channelBreakdown: Record<string, number>;
  generatedAt: string;
}

// ============================================================================
// HANDLER
// ============================================================================

const handleGet: AuthenticatedHandler<AnalyticsResponse> = async () => {
  try {
    const db = getAdminFirestore();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch data in parallel
    const [feedbackSnap, patternsSnap, toolAnalyticsDoc, recentPatternsSnap] = await Promise.all([
      // All feedback (limit 500 for analytics)
      db.collection(COLLECTIONS.AI_AGENT_FEEDBACK)
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get(),
      // Top patterns by score
      db.collection(COLLECTIONS.AI_LEARNED_PATTERNS)
        .orderBy('score', 'desc')
        .limit(10)
        .get(),
      // Tool analytics document
      db.doc('settings/ai_tool_analytics').get(),
      // Patterns created this week
      db.collection(COLLECTIONS.AI_LEARNED_PATTERNS)
        .where('createdAt', '>=', oneWeekAgo)
        .get(),
    ]);

    // Process feedback stats
    let positive = 0;
    let negative = 0;
    let unrated = 0;
    const durations: number[] = [];
    const negativeCategoryBreakdown: Record<string, number> = {};
    const channelBreakdown: Record<string, number> = {};

    for (const doc of feedbackSnap.docs) {
      const data = doc.data();
      const rating = data.rating as string | null;

      if (rating === 'positive') positive++;
      else if (rating === 'negative') negative++;
      else unrated++;

      // Track negative categories
      if (rating === 'negative' && data.negativeCategory) {
        const cat = data.negativeCategory as string;
        negativeCategoryBreakdown[cat] = (negativeCategoryBreakdown[cat] ?? 0) + 1;
      }

      // Track channels
      if (data.channel) {
        const ch = data.channel as string;
        channelBreakdown[ch] = (channelBreakdown[ch] ?? 0) + 1;
      }

      if (typeof data.durationMs === 'number') {
        durations.push(data.durationMs);
      }
    }

    const totalRated = positive + negative;
    const satisfactionRatio = totalRated > 0 ? positive / totalRated : 0;

    // Compute P50 latency
    durations.sort((a, b) => a - b);
    const p50Ms = durations.length > 0
      ? durations[Math.floor(durations.length / 2)]
      : 0;

    // Process top patterns
    const topPatterns = patternsSnap.docs.slice(0, 5).map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        queryTemplate: (data.queryTemplate as string) ?? '',
        score: (data.score as number) ?? 0,
        successCount: (data.successCount as number) ?? 0,
        failureCount: (data.failureCount as number) ?? 0,
        patternType: (data.patternType as string) ?? 'unknown',
      };
    });

    // Process tool stats
    const toolStats: AnalyticsResponse['toolStats'] = {};
    if (toolAnalyticsDoc.exists) {
      const toolData = toolAnalyticsDoc.data();
      const tools = toolData?.tools as Record<string, {
        totalCalls?: number;
        successCount?: number;
        failureCount?: number;
      }> | undefined;

      if (tools) {
        for (const [name, stats] of Object.entries(tools)) {
          const total = stats.totalCalls ?? 0;
          const success = stats.successCount ?? 0;
          const failure = stats.failureCount ?? 0;
          toolStats[name] = {
            totalCalls: total,
            successRate: total > 0 ? success / total : 0,
            failureRate: total > 0 ? failure / total : 0,
          };
        }
      }
    }

    const response: AnalyticsResponse = {
      feedback: {
        total: feedbackSnap.size,
        positive,
        negative,
        unrated,
        satisfactionRatio: Math.round(satisfactionRatio * 100) / 100,
      },
      negativeCategoryBreakdown,
      topPatterns,
      toolStats,
      latency: {
        p50Ms,
        sampleSize: durations.length,
      },
      patternsThisWeek: recentPatternsSnap.size,
      channelBreakdown,
      generatedAt: now.toISOString(),
    };

    logger.info('AI analytics generated', {
      totalFeedback: feedbackSnap.size,
      satisfactionRatio: response.feedback.satisfactionRatio,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to generate AI analytics', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
};

export const GET = withSensitiveRateLimit(withAuth(handleGet, {
  requiredGlobalRoles: 'super_admin',
}));
