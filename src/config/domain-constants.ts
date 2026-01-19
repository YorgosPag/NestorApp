/**
 * =============================================================================
 * DOMAIN CONSTANTS - ENTERPRISE SSoT
 * =============================================================================
 *
 * Centralized domain constants for the entire application.
 * NO hardcoded magic strings in handlers/stores - use these constants.
 *
 * @module config/domain-constants
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

// ============================================================================
// BOT & SYSTEM IDENTITY
// ============================================================================

/**
 * Bot identity configuration
 * @enterprise Used consistently across all channels
 */
export const BOT_IDENTITY = {
  /** Internal identifier for bot messages */
  ID: 'bot',
  /** Display name shown in conversations */
  DISPLAY_NAME: 'Pagonis Bot',
  /** Bot type identifier */
  TYPE: 'bot',
} as const;

/**
 * System identity for automated actions
 */
export const SYSTEM_IDENTITY = {
  /** Internal identifier for system actions */
  ID: 'system',
  /** Display name for system messages */
  DISPLAY_NAME: 'System',
  /** System type identifier */
  TYPE: 'system',
} as const;

// ============================================================================
// PARTICIPANT ROLES
// ============================================================================

/**
 * Conversation participant roles
 * @enterprise Used in ConversationParticipant.role
 */
export const PARTICIPANT_ROLES = {
  /** External customer/user */
  CUSTOMER: 'customer',
  /** Internal support agent */
  AGENT: 'agent',
  /** Automated bot */
  BOT: 'bot',
  /** System automated actions */
  SYSTEM: 'system',
} as const;

export type ParticipantRole = typeof PARTICIPANT_ROLES[keyof typeof PARTICIPANT_ROLES];

// ============================================================================
// SENDER TYPES
// ============================================================================

/**
 * Message sender types
 * @enterprise Used in CanonicalMessage.senderType
 */
export const SENDER_TYPES = {
  /** External customer sending message */
  CUSTOMER: 'customer',
  /** Internal agent sending message */
  AGENT: 'agent',
  /** Bot automated response */
  BOT: 'bot',
  /** System notification/action */
  SYSTEM: 'system',
} as const;

export type SenderType = typeof SENDER_TYPES[keyof typeof SENDER_TYPES];

// ============================================================================
// ENTITY TYPES
// ============================================================================

/**
 * CRM entity types for linking
 * @enterprise Used in communications and conversations
 */
