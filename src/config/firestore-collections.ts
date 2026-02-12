/**
 * 🏢 ENTERPRISE FIRESTORE COLLECTIONS CONFIGURATION
 *
 * Single source of truth για όλα τα Firestore collection names
 * Configurable μέσω environment variables για multi-tenant deployments
 *
 * @module config/firestore-collections
 */

// ============================================================================
// CORE COLLECTIONS
// ============================================================================

/**
 * Core business entity collections
 */
export const COLLECTIONS = {
  // 📞 CONTACTS & COMPANIES
  CONTACTS: process.env.NEXT_PUBLIC_CONTACTS_COLLECTION || 'contacts',
  COMPANIES: process.env.NEXT_PUBLIC_COMPANIES_COLLECTION || 'companies', // Legacy collection

  // 🏢 PROJECTS & PROPERTIES
  PROJECTS: process.env.NEXT_PUBLIC_PROJECTS_COLLECTION || 'projects',
  BUILDINGS: process.env.NEXT_PUBLIC_BUILDINGS_COLLECTION || 'buildings',
  UNITS: process.env.NEXT_PUBLIC_UNITS_COLLECTION || 'units',
  FLOORS: process.env.NEXT_PUBLIC_FLOORS_COLLECTION || 'floors',

  // 💬 COMMUNICATIONS
  COMMUNICATIONS: process.env.NEXT_PUBLIC_COMMUNICATIONS_COLLECTION || 'communications',
  MESSAGES: process.env.NEXT_PUBLIC_MESSAGES_COLLECTION || 'messages',
  NOTIFICATIONS: process.env.NEXT_PUBLIC_NOTIFICATIONS_COLLECTION || 'notifications',

  // 🌐 OMNICHANNEL CONVERSATIONS (Enterprise)
  CONVERSATIONS: process.env.NEXT_PUBLIC_CONVERSATIONS_COLLECTION || 'conversations',
  EXTERNAL_IDENTITIES: process.env.NEXT_PUBLIC_EXTERNAL_IDENTITIES_COLLECTION || 'external_identities',

  // 🎯 LEADS & CRM
  LEADS: process.env.NEXT_PUBLIC_LEADS_COLLECTION || 'leads',
  OPPORTUNITIES: process.env.NEXT_PUBLIC_OPPORTUNITIES_COLLECTION || 'opportunities',
  ACTIVITIES: process.env.NEXT_PUBLIC_ACTIVITIES_COLLECTION || 'activities',
  TASKS: process.env.NEXT_PUBLIC_TASKS_COLLECTION || 'tasks',
  OBLIGATIONS: process.env.NEXT_PUBLIC_OBLIGATIONS_COLLECTION || 'obligations',
  OBLIGATION_TEMPLATES: process.env.NEXT_PUBLIC_OBLIGATION_TEMPLATES_COLLECTION || 'obligationTemplates',
  OBLIGATION_TRANSMITTALS: process.env.NEXT_PUBLIC_OBLIGATION_TRANSMITTALS_COLLECTION || 'obligation_transmittals',
  ASSIGNMENT_POLICIES: process.env.NEXT_PUBLIC_ASSIGNMENT_POLICIES_COLLECTION || 'assignment_policies',

  // 📊 ANALYTICS & METRICS
  ANALYTICS: process.env.NEXT_PUBLIC_ANALYTICS_COLLECTION || 'analytics',
  METRICS: process.env.NEXT_PUBLIC_METRICS_COLLECTION || 'metrics',
  EVENTS: process.env.NEXT_PUBLIC_EVENTS_COLLECTION || 'events',

  // ⚙️ SYSTEM & CONFIGURATION
  SYSTEM: process.env.NEXT_PUBLIC_SYSTEM_COLLECTION || 'system',
  CONFIG: process.env.NEXT_PUBLIC_CONFIG_COLLECTION || 'config',
  SETTINGS: process.env.NEXT_PUBLIC_SETTINGS_COLLECTION || 'settings',
  NAVIGATION: process.env.NEXT_PUBLIC_NAVIGATION_COLLECTION || 'navigation_companies',

  // 👤 USER MANAGEMENT
  USERS: process.env.NEXT_PUBLIC_USERS_COLLECTION || 'users',
  TEAMS: process.env.NEXT_PUBLIC_TEAMS_COLLECTION || 'teams',
  ROLES: process.env.NEXT_PUBLIC_ROLES_COLLECTION || 'roles',
  PERMISSIONS: process.env.NEXT_PUBLIC_PERMISSIONS_COLLECTION || 'permissions',

  // 🏢 WORKSPACES (ADR-032: Workspace-based Multi-Tenancy)
  WORKSPACES: process.env.NEXT_PUBLIC_WORKSPACES_COLLECTION || 'workspaces',
  WORKSPACE_MEMBERS: process.env.NEXT_PUBLIC_WORKSPACE_MEMBERS_COLLECTION || 'workspace_members',

  // 🔄 RELATIONSHIPS
  RELATIONSHIPS: process.env.NEXT_PUBLIC_RELATIONSHIPS_COLLECTION || 'relationships',
  CONTACT_RELATIONSHIPS: process.env.NEXT_PUBLIC_CONTACT_RELATIONSHIPS_COLLECTION || 'contact_relationships',

  // 🔗 ASSOCIATIONS (ADR-032: Linking Model - ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
  CONTACT_LINKS: process.env.NEXT_PUBLIC_CONTACT_LINKS_COLLECTION || 'contact_links',
  FILE_LINKS: process.env.NEXT_PUBLIC_FILE_LINKS_COLLECTION || 'file_links',

  // 📋 FORMS & SURVEYS
  FORMS: process.env.NEXT_PUBLIC_FORMS_COLLECTION || 'forms',
  SUBMISSIONS: process.env.NEXT_PUBLIC_SUBMISSIONS_COLLECTION || 'submissions',
  SURVEYS: process.env.NEXT_PUBLIC_SURVEYS_COLLECTION || 'surveys',

  // 📄 DOCUMENTS & FILES
  DOCUMENTS: process.env.NEXT_PUBLIC_DOCUMENTS_COLLECTION || 'documents',
  FILES: process.env.NEXT_PUBLIC_FILES_COLLECTION || 'files',
  ATTACHMENTS: process.env.NEXT_PUBLIC_ATTACHMENTS_COLLECTION || 'attachments',

  // 🎨 CAD & TECHNICAL DRAWINGS (Enterprise Unified)
  CAD_FILES: process.env.NEXT_PUBLIC_CAD_FILES_COLLECTION || 'cadFiles',
  CAD_LAYERS: process.env.NEXT_PUBLIC_CAD_LAYERS_COLLECTION || 'cadLayers',
  CAD_SESSIONS: process.env.NEXT_PUBLIC_CAD_SESSIONS_COLLECTION || 'cadSessions',
  DXF_OVERLAY_LEVELS: process.env.NEXT_PUBLIC_DXF_OVERLAY_LEVELS_COLLECTION || 'dxfOverlayLevels',
  DXF_VIEWER_LEVELS: process.env.NEXT_PUBLIC_DXF_VIEWER_LEVELS_COLLECTION || 'dxfViewerLevels',

  // 📐 FLOORPLANS (Enterprise Unified)
  FLOORPLANS: process.env.NEXT_PUBLIC_FLOORPLANS_COLLECTION || 'floorplans',

  // 🅿️ PARKING & SPACES
  // 📍 Collection name: parking_spots (με underscore - όπως στη Firestore)
  PARKING_SPACES: process.env.NEXT_PUBLIC_PARKING_SPACES_COLLECTION || 'parking_spots',

  // 📋 OBLIGATIONS (Enterprise Sections)
  OBLIGATION_SECTIONS: process.env.NEXT_PUBLIC_OBLIGATION_SECTIONS_COLLECTION || 'obligationSections',

  // Legacy collections (maintained for backward compatibility)
  LAYERS: process.env.NEXT_PUBLIC_LAYERS_COLLECTION || 'layers',
  LAYER_GROUPS: process.env.NEXT_PUBLIC_LAYER_GROUPS_COLLECTION || 'layerGroups',
  PROPERTY_LAYERS: process.env.NEXT_PUBLIC_PROPERTY_LAYERS_COLLECTION || 'property-layers',
  LAYER_EVENTS: process.env.NEXT_PUBLIC_LAYER_EVENTS_COLLECTION || 'layer-events',

  // 🗓️ CALENDAR & SCHEDULING
  CALENDAR: process.env.NEXT_PUBLIC_CALENDAR_COLLECTION || 'calendar',
  APPOINTMENTS: process.env.NEXT_PUBLIC_APPOINTMENTS_COLLECTION || 'appointments',
  BOOKINGS: process.env.NEXT_PUBLIC_BOOKINGS_COLLECTION || 'bookings',

  // 🔧 MAINTENANCE & LOGS
  LOGS: process.env.NEXT_PUBLIC_LOGS_COLLECTION || 'logs',
  AUDIT: process.env.NEXT_PUBLIC_AUDIT_COLLECTION || 'audit',
  ERRORS: process.env.NEXT_PUBLIC_ERRORS_COLLECTION || 'errors',

  // 🏪 INVENTORY & ASSETS
  INVENTORY: process.env.NEXT_PUBLIC_INVENTORY_COLLECTION || 'inventory',
  ASSETS: process.env.NEXT_PUBLIC_ASSETS_COLLECTION || 'assets',
  STORAGE: process.env.NEXT_PUBLIC_STORAGE_COLLECTION || 'storage_units',

  // 💰 FINANCIAL
  INVOICES: process.env.NEXT_PUBLIC_INVOICES_COLLECTION || 'invoices',
  PAYMENTS: process.env.NEXT_PUBLIC_PAYMENTS_COLLECTION || 'payments',
  TRANSACTIONS: process.env.NEXT_PUBLIC_TRANSACTIONS_COLLECTION || 'transactions',

  // 🔐 SECURITY
  SESSIONS: process.env.NEXT_PUBLIC_SESSIONS_COLLECTION || 'sessions',
  TOKENS: process.env.NEXT_PUBLIC_TOKENS_COLLECTION || 'tokens',

  // 🌐 LOCALIZATION
  TRANSLATIONS: process.env.NEXT_PUBLIC_TRANSLATIONS_COLLECTION || 'translations',
  LOCALES: process.env.NEXT_PUBLIC_LOCALES_COLLECTION || 'locales',

  // 🔢 COUNTERS (Enterprise Sequential ID Generation)
  COUNTERS: process.env.NEXT_PUBLIC_COUNTERS_COLLECTION || 'counters',

  // ⚙️ USER PREFERENCES
  USER_NOTIFICATION_SETTINGS: process.env.NEXT_PUBLIC_USER_NOTIFICATION_SETTINGS_COLLECTION || 'user_notification_settings',
  USER_2FA_SETTINGS: process.env.NEXT_PUBLIC_USER_2FA_SETTINGS_COLLECTION || 'user_2fa_settings',
  USER_PREFERENCES: process.env.NEXT_PUBLIC_USER_PREFERENCES_COLLECTION || 'user_preferences',

  // 🤖 BOT CONFIGURATIONS (PR1: Telegram Enterprise Refactor)
  BOT_CONFIGS: process.env.NEXT_PUBLIC_BOT_CONFIGS_COLLECTION || 'bot_configs',
  BOT_CATALOGS: process.env.NEXT_PUBLIC_BOT_CATALOGS_COLLECTION || 'bot_catalogs',
  BOT_INTENTS: process.env.NEXT_PUBLIC_BOT_INTENTS_COLLECTION || 'bot_intents',

  // 🔍 SEARCH (Global Search v1)
  SEARCH_DOCUMENTS: process.env.NEXT_PUBLIC_SEARCH_DOCUMENTS_COLLECTION || 'searchDocuments',

  // 📧 EMAIL INGESTION QUEUE (ADR-071: Enterprise Email Webhook Queue)
  EMAIL_INGESTION_QUEUE: process.env.NEXT_PUBLIC_EMAIL_INGESTION_QUEUE_COLLECTION || 'email_ingestion_queue',

  // 🎤 VOICE COMMANDS (ADR-164: In-App Voice AI Pipeline)
  VOICE_COMMANDS: process.env.NEXT_PUBLIC_VOICE_COMMANDS_COLLECTION || 'voice_commands',

  // 🤖 AI PIPELINE (ADR-080: Universal AI Pipeline)
  AI_PIPELINE_QUEUE: process.env.NEXT_PUBLIC_AI_PIPELINE_QUEUE_COLLECTION || 'ai_pipeline_queue',
  AI_PIPELINE_AUDIT: process.env.NEXT_PUBLIC_AI_PIPELINE_AUDIT_COLLECTION || 'ai_pipeline_audit',

  // 🧠 AI CHAT HISTORY (ADR-171: Autonomous AI Agent — conversation memory)
  AI_CHAT_HISTORY: process.env.NEXT_PUBLIC_AI_CHAT_HISTORY_COLLECTION || 'ai_chat_history',

  // 🧠 AI SELF-IMPROVEMENT (ADR-173: Feedback + Learning)
  AI_AGENT_FEEDBACK: process.env.NEXT_PUBLIC_AI_AGENT_FEEDBACK_COLLECTION || 'ai_agent_feedback',
  AI_LEARNED_PATTERNS: process.env.NEXT_PUBLIC_AI_LEARNED_PATTERNS_COLLECTION || 'ai_learned_patterns',

  // 📋 SYSTEM AUDIT LOGS (Webhook/system-level audit events)
  SYSTEM_AUDIT_LOGS: process.env.NEXT_PUBLIC_SYSTEM_AUDIT_LOGS_COLLECTION || 'system_audit_logs',

  // 🏗️ CONSTRUCTION PHASES & TASKS (ADR-034: Gantt Chart)
  CONSTRUCTION_PHASES: process.env.NEXT_PUBLIC_CONSTRUCTION_PHASES_COLLECTION || 'construction_phases',
  CONSTRUCTION_TASKS: process.env.NEXT_PUBLIC_CONSTRUCTION_TASKS_COLLECTION || 'construction_tasks',

  // 👷 IKA/EFKA LABOR COMPLIANCE (ADR-090)
  ATTENDANCE_EVENTS: process.env.NEXT_PUBLIC_ATTENDANCE_EVENTS_COLLECTION || 'attendance_events',
  ATTENDANCE_QR_TOKENS: process.env.NEXT_PUBLIC_ATTENDANCE_QR_TOKENS_COLLECTION || 'attendance_qr_tokens',
  EMPLOYMENT_RECORDS: process.env.NEXT_PUBLIC_EMPLOYMENT_RECORDS_COLLECTION || 'employment_records',
  DIGITAL_WORK_CARDS: process.env.NEXT_PUBLIC_DIGITAL_WORK_CARDS_COLLECTION || 'digital_work_cards',

  // 🇪🇺 ESCO PROFESSIONAL CLASSIFICATION (ADR-034)
  // Cached subset of EU ESCO occupations taxonomy (~3.039 occupations, EL+EN)
  // Subcollection path: system/esco_cache/occupations
  ESCO_CACHE: process.env.NEXT_PUBLIC_ESCO_CACHE_COLLECTION || 'system/esco_cache/occupations',

  // 🇪🇺 ESCO SKILLS CLASSIFICATION (ADR-132)
  // Cached subset of EU ESCO skills taxonomy (~13.485 skills, EL+EN)
  // Subcollection path: system/esco_cache/skills
  ESCO_SKILLS_CACHE: process.env.NEXT_PUBLIC_ESCO_SKILLS_CACHE_COLLECTION || 'system/esco_cache/skills',

  // 📊 ACCOUNTING (Subapp — ADR-ACC-001 through ADR-ACC-010)
  ACCOUNTING_JOURNAL_ENTRIES: process.env.NEXT_PUBLIC_ACCOUNTING_JOURNAL_ENTRIES_COLLECTION || 'accounting_journal_entries',
  ACCOUNTING_INVOICES: process.env.NEXT_PUBLIC_ACCOUNTING_INVOICES_COLLECTION || 'accounting_invoices',
  ACCOUNTING_INVOICE_COUNTERS: process.env.NEXT_PUBLIC_ACCOUNTING_INVOICE_COUNTERS_COLLECTION || 'accounting_invoice_counters',
  ACCOUNTING_SETTINGS: process.env.NEXT_PUBLIC_ACCOUNTING_SETTINGS_COLLECTION || 'accounting_settings',
  ACCOUNTING_BANK_TRANSACTIONS: process.env.NEXT_PUBLIC_ACCOUNTING_BANK_TRANSACTIONS_COLLECTION || 'accounting_bank_transactions',
  ACCOUNTING_BANK_ACCOUNTS: process.env.NEXT_PUBLIC_ACCOUNTING_BANK_ACCOUNTS_COLLECTION || 'accounting_bank_accounts',
  ACCOUNTING_FIXED_ASSETS: process.env.NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS_COLLECTION || 'accounting_fixed_assets',
  ACCOUNTING_DEPRECIATION_RECORDS: process.env.NEXT_PUBLIC_ACCOUNTING_DEPRECIATION_RECORDS_COLLECTION || 'accounting_depreciation_records',
  ACCOUNTING_EFKA_PAYMENTS: process.env.NEXT_PUBLIC_ACCOUNTING_EFKA_PAYMENTS_COLLECTION || 'accounting_efka_payments',
  ACCOUNTING_EFKA_CONFIG: process.env.NEXT_PUBLIC_ACCOUNTING_EFKA_CONFIG_COLLECTION || 'accounting_efka_config',
  ACCOUNTING_EXPENSE_DOCUMENTS: process.env.NEXT_PUBLIC_ACCOUNTING_EXPENSE_DOCUMENTS_COLLECTION || 'accounting_expense_documents',
  ACCOUNTING_IMPORT_BATCHES: process.env.NEXT_PUBLIC_ACCOUNTING_IMPORT_BATCHES_COLLECTION || 'accounting_import_batches',
  ACCOUNTING_TAX_INSTALLMENTS: process.env.NEXT_PUBLIC_ACCOUNTING_TAX_INSTALLMENTS_COLLECTION || 'accounting_tax_installments',
} as const;

