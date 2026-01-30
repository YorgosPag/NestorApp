/**
 * =============================================================================
 * DELETE MESSAGES API - ENTERPRISE BULK DELETE
 * =============================================================================
 *
 * Endpoint for deleting one or more messages.
 * Supports bulk deletion with tenant isolation.
 *
 * @module api/messages/delete
 * @enterprise EPIC C - Communications
 * @security Requires authenticated user with proper permissions
 */

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateRequestId } from '@/services/enterprise-id.service';

// ============================================================================
// TYPES
// ============================================================================

interface DeleteMessagesRequest {
  messageIds: string[];
}

interface DeleteMessagesResponse {
  deleted: number;
  failed: number;
  errors: Array<{ messageId: string; reason: string }>;
}

type DeleteMessagesCanonicalResponse = ApiSuccessResponse<DeleteMessagesResponse>;

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_BATCH_SIZE = 100; // Firestore batch limit safety margin

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// POST - Delete Messages
// ============================================================================

/**
 * POST /api/messages/delete
 *
 * Delete one or more messages.
 *
 * 🔒 SECURITY: Protected with RBAC
 * - Permission: comm:messages:delete
 * - Ownership Validation: Verifies messages belong to user's company
 */
export async function POST(request: NextRequest) {
  const handler = withAuth<DeleteMessagesCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      return handleDeleteMessages(req, ctx);
    },
    { permissions: 'comm:messages:delete' }
  );

  return handler(request);
}

async function handleDeleteMessages(
  request: NextRequest,
  ctx: AuthContext
): Promise<ReturnType<typeof apiSuccess<DeleteMessagesResponse>>> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  console.log(`🗑️ [Messages/Delete] User ${ctx.email} (company: ${ctx.companyId}) deleting messages`);

  // Parse request body
  const body: DeleteMessagesRequest = await request.json();

  if (!body.messageIds || !Array.isArray(body.messageIds) || body.messageIds.length === 0) {
    throw new ApiError(400, 'messageIds array is required and must not be empty');
  }

  if (body.messageIds.length > MAX_BATCH_SIZE) {
    throw new ApiError(400, `Cannot delete more than ${MAX_BATCH_SIZE} messages at once`);
  }

  const result: DeleteMessagesResponse = {
    deleted: 0,
    failed: 0,
    errors: [],
  };

  // Process deletions
  const batch = adminDb.batch();
  const validDeletes: string[] = [];

  for (const messageId of body.messageIds) {
    try {
      // Fetch message to verify ownership
      const messageDoc = await adminDb
        .collection(COLLECTIONS.MESSAGES)
        .doc(messageId)
        .get();

      if (!messageDoc.exists) {
        result.failed++;
        result.errors.push({ messageId, reason: 'Message not found' });
        continue;
      }

      const messageData = messageDoc.data();

      // CRITICAL: Tenant isolation check
      if (messageData?.companyId !== ctx.companyId) {
        console.warn(`⚠️ [Messages/Delete] Unauthorized delete attempt:`, {
          userId: ctx.uid,
          userCompany: ctx.companyId,
          messageId,
          messageCompany: messageData?.companyId,
        });
        result.failed++;
        result.errors.push({ messageId, reason: 'Unauthorized - message belongs to different company' });
        continue;
      }

      // Add to batch
      batch.delete(messageDoc.ref);
      validDeletes.push(messageId);
    } catch (error) {
      result.failed++;
      result.errors.push({
        messageId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Execute batch delete
  if (validDeletes.length > 0) {
    try {
      await batch.commit();
      result.deleted = validDeletes.length;
      console.log(`✅ [Messages/Delete] Deleted ${validDeletes.length} messages`);
    } catch (error) {
      console.error('❌ [Messages/Delete] Batch commit failed:', error);
      throw new ApiError(500, 'Failed to delete messages');
    }
  }

  const duration = Date.now() - startTime;
  console.log(`✅ [Messages/Delete] Complete in ${duration}ms - deleted: ${result.deleted}, failed: ${result.failed}`);

  return apiSuccess<DeleteMessagesResponse>(result);
}
