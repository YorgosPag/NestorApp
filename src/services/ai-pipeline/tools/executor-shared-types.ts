/**
 * =============================================================================
 * EXECUTOR SHARED — Types, Constants & Security Whitelists
 * =============================================================================
 *
 * Extracted from executor-shared.ts (ADR-065 Phase 6).
 *
 * @module services/ai-pipeline/tools/executor-shared-types
 * @see ADR-171 (Autonomous AI Agent)
 */

import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticContext {
  companyId: string;
  isAdmin: boolean;
  channel: string;
  channelSenderId: string;
  requestId: string;
  telegramChatId?: string;
  contactMeta?: import('@/types/ai-pipeline').ContactMeta | null;
  _resolvedAccess?: import('@/config/ai-role-access-matrix').RoleAccessConfig;
  attachments?: Array<{
    fileRecordId: string;
    filename: string;
    contentType: string;
    storageUrl: string;
  }>;
  _updatedContactFields?: Map<string, Set<string>>;
  invoiceEntities?: import('@/services/ai-pipeline/invoice-entity-extractor').InvoiceEntityResult | null;
  documentImages?: Array<{
    base64DataUri: string;
    filename: string;
    contentType: string;
    fileRecordId: string;
  }>;
  isDocumentPreviewOnly?: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  count?: number;
  warning?: string;
}

export interface QueryFilter {
  field: string;
  operator: string;
  value: string | number | boolean | null | string[];
}

/**
 * Strategy Pattern: Each domain handler implements this interface.
 */
export interface ToolHandler {
  readonly toolNames: readonly string[];
  execute(toolName: string, args: Record<string, unknown>, ctx: AgenticContext): Promise<ToolResult>;
}

// ============================================================================
// AI-FACING ERROR MESSAGES (SSoT)
// ============================================================================

export const AI_ERRORS = {
  NO_LINKED_UNITS: 'Δεν βρέθηκαν συνδεδεμένα ακίνητα. Επικοινωνήστε με τον διαχειριστή.',
  UNRECOGNIZED_USER: 'Πρέπει να είστε αναγνωρισμένος χρήστης.',
} as const;

// ============================================================================
// SECURITY: COLLECTION WHITELISTS
// ============================================================================

export const ALLOWED_READ_COLLECTIONS = new Set([
  COLLECTIONS.PROJECTS,
  COLLECTIONS.BUILDINGS,
  COLLECTIONS.PROPERTIES,
  COLLECTIONS.FLOORS,
  COLLECTIONS.CONTACTS,
  COLLECTIONS.CONSTRUCTION_PHASES,
  COLLECTIONS.CONSTRUCTION_TASKS,
  COLLECTIONS.LEADS,
  COLLECTIONS.OPPORTUNITIES,
  COLLECTIONS.APPOINTMENTS,
  COLLECTIONS.TASKS,
  COLLECTIONS.OBLIGATIONS,
  COLLECTIONS.MESSAGES,
  COLLECTIONS.COMMUNICATIONS,
  COLLECTIONS.INVOICES,
  COLLECTIONS.PAYMENTS,
  COLLECTIONS.CONTACT_LINKS,
  COLLECTIONS.EMPLOYMENT_RECORDS,
  COLLECTIONS.ATTENDANCE_EVENTS,
  COLLECTIONS.CONVERSATIONS,
  COLLECTIONS.ACTIVITIES,
  COLLECTIONS.FILES,
  COLLECTIONS.PARKING_SPACES,
  COLLECTIONS.ACCOUNTING_INVOICES,
  COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
  COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES,
  COLLECTIONS.ACCOUNTING_FIXED_ASSETS,
  COLLECTIONS.FILES,
  COLLECTIONS.FLOORPLANS,
  COLLECTIONS.PURCHASE_ORDERS,
]);

export const ALLOWED_WRITE_COLLECTIONS = new Set([
  COLLECTIONS.CONTACTS,
  COLLECTIONS.TASKS,
  COLLECTIONS.APPOINTMENTS,
  COLLECTIONS.ACTIVITIES,
  COLLECTIONS.LEADS,
  COLLECTIONS.PROPERTIES,
  COLLECTIONS.PROJECTS,
  COLLECTIONS.BUILDINGS,
  COLLECTIONS.CONSTRUCTION_PHASES,
  COLLECTIONS.CONSTRUCTION_TASKS,
  COLLECTIONS.FILES,
  COLLECTIONS.PURCHASE_ORDERS,
]);

export const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'apiKey',
  'secret',
  'refreshToken',
  'accessToken',
  'privateKey',
]);

/**
 * Map Firestore collections → SyncEntityType for AI sync bridge.
 */
export const COLLECTION_TO_SYNC_ENTITY: Record<string, import('@/services/realtime/types').SyncEntityType> = {
  [COLLECTIONS.CONTACTS]: 'contacts',
  [COLLECTIONS.TASKS]: 'tasks',
  [COLLECTIONS.BUILDINGS]: 'buildings',
  [COLLECTIONS.PROJECTS]: 'projects',
  [COLLECTIONS.OPPORTUNITIES]: 'opportunities',
  [COLLECTIONS.COMMUNICATIONS]: 'communications',
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_QUERY_RESULTS = 50;
export const DEFAULT_QUERY_LIMIT = 20;
export const MAX_RESULT_JSON_LENGTH = 8000;