// ============================================================================
// SUBCOLLECTIONS
// ============================================================================

/**
 * Subcollection names for nested documents
 */
export const SUBCOLLECTIONS = {
  // Contact subcollections
  CONTACT_ACTIVITIES: process.env.NEXT_PUBLIC_CONTACT_ACTIVITIES_SUBCOL || 'activities',
  CONTACT_COMMUNICATIONS: process.env.NEXT_PUBLIC_CONTACT_COMMUNICATIONS_SUBCOL || 'communications',
  CONTACT_NOTES: process.env.NEXT_PUBLIC_CONTACT_NOTES_SUBCOL || 'notes',

  // Project subcollections
  PROJECT_TASKS: process.env.NEXT_PUBLIC_PROJECT_TASKS_SUBCOL || 'tasks',
  PROJECT_DOCUMENTS: process.env.NEXT_PUBLIC_PROJECT_DOCUMENTS_SUBCOL || 'documents',
  PROJECT_TIMELINE: process.env.NEXT_PUBLIC_PROJECT_TIMELINE_SUBCOL || 'timeline',

  // Building subcollections
  BUILDING_FLOORS: process.env.NEXT_PUBLIC_BUILDING_FLOORS_SUBCOL || 'floors',
  BUILDING_UNITS: process.env.NEXT_PUBLIC_BUILDING_UNITS_SUBCOL || 'units',
  BUILDING_MAINTENANCE: process.env.NEXT_PUBLIC_BUILDING_MAINTENANCE_SUBCOL || 'maintenance',

  // Unit subcollections
  UNIT_PHOTOS: process.env.NEXT_PUBLIC_UNIT_PHOTOS_SUBCOL || 'photos',
  UNIT_DOCUMENTS: process.env.NEXT_PUBLIC_UNIT_DOCUMENTS_SUBCOL || 'documents',
  UNIT_HISTORY: process.env.NEXT_PUBLIC_UNIT_HISTORY_SUBCOL || 'history',

  // User subcollections
  USER_PREFERENCES: process.env.NEXT_PUBLIC_USER_PREFERENCES_SUBCOL || 'preferences',
  USER_SESSIONS: process.env.NEXT_PUBLIC_USER_SESSIONS_SUBCOL || 'sessions',
  USER_NOTIFICATIONS: process.env.NEXT_PUBLIC_USER_NOTIFICATIONS_SUBCOL || 'notifications',

  // Company subcollections (RBAC paths: /companies/{id}/projects, /companies/{id}/units)
  COMPANY_PROJECTS: process.env.NEXT_PUBLIC_COMPANY_PROJECTS_SUBCOL || 'projects',
  COMPANY_UNITS: process.env.NEXT_PUBLIC_COMPANY_UNITS_SUBCOL || 'units',

  // Project subcollections (RBAC: /companies/{id}/projects/{id}/members)
  PROJECT_MEMBERS: process.env.NEXT_PUBLIC_PROJECT_MEMBERS_SUBCOL || 'members',

  // Unit subcollections (RBAC: /companies/{id}/units/{id}/grants)
  UNIT_GRANTS: process.env.NEXT_PUBLIC_UNIT_GRANTS_SUBCOL || 'grants'
} as const;

