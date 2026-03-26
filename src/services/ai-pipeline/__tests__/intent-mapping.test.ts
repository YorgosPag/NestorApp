/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * INTENT MAPPING — Unit Tests
 * =============================================================================
 *
 * Tests for mapLegacyIntentToPipeline and mapAIResultToUnderstanding.
 *
 * @module tests/ai-pipeline/intent-mapping
 * @see ADR-131 (Multi-Intent Pipeline)
 * @see ADR-080 (Pipeline Implementation)
 */

jest.mock('@/schemas/ai-analysis', () => ({
  isMultiIntentAnalysis: jest.fn(() => false),
  isMessageIntentAnalysis: jest.fn(() => false),
}));

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: '2.0' },
}));

jest.mock('@/types/ai-pipeline', () => ({
  PipelineIntentType: {
    APPOINTMENT_REQUEST: 'appointment_request',
    PROCUREMENT_REQUEST: 'procurement_request',
    INVOICE: 'invoice',
    PAYMENT_NOTIFICATION: 'payment_notification',
    COMPLAINT: 'complaint',
    DEFECT_REPORT: 'defect_report',
    GENERAL_INQUIRY: 'general_inquiry',
    DOCUMENT_REQUEST: 'document_request',
    PROPERTY_SEARCH: 'property_search',
    OUTBOUND_SEND: 'outbound_send',
    REPORT_REQUEST: 'report_request',
    DASHBOARD_QUERY: 'dashboard_query',
    STATUS_INQUIRY: 'status_inquiry',
    UNKNOWN: 'unknown',
    ADMIN_CONTACT_SEARCH: 'admin_contact_search',
    ADMIN_PROJECT_STATUS: 'admin_project_status',
    ADMIN_SEND_EMAIL: 'admin_send_email',
    ADMIN_UNIT_STATS: 'admin_unit_stats',
    ADMIN_CREATE_CONTACT: 'admin_create_contact',
    ADMIN_UPDATE_CONTACT: 'admin_update_contact',
    ADMIN_GENERAL_QUESTION: 'admin_general_question',
  },
  SenderType: { UNKNOWN_LEGITIMATE: 'unknown_legitimate' },
  ThreatLevel: { CLEAN: 'clean' },
  Urgency: { NORMAL: 'normal' },
}));

import {
  mapLegacyIntentToPipeline,
  mapAIResultToUnderstanding,
} from '../intent-mapping';
import { isMultiIntentAnalysis, isMessageIntentAnalysis } from '@/schemas/ai-analysis';

const mockIsMultiIntent = isMultiIntentAnalysis as jest.Mock;
const mockIsMessageIntent = isMessageIntentAnalysis as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCtx() {
  return {
    intake: { id: 'intake_001' },
    companyId: 'comp_test',
  };
}

// ---------------------------------------------------------------------------
// mapLegacyIntentToPipeline
// ---------------------------------------------------------------------------

