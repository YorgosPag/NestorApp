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
  /**
   * 🏢 ENTERPRISE: Ingestion domain for external sources (Telegram, Email, WhatsApp)
   * @enterprise ADR-055 - Enterprise Attachment Ingestion System
   * Files in this domain are quarantined until classified and promoted to business entities
   */
  INGESTION: 'ingestion',
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

// ============================================================================
// 🗑️ ENTERPRISE TRASH SYSTEM - LIFECYCLE MANAGEMENT
// ============================================================================
// 3-tier lifecycle pattern (Google Drive, Salesforce, Microsoft Purview):
// Active → Trashed → Archived → Purged
// ============================================================================

/**
 * 🏢 ENTERPRISE: File lifecycle states
 * @enterprise ADR-032 - Enterprise Trash System
 * @see local_3.txt - Enterprise delete patterns analysis
 *
 * States:
 * - ACTIVE: Normal file, visible in UI, can be modified
 * - TRASHED: Soft deleted, in "Trash" view, can be restored
 * - ARCHIVED: Long-term retention, not in active views (legal hold, compliance)
 * - PURGED: Permanently deleted (Storage + Firestore)
 */
export const FILE_LIFECYCLE_STATES = {
  /** Normal file, visible in UI */
  ACTIVE: 'active',
  /** Soft deleted, in Trash view, restorable */
  TRASHED: 'trashed',
  /** Archived for retention/compliance */
  ARCHIVED: 'archived',
  /** Permanently deleted (marker only, actual docs are removed) */
  PURGED: 'purged',
} as const;

export type FileLifecycleState = typeof FILE_LIFECYCLE_STATES[keyof typeof FILE_LIFECYCLE_STATES];

/**
 * 🏢 ENTERPRISE: Default retention policies (in days)
 * @enterprise Configurable per deployment, per category
 *
 * Examples from industry:
 * - Google Drive: 30 days in trash
 * - Salesforce: 15 days (extendable)
 * - Microsoft Purview: Configurable retention policies
 */
export const DEFAULT_RETENTION_POLICIES = {
  /** Days in trash before auto-purge eligibility */
  TRASH_RETENTION_DAYS: 30,
  /** Days to retain archived files (legal/compliance) */
  ARCHIVE_RETENTION_DAYS: 365 * 7, // 7 years for construction documents
  /** Grace period for restoration after purge request */
  PURGE_GRACE_PERIOD_DAYS: 7,
} as const;

/**
 * 🏢 ENTERPRISE: Retention policies by file category
 * @enterprise Construction/real estate specific
 *
 * Critical documents (contracts, permits) have longer retention
 * Temporary files (drafts, temp uploads) have shorter retention
 */
export const RETENTION_BY_CATEGORY: Record<FileCategory, number> = {
  [FILE_CATEGORIES.PHOTOS]: 30, // Standard 30 days
  [FILE_CATEGORIES.FLOORPLANS]: 365 * 10, // 10 years for blueprints
  [FILE_CATEGORIES.DOCUMENTS]: 365 * 5, // 5 years
  [FILE_CATEGORIES.INVOICES]: 365 * 10, // 10 years (tax compliance)
  [FILE_CATEGORIES.CONTRACTS]: 365 * 15, // 15 years (legal)
  [FILE_CATEGORIES.AUDIO]: 30, // Standard 30 days
  [FILE_CATEGORIES.VIDEOS]: 30, // Standard 30 days
  [FILE_CATEGORIES.DRAWINGS]: 365 * 10, // 10 years (CAD drawings)
  [FILE_CATEGORIES.PERMITS]: 365 * 20, // 20 years (building permits)
};

/**
 * 🏢 ENTERPRISE: Hold types for compliance
 * @enterprise Legal hold prevents deletion even after retention expires
 */
export const HOLD_TYPES = {
  /** No hold - normal lifecycle */
  NONE: 'none',
  /** Legal hold - eDiscovery, litigation */
  LEGAL: 'legal',
  /** Regulatory hold - compliance audit */
  REGULATORY: 'regulatory',
  /** Administrative hold - internal review */
  ADMIN: 'admin',
} as const;

