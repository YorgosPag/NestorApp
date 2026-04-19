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
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { FIELDS } from '@/config/firestore-field-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
import { PipelineChannel } from '@/types/ai-pipeline';
import type { PipelineChannelValue } from '@/types/ai-pipeline';
import { generateShareId } from '@/services/enterprise-id.service';
import type { ChannelProvider, ChannelShareRequest, ChannelShareResponse } from '@/components/ui/channel-sharing/types';
import {
  dispatchLinkMode,
  dispatchPhotoMode,
  dispatchShowcaseDigest,
  persistShareRecord,
  recordAudit,
} from './dispatch-helpers';

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

  // Mutually-exclusive dispatch modes (ADR-312 Phase 9.16): exactly one of
  // `photoUrls` / `shareUrl` must be provided.
  const hasPhotos = Array.isArray(b.photoUrls) && (b.photoUrls as unknown[]).length > 0;
  const hasShareUrl = typeof b.shareUrl === 'string' && (b.shareUrl as string).length > 0;
  if (hasPhotos === hasShareUrl) {
    throw new ApiError(
      400,
      'Exactly one of photoUrls / shareUrl must be provided',
      'VALIDATION_ERROR',
    );
  }

  let photoUrls: string[] | undefined;
  if (hasPhotos) {
    const arr = b.photoUrls as unknown[];
    if (arr.length > MAX_PHOTOS) {
      throw new ApiError(400, `photoUrls must be 1-${MAX_PHOTOS} items`, 'VALIDATION_ERROR');
    }
    for (const url of arr) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        throw new ApiError(400, 'Invalid photo URL', 'VALIDATION_ERROR');
      }
    }
    photoUrls = arr as string[];
  }

  let shareUrl: string | undefined;
  if (hasShareUrl) {
    shareUrl = b.shareUrl as string;
    if (!shareUrl.startsWith('http')) {
      throw new ApiError(400, 'Invalid shareUrl', 'VALIDATION_ERROR');
    }
  }

  if (b.caption !== undefined && typeof b.caption !== 'string') {
    throw new ApiError(400, 'Invalid caption', 'VALIDATION_ERROR');
  }

  let propertyId: string | undefined;
  if (b.propertyId !== undefined) {
    if (typeof b.propertyId !== 'string' || b.propertyId.length < 3) {
      throw new ApiError(400, 'Invalid propertyId', 'VALIDATION_ERROR');
    }
    propertyId = b.propertyId;
  }

  return {
    contactId: b.contactId,
    contactName: b.contactName,
    channel: b.channel as ChannelProvider,
    externalUserId: b.externalUserId,
    photoUrls,
    shareUrl,
    caption: b.caption as string | undefined,
    propertyId,
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

      const dispatch = data.shareUrl
        ? await dispatchLinkMode(data, pipelineChannel, shareId)
        : await dispatchPhotoMode(data, pipelineChannel, shareId);
      const { lastResult, sentCount, totalCount, mode } = dispatch;

      // ADR-312 Phase 9.18 — after a successful photo dispatch, follow up
      // with the full showcase digest as plain-text chunks so the recipient
      // sees company / project / specs / features / energy / linked spaces
      // in-conversation, not just the photo caption.
      if (mode === 'photo' && lastResult.success && data.propertyId) {
        await dispatchShowcaseDigest(data, pipelineChannel, shareId, ctx.companyId);
      }

      await persistShareRecord(db, shareId, data, mode, sentCount, totalCount, ctx);
      await recordAudit(ctx, data, shareId, mode, totalCount, lastResult.success);

      logger.info('Channel share completed', {
        shareId,
        mode,
        channel: data.channel,
        contactId: data.contactId,
        totalCount,
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
        // Non-image payload reached Telegram (local guard or Telegram's own
        // `IMAGE_PROCESS_FAILED`). Surface a dedicated 422 so the client can
        // show a `telegramNotAnImage` message instead of the raw API text
        // (ADR-312 Phase 9.15).
        if (
          data.channel === 'telegram' &&
          (errText.startsWith('NOT_AN_IMAGE:') || /IMAGE_PROCESS_FAILED/i.test(errText))
        ) {
          throw new ApiError(
            422,
            'Telegram rejected the payload because it is not an image',
            'TELEGRAM_NOT_AN_IMAGE',
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
