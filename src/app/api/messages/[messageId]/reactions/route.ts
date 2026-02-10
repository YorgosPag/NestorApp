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
 */

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🔒 RATE LIMITING: STANDARD category (60 req/min)
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { generateRequestId } from '@/services/enterprise-id.service';
import { FieldValue } from 'firebase-admin/firestore';
import type { MessageReactionsMap } from '@/types/conversations';
import { QUICK_REACTION_EMOJIS } from '@/types/conversations';
import { sendTelegramReaction } from '@/app/api/communications/webhooks/telegram/telegram/client';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MessageReactionsRoute');

// ============================================================================
// TYPES
// ============================================================================

interface ReactionRequest {
  emoji: string;
  action: 'add' | 'remove' | 'toggle';
}

interface ReactionResponse {
  success: boolean;
  reactions: MessageReactionsMap;
  userReactions: string[];
  action: 'added' | 'removed';
  emoji: string;
}

type ReactionCanonicalResponse = ApiSuccessResponse<ReactionResponse>;

interface RouteParams {
  params: Promise<{
    messageId: string;
  }>;
}

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate emoji is allowed
 * @enterprise Only allow configured quick reaction emojis + common emojis
 */
function isValidEmoji(emoji: string): boolean {
  // Allow quick reaction emojis
  if ((QUICK_REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return true;
  }

  // Allow common emoji patterns (single emoji character)
  // This regex matches most emoji characters
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;
  return emojiRegex.test(emoji);
}

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
export const POST = withStandardRateLimit(async function POST(request: NextRequest, context?: RouteParams) {
  const handler = withAuth<ReactionCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!context?.params) {
        throw new ApiError(400, 'Missing route params');
      }
      const { messageId } = await context.params;
      return handleReaction(req, ctx, messageId);
    },
    { permissions: 'comm:messages:send' }
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
export const GET = withStandardRateLimit(async function GET(request: NextRequest, context?: RouteParams) {
  const handler = withAuth<ApiSuccessResponse<{ reactions: MessageReactionsMap; userReactions: string[] }>>(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!context?.params) {
        throw new ApiError(400, 'Missing route params');
      }
      const { messageId } = await context.params;
      return handleGetReactions(ctx, messageId);
    },
    { permissions: 'comm:messages:view' }
  );

  return handler(request);
});

// ============================================================================
// HANDLERS
// ============================================================================

