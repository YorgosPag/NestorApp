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
  /** Identifier for automated ingestion processes */
  INGESTION_ID: 'system:ingestion',
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
  /** Property entity */
  PROPERTY: 'property',
  /** Building entity */
  BUILDING: 'building',
  /** Floor entity */
  FLOOR: 'floor',
  /** Storage unit entity */
  STORAGE_UNIT: 'storage_unit',
  /** Parking spot entity */
  PARKING_SPOT: 'parking_spot',
  /** Storage entity */
  STORAGE: 'storage',
  /** Conversation entity (CRM communications — ADR-293) */
  CONVERSATION: 'conversation',
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
  /** Brokerage documents (brokerage agreements, commissions) */
  BROKERAGE: 'brokerage',
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

/**
 * 🏢 ENTERPRISE: File sensitivity classifications
 * @enterprise Data governance — SAP/Google Drive pattern
 *
 * Levels:
 * - PUBLIC: Can be shared externally (e.g. marketing photos)
 * - INTERNAL: Default — visible within the company only
 * - CONFIDENTIAL: Restricted — legal, financial, sensitive contracts
 */
export const FILE_CLASSIFICATIONS = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
} as const;

export type FileClassification = typeof FILE_CLASSIFICATIONS[keyof typeof FILE_CLASSIFICATIONS];

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
 * 🏢 ENTERPRISE: Floorplan upload purposes (centralized)
 * @enterprise Single source of truth for all floorplan purpose strings
 * @see ADR-031 - Canonical File Storage System
 * @see ADR-033 - Floorplan Processing Pipeline
 */
export const FLOORPLAN_PURPOSES = {
  /** Generic/legacy floorplan (fallback) */
  GENERAL: 'floorplan',
  /** Project-level general floorplan */
  PROJECT: 'project-floorplan',
  /** Building-level floorplan */
  BUILDING: 'building-floorplan',
  /** Storage-level floorplan */
  STORAGE: 'storage-floorplan',
  /** Parking-level floorplan */
  PARKING: 'parking-floorplan',
  /** Floor architectural plan */
  FLOOR: 'floor-floorplan',
  /** Floor section drawing */
  FLOOR_SECTION: 'floor-section',
  /** Floor electrical plan */
  FLOOR_ELECTRICAL: 'floor-electrical',
  /** Floor plumbing plan */
  FLOOR_PLUMBING: 'floor-plumbing',
  /** Property architectural plan */
  PROPERTY: 'property-floorplan',
  /** Property section drawing */
  PROPERTY_SECTION: 'property-section',
  /** Property electrical plan */
  PROPERTY_ELECTRICAL: 'property-electrical',
  /** Property plumbing plan */
  PROPERTY_PLUMBING: 'property-plumbing',
} as const;

export type FloorplanPurpose = typeof FLOORPLAN_PURPOSES[keyof typeof FLOORPLAN_PURPOSES];

// ADR-293: DEPRECATION_MESSAGES, FILE_STORAGE_ERROR_MESSAGES, FILE_STORAGE_FLAGS,
// LEGACY_STORAGE_PATHS removed — legacy pipeline fully eliminated

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
// API ROUTES (SSoT) — ADR-245: Zero Hardcoded Endpoints
// ============================================================================

/**
 * Centralized API routes registry — Single Source of Truth.
 *
 * Every client-side API call MUST use this object. Hardcoded `/api/…` strings
 * are PROHIBITED outside this file (see ADR-245).
 *
 * Pattern:
 *   - Static paths → string literal
 *   - Dynamic paths → arrow function returning template literal `as const`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-245-api-routes-centralization.md
 */
