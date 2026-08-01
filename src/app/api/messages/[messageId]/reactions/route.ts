/**
 * =============================================================================
 * MESSAGE REACTIONS API - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * API endpoint for Telegram-style message reactions.
 * Enterprise-grade with tenant isolation, RBAC, and real-time sync.
 *
 * 🏢 ENTERPRISE FEATURES:
 * - RBAC permission validation
 * - Tenant isolation (companyId validation)
 * - Atomic Firestore updates (FieldValue operations)
 * - Audit logging
 * - User display name denormalization
 *
 * @module api/messages/[messageId]/reactions
 * @enterprise Omnichannel Communications
 * @security RBAC + Tenant Isolation
 * @updated 2026-08-01 - Split σε types/store/telegram-sync (N.7.1: 411 γρ. > όριο 300)
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { loadOwnedMessage } from '../../_shared/message-owned-doc';
// 🔒 RATE LIMITING: STANDARD category (60 req/min)
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateRequestId } from '@/services/enterprise-id.service';
import type { MessageReactionsMap } from '@/types/conversations';
import { createModuleLogger } from '@/lib/telemetry';
import { applyReaction, extractUserReactions, isValidEmoji } from './reaction-store';
import { syncReactionToTelegram } from './reaction-telegram-sync';
import type {
  ReactionRequest,
  ReactionResponse,
  ReactionCanonicalResponse,
  ReactionsReadResponse,
  RouteParams,
  TelegramMessageData,
} from './types';

const logger = createModuleLogger('MessageReactionsRoute');

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// POST HANDLER
// ============================================================================

/**
 * POST /api/messages/[messageId]/reactions
 *
 * Add, remove, or toggle a reaction on a message.
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: comm:messages:send (need send permission to react)
 * - Tenant isolation validated
 *
 * @rateLimit STANDARD (60 req/min) - Add/remove/toggle message reactions
 *
 * @example
 * POST /api/messages/msg_123/reactions
 * Body: { emoji: "👍", action: "add" }
 */
export const POST = withStandardRateLimit(async function POST(
  request: NextRequest,
  context?: RouteParams,
) {
  const handler = withAuth<ReactionCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!context?.params) {
        throw new ApiError(400, 'Missing route params');
      }
      const { messageId } = await context.params;
      return handleReaction(req, ctx, messageId);
    },
    { permissions: 'comm:messages:send' },
  );

  return handler(request);
});

/**
 * GET /api/messages/[messageId]/reactions
 *
 * Get all reactions for a message.
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: comm:messages:view
 * - Tenant isolation validated
 *
 * @rateLimit STANDARD (60 req/min) - Get message reactions
 */
export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
  context?: RouteParams,
) {
  const handler = withAuth<ApiSuccessResponse<ReactionsReadResponse>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!context?.params) {
        throw new ApiError(400, 'Missing route params');
      }
      const { messageId } = await context.params;
      return handleGetReactions(ctx, messageId);
    },
    { permissions: 'comm:messages:view' },
  );

  return handler(request);
});

// ============================================================================
// HANDLERS
// ============================================================================

/** Οι τρεις έλεγχοι σχήματος του σώματος, πριν αγγίξουμε τη βάση. */
function parseReactionBody(body: ReactionRequest): { emoji: string; action: 'add' | 'remove' | 'toggle' } {
  const { emoji, action } = body;

  if (!emoji || !action) {
    throw new ApiError(400, 'emoji and action (add/remove/toggle) required');
  }

  if (!['add', 'remove', 'toggle'].includes(action)) {
    throw new ApiError(400, 'action must be add, remove, or toggle');
  }

  if (!isValidEmoji(emoji)) {
    throw new ApiError(400, 'Invalid emoji');
  }

  return { emoji, action };
}

async function handleReaction(
  request: NextRequest,
  ctx: AuthContext,
  messageId: string,
): Promise<ReturnType<typeof apiSuccess<ReactionResponse>>> {
  const operationId = generateRequestId();

  logger.info('[Reactions] User reaction request', {
    email: ctx.email,
    companyId: ctx.companyId,
    messageId,
    operationId,
  });

  // 1. Parse request
  const { emoji, action } = parseReactionBody((await request.json()) as ReactionRequest);

  // 2+3. Φόρτωσε **και** κρίνε σε μία πράξη (ADR-742 §7decies).
  const { ref: messageRef, data: messageData } = await loadOwnedMessage({
    messageId,
    caller: ctx,
    action: 'reactions-write',
  });

  // 4. Get current reactions
  const currentReactions: MessageReactionsMap = messageData?.reactions || {};
  const userHasReacted = currentReactions[emoji]?.userIds?.includes(ctx.uid) || false;

  // 5. Determine final action for toggle
  const finalAction: 'add' | 'remove' =
    action === 'toggle' ? (userHasReacted ? 'remove' : 'add') : action;

  // 6. Perform atomic update
  const outcome = await applyReaction({
    messageRef,
    currentReactions,
    emoji,
    finalAction,
    userId: ctx.uid,
    // AuthContext has email, not displayName - use email for attribution
    userName: ctx.email || 'Unknown',
    messageId,
    operationId,
  });

  if (outcome === 'noop') {
    return apiSuccess<ReactionResponse>({
      success: true,
      reactions: currentReactions,
      userReactions: extractUserReactions(currentReactions, ctx.uid),
      action: finalAction === 'add' ? 'added' : 'removed',
      emoji,
    });
  }

  // 7. Get updated reactions
  const updatedDoc = await messageRef.get();
  const updatedReactions: MessageReactionsMap = updatedDoc.data()?.reactions || {};

  // 8. Sync to Telegram (fire-and-forget, non-blocking)
  // Use void to explicitly ignore the promise - we don't await it
  void syncReactionToTelegram(
    messageData as TelegramMessageData,
    emoji,
    finalAction === 'remove',
    operationId,
  );

  return apiSuccess<ReactionResponse>({
    success: true,
    reactions: updatedReactions,
    userReactions: extractUserReactions(updatedReactions, ctx.uid),
    action: finalAction === 'add' ? 'added' : 'removed',
    emoji,
  });
}

async function handleGetReactions(
  ctx: AuthContext,
  messageId: string,
): Promise<ReturnType<typeof apiSuccess<ReactionsReadResponse>>> {
  const operationId = generateRequestId();

  logger.info('[Reactions] Getting reactions', { email: ctx.email, messageId, operationId });

  // 1+2. Φόρτωσε **και** κρίνε σε μία πράξη (ADR-742 §7decies).
  const { data: messageData } = await loadOwnedMessage({
    messageId,
    caller: ctx,
    action: 'reactions-read',
  });

  // 3. Return reactions
  const reactions: MessageReactionsMap = messageData?.reactions || {};

  return apiSuccess({
    reactions,
    userReactions: extractUserReactions(reactions, ctx.uid),
  });
}
