/**
 * =============================================================================
 * TELEGRAM WEBHOOK HANDLER - ENTRY POINT
 * =============================================================================
 *
 * Thin entry point for Telegram webhook. Delegates to:
 * - telegram-security.ts — secret token validation
 * - telegram-processing.ts — update processing orchestrator
 * - telegram-pipeline.ts — AI pipeline integration
 *
 * @module api/communications/webhooks/telegram/handler
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse, after } from 'next/server';
import { isFirebaseAvailable } from './firebase/availability';
import { sendTelegramMessage } from './telegram/client';
import type { TelegramMessage } from './telegram/types';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { captureException as sentryCaptureException } from '@/lib/telemetry/sentry';
import { validateSecretToken } from './telegram-security';
import { processTelegramUpdate } from './telegram-processing';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('TelegramHandler');

// ============================================================================
// DEDUPLICATION: Prevent Telegram retry from processing same message twice
// Telegram retries webhooks if response takes >15s — this guard ignores dupes.
// ============================================================================

const PROCESSED_UPDATES = new Set<number>();
const MAX_PROCESSED_SIZE = 500;

function isDuplicateUpdate(updateId: number): boolean {
  if (PROCESSED_UPDATES.has(updateId)) return true;
  PROCESSED_UPDATES.add(updateId);
  // Prune old entries to prevent memory leak
  if (PROCESSED_UPDATES.size > MAX_PROCESSED_SIZE) {
    const oldest = [...PROCESSED_UPDATES].slice(0, 100);
    oldest.forEach(id => PROCESSED_UPDATES.delete(id));
  }
  return false;
}

/**
 * Handles POST requests from the main route file.
 * @enterprise Security-first: validates secret token before processing
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    logger.info('Telegram webhook received');

    // 1. SECURITY: Validate secret token (FAIL-CLOSED in production)
    const secretValidation = validateSecretToken(request);
    if (!secretValidation.valid) {
      // AUDIT LOG: Security rejection event
      logger.error('Webhook rejected', { error: secretValidation.error, ip: request.headers.get('x-forwarded-for') || 'unknown' });
      // B7 FIX: Return 200 to stop Telegram retries, with rejection metadata for audit
      // Enterprise policy: Acknowledge receipt but indicate rejection in body
      return NextResponse.json({ ok: true, rejected: true, error: secretValidation.error }, { status: 200 });
    }

    // 2. Parse webhook JSON first (no Firebase needed — pure HTTP parsing)
    let webhookData: TelegramMessage;
    try {
      webhookData = await request.json() as TelegramMessage;
    } catch {
      logger.warn('Empty or malformed webhook body — ignoring');
      return NextResponse.json({ ok: true, status: 'empty_body' }, { status: 200 });
    }
    const webhookChatId = webhookData.message?.chat?.id
      ?? webhookData.callback_query?.message?.chat?.id;

    // 2b. ADR-259C: Check Firebase availability — send user message if unavailable
    if (!isFirebaseAvailable()) {
      logger.warn('Firebase not available, notifying user');
      if (webhookChatId) {
        const { createDatabaseUnavailableResponse } = await import('./message/responses');
        await sendTelegramMessage(createDatabaseUnavailableResponse(webhookChatId));
      }
      return NextResponse.json({ ok: true, status: 'firebase_unavailable' });
    }

    // 3a. DEDUPLICATION: Telegram retries if response >15s — ignore duplicates
    const updateId = webhookData.update_id;
    if (updateId && isDuplicateUpdate(updateId)) {
      logger.info('Duplicate update_id ignored', { updateId });
      return NextResponse.json({ ok: true, status: 'duplicate_ignored' });
    }

    logger.info('Processing webhook data');

    const updateResult = await processTelegramUpdate(webhookData);

    // ── ADR-134: Trigger AI pipeline worker after response ──
    // Same pattern as Mailgun webhook: "Respond Fast, Process After"
    // Runs processAIPipelineBatch() after the 200 response is sent to Telegram.
    // ADR-156: Also trigger for voice messages (no text but has voice)
    // Phase 6F: Also trigger for suggestion callback re-feeds
    const rawText = webhookData.message?.text ?? webhookData.message?.caption ?? '';
    const hasVoice = !!webhookData.message?.voice;
    // ADR-055: Media-only messages (photo/document without caption) must also trigger pipeline
    const hasMediaContent = !!(webhookData.message?.photo || webhookData.message?.document
      || webhookData.message?.video || webhookData.message?.audio || webhookData.message?.voice);
    const isBotCmd = rawText.startsWith('/');
    const needsBatch = (!isBotCmd && (rawText.trim().length > 0 || hasVoice || hasMediaContent))
      || updateResult.needsPipelineBatch;
    if (needsBatch && isFirebaseAvailable()) {
      after(async () => {
        try {
          const { processAIPipelineBatch } = await import(
            '@/server/ai/workers/ai-pipeline-worker'
          );
          const result = await processAIPipelineBatch();
          logger.info('[Telegram->Pipeline] after(): batch complete', { processed: result.processed, failed: result.failed });
        } catch (error) {
          // Non-fatal: daily cron will retry pipeline items
          logger.warn('[Telegram->Pipeline] after(): pipeline batch failed (cron will retry)', {
            error: getErrorMessage(error),
          });
        }
      });
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    logger.error('Telegram webhook error', { error });
    // ADR-259D: Capture webhook errors in Sentry
    sentryCaptureException(error, {
      tags: { component: 'telegram-webhook' },
      extra: { source: 'handlePOST' },
    });
    return NextResponse.json({ ok: true, error: 'internal_error' });
  }
}

/**
 * Handles GET requests from the main route file.
 */
