/**
 * =============================================================================
 * TELEGRAM WEBHOOK HANDLER - ENTERPRISE SECURITY
 * =============================================================================
 *
 * Handles incoming Telegram webhook requests with enterprise security:
 * - Secret token validation (fail-closed)
 * - Rate limiting via bot-security.ts
 * - CRM integration with conversation model
 *
 * @module api/communications/webhooks/telegram/handler
 * @enterprise ADR-029 - Omnichannel Conversation Model
 */

import { type NextRequest, NextResponse, after } from 'next/server';
import { isFirebaseAvailable } from './firebase/availability';
import { processMessage } from './message/process-message';
import { handleCallbackQuery } from './message/callback-query';
import { sendTelegramMessage } from './telegram/client';
import { storeMessageInCRM } from './crm/store';
import { BOT_IDENTITY } from '@/config/domain-constants';
import type { TelegramMessage, TelegramSendPayload } from './telegram/types';
import { transcribeVoiceMessage } from './telegram/whisper-transcription';

// ============================================================================
// SECURITY: SECRET TOKEN VALIDATION (B5 - Enterprise Policy Documentation)
// ============================================================================
//
// WEBHOOK SECRET TOKEN VALIDATION POLICY
// =====================================
//
// 1. HOW IT WORKS:
//    - When you call Telegram's setWebhook API, you can set a `secret_token`
//    - Telegram will then send this token in the `X-Telegram-Bot-Api-Secret-Token` header
//    - We validate this header matches our configured secret
//
// 2. SECURITY MODEL (FAIL-CLOSED):
//    - Production (NODE_ENV=production): ALWAYS validates, rejects if not configured
//    - Development: Can be bypassed via TELEGRAM_ENFORCE_SECRET=false
//    - Missing secret in production = REJECT (not fail-open)
//    - Invalid secret = REJECT
//
// 3. RESPONSE POLICY:
//    - On rejection: Return HTTP 200 with { ok: true, rejected: true, error: '...' }
//    - WHY 200 for rejections? Telegram retries webhooks on 4xx/5xx status codes.
//      Returning 200 acknowledges receipt and stops retries, while the body
//      indicates the rejection reason for audit/monitoring purposes.
//    - ENTERPRISE DECISION: We explicitly choose to acknowledge unauthorized
//      requests to prevent retry loops. All rejections are audit-logged.
//    - Reference: Telegram Bot API retry behavior documentation
//
// 4. MONITORING & OBSERVABILITY:
//    - All rejections are logged with emoji prefixes for easy grep:
//      🚨 = Critical (secret not configured in production)
//      🔒 = Security event (invalid/missing token)
//      🚫 = Rejection summary
//    - Integration with getWebhookInfo monitoring:
//      - pending_update_count: High values may indicate webhook issues
//      - last_error_date/last_error_message: Telegram-side errors
//
// 5. SETUP REQUIREMENTS:
//    - Set TELEGRAM_WEBHOOK_SECRET in environment (Vercel/Firebase secrets)
//    - Call setWebhook with same secret_token value
//    - Verify with getWebhookInfo that webhook is properly configured
//
// ============================================================================

/**
 * Telegram webhook secret token from environment
 * @enterprise Set via Vercel/Firebase secrets - NEVER hardcode
 */
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Whether to enforce secret token validation
 * @enterprise Set to true in production, can be false for development
 */
const ENFORCE_SECRET_VALIDATION = process.env.NODE_ENV === 'production' ||
  process.env.TELEGRAM_ENFORCE_SECRET === 'true';

/**
 * Validate Telegram webhook secret token
 *
 * @enterprise FAIL-CLOSED: Rejects if secret not configured or mismatched
 *
 * @returns {valid: boolean, error?: string}
 * - valid=true: Request passes validation
 * - valid=false: Request rejected, error contains reason code
 *
 * Error codes:
 * - 'webhook_secret_not_configured': Production without TELEGRAM_WEBHOOK_SECRET
 * - 'missing_secret_token': Request missing X-Telegram-Bot-Api-Secret-Token header
 * - 'invalid_secret_token': Token doesn't match configured secret
 */
