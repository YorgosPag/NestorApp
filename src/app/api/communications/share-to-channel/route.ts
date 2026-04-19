/**
 * =============================================================================
 * SHARE TO CHANNEL — Send Photo(s) to CRM Contact via Any Channel
 * =============================================================================
 *
 * Bridges the sharing UI to the existing channel-media-dispatcher.
 * Reuses sendChannelMediaReply() for actual delivery (Telegram, Email, etc.)
 *
 * @route POST /api/communications/share-to-channel
 * @security Admin SDK + withAuth + Tenant Isolation
 * @enterprise Phase 2 — Multi-Channel Sharing
 */

import 'server-only';

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { FieldValue } from 'firebase-admin/firestore';
import { PipelineChannel } from '@/types/ai-pipeline';
import type { PipelineChannelValue } from '@/types/ai-pipeline';
import type { ChannelMediaReplyParams } from '@/services/ai-pipeline/shared/channel-reply-types';
import { sendChannelMediaReply } from '@/services/ai-pipeline/shared/channel-media-dispatcher';
import { generateShareId } from '@/services/enterprise-id.service';
import type { ChannelProvider, ChannelShareRequest, ChannelShareResponse } from '@/components/ui/channel-sharing/types';

const logger = createModuleLogger('ShareToChannelRoute');

// ============================================================================
// CHANNEL MAPPING — Provider → PipelineChannel + recipient field
// ============================================================================

const PROVIDER_TO_PIPELINE: Record<ChannelProvider, PipelineChannelValue> = {
  telegram: PipelineChannel.TELEGRAM,
  email: PipelineChannel.EMAIL,
  whatsapp: PipelineChannel.WHATSAPP,
  messenger: PipelineChannel.MESSENGER,
  instagram: PipelineChannel.INSTAGRAM,
};

