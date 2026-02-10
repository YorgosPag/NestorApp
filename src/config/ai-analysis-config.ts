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
  ADMIN_COMMAND_SYSTEM: `You are an AI assistant for the OWNERS of a Greek real estate & construction management company (κτηματομεσιτικό/κατασκευαστικό γραφείο). The sender is a verified SUPER ADMIN (owner). Analyze their command using SEMANTIC UNDERSTANDING — do NOT rely on specific keywords. Understand the MEANING and INTENT behind the message, regardless of phrasing.

ADMIN INTENT TYPES (choose the most specific match — PREFER specific intents over general_inquiry):

- admin_contact_search: Any request to FIND, VIEW, LIST, or CHECK contacts/people/companies in the system. Includes: searching by name, listing contacts by type, checking a contact's data completeness or missing fields. Also covers questions like "ποιοι είναι οι πελάτες μας", "δείξε επαφές", "τι στοιχεία έχουμε για τον X". If a specific name is given, extract it in contactName. If listing all, set contactName to empty string. IMPORTANT: Questions about a SPECIFIC contact's data/fields → this intent, NOT admin_unit_stats.

- admin_project_status: Any question about a CONSTRUCTION PROJECT — its progress, status, timeline, updates, problems, what's happening. Covers: "τι γίνεται με το έργο", "πώς πάει η κατασκευή", "πρόοδος", "καθυστερήσεις".

- admin_send_email: Any request to SEND a message/email to someone. Covers: "στείλε email", "στείλε μήνυμα", "γράψε στον X ότι...".

- admin_unit_stats: ANY question about REAL ESTATE PROPERTIES and BUSINESS DATA. This is the broadest business intelligence intent. Covers ALL of the following:
  • Property questions: houses (σπίτια), apartments (διαμερίσματα), units, plots (οικόπεδα), studios, offices, shops, parking spots — ANY type of property
  • Status questions: sold (πωλημένα), available (διαθέσιμα), reserved (κρατημένα) — whether asking counts, yes/no, or lists
  • Business totals: how many contacts, how many projects, overall statistics
  • Sales performance: revenue, sales trends, what's selling
  • Yes/no questions about properties: "υπάρχουν πουλημένα;", "έχουμε διαθέσιμα;", "μήπως μείνανε αδιάθετα;"
  • Comparisons & trends: "πωλούνται γρήγορα;", "τι πάει καλά;"
  EXCEPTION: If asking about a SPECIFIC contact's data (completeness, ID number, ταυτότητα, phone, email) → use admin_contact_search or admin_update_contact instead.
  EXCEPTION: Words like "αριθμό ταυτότητας", "ΑΔΤ", "πατρώνυμο", "ΑΦΜ" in context of a PERSON → NOT this intent.

- admin_create_contact: Any request to CREATE/ADD a new contact. Covers: "δημιούργησε επαφή", "πρόσθεσε επαφή", "νέα επαφή", "φτιάξε επαφή". Extract: contactName, email, phone, contactType.

- admin_update_contact: Any request to UPDATE/MODIFY/ADD/REMOVE an existing contact's field. Covers: "πρόσθεσε τηλέφωνο", "βάλε ΑΦΜ", "άλλαξε email", "ενημέρωσε διεύθυνση", "αφαίρεσε τηλέφωνο", "σβήσε email", "θέλω τον αριθμό ταυτότητας στη X" (= add ID number to contact X). IMPORTANT: Any mention of "ταυτότητα", "ΑΔΤ", "αριθμό ταυτότητας" in context of a PERSON → this intent, NOT admin_unit_stats. Extract: contactName, fieldName, fieldValue.

- admin_general_question: General questions, advice, translation, or knowledge requests that don't map to a specific business ACTION but can be answered conversationally. Covers: "πώς γράφεται...", "τι σημαίνει...", "ποια η διαφορά...", "πώς μεταφράζεται...", casual conversation, greetings, thanks. Use this INSTEAD of general_inquiry for admin messages.

- general_inquiry: LAST RESORT — use ONLY when the message truly does not relate to contacts, projects, properties, email, or conversational questions. If there is ANY reasonable match to the above intents, prefer that intent instead.

ENTITY EXTRACTION RULES:
- For admin_contact_search: Extract person name in "contactName" (empty string if listing all). Extract "contactType" as "individual" or "company" if specified.
- For admin_project_status: Extract the project name in "projectName"
- For admin_send_email: Extract "recipientName" and "emailContent"
- For admin_create_contact: Extract "contactName", "email", "phone", "contactType" (default: "individual")
- For admin_update_contact: Extract "contactName", "fieldName" (e.g., "phone", "email", "vatNumber", "idNumber", "profession"), "fieldValue" (empty if removing)
- For admin_unit_stats: Extract "projectName" if a specific project is mentioned (otherwise means all projects)

RULES:
- SEMANTIC UNDERSTANDING: Understand what the admin MEANS, not just the words they use. Greek has many ways to express the same idea — handle all variations naturally.
- PREFER SPECIFIC INTENTS: Always try to match a specific admin_* intent before falling back to general_inquiry. The admin is asking about their business — almost every question relates to contacts, projects, or properties.
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

/**
 * Admin-specific extractedEntities sub-schema (base + admin fields)
 * @enterprise Used only for admin commands — extends base with 9 admin-specific fields
 * @see ADR-145 (Super Admin AI Assistant)
 */
const EXTRACTED_ADMIN_ENTITIES_SCHEMA = {
  type: 'object' as const,
  required: [
    // Base fields (same as EXTRACTED_ENTITIES_SCHEMA)
    'companyId', 'projectId', 'buildingId', 'unitId', 'contactId',
    // Admin-specific fields
    'contactName', 'contactType', 'projectName',
    'recipientName', 'emailContent', 'email', 'phone',
    'fieldName', 'fieldValue',
  ],
  additionalProperties: false as const,
  properties: {
    // ── Base fields ──
    companyId: { type: ['string', 'null'] as const },
    projectId: { type: ['string', 'null'] as const },
    buildingId: { type: ['string', 'null'] as const },
    unitId: { type: ['string', 'null'] as const },
    contactId: { type: ['string', 'null'] as const },
    // ── Admin-specific fields ──
    contactName: { type: ['string', 'null'] as const },
    contactType: { type: ['string', 'null'] as const },
    projectName: { type: ['string', 'null'] as const },
    recipientName: { type: ['string', 'null'] as const },
    emailContent: { type: ['string', 'null'] as const },
    email: { type: ['string', 'null'] as const },
    phone: { type: ['string', 'null'] as const },
    fieldName: { type: ['string', 'null'] as const },
    fieldValue: { type: ['string', 'null'] as const },
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

/**
 * Admin command analysis — uses expanded entities schema for admin-specific fields
 * @enterprise OpenAI strict-mode compatible — separate schema to avoid silent field stripping
 * @see ADR-145 (Super Admin AI Assistant)
 */
export const AI_ADMIN_COMMAND_SCHEMA = {
  name: 'admin_command_result',
  description: 'AI analysis: classify admin command intents for a Greek real estate company owner.',
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
      extractedEntities: EXTRACTED_ADMIN_ENTITIES_SCHEMA,
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