export type HoldType = typeof HOLD_TYPES[keyof typeof HOLD_TYPES];

/**
 * 🏢 ENTERPRISE: Photo upload purposes
 * @enterprise Used for naming context in photo uploads
 * @see ADR-031 - Canonical File Storage System
 */
export const PHOTO_PURPOSES = {
  /** Profile/representative photo */
  PROFILE: 'profile',
  /** ID card photo */
  ID: 'id',
  /** Other/general photo */
  OTHER: 'other',
} as const;

export type PhotoPurpose = typeof PHOTO_PURPOSES[keyof typeof PHOTO_PURPOSES];

/**
 * 🏢 ENTERPRISE: Centralized deprecation messages
 * @enterprise All deprecation warnings use these constants
 */
export const DEPRECATION_MESSAGES = {
  /** Legacy upload without canonical fields */
  LEGACY_UPLOAD: '[DEPRECATION] uploadPhoto() without canonical fields (companyId, contactId, createdBy) is deprecated. New uploads should use canonical pipeline. This fallback will be removed in a future release.',
  /** Legacy folderPath usage */
  LEGACY_FOLDER_PATH: '[DEPRECATION] Using folderPath is deprecated. Use canonical pipeline with buildStoragePath() instead.',
} as const;

/**
 * 🏢 ENTERPRISE: Centralized error messages for file storage
 * @enterprise All file storage errors use these constants
 * @see ADR-031 - Canonical File Storage System
 */
export const FILE_STORAGE_ERROR_MESSAGES = {
  /** Production lock - legacy writes blocked */
  PRODUCTION_LOCK: 'Legacy uploads are blocked in production. Use canonical pipeline with companyId, contactId, createdBy.',
  /** Missing required fields */
  MISSING_CANONICAL_FIELDS: 'Missing required canonical fields: companyId, contactId, or createdBy.',
  /** Invalid storage path */
  INVALID_STORAGE_PATH: 'Invalid storage path parameters provided.',
} as const;

/**
 * 🏢 ENTERPRISE: File storage feature flags for controlled migrations
 * @enterprise Used to control legacy vs canonical behavior
 * @note Separate from DXF viewer FEATURE_FLAGS (different domain)
 */
export const FILE_STORAGE_FLAGS = {
  /** If true, legacy writes are blocked (production-safe mode) */
  BLOCK_LEGACY_WRITES: process.env.NEXT_PUBLIC_BLOCK_LEGACY_WRITES === 'true',
  /** If true, allow legacy writes with warning (migration mode) */
  ALLOW_LEGACY_WITH_WARNING: process.env.NEXT_PUBLIC_ALLOW_LEGACY_WITH_WARNING !== 'false',
} as const;

/**
 * 🏢 ENTERPRISE: Legacy storage paths (for backward compatibility ONLY)
 * @deprecated Use canonical pipeline with buildStoragePath() instead
 * @enterprise These paths are READ-ONLY in production
 * @see ADR-031 - Canonical File Storage System
 */
export const LEGACY_STORAGE_PATHS = {
  /** Legacy contacts photos folder - DO NOT USE FOR NEW UPLOADS */
  CONTACTS_PHOTOS: 'contacts/photos',
} as const;

/**
 * 🏢 ENTERPRISE: Photo upload purposes
 * @enterprise Type-safe purpose values for file naming
 * @see ADR-031 - Canonical File Storage System
 */
export const UPLOAD_PURPOSE = {
  /** Company logo */
  LOGO: 'logo',
  /** Representative/profile photo */
  REPRESENTATIVE: 'representative',
  /** Profile photo (alias for representative) */
  PROFILE: 'profile',
  /** ID document scan */
  ID_DOCUMENT: 'id-document',
  /** General/other purpose */
  OTHER: 'other',
} as const;

export type UploadPurpose = typeof UPLOAD_PURPOSE[keyof typeof UPLOAD_PURPOSE];

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
  INSTAGRAM: 'instagram',
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
// API ROUTES (SSoT)
// ============================================================================

/**
 * Centralized API routes to avoid hardcoded strings in client code.
 */