describe('mapLegacyIntentToPipeline', () => {
  it('maps "appointment" to APPOINTMENT_REQUEST', () => {
    expect(mapLegacyIntentToPipeline('appointment')).toBe('appointment_request');
  });

  it('maps "appointment_request" alias to APPOINTMENT_REQUEST', () => {
    expect(mapLegacyIntentToPipeline('appointment_request')).toBe('appointment_request');
  });

  it('maps "complaint" to COMPLAINT', () => {
    expect(mapLegacyIntentToPipeline('complaint')).toBe('complaint');
  });

  it('maps "defect_report" to DEFECT_REPORT', () => {
    expect(mapLegacyIntentToPipeline('defect_report')).toBe('defect_report');
  });

  it('maps "property_search" to PROPERTY_SEARCH', () => {
    expect(mapLegacyIntentToPipeline('property_search')).toBe('property_search');
  });

  it('maps "admin_contact_search" to ADMIN_CONTACT_SEARCH', () => {
    expect(mapLegacyIntentToPipeline('admin_contact_search')).toBe('admin_contact_search');
  });

  it('maps "admin_send_email" to ADMIN_SEND_EMAIL', () => {
    expect(mapLegacyIntentToPipeline('admin_send_email')).toBe('admin_send_email');
  });

  it('maps "info_update" to UNKNOWN', () => {
    expect(mapLegacyIntentToPipeline('info_update')).toBe('unknown');
  });

  it('maps "triage_needed" to UNKNOWN', () => {
    expect(mapLegacyIntentToPipeline('triage_needed')).toBe('unknown');
  });

  it('falls back to UNKNOWN for unrecognised strings', () => {
    expect(mapLegacyIntentToPipeline('foobar')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// mapAIResultToUnderstanding
// ---------------------------------------------------------------------------

describe('mapAIResultToUnderstanding', () => {
  beforeEach(() => {
    mockIsMultiIntent.mockReset().mockReturnValue(false);
    mockIsMessageIntent.mockReset().mockReturnValue(false);
  });

  // ── Multi-Intent path ──

  it('builds detectedIntents with primary + secondary for multi-intent result', () => {
    mockIsMultiIntent.mockReturnValue(true);

    const aiResult = {
      primaryIntent: { intentType: 'complaint', confidence: 0.9, rationale: 'angry' },
      secondaryIntents: [
        { intentType: 'invoice', confidence: 0.4, rationale: 'mentions bill' },
      ],
      confidence: 0.9,
      extractedEntities: {},
    };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.detectedIntents).toHaveLength(2);
    expect(result.detectedIntents[0].intent).toBe('complaint');
    expect(result.detectedIntents[1].intent).toBe('invoice');
  });

  it('scales multi-intent confidence from 0-1 to 0-100', () => {
    mockIsMultiIntent.mockReturnValue(true);

    const aiResult = {
      primaryIntent: { intentType: 'complaint', confidence: 0.85, rationale: 'r' },
      secondaryIntents: [],
      confidence: 0.85,
      extractedEntities: {},
    };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.confidence).toBe(85);
  });

  it('extracts entities from extractedEntities for multi-intent result', () => {
    mockIsMultiIntent.mockReturnValue(true);

    const aiResult = {
      primaryIntent: { intentType: 'appointment', confidence: 0.8, rationale: 'r' },
      secondaryIntents: [],
      confidence: 0.8,
      extractedEntities: { date: '2026-04-01', time: '10:00' },
    };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.entities).toEqual({ date: '2026-04-01', time: '10:00' });
  });

  it('sets schemaVersion from PIPELINE_PROTOCOL_CONFIG for multi-intent result', () => {
    mockIsMultiIntent.mockReturnValue(true);

    const aiResult = {
      primaryIntent: { intentType: 'complaint', confidence: 0.7, rationale: 'r' },
      secondaryIntents: [],
      confidence: 0.7,
      extractedEntities: {},
    };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.schemaVersion).toBe('2.0');
  });

  // ── Legacy single-intent path ──

  it('maps intentType correctly for legacy single-intent result', () => {
    mockIsMessageIntent.mockReturnValue(true);

    const aiResult = { intentType: 'invoice', confidence: 0.6, extractedEntities: {} };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.intent).toBe('invoice');
  });

  it('scales legacy confidence from 0-1 to 0-100', () => {
    mockIsMessageIntent.mockReturnValue(true);

    const aiResult = { intentType: 'complaint', confidence: 0.7, extractedEntities: {} };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.confidence).toBe(70);
  });

  it('includes provider name in rationale for legacy result', () => {
    mockIsMessageIntent.mockReturnValue(true);

    const aiResult = { intentType: 'complaint', confidence: 0.5, extractedEntities: {} };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'my-provider');

    expect(result.rationale).toBe('AI analysis via my-provider');
  });

  // ── Neither schema matched ──

  it('returns UNKNOWN intent with confidence 0 when neither schema matches', () => {
    const aiResult = { someRandomField: true };

    const result = mapAIResultToUnderstanding(createMockCtx() as never, aiResult, 'openai');

    expect(result.intent).toBe('unknown');
    expect(result.confidence).toBe(0);
  });
});