function validateSecretToken(request: NextRequest): { valid: boolean; error?: string } {
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');

  // Development mode bypass (if not enforced)
  if (!ENFORCE_SECRET_VALIDATION) {
    if (!secretHeader) {
      console.warn('⚠️ [DEV] No secret token provided, allowing (enforcement disabled)');
    }
    return { valid: true };
  }

  // Production: FAIL-CLOSED
  if (!TELEGRAM_WEBHOOK_SECRET) {
    console.error('🚨 SECURITY: TELEGRAM_WEBHOOK_SECRET not configured - rejecting request');
    return { valid: false, error: 'webhook_secret_not_configured' };
  }

  if (!secretHeader) {
    console.warn('🔒 Security: Missing X-Telegram-Bot-Api-Secret-Token header');
    return { valid: false, error: 'missing_secret_token' };
  }

  if (secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
    console.warn('🔒 Security: Invalid secret token');
    return { valid: false, error: 'invalid_secret_token' };
  }

  return { valid: true };
}

/**
 * Main orchestrator for handling incoming Telegram webhook requests.
 */
async function processTelegramUpdate(webhookData: TelegramMessage): Promise<void> {
  let telegramResponse: TelegramSendPayload | null = null;

  if (webhookData.message) {
    const messageText = webhookData.message.text ?? '';

    // ── ADR-156: Voice Transcription ──
    let effectiveMessageText = messageText;
    let isVoiceTranscription = false;

    if (!effectiveMessageText && webhookData.message.voice) {
      console.log('🎤 Voice message detected — attempting Whisper transcription...');
      const transcription = await transcribeVoiceMessage(
        webhookData.message.voice.file_id
      );
      if (transcription.success && transcription.text) {
        effectiveMessageText = transcription.text;
        isVoiceTranscription = true;
        console.log(`🎤 Transcription OK: "${effectiveMessageText.substring(0, 80)}..."`);
      } else {
        effectiveMessageText = '[Voice message]';
        console.warn(`🎤 Transcription failed: ${transcription.error}`);
      }
    }

    // Caption fallback for photos/documents without text
    if (!effectiveMessageText && webhookData.message.caption) {
      effectiveMessageText = webhookData.message.caption;
    }

    const isBotCommand = effectiveMessageText.startsWith('/');

    // ── ADR-145: Super Admin Detection ──
    // Check if sender is a super admin BEFORE generic bot response
    let isAdminSender = false;
    if (!isBotCommand && effectiveMessageText.trim().length > 0 && isFirebaseAvailable()) {
      try {
        const userId = String(webhookData.message.from?.id ?? '');
        if (userId && userId !== 'unknown') {
          const { isSuperAdminTelegram } = await import(
            '@/services/ai-pipeline/shared/super-admin-resolver'
          );
          const adminResolution = await isSuperAdminTelegram(userId);
          isAdminSender = adminResolution !== null;
        }
      } catch {
        // Non-fatal: if admin check fails, proceed as normal customer
      }
    }

    if (isAdminSender) {
      // Admin message: Send immediate ack, skip generic bot response
      // The pipeline will handle the response via UC modules
      console.log('🛡️ Super admin detected — skipping bot response, pipeline will handle');
      await sendTelegramMessage({
        chat_id: webhookData.message.chat.id,
        text: '⏳ Επεξεργάζομαι την εντολή σας...',
      });
    } else {
      console.log('💬 Processing regular message');
      telegramResponse = await processMessage(webhookData.message, effectiveMessageText);
    }

    // ── ADR-132: Feed to AI Pipeline ──
    // Await enqueue to ensure item is in queue before after() batch runs.
    // Non-fatal: pipeline failure should never break the Telegram bot.
    if (!isBotCommand && effectiveMessageText.trim().length > 0 && isFirebaseAvailable()) {
      await feedTelegramToPipeline(webhookData.message, effectiveMessageText);
    }

  }

  if (webhookData.callback_query) {
    console.log('🎯 Processing callback query');
    telegramResponse = await handleCallbackQuery(webhookData.callback_query);
  }

  // Send response to Telegram if we have one
  if (telegramResponse) {
    const sentResult = await sendTelegramMessage(telegramResponse);
    console.log('📤 Telegram response sent:', sentResult.success);

    // Store outbound message if Firebase is available - using domain constants (B3 fix)
    // B6 FIX: Use REAL provider message_id from Telegram response, not Date.now()
    if (sentResult.success && isFirebaseAvailable() && telegramResponse.text) {
      // Extract real message_id from Telegram API response
      const apiResult = sentResult.result?.result;
      const providerMessageId = typeof apiResult === 'object' && apiResult && 'message_id' in apiResult
        ? apiResult.message_id
        : null;

      // Only store outbound message if we have a real provider message_id
      // This ensures proper idempotency and traceability
      if (providerMessageId) {
        await storeMessageInCRM({
          chat: { id: telegramResponse.chat_id },
          from: { id: BOT_IDENTITY.ID, first_name: BOT_IDENTITY.DISPLAY_NAME },
          text: telegramResponse.text,
          message_id: providerMessageId
        }, 'outbound');
      } else {
        console.warn('⚠️ Outbound message not stored: no provider message_id in response');
      }
    }
  }
}

