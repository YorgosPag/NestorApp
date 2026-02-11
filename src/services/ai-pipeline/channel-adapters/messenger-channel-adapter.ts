/**
 * =============================================================================
 * MESSENGER CHANNEL ADAPTER
 * =============================================================================
 *
 * Bridges Facebook Messenger into the Universal AI Pipeline.
 * Converts Messenger messages to IntakeMessage format and enqueues them.
 *
 * Mirrors WhatsAppChannelAdapter pattern for consistency.
 *
 * @module services/ai-pipeline/channel-adapters/messenger-channel-adapter
 * @see ADR-174 (Meta Omnichannel — WhatsApp + Messenger + Instagram)
 * @see WhatsAppChannelAdapter (./whatsapp-channel-adapter.ts)
 *
 * INTEGRATION POINT:
 *   messenger/handler.ts → processMessagingEvent()
 *     → MessengerChannelAdapter.feedToPipeline() → ai_pipeline_queue
 */

import type { IntakeMessage } from '@/types/ai-pipeline';
import { PipelineChannel } from '@/types/ai-pipeline';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { enqueuePipelineItem } from '../pipeline-queue-service';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for feeding a Messenger message into the pipeline */
export interface MessengerFeedParams {
  /** Page-Scoped ID (PSID) of the sender */
  psid: string;
  /** Sender display name (fallback: 'Messenger User') */
  senderName: string;
  /** Message text content */
  messageText: string;
  /** Messenger message ID (mid) */
  messageId: string;
  /** Resolved company ID */
  companyId: string;
}

/** Result of feeding a Messenger message to the pipeline */
export interface MessengerFeedResult {
  enqueued: boolean;
  pipelineQueueId?: string;
  requestId?: string;
  error?: string;
}

// ============================================================================
// MESSENGER CHANNEL ADAPTER
// ============================================================================

/**
 * Converts Messenger messages to pipeline IntakeMessage format
 * and enqueues them for universal pipeline processing.
 */
export class MessengerChannelAdapter {
  /**
   * Feed a Messenger message into the Universal AI Pipeline.
   */
  static async feedToPipeline(
    params: MessengerFeedParams
  ): Promise<MessengerFeedResult> {
    try {
      const intakeMessage = MessengerChannelAdapter.toIntakeMessage(params);

      const { queueId, requestId } = await enqueuePipelineItem({
        companyId: params.companyId,
        channel: PipelineChannel.MESSENGER,
        intakeMessage,
      });

      return {
        enqueued: true,
        pipelineQueueId: queueId,
        requestId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        enqueued: false,
        error: `MessengerChannelAdapter: ${errorMessage}`,
      };
    }
  }

  /**
   * Convert Messenger message data to pipeline IntakeMessage format.
   */
  static toIntakeMessage(params: MessengerFeedParams): IntakeMessage {
    return {
      id: `msngr_${params.psid}_${params.messageId}`,
      channel: PipelineChannel.MESSENGER,
      rawPayload: {
        psid: params.psid,
        messageId: params.messageId,
      },
      normalized: {
        sender: {
          name: params.senderName,
          messengerUserId: params.psid,
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
