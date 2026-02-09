/**
 * =============================================================================
 * TELEGRAM CHANNEL ADAPTER
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Bridges the Telegram bot into the Universal AI Pipeline.
 * Converts Telegram messages to IntakeMessage format and enqueues them.
 *
 * Mirrors EmailChannelAdapter pattern for consistency.
 *
 * @module services/ai-pipeline/channel-adapters/telegram-channel-adapter
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 * @see EmailChannelAdapter (./email-channel-adapter.ts)
 *
 * INTEGRATION POINT:
 *   telegram/handler.ts → processTelegramUpdate()
 *     → TelegramChannelAdapter.feedToPipeline() → ai_pipeline_queue
 */

import type { IntakeMessage, AdminCommandMeta } from '@/types/ai-pipeline';
import { PipelineChannel } from '@/types/ai-pipeline';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { enqueuePipelineItem } from '../pipeline-queue-service';
import { isSuperAdminTelegram } from '../shared/super-admin-resolver';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for feeding a Telegram message into the pipeline */
export interface TelegramFeedParams {
  /** Telegram chat ID */
  chatId: string;
  /** Telegram user ID */
  userId: string;
  /** User display name (first_name + last_name) */
  userName: string;
  /** Message text content */
  messageText: string;
  /** Telegram message ID */
  messageId: string;
  /** Resolved company ID */
  companyId: string;
}

/** Result of feeding a Telegram message to the pipeline */
export interface TelegramFeedResult {
  /** Whether the item was enqueued successfully */
  enqueued: boolean;
  /** Pipeline queue item ID (if enqueued) */
  pipelineQueueId?: string;
  /** Pipeline request/correlation ID (if enqueued) */
  requestId?: string;
  /** Whether the sender was identified as a super admin (ADR-145) */
  isAdmin?: boolean;
  /** Error message (if failed) */
  error?: string;
}

// ============================================================================
// TELEGRAM CHANNEL ADAPTER
// ============================================================================

/**
 * Converts Telegram messages to pipeline IntakeMessage format
 * and enqueues them for universal pipeline processing.
 *
 * @see EmailChannelAdapter for the email counterpart
 */
export class TelegramChannelAdapter {
  /**
   * Feed a Telegram message into the Universal AI Pipeline.
   *
   * @param params Telegram message data + company ID
   * @returns Pipeline enqueue result
   */
  static async feedToPipeline(
    params: TelegramFeedParams
  ): Promise<TelegramFeedResult> {
    try {
      const intakeMessage = TelegramChannelAdapter.toIntakeMessage(params);

      // ── ADR-145: Super Admin Detection ──
      let adminCommandMeta: AdminCommandMeta | null = null;
      try {
        const adminResolution = await isSuperAdminTelegram(params.userId);
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
        // Non-fatal: if admin check fails, treat as normal customer message
      }

      const { queueId, requestId } = await enqueuePipelineItem({
        companyId: params.companyId,
        channel: PipelineChannel.TELEGRAM,
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
        error: `TelegramChannelAdapter: ${errorMessage}`,
      };
    }
  }

  /**
   * Convert Telegram message data to pipeline IntakeMessage format.
   *
   * @param params Telegram message parameters
   * @returns Normalized IntakeMessage
   */
  static toIntakeMessage(params: TelegramFeedParams): IntakeMessage {
    return {
      id: `tg_${params.chatId}_${params.messageId}`,
      channel: PipelineChannel.TELEGRAM,
      rawPayload: {
        chatId: params.chatId,
        userId: params.userId,
        messageId: params.messageId,
      },
      normalized: {
        sender: {
          name: params.userName,
          telegramId: params.chatId,
        },
        recipients: [],
        contentText: params.messageText,
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: {
        providerMessageId: params.messageId,
        signatureVerified: true, // Validated by Telegram webhook secret
      },
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }
}
