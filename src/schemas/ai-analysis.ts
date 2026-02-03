/**
 * =============================================================================
 * AI ANALYSIS SCHEMAS - ENTERPRISE VALIDATION
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Zod validation schemas for AI analysis results.
 * Provides runtime type safety for AI provider outputs.
 *
 * @module schemas/ai-analysis
 * @enterprise Strict output contract για AI providers
 *
 * CRITICAL:
 * - NO Date objects (serialization-safe)
 * - Discriminated union με kind discriminator
 * - Single source of truth για AI analysis types
 */

import { z } from 'zod';

// ============================================================================
// INTENT TYPES (Message Analysis)
// ============================================================================

/**
 * Intent types for message classification
 * @enterprise Single source of truth για message intents
 */
export const IntentType = z.enum([
  'delivery',           // Παράδοση υλικών/εξοπλισμού
  'appointment',        // Ραντεβού/συνάντηση
  'issue',              // Πρόβλημα/βλάβη
  'payment',            // Πληρωμή/οικονομικό
  'info_update',        // Ενημέρωση πληροφοριών
  'triage_needed',      // Δεν μπορεί να ταξινομηθεί
]);

export type IntentTypeValue = z.infer<typeof IntentType>;

// ============================================================================
// DOCUMENT TYPES (File Classification)
// ============================================================================

/**
 * Document types for file classification
 * @enterprise Single source of truth για document types
 */
export const DocumentType = z.enum([
  'invoice',            // Τιμολόγιο
  'contract',           // Συμβόλαιο
  'photo-exterior',     // Φωτογραφία εξωτερικού
  'photo-interior',     // Φωτογραφία εσωτερικού
  'floorplan',          // Κάτοψη
  'blueprint',          // Σχέδιο
  'permit',             // Άδεια
  'inspection-report',  // Έκθεση επιθεώρησης
  'receipt',            // Απόδειξη
  'other',              // Άλλο
]);

export type DocumentTypeValue = z.infer<typeof DocumentType>;

// ============================================================================
// EXTRACTED ENTITIES (Common)
// ============================================================================

/**
 * Extracted entities from AI analysis
 * @enterprise Links to business entities (project, building, unit, contact)
 */
export const ExtractedEntitiesSchema = z.object({
  companyId: z.string().optional(),
  projectId: z.string().optional(),
  buildingId: z.string().optional(),
  unitId: z.string().optional(),
  contactId: z.string().optional(),
});

export type ExtractedEntities = z.infer<typeof ExtractedEntitiesSchema>;

// ============================================================================
// BASE ANALYSIS SCHEMA (Common Fields)
// ============================================================================

/**
 * Base schema for all AI analysis results
 * @enterprise Common fields shared across all analysis types
 */
const AnalysisBaseSchema = z.object({
  /** AI model used (e.g., 'gpt-4o-2024-11-20', 'mock-provider') */
  aiModel: z.string().min(1),

  /** When analysis was performed (ISO 8601 datetime string) */
  analysisTimestamp: z.string().datetime(),

  /** Confidence score (0-1 range) */
  confidence: z.number().min(0).max(1),

  /** Whether manual review is needed */
  needsTriage: z.boolean(),

  /** Extracted business entities */
  extractedEntities: ExtractedEntitiesSchema,
});

// ============================================================================
// MESSAGE INTENT ANALYSIS (Discriminated Union Member)
// ============================================================================

/**
 * Message intent analysis result
 * @enterprise For analyzing messages from Telegram/Email/Viber
 */
export const MessageIntentAnalysisSchema = AnalysisBaseSchema.extend({
  /** Discriminator field */
  kind: z.literal('message_intent'),

  /** Classified intent type */
  intentType: IntentType,

  /** Event date extracted from message (ISO 8601 datetime string) */
  eventDate: z.string().datetime().optional(),

  /** Due date extracted from message (ISO 8601 datetime string) */
  dueDate: z.string().datetime().optional(),

  /** Original message text */
  rawMessage: z.string(),
});

export type MessageIntentAnalysis = z.infer<typeof MessageIntentAnalysisSchema>;

// ============================================================================
// DOCUMENT CLASSIFICATION (Discriminated Union Member)
// ============================================================================

/**
 * Document classification result
 * @enterprise For analyzing uploaded files/attachments
 */
export const DocumentClassifyAnalysisSchema = AnalysisBaseSchema.extend({
  /** Discriminator field */
  kind: z.literal('document_classify'),

  /** Classified document type */
  documentType: DocumentType,

  /** Detection signals (e.g., ['has-vat-number', 'has-date', 'has-amount']) */
  signals: z.array(z.string()).optional(),
});

export type DocumentClassifyAnalysis = z.infer<typeof DocumentClassifyAnalysisSchema>;

// ============================================================================
// DISCRIMINATED UNION (Main Export)
// ============================================================================

/**
 * AI Analysis result (discriminated union)
 * @enterprise Use `result.kind` to discriminate between types
 *
 * @example
 * ```typescript
 * if (result.kind === 'message_intent') {
 *   console.log(result.intentType); // TypeScript knows this exists
 * } else if (result.kind === 'document_classify') {
 *   console.log(result.documentType); // TypeScript knows this exists
 * }
 * ```
 */
export const AIAnalysisResultSchema = z.discriminatedUnion('kind', [
  MessageIntentAnalysisSchema,
  DocumentClassifyAnalysisSchema,
]);

export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate AI analysis result
 * @enterprise Runtime validation for AI provider outputs
 */
export function validateAIAnalysisResult(data: unknown): AIAnalysisResult {
  return AIAnalysisResultSchema.parse(data);
}

/**
 * Safe validation (returns validation result instead of throwing)
 */
export function safeValidateAIAnalysisResult(data: unknown) {
  return AIAnalysisResultSchema.safeParse(data);
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for message intent analysis
 */
export function isMessageIntentAnalysis(
  result: AIAnalysisResult
): result is MessageIntentAnalysis {
  return result.kind === 'message_intent';
}

/**
 * Type guard for document classification
 */
export function isDocumentClassifyAnalysis(
  result: AIAnalysisResult
): result is DocumentClassifyAnalysis {
  return result.kind === 'document_classify';
}
