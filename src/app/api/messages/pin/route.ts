/**
 * =============================================================================
 * MESSAGE PIN API - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * API endpoint for pinning/unpinning messages.
 * Enterprise-grade with tenant isolation and RBAC.
 *
 * @module api/messages/pin
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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('MessagesPinRoute');

// ============================================================================
// TYPES
// ============================================================================

interface PinMessageRequest {
  messageId: string;
  action: 'pin' | 'unpin';
}

interface PinMessageResponse {
  pinned: boolean;
  messageId: string;
  pinnedAt?: string;
}

type PinMessageCanonicalResponse = ApiSuccessResponse<PinMessageResponse>;

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// POST HANDLER
// ============================================================================

/**
 * POST /api/messages/pin
 *
 * Pin or unpin a message.
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: comm:messages:view
 * - Tenant isolation validated
 *
 * @rateLimit STANDARD (60 req/min) - Pin/unpin message
 */
export const POST = withStandardRateLimit(async function POST(request: NextRequest) {
  const handler = withAuth<PinMessageCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handlePinMessage(req, ctx);
    },
    { permissions: 'comm:messages:view' }
  );

  return handler(request);
});

async function handlePinMessage(
  request: NextRequest,
  ctx: AuthContext
): Promise<ReturnType<typeof apiSuccess<PinMessageResponse>>> {
  const operationId = generateRequestId();

  logger.info('[Messages/Pin] User pin operation', { email: ctx.email, companyId: ctx.companyId });

  // 1. Parse request
  const body: PinMessageRequest = await request.json();
  const { messageId, action } = body;

  if (!messageId || !['pin', 'unpin'].includes(action)) {
    throw new ApiError(400, 'messageId and action (pin/unpin) required');
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

  // 4. Get conversation reference
  const conversationId = messageData?.conversationId;
  if (!conversationId) {
    throw new ApiError(400, 'Message has no conversation');
  }

  const conversationRef = getAdminFirestore().collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);

  // 5. Pin or Unpin
  if (action === 'pin') {
    const pinnedAt = new Date();

    // Add to pinned messages array
    await conversationRef.update({
      pinnedMessages: FieldValue.arrayUnion({
        messageId,
        pinnedAt,
        pinnedBy: ctx.uid,
        text: messageData?.content?.text || '',
        senderName: messageData?.senderName || 'Unknown',
      }),
      updatedAt: pinnedAt,
    });

    // Mark message as pinned
    await messageRef.update({
      isPinned: true,
      pinnedAt,
      pinnedBy: ctx.uid,
    });

    logger.info('[Messages/Pin] Message pinned', { messageId, userId: ctx.uid, operationId });

    return apiSuccess<PinMessageResponse>({
      pinned: true,
      messageId,
      pinnedAt: pinnedAt.toISOString(),
    });

  } else {
    // Get current pinned messages
    const conversationDoc = await conversationRef.get();
    const pinnedMessages = conversationDoc.data()?.pinnedMessages || [];

    // Filter out the message to unpin
    const updatedPinned = pinnedMessages.filter(
      (pm: { messageId: string }) => pm.messageId !== messageId
    );

    await conversationRef.update({
      pinnedMessages: updatedPinned,
      updatedAt: new Date(),
    });

    // Mark message as unpinned
    await messageRef.update({
      isPinned: false,
      pinnedAt: FieldValue.delete(),
      pinnedBy: FieldValue.delete(),
    });

    logger.info('[Messages/Pin] Message unpinned', { messageId, userId: ctx.uid, operationId });

    return apiSuccess<PinMessageResponse>({
      pinned: false,
      messageId,
    });
  }
}
