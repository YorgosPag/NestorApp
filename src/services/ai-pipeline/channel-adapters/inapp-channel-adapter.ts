/**
 * =============================================================================
 * IN-APP CHANNEL ADAPTER — ADR-164
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Bridges the in-app voice assistant into the Universal AI Pipeline.
 * Converts voice commands to IntakeMessage format and enqueues them.
 *
 * Mirrors TelegramChannelAdapter pattern for consistency.
 *
 * @module services/ai-pipeline/channel-adapters/inapp-channel-adapter
 * @see ADR-164 (In-App Voice AI Pipeline)
 * @see TelegramChannelAdapter (./telegram-channel-adapter.ts)
 *
 * INTEGRATION POINT:
 *   POST /api/voice/command → InAppChannelAdapter.feedToPipeline() → ai_pipeline_queue
 */

import { getErrorMessage } from '@/lib/error-utils';
import type { IntakeMessage, AdminCommandMeta } from '@/types/ai-pipeline';
import { PipelineChannel } from '@/types/ai-pipeline';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { enqueuePipelineItem } from '../pipeline-queue-service';
import { isSuperAdminFirebaseUid, isSuperAdminEmail } from '../shared/super-admin-resolver';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

/** Parameters for feeding an in-app voice command into the pipeline */
export interface InAppFeedParams {
  /** Firestore voice_commands document ID */
  commandId: string;
  /** Firebase Auth UID */
  userId: string;
  /** User display name or email */
  userName: string;
  /** User email (for admin fallback detection) */
  userEmail?: string;
  /** Transcribed text from Whisper */
  transcript: string;
  /** Tenant company ID */
  companyId: string;
}

/** Result of feeding an in-app command to the pipeline */
export interface InAppFeedResult {
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
// IN-APP CHANNEL ADAPTER
// ============================================================================

/**
 * Converts in-app voice commands to pipeline IntakeMessage format
 * and enqueues them for universal pipeline processing.
 *
 * @see TelegramChannelAdapter for the Telegram counterpart
 * @see EmailChannelAdapter for the email counterpart
 */
export class InAppChannelAdapter {
  /**
   * Feed an in-app voice command into the Universal AI Pipeline.
   *
   * @param params Voice command data + company ID
   * @returns Pipeline enqueue result
   */
  static async feedToPipeline(
    params: InAppFeedParams
  ): Promise<InAppFeedResult> {
    try {
      const intakeMessage = InAppChannelAdapter.toIntakeMessage(params);

      // ── ADR-145: Super Admin Detection ──
      // Try Firebase UID first, fall back to email if UID not in registry
      let adminCommandMeta: AdminCommandMeta | null = null;
      try {
        let adminResolution = await isSuperAdminFirebaseUid(params.userId);

        // Fallback: check by email if UID didn't match (registry may lack firebaseUid)
        if (!adminResolution && params.userEmail) {
          adminResolution = await isSuperAdminEmail(params.userEmail);
        }

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
        // Non-fatal: if admin check fails, treat as normal user message
      }

      const { queueId, requestId } = await enqueuePipelineItem({
        companyId: params.companyId,
        channel: PipelineChannel.IN_APP,
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
      return {
        enqueued: false,
        error: `InAppChannelAdapter: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Convert in-app voice command data to pipeline IntakeMessage format.
   *
   * @param params Voice command parameters
   * @returns Normalized IntakeMessage
   */
  static toIntakeMessage(params: InAppFeedParams): IntakeMessage {
    return {
      id: `inapp_${params.commandId}`,
      channel: PipelineChannel.IN_APP,
      rawPayload: {
        commandId: params.commandId,
        userId: params.userId,
      },
      normalized: {
        sender: {
          name: params.userName,
          firebaseUid: params.userId,
          email: params.userEmail,
        },
        recipients: [],
        contentText: params.transcript,
        attachments: [],
        timestampIso: nowISO(),
      },
      metadata: {
        providerMessageId: params.commandId,
        signatureVerified: true, // Authenticated via Firebase Auth JWT
      },
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }
}