export const API_ROUTES = {
  /** Create/clear Firebase session cookie for server-side auth */
  AUTH_SESSION: '/api/auth/session',
  /** Mark MFA enrollment complete and sync custom claims */
  AUTH_MFA_ENROLL_COMPLETE: '/api/auth/mfa/enroll/complete',
} as const;

// ============================================================================
// AUTH EVENTS (SSoT)
// ============================================================================

/**
 * Centralized auth-related browser events.
 */
export const AUTH_EVENTS = {
  /** Request a server session cookie refresh */
  REFRESH_SESSION: 'auth:refresh-session',
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Radix Select "Clear" Value
 * @enterprise Used for "no selection" / "clear selection" options in Radix Select
 *
 * CRITICAL: Radix Select FORBIDS <SelectItem value="" />
 * The Select component can have value="" to show placeholder,
 * but SelectItem MUST have a non-empty value.
 *
 * Pattern:
 * 1. <SelectItem value={SELECT_CLEAR_VALUE}>No selection</SelectItem>
 * 2. In onValueChange: if (value === SELECT_CLEAR_VALUE) setDraft(undefined)
 * 3. In Save: never persist SELECT_CLEAR_VALUE - convert to null/undefined
 *
 * @see https://www.radix-ui.com/primitives/docs/components/select
 */
export const SELECT_CLEAR_VALUE = '__clear__' as const;

/**
 * Helper to check if a value is the clear sentinel
 * @param value - Value to check
 * @returns true if value is the clear sentinel
 */
export function isSelectClearValue(value: string | undefined | null): value is typeof SELECT_CLEAR_VALUE {
  return value === SELECT_CLEAR_VALUE;
}

/**
 * Convert select value for persistence (sentinel → undefined)
 * @param value - Select value (may be sentinel)
 * @returns undefined if sentinel, otherwise original value
 */
export function selectValueForPersistence(value: string | undefined): string | undefined {
  return isSelectClearValue(value) ? undefined : value;
}

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

// ============================================================================
// PARKING/STORAGE ALLOCATION METADATA SCHEMA
// ============================================================================

/**
 * 🏢 ENTERPRISE: Parking/Storage Allocation Metadata Schema
 * Used with Associations system for linking parking/storage to units
 *
 * @enterprise Phase 2 - Uses existing Associations system (ADR-032)
 * @created 2026-01-23
 *
 * IMPORTANT: LinkedSpace interface remains as VIEW/DTO only
 * Actual persistence is through Associations with this metadata schema
 */

/**
 * Inclusion types for parking/storage allocations
 */
export const SPACE_INCLUSION_TYPES = {
  /** Included with unit sale/rent */
  INCLUDED: 'included',
  /** Available as optional purchase/rent */
  OPTIONAL: 'optional',
  /** Separately rented */
  RENTED: 'rented',
} as const;

export type SpaceInclusionType = typeof SPACE_INCLUSION_TYPES[keyof typeof SPACE_INCLUSION_TYPES];

/**
 * Space types for allocations
 */
export const ALLOCATION_SPACE_TYPES = {
  PARKING: 'parking',
  STORAGE: 'storage',
} as const;

export type AllocationSpaceType = typeof ALLOCATION_SPACE_TYPES[keyof typeof ALLOCATION_SPACE_TYPES];

/**
 * Metadata schema for parking/storage allocations
 * Used in ContactLink.metadata when linking spaces to units
 */
export interface ParkingStorageAllocationMetadata {
  /** Type of space being allocated */
  spaceType: AllocationSpaceType;

  /** How many spaces allocated */
  quantity: number;

  /** How the space is included with the unit */
  inclusion: SpaceInclusionType;

  /** Human-readable allocation code (e.g., "P-101", "S-42") */
  allocationCode?: string;

  /** Additional notes about the allocation */
  allocationNotes?: string;
}

/**
 * Standard reason codes for parking/storage allocations
 * @enterprise NO hardcoded labels - use i18n keys in UI
 */
export const ALLOCATION_REASONS = {
  STANDARD: 'standard',
  UPGRADE: 'upgrade',
  TEMPORARY: 'temporary',
  EXCHANGE: 'exchange',
} as const;

export type AllocationReasonCode = typeof ALLOCATION_REASONS[keyof typeof ALLOCATION_REASONS];
