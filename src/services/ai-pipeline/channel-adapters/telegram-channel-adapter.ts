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

import { getErrorMessage } from '@/lib/error-utils';
import type { IntakeMessage, AdminCommandMeta, ContactMeta, IntakeAttachment } from '@/types/ai-pipeline';
import type { MessageAttachment } from '@/types/conversations';
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
  /** Resolved contact with project roles (RBAC) */
  contactMeta?: ContactMeta | null;
  /** Media attachments from Telegram message (photos, documents) */
  attachments?: MessageAttachment[];
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
        ...(params.contactMeta ? { contactMeta: params.contactMeta } : {}),
      });

      return {
        enqueued: true,
        pipelineQueueId: queueId,
        requestId,
        isAdmin: adminCommandMeta?.isAdminCommand ?? false,
      };
    } catch (error) {
      return {
        enqueued: false,
        error: `TelegramChannelAdapter: ${getErrorMessage(error)}`,
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
        attachments: mapAttachments(params.attachments),
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

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map MessageAttachment[] from Telegram media to IntakeAttachment[].
 * Includes metadata-only entries when download failed (FIND-J)
 * so AI can acknowledge the attachment exists.
 */
function mapAttachments(attachments?: MessageAttachment[]): IntakeAttachment[] {
  if (!attachments || attachments.length === 0) return [];

  return attachments.map(a => ({
    filename: a.filename ?? 'attachment',
    contentType: a.mimeType ?? 'application/octet-stream',
    sizeBytes: a.size ?? 0,
    ...(a.url ? { storageUrl: a.url } : {}),
    ...(a.fileRecordId ? { fileRecordId: a.fileRecordId } : {}),
    ...(!a.url && !a.fileRecordId ? { downloadFailed: true } : {}),
  }));
}