// ============================================================================
// SYSTEM DOCUMENT PATHS
// ============================================================================

/**
 * Common system document paths
 */
export const SYSTEM_DOCS = {
  COMPANY_CONFIG: process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company',
  APP_SETTINGS: process.env.NEXT_PUBLIC_APP_SETTINGS_DOC || 'app_settings',
  FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS_DOC || 'feature_flags',
  MAINTENANCE_MODE: process.env.NEXT_PUBLIC_MAINTENANCE_MODE_DOC || 'maintenance',
  API_LIMITS: process.env.NEXT_PUBLIC_API_LIMITS_DOC || 'api_limits',
  TENANT_CONFIG: process.env.NEXT_PUBLIC_TENANT_CONFIG_DOC || 'tenant',

  // 🛡️ SUPER ADMIN REGISTRY (ADR-145: Super Admin AI Assistant)
  // Path: settings/super_admin_registry
  SUPER_ADMIN_REGISTRY: process.env.NEXT_PUBLIC_SUPER_ADMIN_REGISTRY_DOC || 'super_admin_registry'
} as const;

// ============================================================================
// FIRESTORE QUERY LIMITS
// ============================================================================

/**
 * Firestore query operation limits
 *
 * @see https://firebase.google.com/docs/firestore/query-data/queries#in_not-in_and_array-contains-any
 */