async function handleReaction(
  request: NextRequest,
  ctx: AuthContext,
  messageId: string
): Promise<ReturnType<typeof apiSuccess<ReactionResponse>>> {
  const operationId = generateRequestId();

  logger.info('[Reactions] User reaction request', { email: ctx.email, companyId: ctx.companyId, messageId, operationId });

  // 1. Parse request
  const body: ReactionRequest = await request.json();
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

  // 2. Get message document
  const messageRef = getAdminFirestore().collection(COLLECTIONS.MESSAGES).doc(messageId);
  const messageDoc = await messageRef.get();

  if (!messageDoc.exists) {
    throw new ApiError(404, 'Message not found');
  }

  const messageData = messageDoc.data();

  // 3. Validate tenant isolation
  if (messageData?.companyId !== ctx.companyId) {
    throw new ApiError(403, 'Access denied');
  }

  // 4. Get current reactions
  const currentReactions: MessageReactionsMap = messageData?.reactions || {};
  const currentReaction = currentReactions[emoji];
  const userHasReacted = currentReaction?.userIds?.includes(ctx.uid) || false;

  // 5. Determine final action for toggle
  let finalAction: 'add' | 'remove' = action === 'toggle'
    ? (userHasReacted ? 'remove' : 'add')
    : action;

  // 6. Perform atomic update
  const now = new Date();
  // AuthContext has email, not displayName - use email for attribution
  const userName = ctx.email || 'Unknown';

  if (finalAction === 'add') {
    if (userHasReacted) {
      // Already reacted - return current state
      logger.info('[Reactions] User already reacted', { userId: ctx.uid, emoji, operationId });
      return apiSuccess<ReactionResponse>({
        success: true,
        reactions: currentReactions,
        userReactions: extractUserReactions(currentReactions, ctx.uid),
        action: 'added',
        emoji,
      });
    }

    // Add reaction
    if (currentReaction) {
      // Update existing reaction
      await messageRef.update({
        [`reactions.${emoji}.userIds`]: FieldValue.arrayUnion(ctx.uid),
        [`reactions.${emoji}.userNames`]: FieldValue.arrayUnion(userName),
        [`reactions.${emoji}.count`]: FieldValue.increment(1),
        [`reactions.${emoji}.updatedAt`]: now,
        reactionCount: FieldValue.increment(1),
        updatedAt: now,
      });
    } else {
      // Create new reaction entry
      await messageRef.update({
        [`reactions.${emoji}`]: {
          emoji,
          userIds: [ctx.uid],
          userNames: [userName],
          count: 1,
          createdAt: now,
          updatedAt: now,
        },
        reactionCount: FieldValue.increment(1),
        updatedAt: now,
      });
    }

    logger.info('[Reactions] Added reaction', { emoji, userId: ctx.uid, messageId, operationId });

  } else {
    // Remove reaction
    if (!userHasReacted) {
      // Not reacted - return current state
      logger.info('[Reactions] User has not reacted', { userId: ctx.uid, emoji, operationId });
      return apiSuccess<ReactionResponse>({
        success: true,
        reactions: currentReactions,
        userReactions: extractUserReactions(currentReactions, ctx.uid),
        action: 'removed',
        emoji,
      });
    }

    if (currentReaction && currentReaction.count <= 1) {
      // Remove entire reaction entry
      await messageRef.update({
        [`reactions.${emoji}`]: FieldValue.delete(),
        reactionCount: FieldValue.increment(-1),
        updatedAt: now,
      });
    } else {
      // Decrement count
      await messageRef.update({
        [`reactions.${emoji}.userIds`]: FieldValue.arrayRemove(ctx.uid),
        [`reactions.${emoji}.userNames`]: FieldValue.arrayRemove(userName),
        [`reactions.${emoji}.count`]: FieldValue.increment(-1),
        [`reactions.${emoji}.updatedAt`]: now,
        reactionCount: FieldValue.increment(-1),
        updatedAt: now,
      });
    }

    logger.info('[Reactions] Removed reaction', { emoji, userId: ctx.uid, messageId, operationId });
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
    operationId
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
  messageId: string
): Promise<ReturnType<typeof apiSuccess<{ reactions: MessageReactionsMap; userReactions: string[] }>>> {
  const operationId = generateRequestId();

  logger.info('[Reactions] Getting reactions', { email: ctx.email, messageId, operationId });

  // 1. Get message document
  const messageRef = getAdminFirestore().collection(COLLECTIONS.MESSAGES).doc(messageId);
  const messageDoc = await messageRef.get();

  if (!messageDoc.exists) {
    throw new ApiError(404, 'Message not found');
  }

  const messageData = messageDoc.data();

  // 2. Validate tenant isolation
  if (messageData?.companyId !== ctx.companyId) {
    throw new ApiError(403, 'Access denied');
  }

  // 3. Return reactions
  const reactions: MessageReactionsMap = messageData?.reactions || {};

  return apiSuccess({
    reactions,
    userReactions: extractUserReactions(reactions, ctx.uid),
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract emojis that user has reacted with
 */
function extractUserReactions(reactions: MessageReactionsMap, userId: string): string[] {
  const userReactions: string[] = [];
  Object.entries(reactions).forEach(([emoji, reaction]) => {
    if (reaction.userIds?.includes(userId)) {
      userReactions.push(emoji);
    }
  });
  return userReactions;
}

// ============================================================================
// TELEGRAM SYNC
// ============================================================================

interface TelegramMessageData {
  channel?: string;
  providerMessageId?: string;
  providerMetadata?: {
    chatId?: string | number;
    [key: string]: unknown;
  };
}

/**
 * Sync reaction to Telegram
 *
 * 🏢 ENTERPRISE: Fire-and-forget pattern
 * - Does not block the main response
 * - Logs errors but doesn't fail the request
 * - Telegram reaction failures are non-critical
 *
 * @param messageData - Firestore message document data
 * @param emoji - The emoji to react with
 * @param remove - Whether to remove (true) or add (false) the reaction
 * @param operationId - Request tracking ID for logging
 */
async function syncReactionToTelegram(
  messageData: TelegramMessageData,
  emoji: string,
  remove: boolean,
  operationId: string
): Promise<void> {
  // Only sync if message is from Telegram channel
  if (messageData.channel !== 'telegram') {
    return;
  }

  // Extract Telegram-specific IDs
  const chatId = messageData.providerMetadata?.chatId;
  const providerMessageId = messageData.providerMessageId;

  if (!chatId || !providerMessageId) {
    logger.warn('[Reactions->Telegram] Missing chatId or providerMessageId for Telegram sync', { operationId, chatId, providerMessageId });
    return;
  }

  try {
    // Convert providerMessageId to number (Telegram message_id is numeric)
    const telegramMessageId = parseInt(providerMessageId, 10);

    if (isNaN(telegramMessageId)) {
      logger.warn('[Reactions->Telegram] Invalid providerMessageId', { providerMessageId, operationId });
      return;
    }

    logger.info('[Reactions->Telegram] Syncing reaction', { action: remove ? 'remove' : 'add', emoji, chatId, telegramMessageId, operationId });

    const result = await sendTelegramReaction(chatId, telegramMessageId, emoji, remove);

    if (result.success) {
      logger.info('[Reactions->Telegram] Synced successfully', { emoji, action: remove ? 'removal' : 'addition', operationId });
    } else {
      // Log but don't throw - Telegram sync is non-blocking
      logger.warn('[Reactions->Telegram] Sync failed', { error: result.error, operationId, chatId, telegramMessageId, emoji, remove });
    }
  } catch (error) {
    // Log but don't throw - Telegram sync is non-blocking
    logger.error('[Reactions->Telegram] Unexpected error during sync', { operationId, error: error instanceof Error ? error.message : String(error) });
  }
}
