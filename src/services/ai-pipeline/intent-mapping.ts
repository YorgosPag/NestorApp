/**
 * =============================================================================
 * INTENT MAPPING — Pure Functions
 * =============================================================================
 *
 * Maps AI analysis results to pipeline UnderstandingResult types.
 * Handles both multi-intent (ADR-131) and legacy single-intent responses.
 *
 * Extracted from pipeline-orchestrator.ts for SRP compliance (N.7.1).
 *
 * @module services/ai-pipeline/intent-mapping
 * @see ADR-131 (Multi-Intent Pipeline)
 * @see ADR-080 (Pipeline Implementation)
 */

import type {
  PipelineContext,
  UnderstandingResult,
  DetectedIntent,
} from '@/types/ai-pipeline';
import {
  PipelineIntentType,
  SenderType,
  ThreatLevel,
  Urgency,
} from '@/types/ai-pipeline';
import type { PipelineIntentTypeValue } from '@/types/ai-pipeline';
import { isMessageIntentAnalysis, isMultiIntentAnalysis } from '@/schemas/ai-analysis';
import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';

// ============================================================================
// LEGACY INTENT MAPPING
// ============================================================================

/**
 * Map legacy intent types (from existing AI provider) to pipeline intent types
 * @see src/schemas/ai-analysis.ts IntentType enum
 */
export function mapLegacyIntentToPipeline(legacyIntent: string): PipelineIntentTypeValue {
  const mapping: Record<string, PipelineIntentTypeValue> = {
    'appointment': PipelineIntentType.APPOINTMENT_REQUEST,
    'appointment_request': PipelineIntentType.APPOINTMENT_REQUEST,
    'delivery': PipelineIntentType.PROCUREMENT_REQUEST,
    'invoice': PipelineIntentType.INVOICE,
    'payment': PipelineIntentType.PAYMENT_NOTIFICATION,
    'issue': PipelineIntentType.COMPLAINT,
    'defect_report': PipelineIntentType.DEFECT_REPORT,
    'complaint': PipelineIntentType.COMPLAINT,
    'general_inquiry': PipelineIntentType.GENERAL_INQUIRY,
    'info_update': PipelineIntentType.UNKNOWN,
    'triage_needed': PipelineIntentType.UNKNOWN,
    'document_request': PipelineIntentType.DOCUMENT_REQUEST,
    'property_search': PipelineIntentType.PROPERTY_SEARCH,
    'outbound_send': PipelineIntentType.OUTBOUND_SEND,
    'report_request': PipelineIntentType.REPORT_REQUEST,
    'dashboard_query': PipelineIntentType.DASHBOARD_QUERY,
    'status_inquiry': PipelineIntentType.STATUS_INQUIRY,
    'procurement_request': PipelineIntentType.PROCUREMENT_REQUEST,
    'payment_notification': PipelineIntentType.PAYMENT_NOTIFICATION,
    'unknown': PipelineIntentType.UNKNOWN,
    // ── ADR-145: Super Admin Command Intents ──
    'admin_contact_search': PipelineIntentType.ADMIN_CONTACT_SEARCH,
    'admin_project_status': PipelineIntentType.ADMIN_PROJECT_STATUS,
    'admin_send_email': PipelineIntentType.ADMIN_SEND_EMAIL,
    'admin_property_stats': PipelineIntentType.ADMIN_PROPERTY_STATS,
    'admin_create_contact': PipelineIntentType.ADMIN_CREATE_CONTACT,
    'admin_update_contact': PipelineIntentType.ADMIN_UPDATE_CONTACT,
    'admin_general_question': PipelineIntentType.ADMIN_GENERAL_QUESTION,
  };

  return mapping[legacyIntent] ?? PipelineIntentType.UNKNOWN;
}

// ============================================================================
// AI RESULT → UNDERSTANDING MAPPING
// ============================================================================

/**
 * Map existing AI analysis result to pipeline UnderstandingResult.
 * Handles both multi_intent (new) and message_intent (legacy) responses.
 *
 * @param ctx - Pipeline context (for intake ID and company)
 * @param aiResult - Raw AI analysis result
 * @param aiProviderName - Name of the AI provider (for rationale)
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export function mapAIResultToUnderstanding(
  ctx: PipelineContext,
  aiResult: unknown,
  aiProviderName: string
): UnderstandingResult {
  const typedResult = aiResult as Record<string, unknown>;
  const entities = (typedResult.extractedEntities ?? {}) as Record<string, string | undefined>;

  // ── Multi-Intent Response (new schema) ──
  if (isMultiIntentAnalysis(typedResult as Parameters<typeof isMultiIntentAnalysis>[0])) {
    const multiResult = typedResult as {
      primaryIntent: { intentType: string; confidence: number; rationale: string };
      secondaryIntents: Array<{ intentType: string; confidence: number; rationale: string }>;
      confidence: number;
    };

    const primaryIntent = mapLegacyIntentToPipeline(multiResult.primaryIntent.intentType);
    const primaryConfidence = multiResult.primaryIntent.confidence * 100;
    const primaryRationale = multiResult.primaryIntent.rationale;

    // Build detectedIntents array: primary first, then secondaries
    const detectedIntents: DetectedIntent[] = [
      {
        intent: primaryIntent,
        confidence: primaryConfidence,
        rationale: primaryRationale,
      },
      ...multiResult.secondaryIntents.map(si => ({
        intent: mapLegacyIntentToPipeline(si.intentType),
        confidence: si.confidence * 100,
        rationale: si.rationale,
      })),
    ];

    return {
      messageId: ctx.intake.id,
      intent: primaryIntent,
      entities,
      confidence: primaryConfidence,
      rationale: primaryRationale,
      language: 'el',
      urgency: Urgency.NORMAL,
      policyFlags: [],
      companyDetection: {
        companyId: ctx.companyId,
        signal: 'recipient_email',
        confidence: 100,
      },
      senderType: SenderType.UNKNOWN_LEGITIMATE,
      threatLevel: ThreatLevel.CLEAN,
      detectedIntents,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Legacy Single-Intent Response (backward compatible) ──
  let intent: PipelineIntentTypeValue = PipelineIntentType.UNKNOWN;
  if (isMessageIntentAnalysis(typedResult as Parameters<typeof isMessageIntentAnalysis>[0])) {
    const analysisResult = typedResult as { intentType?: string };
    intent = mapLegacyIntentToPipeline(analysisResult.intentType ?? 'triage_needed');
  }

  const confidence = typeof typedResult.confidence === 'number'
    ? typedResult.confidence * 100
    : 0;

  const rationale = `AI analysis via ${aiProviderName}`;

  return {
    messageId: ctx.intake.id,
    intent,
    entities,
    confidence,
    rationale,
    language: 'el',
    urgency: Urgency.NORMAL,
    policyFlags: [],
    companyDetection: {
      companyId: ctx.companyId,
      signal: 'recipient_email',
      confidence: 100,
    },
    senderType: SenderType.UNKNOWN_LEGITIMATE,
    threatLevel: ThreatLevel.CLEAN,
    detectedIntents: [{ intent, confidence, rationale }],
    schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
  };
}