/**
 * Feed a Telegram message to the AI Pipeline.
 *
 * Awaitable to ensure enqueue completes before after() batch processing.
 * Non-fatal: catches all errors so pipeline failure never breaks the bot.
 * Uses dynamic import to avoid circular dependency issues.
 *
 * @see ADR-132 (UC Modules Expansion + Telegram Channel)
 */
async function feedTelegramToPipeline(message: TelegramMessage['message'], overrideText?: string): Promise<void> {
  if (!message) return;

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id ?? 'unknown');
  const firstName = message.from?.first_name ?? '';
  const lastName = message.from?.last_name ?? '';
  const userName = [firstName, lastName].filter(Boolean).join(' ') || 'Telegram User';
  const messageText = overrideText ?? message.text ?? '';
  const messageId = String(message.message_id);

  // Default company ID — checks both server-only and NEXT_PUBLIC_ variants
  const companyId = process.env.DEFAULT_COMPANY_ID
    ?? process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID
    ?? 'default';

  try {
    const { TelegramChannelAdapter } = await import(
      '@/services/ai-pipeline/channel-adapters/telegram-channel-adapter'
    );

    const result = await TelegramChannelAdapter.feedToPipeline({
      chatId,
      userId,
      userName,
      messageText,
      messageId,
      companyId,
    });

    if (result.enqueued) {
      console.log(`🤖 [Telegram→Pipeline] Enqueued: ${result.requestId}`);
    } else {
      console.warn(`⚠️ [Telegram→Pipeline] Failed: ${result.error}`);
    }
  } catch (error) {
    // Non-fatal: pipeline failure should never break the Telegram bot
    console.warn('[Telegram→Pipeline] Non-fatal error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handles POST requests from the main route file.
 * @enterprise Security-first: validates secret token before processing
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Telegram webhook received');

    // 1. SECURITY: Validate secret token (FAIL-CLOSED in production)
    const secretValidation = validateSecretToken(request);
    if (!secretValidation.valid) {
      // AUDIT LOG: Security rejection event
      console.error(`🚫 Webhook rejected: ${secretValidation.error} | IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`);
      // B7 FIX: Return 200 to stop Telegram retries, with rejection metadata for audit
      // Enterprise policy: Acknowledge receipt but indicate rejection in body
      return NextResponse.json({ ok: true, rejected: true, error: secretValidation.error }, { status: 200 });
    }

    // 2. Check Firebase availability
    if (!isFirebaseAvailable()) {
      console.warn('⚠️ Firebase not available, returning minimal response');
      return NextResponse.json({ ok: true, status: 'firebase_unavailable' });
    }

    // 3. Parse and process webhook data
    const webhookData = await request.json();
    console.log('📦 Processing webhook data...');

    await processTelegramUpdate(webhookData);

    // ── ADR-134: Trigger AI pipeline worker after response ──
    // Same pattern as Mailgun webhook: "Respond Fast, Process After"
    // Runs processAIPipelineBatch() after the 200 response is sent to Telegram.
    // ADR-156: Also trigger for voice messages (no text but has voice)
    const rawText = webhookData.message?.text ?? webhookData.message?.caption ?? '';
    const hasVoice = !!webhookData.message?.voice;
    const isBotCmd = rawText.startsWith('/');
    if (!isBotCmd && (rawText.trim().length > 0 || hasVoice) && isFirebaseAvailable()) {
      after(async () => {
        try {
          const { processAIPipelineBatch } = await import(
            '@/server/ai/workers/ai-pipeline-worker'
          );
          const result = await processAIPipelineBatch();
          console.log(`🤖 [Telegram→Pipeline] after(): batch processed=${result.processed}, failed=${result.failed}`);
        } catch (error) {
          // Non-fatal: daily cron will retry pipeline items
          console.warn('[Telegram→Pipeline] after(): pipeline batch failed (cron will retry)',
            error instanceof Error ? error.message : String(error));
        }
      });
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('❌ Telegram webhook error:', error);
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
        const adminDb = getAdminFirestore();

        const companyId = (process.env.DEFAULT_COMPANY_ID
          ?? process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID
          ?? 'default').trim();

        // Step 1: Projects
        const projectsSnap = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where('companyId', '==', companyId)
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
            .where('projectId', 'in', projectIds.slice(0, 30))
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
            .where('buildingId', 'in', buildingIds.slice(0, 30))
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

        // Step 6: Test agentic tool executor (ADR-171 diagnostic)
        let agenticTest: Record<string, unknown> = {};
        try {
          const { getAgenticToolExecutor } = await import(
            '@/services/ai-pipeline/tools/agentic-tool-executor'
          );
          const executor = getAgenticToolExecutor();
          const testCtx = {
            companyId,
            isAdmin: true,
            channelSenderId: 'diagnostic_test',
            requestId: 'diag_' + Date.now(),
          };

          // Test 1: Query construction_phases (no filters — what AI would do)
          const phasesResult = await executor.executeTool('firestore_query', {
            collection: 'construction_phases',
            filters: [],
            orderBy: null,
            orderDirection: null,
            limit: 10,
          }, testCtx);

          // Test 2: Query construction_phases with companyId (what AI might do)
          const phasesWithCompanyResult = await executor.executeTool('firestore_query', {
            collection: 'construction_phases',
            filters: [{ field: 'companyId', operator: '==', value: companyId }],
            orderBy: null,
            orderDirection: null,
            limit: 10,
          }, testCtx);

          // Test 3: Query projects (with auto companyId)
          const projectsResult = await executor.executeTool('firestore_query', {
            collection: 'projects',
            filters: [],
            orderBy: null,
            orderDirection: null,
            limit: 10,
          }, testCtx);

          agenticTest = {
            phases_no_filter: phasesResult,
            phases_with_companyId: phasesWithCompanyResult,
            projects_auto_companyId: projectsResult,
          };
        } catch (agenticErr) {
          agenticTest = { error: agenticErr instanceof Error ? agenticErr.message : String(agenticErr) };
        }

        diagnostic = {
          companyId,
          step1_projects: { count: projects.length, data: projects },
          step2_buildings_by_projectId: { count: buildings.length, data: buildings },
          step3_phases_by_buildingId: { count: phases.length, data: phases.slice(0, 10) },
          global_all_phases: { count: allPhases.length, data: allPhases },
          global_all_buildings: { count: allBuildings.length, data: allBuildings },
          agentic_executor_test: agenticTest,
        };
      } catch (err) {
        diagnostic = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    return NextResponse.json({
        status: 'Telegram webhook endpoint is working',
        timestamp: new Date().toISOString(),
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
