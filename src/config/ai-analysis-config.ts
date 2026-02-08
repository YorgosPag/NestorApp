/**
 * =============================================================================
 * AI ANALYSIS CONFIGURATION - CENTRALIZED SETTINGS
 * =============================================================================
 *
 * Centralized configuration for AI analysis providers and defaults.
 * This keeps all provider-level constants in one place.
 */

import { IntentType, DocumentType } from '@/schemas/ai-analysis';

export const AI_PROVIDER_IDS = {
  MOCK: 'mock',
  OPENAI: 'openai',
} as const;

export type AIProviderId = typeof AI_PROVIDER_IDS[keyof typeof AI_PROVIDER_IDS];

export const AI_ANALYSIS_DEFAULTS = {
  PROVIDER: process.env.AI_PROVIDER,
  FALLBACK_CONFIDENCE: 0.5,
  FALLBACK_NEEDS_TRIAGE: true,
  FALLBACK_INTENT: 'triage_needed',
  FALLBACK_DOCUMENT: 'other',
  OPENAI: {
    BASE_URL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    TEXT_MODEL: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    VISION_MODEL: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
    TIMEOUT_MS: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10),
    MAX_RETRIES: Number.parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10),
  },
} as const;

export const AI_ANALYSIS_PROMPTS = {
  MESSAGE_INTENT_SYSTEM: `You are an AI classifier for a Greek real estate & construction management company (κτηματομεσιτικό/κατασκευαστικό γραφείο). Analyze incoming messages and return JSON matching the schema.

INTENT TYPES (choose the most specific match):
- appointment_request: Request for a meeting, viewing, or appointment (ραντεβού, συνάντηση, επίσκεψη)
- property_search: Inquiry about available properties, units, apartments, studios, pricing (αναζήτηση ακινήτου, διαθέσιμα, τιμές, τ.μ.)
- invoice: Invoice submission or inquiry (τιμολόγιο)
- payment / payment_notification: Payment confirmation or notice (πληρωμή, κατάθεση)
- defect_report / issue: Report of a defect, damage, or problem (βλάβη, πρόβλημα, ζημιά)
- delivery / procurement_request: Material delivery or procurement (παράδοση υλικών, προμήθεια)
- document_request: Request for documents, certificates, plans (αίτημα εγγράφου, κάτοψη, πιστοποιητικό)
- status_inquiry: Status check on order, construction, project (ερώτηση κατάστασης, πρόοδος)
- report_request: Request for a report (αίτημα αναφοράς)
- info_update: General information update
- triage_needed: Cannot determine intent with confidence

RULES:
- Prefer specific intents over generic ones
- Set confidence 0.0-1.0 reflecting your certainty
- Set needsTriage=true if confidence < 0.6
- Extract entities when identifiable (projectId, unitId, etc.)
- Messages in Greek (el) are expected`,
  DOCUMENT_CLASSIFY_SYSTEM:
    'You are an enterprise document classifier for a Greek real estate & construction company. Return JSON only, matching the schema. Classify the document type and signals.',
} as const;

const intentOptions = IntentType.options;
const documentOptions = DocumentType.options;

export const AI_ANALYSIS_JSON_SCHEMA = {
  name: 'ai_analysis_result',
  description: 'AI analysis result for message intent or document classification.',
  strict: true,
  schema: {
    type: 'object',
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind',
          'aiModel',
          'analysisTimestamp',
          'confidence',
          'needsTriage',
          'extractedEntities',
          'intentType',
          'rawMessage',
        ],
        properties: {
          kind: { type: 'string', enum: ['message_intent'] },
          aiModel: { type: 'string' },
          analysisTimestamp: { type: 'string', format: 'date-time' },
          confidence: { type: 'number' },
          needsTriage: { type: 'boolean' },
          extractedEntities: {
            type: 'object',
            additionalProperties: false,
            properties: {
              companyId: { type: 'string' },
              projectId: { type: 'string' },
              buildingId: { type: 'string' },
              unitId: { type: 'string' },
              contactId: { type: 'string' },
            },
          },
          intentType: { type: 'string', enum: intentOptions },
          eventDate: { type: 'string', format: 'date-time' },
          dueDate: { type: 'string', format: 'date-time' },
          rawMessage: { type: 'string' },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind',
          'aiModel',
          'analysisTimestamp',
          'confidence',
          'needsTriage',
          'extractedEntities',
          'documentType',
        ],
        properties: {
          kind: { type: 'string', enum: ['document_classify'] },
          aiModel: { type: 'string' },
          analysisTimestamp: { type: 'string', format: 'date-time' },
          confidence: { type: 'number' },
          needsTriage: { type: 'boolean' },
          extractedEntities: {
            type: 'object',
            additionalProperties: false,
            properties: {
              companyId: { type: 'string' },
              projectId: { type: 'string' },
              buildingId: { type: 'string' },
              unitId: { type: 'string' },
              contactId: { type: 'string' },
            },
          },
          documentType: { type: 'string', enum: documentOptions },
          signals: { type: 'array', items: { type: 'string' } },
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;
