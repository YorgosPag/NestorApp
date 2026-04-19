/**
 * =============================================================================
 * SHARE-TO-CHANNEL DISPATCH HELPERS (ADR-312 Phase 9.16)
 * =============================================================================
 *
 * Mode-specific dispatchers, persistence and audit helpers extracted from
 * `share-to-channel/route.ts` to keep the route under the 300-LOC API budget
 * and to keep each function under 40 LOC (Google SRP, CLAUDE.md SOS N.7.1).
 *
 * - `dispatchPhotoMode`  — per-photo multipart media send (Phase 9.14 path).
 * - `dispatchLinkMode`   — single text message carrying the share URL
 *                          (Phase 9.16 fallback).
 * - `persistShareRecord` — writes the `photo_shares` row with a mode tag.
 * - `recordAudit`        — emits a mode-aware `message_sent` audit event.
 *
 * @module app/api/communications/share-to-channel/dispatch-helpers
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { logAuditEvent } from '@/lib/auth';
import type { AuthContext } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { PipelineChannelValue } from '@/types/ai-pipeline';
import type {
  ChannelMediaReplyParams,
  ChannelReplyParams,
} from '@/services/ai-pipeline/shared/channel-reply-types';
import { sendChannelMediaReply } from '@/services/ai-pipeline/shared/channel-media-dispatcher';
import { sendChannelReply } from '@/services/ai-pipeline/shared/channel-reply-dispatcher';
import type {
  ChannelProvider,
  ChannelShareRequest,
} from '@/components/ui/channel-sharing/types';

const logger = createModuleLogger('ShareToChannelDispatch');

export type DispatchMode = 'photo' | 'link';

export interface DispatchResult {
  lastResult: { success: boolean; error?: string };
  sentCount: number;
  totalCount: number;
  mode: DispatchMode;
}

function buildMediaRecipient(
  provider: ChannelProvider,
  externalUserId: string,
): Partial<ChannelMediaReplyParams> {
  switch (provider) {
    case 'telegram':  return { telegramChatId: externalUserId };
    case 'email':     return { recipientEmail: externalUserId };
    case 'whatsapp':  return { whatsappPhone: externalUserId };
    case 'messenger': return { messengerPsid: externalUserId };
    case 'instagram': return { instagramIgsid: externalUserId };
  }
}

function buildTextRecipient(
  provider: ChannelProvider,
  externalUserId: string,
): Pick<ChannelReplyParams, 'recipientEmail' | 'telegramChatId' | 'whatsappPhone' | 'messengerPsid' | 'instagramIgsid'> {
  switch (provider) {
    case 'telegram':  return { telegramChatId: externalUserId };
    case 'email':     return { recipientEmail: externalUserId };
    case 'whatsapp':  return { whatsappPhone: externalUserId };
    case 'messenger': return { messengerPsid: externalUserId };
    case 'instagram': return { instagramIgsid: externalUserId };
  }
}

export async function dispatchPhotoMode(
  data: ChannelShareRequest,
  pipelineChannel: PipelineChannelValue,
  shareId: string,
): Promise<DispatchResult> {
  const recipientParams = buildMediaRecipient(data.channel, data.externalUserId);
  const photoUrls = data.photoUrls ?? [];
  let lastResult: { success: boolean; error?: string } = {
    success: false,
    error: 'No photos sent',
  };
  let sentCount = 0;

  for (let i = 0; i < photoUrls.length; i++) {
    const mediaParams: ChannelMediaReplyParams = {
      channel: pipelineChannel,
      ...recipientParams,
      mediaUrl: photoUrls[i],
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
        shareId, photoIndex: i, channel: data.channel, error: result.error,
      });
      break;
    }
  }
  return { lastResult, sentCount, totalCount: photoUrls.length, mode: 'photo' };
}

export async function dispatchLinkMode(
  data: ChannelShareRequest,
  pipelineChannel: PipelineChannelValue,
  shareId: string,
): Promise<DispatchResult> {
  const recipientParams = buildTextRecipient(data.channel, data.externalUserId);
  const caption = data.caption?.trim();
  const textBody = caption
    ? `${caption}\n\n${data.shareUrl}`
    : (data.shareUrl as string);
  const params: ChannelReplyParams = {
    channel: pipelineChannel,
    ...recipientParams,
    textBody,
    requestId: shareId,
  };
  const result = await sendChannelReply(params);
  if (!result.success) {
    logger.warn('Channel link send failed', {
      shareId, channel: data.channel, error: result.error,
    });
  }
  return {
    lastResult: { success: result.success, error: result.error },
    sentCount: result.success ? 1 : 0,
    totalCount: 1,
    mode: 'link',
  };
}

export async function persistShareRecord(
  db: FirebaseFirestore.Firestore,
  shareId: string,
  data: ChannelShareRequest,
  mode: DispatchMode,
  sentCount: number,
  totalCount: number,
  ctx: AuthContext,
): Promise<void> {
  const status = sentCount === totalCount ? 'sent' : sentCount > 0 ? 'partial' : 'failed';
  try {
    await db.collection(COLLECTIONS.PHOTO_SHARES).doc(shareId).set({
      contactId: data.contactId,
      contactName: data.contactName,
      channel: data.channel,
      externalUserId: data.externalUserId,
      mode,
      photoUrls: data.photoUrls ?? null,
      photoCount: data.photoUrls?.length ?? 0,
      shareUrl: data.shareUrl ?? null,
      caption: data.caption ?? null,
      status,
      sentCount,
      companyId: ctx.companyId,
      createdBy: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (writeError) {
    logger.warn('Share record write failed (non-blocking)', {
      shareId, error: getErrorMessage(writeError),
    });
  }
}

export async function recordAudit(
  ctx: AuthContext,
  data: ChannelShareRequest,
  shareId: string,
  mode: DispatchMode,
  totalCount: number,
  success: boolean,
): Promise<void> {
  try {
    await logAuditEvent(ctx, 'message_sent', data.contactId, 'communication', {
      newValue: {
        type: 'communication_status',
        value: {
          shareId,
          channel: data.channel,
          contactName: data.contactName,
          mode,
          photoCount: totalCount,
          success,
        },
      },
      metadata: {
        reason: mode === 'link'
          ? `Share link sent via ${data.channel} to ${data.contactName}`
          : `Photo shared via ${data.channel} to ${data.contactName}`,
      },
    });
  } catch (auditError) {
    logger.warn('Audit logging failed (non-blocking)', {
      shareId, error: getErrorMessage(auditError),
    });
  }
}
