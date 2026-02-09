/**
 * =============================================================================
 * VOICE COMMAND API — In-App AI Pipeline Entry (ADR-164)
 * =============================================================================
 *
 * Server-side endpoint for submitting voice commands to the AI pipeline.
 * Receives transcribed text → creates Firestore doc → enqueues to pipeline → triggers worker.
 *
 * Flow:
 *   POST { text } → voice_commands/{id} (pending) → InAppChannelAdapter → ai_pipeline_queue
 *   → after() triggers processAIPipelineBatch()
 *   → pipeline processes → dispatchInApp() updates voice_commands/{id} (completed)
 *   → client onSnapshot sees update → displays AI response
 *
 * @endpoint POST /api/voice/command
 * @enterprise ADR-164 - In-App Voice AI Pipeline
 * @security Authenticated users only, rate limited
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { InAppChannelAdapter } from '@/services/ai-pipeline/channel-adapters/inapp-channel-adapter';
import { createModuleLogger } from '@/lib/telemetry';
import type { VoiceCommandDoc, SubmitCommandResult } from '@/types/voice-command';

// =============================================================================
// LOGGER
// =============================================================================

const logger = createModuleLogger('VOICE_COMMAND');

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum text length for voice commands */
const MAX_TEXT_LENGTH = 2000;

// =============================================================================
// HANDLER
// =============================================================================

/**
 * POST /api/voice/command
 *
 * Accepts transcribed text and submits it to the AI pipeline.
 * Returns commandId for client-side Firestore subscription.
 */
export const POST = withStandardRateLimit(
  withAuth<SubmitCommandResult>(
    async (
      request: NextRequest,
      authCtx: AuthContext,
      _cache: PermissionCache
    ): Promise<NextResponse<SubmitCommandResult>> => {
      // 1. Parse body
      let body: { text?: string };
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      // 2. Validate text
      const text = body.text?.trim();
      if (!text) {
        return NextResponse.json(
          { success: false, error: 'Empty text' },
          { status: 400 }
        );
      }

      if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Text too long (max ${MAX_TEXT_LENGTH} chars)` },
          { status: 400 }
        );
      }

      const { uid, companyId, displayName } = authCtx;

      // 3. Create voice_commands document (status: pending)
      const adminDb = getAdminFirestore();
      const now = new Date().toISOString();

      const commandDoc: Omit<VoiceCommandDoc, 'pipelineRequestId' | 'pipelineQueueId'> & {
        pipelineRequestId: string | null;
        pipelineQueueId: string | null;
      } = {
        userId: uid,
        companyId,
        transcript: text,
        status: 'pending',
        pipelineRequestId: null,
        pipelineQueueId: null,
        aiResponse: null,
        intent: null,
        moduleId: null,
        isAdmin: false,
        error: null,
        channel: 'in_app',
        createdAt: now,
        completedAt: null,
      };

      const docRef = await adminDb
        .collection(COLLECTIONS.VOICE_COMMANDS)
        .add(commandDoc);

      const commandId = docRef.id;

      logger.info('Voice command created', {
        commandId,
        userId: uid,
        textLength: text.length,
      });

      // 4. Feed to AI pipeline via InAppChannelAdapter
      const feedResult = await InAppChannelAdapter.feedToPipeline({
        commandId,
        userId: uid,
        userName: displayName ?? 'User',
        transcript: text,
        companyId,
      });

      if (!feedResult.enqueued) {
        // Update doc with error
        await docRef.update({
          status: 'failed',
          error: feedResult.error ?? 'Pipeline enqueue failed',
        });

        logger.error('Pipeline enqueue failed', {
          commandId,
          error: feedResult.error,
        });

        return NextResponse.json(
          { success: false, error: 'Pipeline enqueue failed' },
          { status: 500 }
        );
      }

      // 5. Update doc with pipeline IDs and admin status
      await docRef.update({
        status: 'processing',
        pipelineRequestId: feedResult.requestId ?? null,
        pipelineQueueId: feedResult.pipelineQueueId ?? null,
        isAdmin: feedResult.isAdmin ?? false,
      });

      logger.info('Voice command enqueued to pipeline', {
        commandId,
        requestId: feedResult.requestId,
        isAdmin: feedResult.isAdmin,
      });

      // 6. Trigger pipeline worker after response (same pattern as Telegram/Mailgun)
      after(async () => {
        try {
          const { processAIPipelineBatch } = await import(
            '@/server/ai/workers/ai-pipeline-worker'
          );
          const result = await processAIPipelineBatch();
          logger.info('Pipeline batch triggered by voice command', {
            commandId,
            processed: result.processed,
            failed: result.failed,
          });
        } catch (error) {
          // Non-fatal: daily cron will retry pipeline items
          logger.warn('Pipeline batch trigger failed (cron will retry)', {
            commandId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      // 7. Return command ID for client subscription
      return NextResponse.json({
        success: true,
        commandId,
        requestId: feedResult.requestId,
      });
    }
  )
);
