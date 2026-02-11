/**
 * =============================================================================
 * INSTAGRAM CHANNEL ADAPTER
 * =============================================================================
 *
 * Bridges Instagram DMs into the Universal AI Pipeline.
 * Converts Instagram messages to IntakeMessage format and enqueues them.
 *
 * Mirrors WhatsAppChannelAdapter pattern for consistency.
 *
 * @module services/ai-pipeline/channel-adapters/instagram-channel-adapter
 * @see ADR-174 (Meta Omnichannel — WhatsApp + Messenger + Instagram)
 * @see WhatsAppChannelAdapter (./whatsapp-channel-adapter.ts)
 *
 * INTEGRATION POINT:
 *   instagram/handler.ts → processMessagingEvent()
 *     → InstagramChannelAdapter.feedToPipeline() → ai_pipeline_queue
 */

import type { IntakeMessage, AdminCommandMeta } from '@/types/ai-pipeline';
import { PipelineChannel } from '@/types/ai-pipeline';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { enqueuePipelineItem } from '../pipeline-queue-service';
import { isSuperAdminInstagram } from '../shared/super-admin-resolver';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for feeding an Instagram message into the pipeline */
export interface InstagramFeedParams {
  /** Instagram-Scoped ID (IGSID) of the sender */
  igsid: string;
  /** Sender display name (fallback: 'Instagram User') */
  senderName: string;
  /** Message text content */
  messageText: string;
  /** Instagram message ID (mid) */
  messageId: string;
  /** Resolved company ID */
  companyId: string;
}

/** Result of feeding an Instagram message to the pipeline */
export interface InstagramFeedResult {
  enqueued: boolean;
  pipelineQueueId?: string;
  requestId?: string;
  isAdmin?: boolean;
  error?: string;
}

// ============================================================================
// INSTAGRAM CHANNEL ADAPTER
// ============================================================================

/**
 * Converts Instagram messages to pipeline IntakeMessage format
 * and enqueues them for universal pipeline processing.
 */
export class InstagramChannelAdapter {
  /**
   * Feed an Instagram message into the Universal AI Pipeline.
   */
  static async feedToPipeline(
    params: InstagramFeedParams
  ): Promise<InstagramFeedResult> {
    try {
      const intakeMessage = InstagramChannelAdapter.toIntakeMessage(params);

      // ── ADR-145: Super Admin Detection ──
      let adminCommandMeta: AdminCommandMeta | null = null;
      try {
        const adminResolution = await isSuperAdminInstagram(params.igsid);
        if (adminResolution) {
          adminCommandMeta = {
            adminIdentity: {
              displayName: adminResolution.identity.displayName,
              firebaseUid: adminResolution.identity.firebaseUid,
            },
            isAdminCommand: true,
            resolvedVia: adminResolution.resolvedVia,
          };
        }
      } catch {
        // Non-fatal: proceed as regular customer if admin check fails
      }

      const { queueId, requestId } = await enqueuePipelineItem({
        companyId: params.companyId,
        channel: PipelineChannel.INSTAGRAM,
        intakeMessage,
        ...(adminCommandMeta ? { adminCommandMeta } : {}),
      });

      return {
        enqueued: true,
        pipelineQueueId: queueId,
        requestId,
        isAdmin: adminCommandMeta?.isAdminCommand ?? false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        enqueued: false,
        error: `InstagramChannelAdapter: ${errorMessage}`,
      };
    }
  }

  /**
   * Convert Instagram message data to pipeline IntakeMessage format.
   */
  static toIntakeMessage(params: InstagramFeedParams): IntakeMessage {
    return {
      id: `ig_${params.igsid}_${params.messageId}`,
      channel: PipelineChannel.INSTAGRAM,
      rawPayload: {
        igsid: params.igsid,
        messageId: params.messageId,
      },
      normalized: {
        sender: {
          name: params.senderName,
          instagramUserId: params.igsid,
        },
        recipients: [],
        contentText: params.messageText,
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: {
        providerMessageId: params.messageId,
        signatureVerified: !!process.env.META_APP_SECRET,
      },
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }
}