export const API_ROUTES = {
  // ── Auth ──────────────────────────────────────────────────────────────
  AUTH: {
    SESSION: '/api/auth/session',
    MFA_ENROLL_COMPLETE: '/api/auth/mfa/enroll/complete',
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  ADMIN: {
    ENSURE_USER_PROFILE: '/api/admin/ensure-user-profile',
    SETUP_CONFIG: '/api/admin/setup-admin-config',
    OPERATOR_INBOX: '/api/admin/operator-inbox',
    SEARCH_BACKFILL: '/api/admin/search-backfill',
    SEED_PARKING: '/api/admin/seed-parking',
    SET_USER_CLAIMS: '/api/admin/set-user-claims',
    ROLE_MANAGEMENT: {
      USERS: '/api/admin/role-management/users',
      USER_STATUS: (uid: string) => `/api/admin/role-management/users/${uid}/status` as const,
      USER_ROLE: (uid: string) => `/api/admin/role-management/users/${uid}/role` as const,
      USER_PERMISSION_SETS: (uid: string) => `/api/admin/role-management/users/${uid}/permission-sets` as const,
      PROJECT_MEMBERS: '/api/admin/role-management/project-members',
      AUDIT_LOG: '/api/admin/role-management/audit-log',
      AUDIT_LOG_EXPORT: '/api/admin/role-management/audit-log/export',
    },
  },

  // ── Companies ─────────────────────────────────────────────────────────
  COMPANIES: {
    LIST: '/api/companies',
  },

  // ── Projects ──────────────────────────────────────────────────────────
  PROJECTS: {
    LIST: '/api/projects/list',
    BY_ID: (id: string) => `/api/projects/${id}` as const,
    BY_COMPANY: (companyId: string) => `/api/projects/by-company/${companyId}` as const,
    CUSTOMERS: (projectId: string) => `/api/projects/${projectId}/customers` as const,
    STRUCTURE: (projectId: string) => `/api/projects/structure/${projectId}` as const,
    PAYMENT_REPORT: (projectId: string) => `/api/projects/${projectId}/payment-report` as const,
    IMPACT_PREVIEW: (projectId: string) => `/api/projects/${projectId}/impact-preview` as const,
    ADDRESS_IMPACT_PREVIEW: (projectId: string) => `/api/projects/${projectId}/address-impact-preview` as const,
    OWNERSHIP_IMPACT_PREVIEW: (projectId: string) => `/api/projects/${projectId}/ownership-impact-preview` as const,
    LANDOWNERS_SAVE_PREVIEW: (projectId: string) => `/api/projects/${projectId}/landowners-save-preview` as const,
    ENGINEER_IMPACT_PREVIEW: (projectId: string) => `/api/projects/${projectId}/engineer-impact-preview` as const,
    BROKER_TERMINATE_PREVIEW: (projectId: string) => `/api/projects/${projectId}/broker-terminate-preview` as const,
  },

  PROCUREMENT: {
    LIST: '/api/procurement',
    BY_ID: (poId: string) => `/api/procurement/${poId}` as const,
    ACTION: (poId: string, action: string) => `/api/procurement/${poId}?action=${action}` as const,
    SHARE: (poId: string) => `/api/procurement/${poId}/share` as const,
    EMAIL: (poId: string) => `/api/procurement/${poId}/email` as const,
    PDF: (poId: string) => `/api/procurement/${poId}/pdf` as const,
    SUPPLIER_METRICS: '/api/procurement/supplier-metrics',
    SUPPLIER_COMPARISON: '/api/procurement/supplier-metrics/comparison',
  },

  // ── Buildings ─────────────────────────────────────────────────────────
  BUILDINGS: {
    LIST: '/api/buildings',
    BY_ID: (id: string) => `/api/buildings/${id}` as const,
    CONSTRUCTION_PHASES: (buildingId: string) => `/api/buildings/${buildingId}/construction-phases` as const,
    CONSTRUCTION_BASELINES: (buildingId: string) => `/api/buildings/${buildingId}/construction-baselines` as const,
    CONSTRUCTION_RESOURCE_ASSIGNMENTS: (buildingId: string) => `/api/buildings/${buildingId}/construction-resource-assignments` as const,
    CUSTOMERS: (buildingId: string) => `/api/buildings/${buildingId}/customers` as const,
    MILESTONES: (buildingId: string) => `/api/buildings/${buildingId}/milestones` as const,
    /** ADR-284 §3.3 Phase 3b — atomic link to Project (orphan fix) */
    LINK_PROJECT: (buildingId: string) => `/api/buildings/${buildingId}/link-project` as const,
  },

  // ── Floors ────────────────────────────────────────────────────────────
  FLOORS: {
    LIST: '/api/floors',
    BY_ID: (id: string) => `/api/floors/${id}` as const,
  },

  // ── DXF Levels (ADR-286) ──────────────────────────────────────────────
  DXF_LEVELS: {
    LIST: '/api/dxf-levels',
  },

  // ── CAD Files (ADR-288) ───────────────────────────────────────────────
  CAD_FILES: {
    LIST: '/api/cad-files',
  },

  // ── DXF Overlay Items (ADR-289) ───────────────────────────────────────
  DXF_OVERLAY_ITEMS: {
    LIST: '/api/dxf-overlay-items',
  },

  // ── Properties ────────────────────────────────────────────────────────
  PROPERTIES: {
    LIST: '/api/properties',
    CREATE: '/api/properties/create',
    BY_ID: (id: string) => `/api/properties/${id}` as const,
    IMPACT_PREVIEW: (propertyId: string) => `/api/properties/${propertyId}/impact-preview` as const,
    HIERARCHY: (propertyId: string) => `/api/properties/${propertyId}/hierarchy` as const,
    ACTIVITY: (propertyId: string) => `/api/properties/${propertyId}/activity` as const,
    PAYMENT_PLAN: (propertyId: string) => `/api/properties/${propertyId}/payment-plan` as const,
    PAYMENTS: (propertyId: string) => `/api/properties/${propertyId}/payments` as const,
    INSTALLMENTS: (propertyId: string) => `/api/properties/${propertyId}/payment-plan/installments` as const,
    LOAN: (propertyId: string) => `/api/properties/${propertyId}/payment-plan/loan` as const,
    LOANS: (propertyId: string) => `/api/properties/${propertyId}/payment-plan/loans` as const,
    CHEQUES: (propertyId: string) => `/api/properties/${propertyId}/cheques` as const,
    TRASH: '/api/properties/trash',
  },

  // ── Parking ───────────────────────────────────────────────────────────
  PARKING: {
    LIST: '/api/parking',
    BY_ID: (id: string) => `/api/parking/${id}` as const,
  },

  // ── Storages ──────────────────────────────────────────────────────────
  STORAGES: {
    LIST: '/api/storages',
    BY_ID: (id: string) => `/api/storages/${id}` as const,
  },

  // ── Spaces (cross-type) ────────────────────────────────────────────
  SPACES: {
    BATCH_RESOLVE: '/api/spaces/batch-resolve',
  },

  // ── Contacts ──────────────────────────────────────────────────────────
  CONTACTS: {
    BY_ID: (id: string) => `/api/contacts/${id}` as const,
    PROPERTIES: (contactId: string) => `/api/contacts/${contactId}/properties` as const,
    SEARCH_INDIVIDUALS: '/api/contacts/search-individuals',
    SEARCH_FOR_SHARE: '/api/contacts/search-for-share',
    IDENTITY_IMPACT_PREVIEW: (id: string) => `/api/contacts/${id}/identity-impact-preview` as const,
    COMPANY_IDENTITY_IMPACT_PREVIEW: (id: string) => `/api/contacts/${id}/company-identity-impact-preview` as const,
    SERVICE_IDENTITY_IMPACT_PREVIEW: (id: string) => `/api/contacts/${id}/service-identity-impact-preview` as const,
    RESTORE: (id: string) => `/api/contacts/${id}/restore` as const,
    PERMANENT_DELETE: (id: string) => `/api/contacts/${id}/permanent-delete` as const,
    CHANNELS: (contactId: string) => `/api/contacts/${contactId}/channels` as const,
    LINK_CHANNEL: (contactId: string) => `/api/contacts/${contactId}/link-channel` as const,
  },

  // ── Trash (SSOT Soft-Delete — ADR-281) ─────────────────────────────────
  TRASH: {
    RESTORE: (entityType: string, entityId: string) =>
      `/api/trash/${entityType}/${entityId}/restore` as const,
    PERMANENT_DELETE: (entityType: string, entityId: string) =>
      `/api/trash/${entityType}/${entityId}/permanent-delete` as const,
  },

  // ── Contracts ─────────────────────────────────────────────────────────
  CONTRACTS: {
    LIST: '/api/contracts',
    BY_ID: (id: string) => `/api/contracts/${id}` as const,
    TRANSITION: (id: string) => `/api/contracts/${id}/transition` as const,
    PROFESSIONALS: (id: string) => `/api/contracts/${id}/professionals` as const,
  },

  // ── Sales ─────────────────────────────────────────────────────────────
  SALES: {
    ACCOUNTING_EVENT: (propertyId: string) => `/api/sales/${propertyId}/accounting-event` as const,
    APPURTENANCE_SYNC: (propertyId: string) => `/api/sales/${propertyId}/appurtenance-sync` as const,
  },

  // ── Files & Floorplans ────────────────────────────────────────────────
  FILES: {
    CLASSIFY: '/api/files/classify',
    BATCH_DOWNLOAD: '/api/files/batch-download',
    ARCHIVE: '/api/files/archive',
  },
  DOWNLOAD: '/api/download',
  FLOORPLANS: {
    PROCESS: '/api/floorplans/process',
    SCENE: (fileId: string) => `/api/floorplans/scene?fileId=${fileId}` as const,
  },

  // ── Accounting (subapp) ───────────────────────────────────────────────
  ACCOUNTING: {
    INVOICES: {
      LIST: '/api/accounting/invoices',
      BY_ID: (id: string) => `/api/accounting/invoices/${id}` as const,
      SEND_EMAIL: (id: string) => `/api/accounting/invoices/${id}/send-email` as const,
    },
    JOURNAL: '/api/accounting/journal',
    VAT: { SUMMARY: '/api/accounting/vat/summary' },
    TAX: {
      ESTIMATE: '/api/accounting/tax/estimate',
      DASHBOARD: '/api/accounting/tax/dashboard',
    },
    BANK: {
      TRANSACTIONS: '/api/accounting/bank/transactions',
      IMPORT: '/api/accounting/bank/import',
      CANDIDATES: '/api/accounting/bank/candidates',
      MATCH: '/api/accounting/bank/match',
      MATCH_BATCH: '/api/accounting/bank/match-batch',
      RECONCILE: '/api/accounting/bank/reconcile',
    },
    REPORTS: '/api/accounting/reports',
    DOCUMENTS: {
      LIST: '/api/accounting/documents',
      BY_ID: (id: string) => `/api/accounting/documents/${id}` as const,
    },
    SETUP: {
      BASE: '/api/accounting/setup',
      PRESETS: '/api/accounting/setup/presets',
    },
    CATEGORIES: {
      LIST: '/api/accounting/categories',
      BY_ID: (id: string) => `/api/accounting/categories/${id}` as const,
    },
    PARTNERS: '/api/accounting/partners',
    APY_CERTIFICATES: {
      LIST: '/api/accounting/apy-certificates',
      BY_ID: (id: string) => `/api/accounting/apy-certificates/${id}` as const,
      SEND_EMAIL: (id: string) => `/api/accounting/apy-certificates/${id}/send-email` as const,
    },
    FIXED_ASSETS: '/api/accounting/fixed-assets',
    EFKA: { SUMMARY: '/api/accounting/efka/summary' },
  },

  // ── Messages & Conversations ──────────────────────────────────────────
  MESSAGES: {
    PIN: '/api/messages/pin',
    EDIT: '/api/messages/edit',
    DELETE: '/api/messages/delete',
    REACTIONS: (messageId: string) => `/api/messages/${messageId}/reactions` as const,
  },
  CONVERSATIONS: {
    LIST: '/api/conversations',
    MESSAGES: (conversationId: string) => `/api/conversations/${conversationId}/messages` as const,
    SEND: (conversationId: string) => `/api/conversations/${conversationId}/send` as const,
  },

  // ── Notifications ─────────────────────────────────────────────────────
  NOTIFICATIONS: {
    LIST: '/api/notifications',
    DISPATCH: '/api/notifications/dispatch',
    ERROR_REPORT: '/api/notifications/error-report',
    READ: '/api/notifications/read',
    PREFERENCES: '/api/notifications/preferences',
    PROFESSIONAL_ASSIGNED: '/api/notifications/professional-assigned',
  },

  // ── Financial Intelligence ────────────────────────────────────────────
  FINANCIAL_INTELLIGENCE: {
    PORTFOLIO: '/api/financial-intelligence/portfolio',
    DEBT_MATURITY: '/api/financial-intelligence/debt-maturity',
    BUDGET_VARIANCE: '/api/financial-intelligence/budget-variance',
  },
  ECB: {
    FORWARD_RATES: '/api/ecb/forward-rates',
  },

  // ── Interest Calculator ───────────────────────────────────────────────
  EURIBOR: {
    RATES: '/api/euribor/rates',
    REFRESH: '/api/euribor/refresh',
  },
  SETTINGS: {
    BANK_SPREADS: '/api/settings/bank-spreads',
  },
  CALCULATOR: {
    COST: '/api/calculator/cost',
  },

  // ── Attendance ────────────────────────────────────────────────────────
  ATTENDANCE: {
    QR_GENERATE: '/api/attendance/qr/generate',
    QR_VALIDATE: '/api/attendance/qr/validate',
    CHECK_IN: '/api/attendance/check-in',
    GEOFENCE: '/api/attendance/geofence',
  },
  IKA: {
    ATTENDANCE_EVENTS: '/api/ika/attendance-events',
    EMPLOYMENT_RECORDS: '/api/ika/employment-records',
    EMPLOYMENT_RECORD_APD_STATUS: (recordId: string) => `/api/ika/employment-records/${recordId}/apd-status` as const,
    EFKA_DECLARATION: (projectId: string) => `/api/projects/${projectId}/efka-declaration` as const,
    /** ADR-307: impact preview before saving global ΕΦΚΑ labor compliance config */
    LABOR_COMPLIANCE_SAVE_PREVIEW: '/api/ika/labor-compliance-save-preview',
  },

  // ── Communications ────────────────────────────────────────────────────
  COMMUNICATIONS: {
    EMAIL: '/api/communications/email',
    EMAIL_PROPERTY_SHARE: '/api/communications/email/property-share/',
    SHARE_TO_CHANNEL: '/api/communications/share-to-channel',
  },

  // ── Voice & Calendar ──────────────────────────────────────────────────
  VOICE: {
    TRANSCRIBE: '/api/voice/transcribe',
    COMMAND: '/api/voice/command',
  },
  CALENDAR: {
    PARSE_EVENT: '/api/calendar/parse-event',
  },

  // ── Relationships ─────────────────────────────────────────────────────
  RELATIONSHIPS: {
    CREATE: '/api/relationships/create',
    REMOVE: '/api/relationships/remove',
    HIERARCHY: '/api/relationships/hierarchy',
    CHILDREN: '/api/relationships/children',
    PARENT: '/api/relationships/parent',
    VALIDATE_INTEGRITY: '/api/relationships/validate-integrity',
    CASCADE_DELETE: '/api/relationships/cascade-delete',
    AUDIT_TRAIL: '/api/relationships/audit-trail',
  },

  // ── Projects ───────────────────────────────────────────────────────────
  PROJECTS_BOOTSTRAP: {
    BOOTSTRAP: '/api/projects/bootstrap',
  },
  AUDIT_TRAIL: {
    RECORD: '/api/audit-trail/record',
    BY_ENTITY: (entityType: string, entityId: string) => `/api/audit-trail/${entityType}/${entityId}` as const,
    GLOBAL: '/api/audit-trail/global',
  },

  // ── Misc ──────────────────────────────────────────────────────────────
  UPLOAD: { PHOTO: '/api/upload/photo' },
  SEARCH: '/api/search',
  ENTERPRISE_IDS: { MIGRATE: '/api/enterprise-ids/migrate' },
  NAVIGATION: { COMPANY: '/api/navigation/company' },
  ENTITY_CODE: { SUGGEST: '/api/entity-code/suggest' },
  DELETION_GUARD: {
    CHECK: (entityType: string, entityId: string) => `/api/deletion-guard/${entityType}/${entityId}` as const,
  },
  LINK_REMOVAL_GUARD: {
    CHECK: (linkId: string) => `/api/link-removal-guard/${linkId}` as const,
  },
  GEOCODING: '/api/geocoding',
  DXF_AI: { COMMAND: '/api/dxf-ai/command' },

  // ── Entity Activity (generic) ─────────────────────────────────────────
  ENTITY_ACTIVITY: (entityType: string, entityId: string) => {
    const plural = entityType.endsWith('y')
      ? `${entityType.slice(0, -1)}ies`
      : `${entityType}s`;
    return `/api/${plural}/${entityId}/activity` as const;
  },
} as const;

// ── Backward-compatible flat aliases (DEPRECATED — migrate to nested form) ──
/** @deprecated Use API_ROUTES.AUTH.SESSION */
export const API_ROUTES_AUTH_SESSION = API_ROUTES.AUTH.SESSION;
/** @deprecated Use API_ROUTES.AUTH.MFA_ENROLL_COMPLETE */
export const API_ROUTES_AUTH_MFA_ENROLL_COMPLETE = API_ROUTES.AUTH.MFA_ENROLL_COMPLETE;

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
// MULTI-LEVEL PROPERTY DETECTION (ADR-236)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Property types that can span multiple floors
 * SSoT for multi-level detection — includes both canonical English
 * codes and legacy Greek values for backward compatibility.
 *
 * @since ADR-236 — Multi-Level Property Management
 */
export const MULTI_LEVEL_CAPABLE_TYPES: ReadonlySet<string> = new Set([
  // Canonical English codes
  'maisonette',       // Μεζονέτα
  'penthouse',        // Ρετιρέ
  'loft',             // Loft
  'shop',             // Κατάστημα
  'hall',             // Αίθουσα
  'detached_house',   // Μονοκατοικία
  'villa',            // Βίλα
  // Legacy Greek values (backward compat)
  'Μεζονέτα',
  'Κατάστημα',
]);

/**
 * Types that are ALWAYS multi-level (≥2 levels required by definition).
 * When user selects one of these, system auto-creates 2 levels.
 */
export const ALWAYS_MULTI_LEVEL_TYPES: ReadonlySet<string> = new Set([
  'maisonette', 'penthouse', 'loft',
]);

/**
 * Types that CAN be multi-level but user must confirm.
 * System asks "does this unit span multiple floors?" before creating levels.
 */
export const OPTIONALLY_MULTI_LEVEL_TYPES: ReadonlySet<string> = new Set([
  'shop', 'hall',
]);

/**
 * Check if a property type supports multi-level floors.
 * @param type — PropertyType value (canonical or legacy)
 */
export function isMultiLevelCapableType(type: string | undefined | null): boolean {
  if (!type) return false;
  return MULTI_LEVEL_CAPABLE_TYPES.has(type);
}

/** Check if a property type is ALWAYS multi-level (auto-create levels). */
export function isAlwaysMultiLevelType(type: string | undefined | null): boolean {
  if (!type) return false;
  return ALWAYS_MULTI_LEVEL_TYPES.has(type);
}

/** Check if a property type is OPTIONALLY multi-level (ask user). */
export function isOptionallyMultiLevelType(type: string | undefined | null): boolean {
  if (!type) return false;
  return OPTIONALLY_MULTI_LEVEL_TYPES.has(type);
}

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
