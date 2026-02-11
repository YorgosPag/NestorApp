/**
 * =============================================================================
 * WHATSAPP CHANNEL ADAPTER
 * =============================================================================
 *
 * Bridges WhatsApp Cloud API into the Universal AI Pipeline.
 * Converts WhatsApp messages to IntakeMessage format and enqueues them.
 *
 * Mirrors TelegramChannelAdapter pattern for consistency.
 *
 * @module services/ai-pipeline/channel-adapters/whatsapp-channel-adapter
 * @see ADR-174 (Meta Omnichannel — WhatsApp + Messenger + Instagram)
 * @see TelegramChannelAdapter (./telegram-channel-adapter.ts)
 *
 * INTEGRATION POINT:
 *   whatsapp/handler.ts → processIncomingMessage()
 *     → WhatsAppChannelAdapter.feedToPipeline() → ai_pipeline_queue
 */

import type { IntakeMessage, AdminCommandMeta } from '@/types/ai-pipeline';
import { PipelineChannel } from '@/types/ai-pipeline';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { enqueuePipelineItem } from '../pipeline-queue-service';
import { isSuperAdminWhatsApp } from '../shared/super-admin-resolver';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for feeding a WhatsApp message into the pipeline */
export interface WhatsAppFeedParams {
  /** WhatsApp phone number of sender (wa_id) */
  phoneNumber: string;
  /** Sender display name from WhatsApp profile */
  senderName: string;
  /** Message text content */
  messageText: string;
  /** WhatsApp message ID (wamid.xxx) */
  messageId: string;
  /** Resolved company ID */
  companyId: string;
}

/** Result of feeding a WhatsApp message to the pipeline */
export interface WhatsAppFeedResult {
  /** Whether the item was enqueued successfully */
  enqueued: boolean;
  /** Pipeline queue item ID (if enqueued) */
  pipelineQueueId?: string;
  /** Pipeline request/correlation ID (if enqueued) */
  requestId?: string;
  /** Whether the sender was identified as super admin */
  isAdmin?: boolean;
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// WHATSAPP CHANNEL ADAPTER
// ============================================================================

/**
 * Converts WhatsApp messages to pipeline IntakeMessage format
 * and enqueues them for universal pipeline processing.
 *
 * @see TelegramChannelAdapter for the Telegram counterpart
 */
export class WhatsAppChannelAdapter {
  /**
   * Feed a WhatsApp message into the Universal AI Pipeline.
   *
   * @param params WhatsApp message data + company ID
   * @returns Pipeline enqueue result
   */
  static async feedToPipeline(
    params: WhatsAppFeedParams
  ): Promise<WhatsAppFeedResult> {
    try {
      const intakeMessage = WhatsAppChannelAdapter.toIntakeMessage(params);

      // ── ADR-145: Super Admin Detection ──
      let adminCommandMeta: AdminCommandMeta | null = null;
      try {
        const adminResolution = await isSuperAdminWhatsApp(params.phoneNumber);
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
        channel: PipelineChannel.WHATSAPP,
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
        error: `WhatsAppChannelAdapter: ${errorMessage}`,
      };
    }
  }

  /**
   * Convert WhatsApp message data to pipeline IntakeMessage format.
   *
   * @param params WhatsApp message parameters
   * @returns Normalized IntakeMessage
   */
  static toIntakeMessage(params: WhatsAppFeedParams): IntakeMessage {
    return {
      id: `wa_${params.phoneNumber}_${params.messageId}`,
      channel: PipelineChannel.WHATSAPP,
      rawPayload: {
        phoneNumber: params.phoneNumber,
        messageId: params.messageId,
      },
      normalized: {
        sender: {
          name: params.senderName,
          whatsappPhone: params.phoneNumber,
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
