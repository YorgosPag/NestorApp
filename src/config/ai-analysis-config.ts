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
    /** ADR-156: Whisper speech-to-text model */
    WHISPER_MODEL: 'whisper-1',
    /** ADR-156: Whisper API timeout (voice files can be larger) */
    WHISPER_TIMEOUT_MS: 30_000,
    /** ADR-156: Default language hint for Whisper (improves accuracy) */
    WHISPER_DEFAULT_LANGUAGE: 'el',
  },
} as const;

export const AI_ANALYSIS_PROMPTS = {
  /** @deprecated Use MULTI_INTENT_SYSTEM for new pipeline. Kept for backward compatibility. */
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
- complaint: Customer complaint about service, quality, delays, defects (παράπονο, καταγγελία, δυσαρέσκεια)
- general_inquiry: General question or request that doesn't fit specific categories (γενική ερώτηση, πληροφορία)
- info_update: General information update
- triage_needed: Cannot determine intent with confidence

RULES:
- Prefer specific intents over generic ones
- Set confidence 0.0-1.0 reflecting your certainty
- Set needsTriage=true if confidence < 0.6
- Extract entities when identifiable (projectId, unitId, etc.)
- Messages in Greek (el) are expected`,

  /**
   * Multi-intent system prompt — detects primary + secondary intents
   * @see ADR-131 (Multi-Intent Pipeline)
   */
  MULTI_INTENT_SYSTEM: `You are an AI classifier for a Greek real estate & construction management company (κτηματομεσιτικό/κατασκευαστικό γραφείο). Analyze incoming messages and return JSON matching the schema.

INTENT TYPES (use these for both primaryIntent and secondaryIntents):
- appointment_request: Request for a meeting, viewing, or appointment (ραντεβού, συνάντηση, επίσκεψη)
- property_search: Inquiry about available properties, units, apartments, studios, pricing (αναζήτηση ακινήτου, διαθέσιμα, τιμές, τ.μ.)
- invoice: Invoice submission or inquiry (τιμολόγιο)
- payment / payment_notification: Payment confirmation or notice (πληρωμή, κατάθεση)
- defect_report / issue: Report of a defect, damage, or problem (βλάβη, πρόβλημα, ζημιά)
- delivery / procurement_request: Material delivery or procurement (παράδοση υλικών, προμήθεια)
- document_request: Request for documents, certificates, plans (αίτημα εγγράφου, κάτοψη, πιστοποιητικό)
- status_inquiry: Status check on order, construction, project (ερώτηση κατάστασης, πρόοδος)
- report_request: Request for a report (αίτημα αναφοράς)
- complaint: Customer complaint about service, quality, delays, defects (παράπονο, καταγγελία, δυσαρέσκεια)
- general_inquiry: General question or request that doesn't fit specific categories (γενική ερώτηση, πληροφορία)
- info_update: General information update
- triage_needed: Cannot determine intent with confidence

MULTI-INTENT RULES:
- Identify the PRIMARY intent (highest confidence) → put in primaryIntent
- Identify ALL SECONDARY intents if the message contains additional requests → put in secondaryIntents array
  Example: "θέλω ραντεβού και ψάχνω στούντιο 50τμ" → primaryIntent: appointment_request, secondaryIntents: [property_search]
- Each intent gets its own confidence score (0.0-1.0) and rationale
- secondaryIntents array MUST be EMPTY [] if only one intent is detected
- The top-level confidence field MUST equal primaryIntent.confidence
- Set needsTriage=true if primaryIntent.confidence < 0.6

GENERAL RULES:
- Prefer specific intents over generic ones
- Do NOT duplicate the same intent in both primary and secondary
- Extract entities when identifiable (projectId, unitId, etc.)
- Messages in Greek (el) are expected`,
  /**
   * Admin command system prompt — used when sender is a verified super admin
   * @see ADR-145 (Super Admin AI Assistant)
   */
  ADMIN_COMMAND_SYSTEM: `You are an AI assistant for the OWNERS of a Greek real estate & construction management company (κτηματομεσιτικό/κατασκευαστικό γραφείο). The sender is a verified SUPER ADMIN (owner). Analyze their command and return JSON matching the schema.

ADMIN INTENT TYPES (choose the most specific match):
- admin_contact_search: Search for a contact by name OR list/show contacts. Examples: "βρες Γιάννη", "ποιες είναι οι επαφές φυσικών προσώπων", "δείξε μου τους πελάτες", "λίστα εταιρειών". If a specific name is given, extract it in contactName. If the user asks to LIST or SHOW contacts (without a specific name), set contactName to empty string and extract contactType ("individual" or "company") if specified.
- admin_project_status: Check project status, progress, updates (τι γίνεται με το έργο, πρόοδος, κατάσταση)
- admin_send_email: Send an email to someone (στείλε email, στείλε μήνυμα σε)
- admin_unit_stats: Business statistics and counts — units, contacts, projects (πόσα ακίνητα, πόσες επαφές, πόσα έργα, στατιστικά, πωλήσεις, αριθμός). Use this for ANY "how many" / "πόσα/πόσες/πόσοι" questions.
- admin_create_contact: Create a new contact (δημιούργησε επαφή, πρόσθεσε επαφή, νέα επαφή, κάνε νέα επαφή, φτιάξε επαφή). Extract: contactName (full name), email, phone, contactType (individual/company).
- general_inquiry: Command that doesn't fit the above categories

ENTITY EXTRACTION RULES:
- For admin_contact_search: Extract person name in "contactName" (empty string if listing all). Extract "contactType" as "individual" or "company" if the user specifies a type (φυσικά πρόσωπα→individual, εταιρείες→company).
- For admin_project_status: Extract the project name in the "projectName" entity field
- For admin_send_email: Extract recipient name in "recipientName", email content in "emailContent" entity fields
- For admin_create_contact: Extract full name in "contactName", email address in "email", phone number in "phone". If the contact is a company, set "contactType" to "company", otherwise "individual". If no type is specified, default to "individual".
- For admin_unit_stats: Extract project name in "projectName" if specified (otherwise means all projects)

RULES:
- Admin commands are typically short and imperative (e.g., "Βρες μου τον Γιάννη")
- Always use admin_* intents — NEVER use customer intents for admin messages
- Set confidence 0.0-1.0 reflecting your certainty
- Messages in Greek (el) are expected
- Extract as many entities as possible from the command`,

  DOCUMENT_CLASSIFY_SYSTEM:
    'You are an enterprise document classifier for a Greek real estate & construction company. Return JSON only, matching the schema. Classify the document type and signals.',
} as const;

const intentOptions = IntentType.options;
const documentOptions = DocumentType.options;

// ============================================================================
// OPENAI STRICT-MODE COMPATIBLE SCHEMAS
// ============================================================================
// OpenAI strict mode requires:
// - Root: type 'object' + properties + required + additionalProperties: false
// - ALL properties in required (nullable fields use type: ['string', 'null'])
// - NO oneOf/anyOf at root level
// We split into 2 schemas and select based on input.kind
// ============================================================================

/** Shared extractedEntities sub-schema (all fields nullable) */
const EXTRACTED_ENTITIES_SCHEMA = {
  type: 'object' as const,
  required: ['companyId', 'projectId', 'buildingId', 'unitId', 'contactId'],
  additionalProperties: false as const,
  properties: {
    companyId: { type: ['string', 'null'] as const },
    projectId: { type: ['string', 'null'] as const },
    buildingId: { type: ['string', 'null'] as const },
    unitId: { type: ['string', 'null'] as const },
    contactId: { type: ['string', 'null'] as const },
  },
};

/** Message intent analysis — OpenAI strict-mode compatible */
export const AI_MESSAGE_INTENT_SCHEMA = {
  name: 'message_intent_result',
  description: 'AI analysis: classify message intent for a Greek real estate company.',
  strict: true,
  schema: {
    type: 'object',
    required: [
      'kind',
      'aiModel',
      'analysisTimestamp',
      'confidence',
      'needsTriage',
      'extractedEntities',
      'intentType',
      'rawMessage',
      'eventDate',
      'dueDate',
    ],
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['message_intent'] },
      aiModel: { type: 'string' },
      analysisTimestamp: { type: 'string' },
      confidence: { type: 'number' },
      needsTriage: { type: 'boolean' },
      extractedEntities: EXTRACTED_ENTITIES_SCHEMA,
      intentType: { type: 'string', enum: intentOptions },
      rawMessage: { type: 'string' },
      eventDate: { type: ['string', 'null'] },
      dueDate: { type: ['string', 'null'] },
    },
  },
} as const satisfies Record<string, unknown>;

/**
 * Sub-schema for a single detected intent (primaryIntent / secondaryIntents items)
 * @enterprise Reused in AI_MULTI_INTENT_SCHEMA
 */
const DETECTED_INTENT_SUB_SCHEMA = {
  type: 'object' as const,
  required: ['intentType', 'confidence', 'rationale'],
  additionalProperties: false as const,
  properties: {
    intentType: { type: 'string' as const, enum: intentOptions },
    confidence: { type: 'number' as const },
    rationale: { type: 'string' as const },
  },
};

/**
 * Multi-intent analysis — detects primary + secondary intents
 * @enterprise OpenAI strict-mode compatible
 * @see ADR-131 (Multi-Intent Pipeline)
 */
export const AI_MULTI_INTENT_SCHEMA = {
  name: 'multi_intent_result',
  description: 'AI analysis: classify message intents (primary + secondary) for a Greek real estate company.',
  strict: true,
  schema: {
    type: 'object',
    required: [
      'kind',
      'aiModel',
      'analysisTimestamp',
      'confidence',
      'needsTriage',
      'extractedEntities',
      'rawMessage',
      'eventDate',
      'dueDate',
      'primaryIntent',
      'secondaryIntents',
    ],
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['multi_intent'] },
      aiModel: { type: 'string' },
      analysisTimestamp: { type: 'string' },
      confidence: { type: 'number' },
      needsTriage: { type: 'boolean' },
      extractedEntities: EXTRACTED_ENTITIES_SCHEMA,
      rawMessage: { type: 'string' },
      eventDate: { type: ['string', 'null'] },
      dueDate: { type: ['string', 'null'] },
      primaryIntent: DETECTED_INTENT_SUB_SCHEMA,
      secondaryIntents: {
        type: 'array',
        items: DETECTED_INTENT_SUB_SCHEMA,
      },
    },
  },
} as const satisfies Record<string, unknown>;

/** Document classification — OpenAI strict-mode compatible */
export const AI_DOCUMENT_CLASSIFY_SCHEMA = {
  name: 'document_classify_result',
  description: 'AI analysis: classify document type for a Greek real estate company.',
  strict: true,
  schema: {
    type: 'object',
    required: [
      'kind',
      'aiModel',
      'analysisTimestamp',
      'confidence',
      'needsTriage',
      'extractedEntities',
      'documentType',
      'signals',
    ],
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['document_classify'] },
      aiModel: { type: 'string' },
      analysisTimestamp: { type: 'string' },
      confidence: { type: 'number' },
      needsTriage: { type: 'boolean' },
      extractedEntities: EXTRACTED_ENTITIES_SCHEMA,
      documentType: { type: 'string', enum: documentOptions },
      signals: { type: 'array', items: { type: 'string' } },
    },
  },
} as const satisfies Record<string, unknown>;