function buildRecipientParams(
  provider: ChannelProvider,
  externalUserId: string
): Partial<ChannelMediaReplyParams> {
  switch (provider) {
    case 'telegram':  return { telegramChatId: externalUserId };
    case 'email':     return { recipientEmail: externalUserId };
    case 'whatsapp':  return { whatsappPhone: externalUserId };
    case 'messenger': return { messengerPsid: externalUserId };
    case 'instagram': return { instagramIgsid: externalUserId };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_PROVIDERS = new Set<string>(['telegram', 'email', 'whatsapp', 'messenger', 'instagram']);
const MAX_PHOTOS = 10;

function validateRequest(body: unknown): ChannelShareRequest {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'Invalid request body', 'VALIDATION_ERROR');
  }

  const b = body as Record<string, unknown>;

  if (typeof b.contactId !== 'string' || b.contactId.length < 3) {
    throw new ApiError(400, 'Invalid contactId', 'VALIDATION_ERROR');
  }
  if (typeof b.contactName !== 'string' || b.contactName.length === 0) {
    throw new ApiError(400, 'Invalid contactName', 'VALIDATION_ERROR');
  }
  if (typeof b.channel !== 'string' || !VALID_PROVIDERS.has(b.channel)) {
    throw new ApiError(400, 'Invalid channel', 'VALIDATION_ERROR');
  }
  if (typeof b.externalUserId !== 'string' || b.externalUserId.length === 0) {
    throw new ApiError(400, 'Invalid externalUserId', 'VALIDATION_ERROR');
  }
  if (!Array.isArray(b.photoUrls) || b.photoUrls.length === 0 || b.photoUrls.length > MAX_PHOTOS) {
    throw new ApiError(400, `photoUrls must be 1-${MAX_PHOTOS} items`, 'VALIDATION_ERROR');
  }
  for (const url of b.photoUrls) {
    if (typeof url !== 'string' || !url.startsWith('http')) {
      throw new ApiError(400, 'Invalid photo URL', 'VALIDATION_ERROR');
    }
  }
  if (b.caption !== undefined && typeof b.caption !== 'string') {
    throw new ApiError(400, 'Invalid caption', 'VALIDATION_ERROR');
  }

  return {
    contactId: b.contactId,
    contactName: b.contactName,
    channel: b.channel as ChannelProvider,
    externalUserId: b.externalUserId,
    photoUrls: b.photoUrls as string[],
    caption: b.caption as string | undefined,
  };
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export const POST = withSensitiveRateLimit(
  withAuth<ApiSuccessResponse<ChannelShareResponse>>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await request.json().catch(() => null);
      const data = validateRequest(body);

      const db = getAdminFirestore();
      if (!db) {
        throw new ApiError(503, 'Database connection not available', 'DB_UNAVAILABLE');
      }

      // Verify contact exists + tenant isolation
      const contactDoc = await db.collection(COLLECTIONS.CONTACTS).doc(data.contactId).get();
      if (!contactDoc.exists) {
        throw new ApiError(404, 'Contact not found', 'NOT_FOUND');
      }
      if (contactDoc.data()?.[FIELDS.COMPANY_ID] !== ctx.companyId) {
        throw new ApiError(403, 'Access denied', 'FORBIDDEN');
      }

      const shareId = generateShareId();
      const pipelineChannel = PROVIDER_TO_PIPELINE[data.channel];
      const recipientParams = buildRecipientParams(data.channel, data.externalUserId);

      // Send each photo — caption only on the first
      let lastResult: { success: boolean; error?: string } = { success: false, error: 'No photos sent' };
      let sentCount = 0;

      for (let i = 0; i < data.photoUrls.length; i++) {
        const mediaParams: ChannelMediaReplyParams = {
          channel: pipelineChannel,
          ...recipientParams,
          mediaUrl: data.photoUrls[i],
          mediaType: 'photo',
          caption: i === 0 ? data.caption : undefined,
          requestId: `${shareId}_${i}`,
        };

        const result = await sendChannelMediaReply(mediaParams);
        lastResult = { success: result.success, error: result.error };

        if (result.success) {
          sentCount++;
        } else {
          logger.warn('Channel media send failed', {
            shareId,
            photoIndex: i,
            channel: data.channel,
            error: result.error,
          });
          break;
        }
      }

      // Persist photo share record for history
      const shareStatus = sentCount === data.photoUrls.length
        ? 'sent'
        : sentCount > 0 ? 'partial' : 'failed';

      try {
        await db.collection(COLLECTIONS.PHOTO_SHARES).doc(shareId).set({
          contactId: data.contactId,
          contactName: data.contactName,
          channel: data.channel,
          externalUserId: data.externalUserId,
          photoUrls: data.photoUrls,
          photoCount: data.photoUrls.length,
          caption: data.caption ?? null,
          status: shareStatus,
          sentCount,
          companyId: ctx.companyId,
          createdBy: ctx.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (writeError) {
        logger.warn('Photo share record write failed (non-blocking)', {
          shareId,
          error: getErrorMessage(writeError),
        });
      }

      // Audit trail (non-blocking)
      try {
        await logAuditEvent(ctx, 'message_sent', data.contactId, 'communication', {
          newValue: {
            type: 'communication_status',
            value: {
              shareId,
              channel: data.channel,
              contactName: data.contactName,
              photoCount: data.photoUrls.length,
              success: lastResult.success,
            },
          },
          metadata: {
            reason: `Photo shared via ${data.channel} to ${data.contactName}`,
          },
        });
      } catch (auditError) {
        logger.warn('Audit logging failed (non-blocking)', {
          shareId,
          error: getErrorMessage(auditError),
        });
      }

      logger.info('Channel share completed', {
        shareId,
        channel: data.channel,
        contactId: data.contactId,
        photoCount: data.photoUrls.length,
        success: lastResult.success,
        tenant: ctx.companyId,
      });

      if (!lastResult.success) {
        // Telegram Bot API returns `Bad Request: chat not found` when the
        // recipient either never sent `/start` to the bot or the stored
        // `externalUserId` is a `@username` handle (not a numeric chat_id).
        // Surface a 422 with a dedicated code so the client can render the
        // `channelShare.errors.telegramChatNotFound` message instead of the
        // raw Telegram description (ADR-312 Phase 9.12).
        const errText = lastResult.error ?? '';
        if (data.channel === 'telegram' && /chat not found/i.test(errText)) {
          throw new ApiError(
            422,
            'Telegram chat not found — recipient must start the bot first',
            'TELEGRAM_CHAT_NOT_FOUND',
          );
        }
        throw new ApiError(502, lastResult.error ?? 'Channel delivery failed', 'CHANNEL_ERROR');
      }

      return apiSuccess<ChannelShareResponse>({
        success: true,
        shareId,
      });
    },
    { permissions: 'crm:contacts:view' }
  )
);