export const FIRESTORE_LIMITS = {
  /**
   * Maximum items in 'in', 'not-in', and 'array-contains-any' queries
   * Firestore hard limit: 10 items
   *
   * Usage:
   * ```typescript
   * import { FIRESTORE_LIMITS } from '@/config/firestore-collections';
   *
   * const chunks = chunkArray(ids, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);
   * ```
   */
  IN_QUERY_MAX_ITEMS: 10,

  /**
   * Maximum composite filters in a query
   * Firestore hard limit: 30 filters
   */
  MAX_COMPOSITE_FILTERS: 30,

  /**
   * Recommended batch size for write operations
   * Firestore hard limit: 500 operations per batch
   */
  BATCH_WRITE_LIMIT: 500
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get collection name με type safety
 */
export function getCollectionName(collectionKey: keyof typeof COLLECTIONS): string {
  return COLLECTIONS[collectionKey];
}

/**
 * Get subcollection name με type safety
 */
export function getSubcollectionName(subcollectionKey: keyof typeof SUBCOLLECTIONS): string {
  return SUBCOLLECTIONS[subcollectionKey];
}

/**
 * Get system document path με type safety
 */
export function getSystemDocPath(docKey: keyof typeof SYSTEM_DOCS): string {
  return SYSTEM_DOCS[docKey];
}

/**
 * Build full document path
 */
export function buildDocPath(collection: keyof typeof COLLECTIONS, docId: string): string {
  return `${COLLECTIONS[collection]}/${docId}`;
}

/**
 * Build full subcollection path
 */
export function buildSubcollectionPath(
  collection: keyof typeof COLLECTIONS,
  docId: string,
  subcollection: keyof typeof SUBCOLLECTIONS
): string {
  return `${COLLECTIONS[collection]}/${docId}/${SUBCOLLECTIONS[subcollection]}`;
}

/**
 * Validate collection name exists
 * ✅ ENTERPRISE: Type-safe collection validation
 */
export function isValidCollection(collectionName: string): boolean {
  return (Object.values(COLLECTIONS) as string[]).includes(collectionName);
}

/**
 * Get all collection names για debugging
 */
export function getAllCollections(): Record<string, string> {
  return { ...COLLECTIONS };
}

/**
 * Get collection configuration summary για logging
 */
export function getCollectionConfigSummary(): {
  totalCollections: number;
  totalSubcollections: number;
  customizedCollections: number;
  environment: string;
} {
  const customizedCount = Object.entries(COLLECTIONS).reduce((count, [key]) => {
    const envVar = `NEXT_PUBLIC_${key}_COLLECTION`;
    return process.env[envVar] ? count + 1 : count;
  }, 0);

  return {
    totalCollections: Object.keys(COLLECTIONS).length,
    totalSubcollections: Object.keys(SUBCOLLECTIONS).length,
    customizedCollections: customizedCount,
    environment: process.env.NODE_ENV || 'development'
  };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CollectionKey = keyof typeof COLLECTIONS;
export type SubcollectionKey = keyof typeof SUBCOLLECTIONS;
export type SystemDocKey = keyof typeof SYSTEM_DOCS;

// Default export για backward compatibility
export default COLLECTIONS;