export async function handleGET(): Promise<NextResponse> {
    // ── UC-011 Diagnostic: trace project→building→phase chain ──
    let diagnostic: Record<string, unknown> = {};
    if (isFirebaseAvailable()) {
      try {
        const { getAdminFirestore } = await import('@/lib/firebaseAdmin');
        const { COLLECTIONS } = await import('@/config/firestore-collections');
        const { FIELDS } = await import('@/config/firestore-field-constants');
        const adminDb = getAdminFirestore();

        const companyId = getCompanyId();

        // Step 1: Projects
        const projectsSnap = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where(FIELDS.COMPANY_ID, '==', companyId)
          .limit(10)
          .get();

        const projects = projectsSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name ?? d.data().title ?? '?',
          companyId: d.data().companyId ?? null,
        }));

        // Step 2: Buildings by projectId
        const projectIds = projects.map(p => p.id);
        let buildings: Array<{ id: string; name: string; projectId: string }> = [];
        if (projectIds.length > 0) {
          const buildSnap = await adminDb
            .collection(COLLECTIONS.BUILDINGS)
            .where(FIELDS.PROJECT_ID, 'in', projectIds.slice(0, 30))
            .get();
          buildings = buildSnap.docs.map(d => ({
            id: d.id,
            name: (d.data().name as string) ?? '?',
            projectId: (d.data().projectId as string) ?? '?',
          }));
        }

        // Step 3: Construction phases by buildingId
        const buildingIds = buildings.map(b => b.id);
        let phases: Array<{ id: string; buildingId: string; name: string }> = [];
        if (buildingIds.length > 0) {
          const phaseSnap = await adminDb
            .collection(COLLECTIONS.CONSTRUCTION_PHASES)
            .where(FIELDS.BUILDING_ID, 'in', buildingIds.slice(0, 30))
            .limit(50)
            .get();
          phases = phaseSnap.docs.map(d => ({
            id: d.id,
            buildingId: (d.data().buildingId as string) ?? '?',
            name: (d.data().name as string) ?? '?',
          }));
        }

        // Step 4: Search ALL construction_phases (no filter) to find Gantt data
        const allPhasesSnap = await adminDb
          .collection(COLLECTIONS.CONSTRUCTION_PHASES)
          .limit(10)
          .get();
        const allPhases = allPhasesSnap.docs.map(d => ({
          id: d.id,
          buildingId: d.data().buildingId ?? null,
          companyId: d.data().companyId ?? null,
          name: d.data().name ?? '?',
        }));

        // Step 5: Search ALL buildings (no filter) to find "kados"/"1524"
        const allBuildingsSnap = await adminDb
          .collection(COLLECTIONS.BUILDINGS)
          .limit(20)
          .get();
        const allBuildings = allBuildingsSnap.docs.map(d => ({
          id: d.id,
          name: (d.data().name as string) ?? '?',
          projectId: d.data().projectId ?? null,
          companyId: d.data().companyId ?? null,
        }));

        // ADR-171: Clear poisoned chat history for super admin
        let chatHistoryCleared = false;
        try {
          const { getChatHistoryService } = await import(
            '@/services/ai-pipeline/chat-history-service'
          );
          const chatService = getChatHistoryService();
          // Super admin Telegram userId from ADR-145
          await chatService.clearHistory('telegram_5618410820');
          chatHistoryCleared = true;
        } catch {
          chatHistoryCleared = false;
        }

        diagnostic = {
          companyId,
          chat_history_cleared: chatHistoryCleared,
          step1_projects: { count: projects.length, data: projects },
          step2_buildings_by_projectId: { count: buildings.length, data: buildings },
          step3_phases_by_buildingId: { count: phases.length, data: phases.slice(0, 10) },
          global_all_phases: { count: allPhases.length, data: allPhases },
          global_all_buildings: { count: allBuildings.length, data: allBuildings },
        };
      } catch (err) {
        diagnostic = { error: getErrorMessage(err) };
      }
    }

    return NextResponse.json({
        status: 'Telegram webhook endpoint is working',
        timestamp: nowISO(),
        firebase_available: isFirebaseAvailable(),
        uc011_diagnostic: diagnostic,
        features: [
          'Real property search',
          'Smart natural language processing',
          'Security controls',
          'CRM integration',
          'Build-safe operation'
        ]
    });
}
