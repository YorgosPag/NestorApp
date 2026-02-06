/**
 * =============================================================================
 * MESSAGE EDIT API - ENTERPRISE OMNICHANNEL
 * =============================================================================
 *
 * API endpoint for editing messages.
 * Enterprise-grade with tenant isolation and RBAC.
 *
 * @module api/messages/edit
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

// ============================================================================
// TYPES
// ============================================================================

interface EditMessageRequest {
  messageId: string;
  newText: string;
}

interface EditMessageResponse {
  edited: boolean;
  messageId: string;
}

type EditMessageCanonicalResponse = ApiSuccessResponse<EditMessageResponse>;

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// PATCH HANDLER
// ============================================================================

/**
 * PATCH /api/messages/edit
 *
 * Edit a message's text.
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: comm:messages:send
 * - Ownership: Only edit own messages
 * - Time limit: 15 minutes after creation
 *
 * @rateLimit STANDARD (60 req/min) - Edit message text
 */
export const PATCH = withStandardRateLimit(async function PATCH(request: NextRequest) {
  const handler = withAuth<EditMessageCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleEditMessage(req, ctx);
    },
    { permissions: 'comm:messages:send' }
  );

  return handler(request);
});

async function handleEditMessage(
  request: NextRequest,
  ctx: AuthContext
): Promise<ReturnType<typeof apiSuccess<EditMessageResponse>>> {
  const operationId = generateRequestId();

  console.log(`✏️ [Messages/Edit] User ${ctx.email} (company: ${ctx.companyId}) editing message`);

  // 1. Parse request
  const body: EditMessageRequest = await request.json();
  const { messageId, newText } = body;

  if (!messageId || typeof newText !== 'string') {
    throw new ApiError(400, 'messageId and newText required');
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

  // 4. Validate ownership (only edit own messages)
  if (messageData?.senderId !== ctx.uid) {
    throw new ApiError(403, 'Can only edit your own messages');
  }

  // 5. Check time limit (15 minutes for editing)
  const createdAt = messageData?.createdAt?.toDate?.() || new Date(messageData?.createdAt);
  const editTimeLimit = 15 * 60 * 1000; // 15 minutes
  const timeSinceCreation = Date.now() - createdAt.getTime();

  if (timeSinceCreation > editTimeLimit) {
    throw new ApiError(400, 'Edit time limit exceeded (15 minutes)');
  }

  // 6. Update message
  await messageRef.update({
    'content.text': newText,
    'content.edited': true,
    'content.editedAt': new Date(),
    updatedAt: new Date(),
  });

  console.log(`✅ [Messages/Edit] Message ${messageId} edited by ${ctx.uid} [${operationId}]`);

  return apiSuccess<EditMessageResponse>({
    edited: true,
    messageId,
  });
}
