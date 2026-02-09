/**
 * =============================================================================
 * EMAIL CHANNEL ADAPTER
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Bridges the existing email pipeline into the Universal AI Pipeline.
 * Converts completed email queue items to IntakeMessage format and enqueues them.
 *
 * @module services/ai-pipeline/channel-adapters/email-channel-adapter
 * @see ADR-080 (Pipeline Implementation)
 * @see ADR-071 (Email Webhook Queue)
 *
 * INTEGRATION POINT:
 *   email-queue-service.ts → processQueueItem() → SUCCESS
 *     → EmailChannelAdapter.feedToPipeline() → ai_pipeline_queue
 */

import type { EmailIngestionQueueItem } from '@/types/email-ingestion-queue';
import type { IntakeMessage, IntakeAttachment, AdminCommandMeta } from '@/types/ai-pipeline';
import { PipelineChannel } from '@/types/ai-pipeline';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { enqueuePipelineItem } from '../pipeline-queue-service';
import { isSuperAdminEmail } from '../shared/super-admin-resolver';

// ============================================================================
// EMAIL CHANNEL ADAPTER
// ============================================================================

/**
 * Parameters for feeding an email into the pipeline
 */
export interface FeedToPipelineParams {
  /** The processed email queue item */
  queueItem: EmailIngestionQueueItem;
  /** Communication record ID (from messages collection) */
  communicationId: string;
  /** Resolved company ID */
  companyId: string;
}

/**
 * Result of feeding an email to the pipeline
 */
export interface FeedToPipelineResult {
  /** Whether the item was enqueued successfully */
  enqueued: boolean;
  /** Pipeline queue item ID (if enqueued) */
  pipelineQueueId?: string;
  /** Pipeline request/correlation ID (if enqueued) */
  requestId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Converts email queue items to pipeline IntakeMessage format
 * and enqueues them for universal pipeline processing
 */
export class EmailChannelAdapter {
  /**
   * Feed a successfully processed email into the Universal AI Pipeline
   *
   * @param params - Email queue item + processing result
   * @returns Pipeline enqueue result
   */
  static async feedToPipeline(
    params: FeedToPipelineParams
  ): Promise<FeedToPipelineResult> {
    try {
      const { queueItem, communicationId, companyId } = params;

      // Convert email queue item to normalized IntakeMessage
      const intakeMessage = EmailChannelAdapter.toIntakeMessage(
        queueItem,
        communicationId
      );

      // ── ADR-145: Super Admin Detection ──
      let adminCommandMeta: AdminCommandMeta | null = null;
      const senderEmail = queueItem.sender.email;
      if (senderEmail) {
        try {
          const adminResolution = await isSuperAdminEmail(senderEmail);
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
      }

      // Enqueue to ai_pipeline_queue
      const { queueId, requestId } = await enqueuePipelineItem({
        companyId,
        channel: PipelineChannel.EMAIL,
        intakeMessage,
        ...(adminCommandMeta ? { adminCommandMeta } : {}),
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
        error: `EmailChannelAdapter: ${errorMessage}`,
      };
    }
  }

  /**
   * Convert EmailIngestionQueueItem to IntakeMessage
   *
   * @param queueItem - Email queue item
   * @param communicationId - ID of the created communication record
   * @returns Normalized IntakeMessage
   */
  static toIntakeMessage(
    queueItem: EmailIngestionQueueItem,
    communicationId: string
  ): IntakeMessage {
    // Map serialized attachments to pipeline format
    const attachments: IntakeAttachment[] = queueItem.attachments.map(att => ({
      filename: att.filename,
      contentType: att.contentType,
      sizeBytes: att.sizeBytes,
      ...(att.mode === 'deferred' && att.storageUrl ? { storageUrl: att.storageUrl } : {}),
    }));

    return {
      id: communicationId,
      channel: PipelineChannel.EMAIL,
      rawPayload: queueItem.rawMetadata ?? {},
      normalized: {
        sender: {
          email: queueItem.sender.email,
          name: queueItem.sender.name,
        },
        recipients: queueItem.recipients,
        subject: queueItem.subject,
        contentText: queueItem.contentText,
        contentHtml: queueItem.contentHtml,
        attachments,
        timestampIso: queueItem.createdAt instanceof Date
          ? queueItem.createdAt.toISOString()
          : new Date().toISOString(),
      },
      metadata: {
        providerMessageId: queueItem.providerMessageId,
        signatureVerified: true, // Already verified by Mailgun webhook
      },
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }
}