export const ENTITY_TYPES = {
  /** Lead entity */
  LEAD: 'lead',
  /** Contact entity */
  CONTACT: 'contact',
  /** Company entity */
  COMPANY: 'company',
  /** Project entity */
  PROJECT: 'project',
  /** Unit entity */
  UNIT: 'unit',
  /** Building entity */
  BUILDING: 'building',
  /** Floor entity */
  FLOOR: 'floor',
  /** Storage unit entity */
  STORAGE_UNIT: 'storage_unit',
  /** Parking spot entity */
  PARKING_SPOT: 'parking_spot',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

// ============================================================================
// FILE STORAGE CONSTANTS - ENTERPRISE CANONICAL
// ============================================================================

/**
 * 🏢 ENTERPRISE: File storage domains (business areas)
 * @enterprise Used in FileRecord.domain for organizing files by business function
 * @see local_ΔΙΚΑΙΩΜΑΤΑ.txt - Canonical File Storage System
 */
export const FILE_DOMAINS = {
  /** Administrative documents (contacts, HR, general) */
  ADMIN: 'admin',
  /** Construction-related files (blueprints, progress, permits) */
  CONSTRUCTION: 'construction',
  /** Sales-related files (contracts, offers, brochures) */
  SALES: 'sales',
  /** Accounting files (invoices, receipts, financial) */
  ACCOUNTING: 'accounting',
  /** Legal documents (contracts, agreements, legal) */
  LEGAL: 'legal',
  /** Financial documents (financial reports, statements) */
  FINANCIAL: 'financial',
} as const;

export type FileDomain = typeof FILE_DOMAINS[keyof typeof FILE_DOMAINS];

/**
 * 🏢 ENTERPRISE: File categories (content types)
 * @enterprise Used in FileRecord.category for organizing files by type
 */
export const FILE_CATEGORIES = {
  /** Photos and images */
  PHOTOS: 'photos',
  /** Floor plans (PDF, DXF) */
  FLOORPLANS: 'floorplans',
  /** General documents (PDF, DOC) */
  DOCUMENTS: 'documents',
  /** Invoices and billing */
  INVOICES: 'invoices',
  /** Contracts and agreements */
  CONTRACTS: 'contracts',
  /** Audio recordings */
  AUDIO: 'audio',
  /** Video files */
  VIDEOS: 'videos',
  /** Technical drawings (CAD) */
  DRAWINGS: 'drawings',
  /** Permits and certifications */
  PERMITS: 'permits',
} as const;

export type FileCategory = typeof FILE_CATEGORIES[keyof typeof FILE_CATEGORIES];

/**
 * 🏢 ENTERPRISE: File processing status
 * @enterprise Used in FileRecord.status for tracking upload state
 */
export const FILE_STATUS = {
  /** Upload pending/in progress */
  PENDING: 'pending',
  /** File ready and available */
  READY: 'ready',
  /** Upload or processing failed */
  FAILED: 'failed',
} as const;

export type FileStatus = typeof FILE_STATUS[keyof typeof FILE_STATUS];

/**
 * 🏢 ENTERPRISE: Storage path segments (for buildStoragePath)
 * @enterprise ZERO hardcoded path strings - all segments from here
 */
export const STORAGE_PATH_SEGMENTS = {
  /** Root companies folder */
  COMPANIES: 'companies',
  /** Projects subfolder */
  PROJECTS: 'projects',
  /** Entities subfolder */
  ENTITIES: 'entities',
  /** Domains subfolder */
  DOMAINS: 'domains',
  /** Categories subfolder */
  CATEGORIES: 'categories',
  /** Files subfolder */
  FILES: 'files',
} as const;

// ============================================================================
// 🚨 ENTERPRISE: NO HARDCODED LABELS IN CONSTANTS
// ============================================================================
// Labels/display names MUST come from i18n system, NOT from constants.
// Use: i18n.t('files:domains.admin'), i18n.t('files:categories.photos'), etc.
// See: src/i18n/locales/el/files.json, src/i18n/locales/en/files.json
// ADR-030: Zero Hardcoded Values - Labels only via centralized i18n
// ============================================================================

// ============================================================================
// MESSAGE STATUS VALUES
// ============================================================================

/**
 * Legacy message status values (for backward compatibility)
 * @enterprise Used in COMMUNICATIONS collection
 */
export const MESSAGE_STATUS = {
  /** Message received */
  RECEIVED: 'received',
  /** Message sent */
  SENT: 'sent',
  /** Message delivered */
  DELIVERED: 'delivered',
  /** Message read */
  READ: 'read',
  /** Message failed */
  FAILED: 'failed',
} as const;

export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];

// ============================================================================
// PLATFORM IDENTIFIERS
// ============================================================================

/**
 * Platform identifiers for provider metadata
 * @enterprise Used in providerMetadata.platform
 */
export const PLATFORMS = {
  TELEGRAM: 'telegram',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  SMS: 'sms',
  WEB: 'web',
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default values for missing data
 * @enterprise Use these instead of inline strings
 */
export const DEFAULTS = {
  /** Default sender name when not provided */
  UNKNOWN_SENDER: 'Unknown',
  /** Default message content for media */
  MEDIA_MESSAGE_PLACEHOLDER: '[Media Message]',
  /** Default conversation subject */
  NO_SUBJECT: '(No Subject)',
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Conversation preview length for lastMessage.content
 * @enterprise Used in conversation list views
 */
export const CONVERSATION_PREVIEW_LENGTH = 100;

// ============================================================================
// INBOX UI CONSTANTS - EPIC Δ
// ============================================================================

/**
 * Inbox polling intervals
 * @enterprise Near-realtime updates without WebSocket
 */
export const INBOX_POLL_MS = 15000; // 15 seconds for inbox list
export const THREAD_POLL_MS = 5000; // 5 seconds for active thread

/**
 * Inbox pagination defaults
 * @enterprise Optimized for performance
 */
export const INBOX_PAGE_SIZE = 20;
export const MESSAGES_PAGE_SIZE = 50;

/**
 * UI display limits
 * @enterprise Consistent truncation across components
 */
export const MESSAGE_PREVIEW_LENGTH = 120;
