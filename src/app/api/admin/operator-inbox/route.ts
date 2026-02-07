/**
 * =============================================================================
 * OPERATOR INBOX API (UC-009)
 * =============================================================================
 *
 * 🏢 ENTERPRISE: API endpoints for the Operator Inbox.
 * Allows authenticated operators to list pipeline proposals and submit decisions.
 *
 * @route /api/admin/operator-inbox
 * @method GET  - List proposed items + stats
 * @method POST - Submit approval/rejection decision
 *
 * @security withAuth + internal_user+ role required
 * @rateLimit SENSITIVE (20 req/min)
 *
 * @module api/admin/operator-inbox
 * @see ADR-080 (Pipeline Implementation)
 * @see UC-009 (Internal Operator Workflow)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import {
  getProposedPipelineItems,
  getProposedItemStats,
} from '@/services/ai-pipeline/pipeline-queue-service';
import {
  processOperatorDecision,
} from '@/services/ai-pipeline/operator-inbox-service';

const logger = createModuleLogger('OPERATOR_INBOX_API');

// ============================================================================
// RESPONSE TYPES (unified for withAuth generic inference)
// ============================================================================

interface OperatorInboxGetResponse {
  success: boolean;
  items?: import('@/types/ai-pipeline').PipelineQueueItem[];
  stats?: import('@/services/ai-pipeline/pipeline-queue-service').ProposedItemStats;
  error?: string;
  elapsedMs: number;
}

interface OperatorInboxPostResponse {
  success: boolean;
  queueId?: string;
  newState?: import('@/types/ai-pipeline').PipelineStateValue;
  auditId?: string;
  error?: string;
  details?: unknown;
  elapsedMs?: number;
}

// ============================================================================
// REQUEST VALIDATION SCHEMAS
// ============================================================================

/**
 * Zod schema for POST body validation
 */
const ApprovalRequestSchema = z.object({
  queueId: z.string().min(1, 'queueId is required'),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
  modifiedActions: z.array(
    z.object({
      type: z.string(),
      params: z.record(z.unknown()),
    })
  ).optional(),
});

// ============================================================================
// GET /api/admin/operator-inbox
//
// Returns proposed pipeline items awaiting review + dashboard stats.
// ============================================================================

export const GET = withAuth<OperatorInboxGetResponse>(
  async (
    request: NextRequest,
    ctx: AuthContext,
    _cache: PermissionCache
  ): Promise<NextResponse<OperatorInboxGetResponse>> => {
    const startTime = Date.now();

    logger.info('Operator inbox GET request', {
      uid: ctx.uid,
      companyId: ctx.companyId,
    });

    try {
      const [items, stats] = await Promise.all([
        getProposedPipelineItems({ companyId: ctx.companyId }),
        getProposedItemStats(ctx.companyId),
      ]);

      const elapsed = Date.now() - startTime;

      logger.info('Operator inbox data fetched', {
        itemCount: items.length,
        stats,
        elapsedMs: elapsed,
      });

      return NextResponse.json<OperatorInboxGetResponse>({
        success: true,
        items,
        stats,
        elapsedMs: elapsed,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const elapsed = Date.now() - startTime;

      logger.error('Operator inbox GET error', {
        error: errorMessage,
        elapsedMs: elapsed,
      });

      return NextResponse.json<OperatorInboxGetResponse>({
        success: false,
        error: errorMessage,
        elapsedMs: elapsed,
      }, { status: 500 });
    }
  },
  {
    requiredGlobalRoles: ['super_admin', 'company_admin', 'internal_user'],
  }
);

// ============================================================================
// POST /api/admin/operator-inbox
//
// Submit an approval or rejection decision for a proposed item.
// ============================================================================

export const POST = withAuth<OperatorInboxPostResponse>(
  async (
    request: NextRequest,
    ctx: AuthContext,
    _cache: PermissionCache
  ): Promise<NextResponse<OperatorInboxPostResponse>> => {
    const startTime = Date.now();

    logger.info('Operator inbox POST request', {
      uid: ctx.uid,
      companyId: ctx.companyId,
    });

    try {
      // Parse and validate request body
      const body: unknown = await request.json();
      const parsed = ApprovalRequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json<OperatorInboxPostResponse>({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        }, { status: 400 });
      }

      const { queueId, decision, reason, modifiedActions } = parsed.data;

      // Process the operator decision
      const result = await processOperatorDecision({
        queueId,
        decision,
        approvedBy: ctx.email,
        reason,
        modifiedActions,
      });

      const elapsed = Date.now() - startTime;

      logger.info('Operator decision processed', {
        queueId,
        decision,
        success: result.success,
        newState: result.newState,
        elapsedMs: elapsed,
      });

      return NextResponse.json<OperatorInboxPostResponse>({
        success: result.success,
        queueId: result.queueId,
        newState: result.newState,
        auditId: result.auditId,
        error: result.error,
        elapsedMs: elapsed,
      }, { status: result.success ? 200 : 500 });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const elapsed = Date.now() - startTime;

      logger.error('Operator inbox POST error', {
        error: errorMessage,
        elapsedMs: elapsed,
      });

      return NextResponse.json<OperatorInboxPostResponse>({
        success: false,
        error: errorMessage,
        elapsedMs: elapsed,
      }, { status: 500 });
    }
  },
  {
    requiredGlobalRoles: ['super_admin', 'company_admin', 'internal_user'],
  }
);
