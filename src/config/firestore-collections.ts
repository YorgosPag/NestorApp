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
  PROPERTIES: process.env.NEXT_PUBLIC_PROPERTIES_COLLECTION || 'properties',
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
  OBLIGATION_TEMPLATES: process.env.NEXT_PUBLIC_OBLIGATION_TEMPLATES_COLLECTION || 'obligation_templates',
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
  // ADR-336 — self-extending taxonomy of custom relationship types
  // (label registry for user-created relationship types beyond the 31 static ones in code).
  CONTACT_RELATIONSHIP_TYPE_REGISTRY:
    process.env.NEXT_PUBLIC_CONTACT_RELATIONSHIP_TYPE_REGISTRY_COLLECTION ||
    'contact_relationship_type_registry',

  // 🔗 ASSOCIATIONS (ADR-032: Linking Model - ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
  CONTACT_LINKS: process.env.NEXT_PUBLIC_CONTACT_LINKS_COLLECTION || 'contact_links',
  FILE_LINKS: process.env.NEXT_PUBLIC_FILE_LINKS_COLLECTION || 'file_links',

  // 📋 FORMS & SURVEYS
  FORMS: process.env.NEXT_PUBLIC_FORMS_COLLECTION || 'forms',
  SUBMISSIONS: process.env.NEXT_PUBLIC_SUBMISSIONS_COLLECTION || 'submissions',
  SURVEYS: process.env.NEXT_PUBLIC_SURVEYS_COLLECTION || 'surveys',

  // 📄 FILES (SSoT: all uploaded files — floorplans, DXF, photos, documents)
  FILES: process.env.NEXT_PUBLIC_FILES_COLLECTION || 'files',
  ATTACHMENTS: process.env.NEXT_PUBLIC_ATTACHMENTS_COLLECTION || 'attachments',

  // 🎨 CAD & TECHNICAL DRAWINGS (Enterprise Unified)
  /** @deprecated ADR-292 Phase 3: Writes stopped, reads eliminated. All DXF metadata lives in FILES collection. */
  CAD_FILES: process.env.NEXT_PUBLIC_CAD_FILES_COLLECTION || 'cad_files',
  CAD_LAYERS: process.env.NEXT_PUBLIC_CAD_LAYERS_COLLECTION || 'cad_layers',
  CAD_SESSIONS: process.env.NEXT_PUBLIC_CAD_SESSIONS_COLLECTION || 'cad_sessions',
  DXF_OVERLAY_LEVELS: process.env.NEXT_PUBLIC_DXF_OVERLAY_LEVELS_COLLECTION || 'dxf_overlay_levels',
  DXF_VIEWER_LEVELS: process.env.NEXT_PUBLIC_DXF_VIEWER_LEVELS_COLLECTION || 'dxf_viewer_levels',

  // 📐 FLOORPLANS (Enterprise Unified)
  FLOORPLANS: process.env.NEXT_PUBLIC_FLOORPLANS_COLLECTION || 'floorplans',
  PROJECT_FLOORPLANS: process.env.NEXT_PUBLIC_PROJECT_FLOORPLANS_COLLECTION || 'project_floorplans',
  /** ADR-292 Phase 4 legacy — reads/writes go through `files`; counts only for showcase MVP (ADR-312). */
  UNIT_FLOORPLANS: process.env.NEXT_PUBLIC_UNIT_FLOORPLANS_COLLECTION || 'unit_floorplans',
  /** ADR-340: Floorplan background domain entities (PDF/Image, 1 per floor, calibration, transform). */
  FLOORPLAN_BACKGROUNDS: process.env.NEXT_PUBLIC_FLOORPLAN_BACKGROUNDS_COLLECTION || 'floorplan_backgrounds',
  /** ADR-340: Floorplan polygon overlays (FK → floorplan_backgrounds, tenant-scoped). */
  FLOORPLAN_OVERLAYS: process.env.NEXT_PUBLIC_FLOORPLAN_OVERLAYS_COLLECTION || 'floorplan_overlays',

  // 🅿️ PARKING & SPACES
  // 📍 Collection name: parking_spots (με underscore - όπως στη Firestore)
  PARKING_SPACES: process.env.NEXT_PUBLIC_PARKING_SPACES_COLLECTION || 'parking_spots',

  // Legacy collections (maintained for backward compatibility)
  LAYERS: process.env.NEXT_PUBLIC_LAYERS_COLLECTION || 'layers',
  LAYER_GROUPS: process.env.NEXT_PUBLIC_LAYER_GROUPS_COLLECTION || 'layer_groups',
  PROPERTY_LAYERS: process.env.NEXT_PUBLIC_PROPERTY_LAYERS_COLLECTION || 'property-layers',
  LAYER_EVENTS: process.env.NEXT_PUBLIC_LAYER_EVENTS_COLLECTION || 'layer-events',

  // 🗓️ CALENDAR & SCHEDULING
  CALENDAR: process.env.NEXT_PUBLIC_CALENDAR_COLLECTION || 'calendar',
  APPOINTMENTS: process.env.NEXT_PUBLIC_APPOINTMENTS_COLLECTION || 'appointments',
  BOOKINGS: process.env.NEXT_PUBLIC_BOOKINGS_COLLECTION || 'bookings',
  BOOKING_SESSIONS: process.env.NEXT_PUBLIC_BOOKING_SESSIONS_COLLECTION || 'booking_sessions',

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
  SECURITY_ROLES: process.env.NEXT_PUBLIC_SECURITY_ROLES_COLLECTION || 'security_roles',
  EMAIL_DOMAIN_POLICIES: process.env.NEXT_PUBLIC_EMAIL_DOMAIN_POLICIES_COLLECTION || 'email_domain_policies',
  COUNTRY_SECURITY_POLICIES: process.env.NEXT_PUBLIC_COUNTRY_SECURITY_POLICIES_COLLECTION || 'country_security_policies',

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
  SEARCH_DOCUMENTS: process.env.NEXT_PUBLIC_SEARCH_DOCUMENTS_COLLECTION || 'search_documents',

  // 📧 EMAIL INGESTION QUEUE (ADR-071: Enterprise Email Webhook Queue)
  EMAIL_INGESTION_QUEUE: process.env.NEXT_PUBLIC_EMAIL_INGESTION_QUEUE_COLLECTION || 'email_ingestion_queue',

  // 🎤 VOICE COMMANDS (ADR-164: In-App Voice AI Pipeline)
  VOICE_COMMANDS: process.env.NEXT_PUBLIC_VOICE_COMMANDS_COLLECTION || 'voice_commands',

  // 🤖 AI PIPELINE (ADR-080: Universal AI Pipeline)
  AI_PIPELINE_QUEUE: process.env.NEXT_PUBLIC_AI_PIPELINE_QUEUE_COLLECTION || 'ai_pipeline_queue',
  AI_PIPELINE_AUDIT: process.env.NEXT_PUBLIC_AI_PIPELINE_AUDIT_COLLECTION || 'ai_pipeline_audit',

  // 🧠 AI CHAT HISTORY (ADR-171: Autonomous AI Agent — conversation memory)
  AI_CHAT_HISTORY: process.env.NEXT_PUBLIC_AI_CHAT_HISTORY_COLLECTION || 'ai_chat_history',

  // ⏳ AI PENDING ACTIONS (ADR-171: Duplicate contact resolution via inline keyboards)
  AI_PENDING_ACTIONS: process.env.NEXT_PUBLIC_AI_PENDING_ACTIONS_COLLECTION || 'ai_pending_actions',

  // 🧠 AI SELF-IMPROVEMENT (ADR-173: Feedback + Learning)
  AI_AGENT_FEEDBACK: process.env.NEXT_PUBLIC_AI_AGENT_FEEDBACK_COLLECTION || 'ai_agent_feedback',
  AI_LEARNED_PATTERNS: process.env.NEXT_PUBLIC_AI_LEARNED_PATTERNS_COLLECTION || 'ai_learned_patterns',
  /** 🧠 AI Query Strategy Memory — remembers which query approaches work/fail per collection */
  AI_QUERY_STRATEGIES: 'ai_query_strategies',

  // 💰 AI USAGE TRACKING (ADR-259A: Cost Protection — per-user monthly token/cost tracking)
  AI_USAGE: process.env.NEXT_PUBLIC_AI_USAGE_COLLECTION || 'ai_usage',

  // 📋 AUDIT LOGS
  SYSTEM_AUDIT_LOGS: process.env.NEXT_PUBLIC_SYSTEM_AUDIT_LOGS_COLLECTION || 'system_audit_logs',
  /** Cloud Function audit log (orphan cleanup, system events) */
  CLOUD_FUNCTION_AUDIT_LOG: process.env.NEXT_PUBLIC_CLOUD_FUNCTION_AUDIT_LOG_COLLECTION || 'audit_log',

  // 🏗️ CONSTRUCTION PHASES, TASKS & BASELINES (ADR-034, ADR-266)
  CONSTRUCTION_PHASES: process.env.NEXT_PUBLIC_CONSTRUCTION_PHASES_COLLECTION || 'construction_phases',
  CONSTRUCTION_TASKS: process.env.NEXT_PUBLIC_CONSTRUCTION_TASKS_COLLECTION || 'construction_tasks',
  CONSTRUCTION_BASELINES: process.env.NEXT_PUBLIC_CONSTRUCTION_BASELINES_COLLECTION || 'construction_baselines',
  CONSTRUCTION_RESOURCE_ASSIGNMENTS: process.env.NEXT_PUBLIC_CONSTRUCTION_RESOURCE_ASSIGNMENTS_COLLECTION || 'construction_resource_assignments',

  // 🏗️ BUILDING MILESTONES (Building Timeline CRUD)
  BUILDING_MILESTONES: process.env.NEXT_PUBLIC_BUILDING_MILESTONES_COLLECTION || 'building_milestones',

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
  ACCOUNTING_APY_CERTIFICATES: process.env.NEXT_PUBLIC_ACCOUNTING_APY_CERTIFICATES_COLLECTION || 'accounting_apy_certificates',
  ACCOUNTING_CUSTOM_CATEGORIES: process.env.NEXT_PUBLIC_ACCOUNTING_CUSTOM_CATEGORIES_COLLECTION || 'accounting_custom_categories',
  ACCOUNTING_CUSTOMER_BALANCES: process.env.NEXT_PUBLIC_ACCOUNTING_CUSTOMER_BALANCES_COLLECTION || 'accounting_customer_balances',
  ACCOUNTING_FISCAL_PERIODS: process.env.NEXT_PUBLIC_ACCOUNTING_FISCAL_PERIODS_COLLECTION || 'accounting_fiscal_periods',
  ACCOUNTING_MATCHING_RULES: process.env.NEXT_PUBLIC_ACCOUNTING_MATCHING_RULES_COLLECTION || 'accounting_matching_rules',
  ACCOUNTING_AUDIT_LOG: process.env.NEXT_PUBLIC_ACCOUNTING_AUDIT_LOG_COLLECTION || 'accounting_audit_log',

  // 📄 FILE AUDIT LOG (ADR-191: Enterprise Document Management — Phase 3.1)
  FILE_AUDIT_LOG: process.env.NEXT_PUBLIC_FILE_AUDIT_LOG_COLLECTION || 'file_audit_log',

  /**
   * 🔗 FILE SHARES (ADR-191: Enterprise Document Management — Phase 4.2)
   * @deprecated ADR-315 Phase M5: will be replaced by SHARES. Legacy reads during M1–M4 migration window.
   */
  FILE_SHARES: process.env.NEXT_PUBLIC_FILE_SHARES_COLLECTION || 'file_shares',

  // 📸 PHOTO SHARES — CRM Contact Channel Share History
  PHOTO_SHARES: process.env.NEXT_PUBLIC_PHOTO_SHARES_COLLECTION || 'photo_shares',

  // 🔗 UNIFIED SHARES (ADR-315: Polymorphic sharing SSoT — file + contact + property_showcase)
  SHARES: process.env.NEXT_PUBLIC_SHARES_COLLECTION || 'shares',
  // 📤 SHARE DISPATCHES (ADR-315: One record per channel send — email / telegram / whatsapp / messenger / instagram)
  SHARE_DISPATCHES: process.env.NEXT_PUBLIC_SHARE_DISPATCHES_COLLECTION || 'share_dispatches',

  // 💬 FILE COMMENTS (ADR-191: Enterprise Document Management — Phase 4.3)
  FILE_COMMENTS: process.env.NEXT_PUBLIC_FILE_COMMENTS_COLLECTION || 'file_comments',

  // 📁 FILE FOLDERS (ADR-191: Enterprise Document Management — Phase 4.4)
  FILE_FOLDERS: process.env.NEXT_PUBLIC_FILE_FOLDERS_COLLECTION || 'file_folders',

  // ✅ FILE APPROVALS (ADR-191: Enterprise Document Management — Phase 3.3)
  FILE_APPROVALS: process.env.NEXT_PUBLIC_FILE_APPROVALS_COLLECTION || 'file_approvals',

  // 📦 DOCUMENT TEMPLATES (ADR-191: Enterprise Document Management — Phase 4.1)
  DOCUMENT_TEMPLATES: process.env.NEXT_PUBLIC_DOCUMENT_TEMPLATES_COLLECTION || 'document_templates',

  // 📜 ENTITY AUDIT TRAIL (ADR-195: Entity Change History)
  ENTITY_AUDIT_TRAIL: process.env.NEXT_PUBLIC_ENTITY_AUDIT_TRAIL_COLLECTION || 'entity_audit_trail',

  // 📍 ADDRESS CORRECTIONS LOG (ADR-332 §3.7 Phase 9: Telemetry)
  ADDRESS_CORRECTIONS_LOG: process.env.NEXT_PUBLIC_ADDRESS_CORRECTIONS_LOG_COLLECTION || 'address_corrections_log',

  // 📐 BOQ / QUANTITY SURVEYING (ADR-175: Σύστημα Επιμετρήσεων)
  BOQ_ITEMS: process.env.NEXT_PUBLIC_BOQ_ITEMS_COLLECTION || 'boq_items',
  BOQ_CATEGORIES: process.env.NEXT_PUBLIC_BOQ_CATEGORIES_COLLECTION || 'boq_categories',
  BOQ_SYSTEM_SUBCATEGORIES: process.env.NEXT_PUBLIC_BOQ_SYSTEM_SUBCATEGORIES_COLLECTION || 'boq_system_subcategories',
  BOQ_PRICE_LISTS: process.env.NEXT_PUBLIC_BOQ_PRICE_LISTS_COLLECTION || 'boq_price_lists',
  BOQ_TEMPLATES: process.env.NEXT_PUBLIC_BOQ_TEMPLATES_COLLECTION || 'boq_templates',

  // 🧾 CHEQUE REGISTRY (ADR-234 Phase 3 — SPEC-234A)
  CHEQUES: process.env.NEXT_PUBLIC_CHEQUES_COLLECTION || 'cheques',

  // ⚖️ LEGAL CONTRACTS & BROKERAGE (ADR-230: Contract Workflow & Legal Process)
  LEGAL_CONTRACTS: process.env.NEXT_PUBLIC_LEGAL_CONTRACTS_COLLECTION || 'legal_contracts',
  BROKERAGE_AGREEMENTS: process.env.NEXT_PUBLIC_BROKERAGE_AGREEMENTS_COLLECTION || 'brokerage_agreements',
  COMMISSION_RECORDS: process.env.NEXT_PUBLIC_COMMISSION_RECORDS_COLLECTION || 'commission_records',

  // 📊 OWNERSHIP PERCENTAGE TABLE (ADR-235: Πίνακας Χιλιοστών Συνιδιοκτησίας)
  OWNERSHIP_TABLES: process.env.NEXT_PUBLIC_OWNERSHIP_TABLES_COLLECTION || 'ownership_tables',

  /** @deprecated ADR-292 Phase 4: Legacy reads eliminated. All floor floorplans in FILES collection. */
  FLOOR_FLOORPLANS: process.env.NEXT_PUBLIC_FLOOR_FLOORPLANS_COLLECTION || 'floor_floorplans',

  // 🔗 FILE WEBHOOKS (ADR-191: Enterprise Document Management — Phase 5.4)
  FILE_WEBHOOKS: process.env.NEXT_PUBLIC_FILE_WEBHOOKS_COLLECTION || 'file_webhooks',

  // 📦 PROCUREMENT (ADR-267: Lightweight Procurement Module)
  PURCHASE_ORDERS: process.env.NEXT_PUBLIC_PURCHASE_ORDERS_COLLECTION || 'purchase_orders',
  PURCHASE_ORDER_COUNTERS: process.env.NEXT_PUBLIC_PURCHASE_ORDER_COUNTERS_COLLECTION || 'purchase_order_counters',
  PO_SHARES: process.env.NEXT_PUBLIC_PO_SHARES_COLLECTION || 'po_shares',

  // 📊 SAVED REPORTS (ADR-268 Phase 7: Saved Reports)
  SAVED_REPORTS: process.env.NEXT_PUBLIC_SAVED_REPORTS_COLLECTION || 'saved_reports',

  // 📋 QUOTES & RFQ (ADR-327: Quote Management & Comparison System)
  RFQS: process.env.NEXT_PUBLIC_RFQS_COLLECTION || 'rfqs',
  QUOTES: process.env.NEXT_PUBLIC_QUOTES_COLLECTION || 'quotes',
  QUOTE_COUNTERS: process.env.NEXT_PUBLIC_QUOTE_COUNTERS_COLLECTION || 'quote_counters',
  VENDOR_INVITES: process.env.NEXT_PUBLIC_VENDOR_INVITES_COLLECTION || 'vendor_invites',
  VENDOR_INVITE_TOKENS: process.env.NEXT_PUBLIC_VENDOR_INVITE_TOKENS_COLLECTION || 'vendor_invite_tokens',
  TRADES: process.env.NEXT_PUBLIC_TRADES_COLLECTION || 'trades',
  // ADR-327 §17 Q28-Q31 Multi-Vendor extension (2026-04-29)
  SOURCING_EVENTS: process.env.NEXT_PUBLIC_SOURCING_EVENTS_COLLECTION || 'sourcing_events',
  RFQ_LINES_SUB: 'lines',

  // 📦 MATERIAL CATALOG (ADR-330 Phase 4)
  MATERIALS: process.env.NEXT_PUBLIC_MATERIALS_COLLECTION || 'materials',

  // 📜 FRAMEWORK AGREEMENTS (ADR-330 Phase 5)
  FRAMEWORK_AGREEMENTS:
    process.env.NEXT_PUBLIC_FRAMEWORK_AGREEMENTS_COLLECTION || 'framework_agreements',
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
  BUILDING_PROPERTIES: process.env.NEXT_PUBLIC_BUILDING_PROPERTIES_SUBCOL || 'properties',
  BUILDING_MAINTENANCE: process.env.NEXT_PUBLIC_BUILDING_MAINTENANCE_SUBCOL || 'maintenance',

  // Property subcollections
  PROPERTY_PHOTOS: process.env.NEXT_PUBLIC_PROPERTY_PHOTOS_SUBCOL || 'photos',
  PROPERTY_DOCUMENTS: process.env.NEXT_PUBLIC_PROPERTY_DOCUMENTS_SUBCOL || 'documents',
  PROPERTY_HISTORY: process.env.NEXT_PUBLIC_PROPERTY_HISTORY_SUBCOL || 'history',

  // Property payment subcollections (ADR-234: Payment Plan & Installment Tracking)
  PROPERTY_PAYMENT_PLANS: process.env.NEXT_PUBLIC_PROPERTY_PAYMENT_PLANS_SUBCOL || 'payment_plans',
  PROPERTY_PAYMENTS: process.env.NEXT_PUBLIC_PROPERTY_PAYMENTS_SUBCOL || 'payments',

  // User subcollections
  USER_PREFERENCES: process.env.NEXT_PUBLIC_USER_PREFERENCES_SUBCOL || 'preferences',
  USER_SESSIONS: process.env.NEXT_PUBLIC_USER_SESSIONS_SUBCOL || 'sessions',
  USER_NOTIFICATIONS: process.env.NEXT_PUBLIC_USER_NOTIFICATIONS_SUBCOL || 'notifications',

  // Company subcollections (RBAC paths: /companies/{id}/projects, /companies/{id}/properties)
  COMPANY_PROJECTS: process.env.NEXT_PUBLIC_COMPANY_PROJECTS_SUBCOL || 'projects',
  COMPANY_PROPERTIES: process.env.NEXT_PUBLIC_COMPANY_PROPERTIES_SUBCOL || 'properties',

  // Project subcollections (RBAC: /companies/{id}/projects/{id}/members)
  PROJECT_MEMBERS: process.env.NEXT_PUBLIC_PROJECT_MEMBERS_SUBCOL || 'members',

  // Company member subcollections (ADR-244: Role Management — /companies/{id}/members/{uid})
  COMPANY_MEMBERS: process.env.NEXT_PUBLIC_COMPANY_MEMBERS_SUBCOL || 'members',

  // Property subcollections (RBAC: /companies/{id}/properties/{id}/grants)
  PROPERTY_GRANTS: process.env.NEXT_PUBLIC_PROPERTY_GRANTS_SUBCOL || 'grants',

  // File subcollections (ADR-191: Document Management)
  FILE_VERSIONS: process.env.NEXT_PUBLIC_FILE_VERSIONS_SUBCOL || 'versions',

  // Ownership table revisions (ADR-235)
  OWNERSHIP_REVISIONS: process.env.NEXT_PUBLIC_OWNERSHIP_REVISIONS_SUBCOL || 'revisions',

  // Company audit logs (ADR-210: subcollection under companies/{id})
  COMPANY_AUDIT_LOGS: process.env.NEXT_PUBLIC_COMPANY_AUDIT_LOGS_SUBCOL || 'audit_logs',

  // Contact bank accounts (subcollection under contacts/{id})
  BANK_ACCOUNTS: process.env.NEXT_PUBLIC_BANK_ACCOUNTS_SUBCOL || 'bank_accounts',

  // Quote subcollections (ADR-329: Quote Comments)
  QUOTE_COMMENTS: process.env.NEXT_PUBLIC_QUOTE_COMMENTS_SUBCOL || 'quote_comments',
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
  SUPER_ADMIN_REGISTRY: process.env.NEXT_PUBLIC_SUPER_ADMIN_REGISTRY_DOC || 'super_admin_registry',

  // 👷 LABOR COMPLIANCE SETTINGS (ADR-090: IKA/EFKA — Insurance Classes & Contribution Rates)
  // Path: settings/labor_compliance
  LABOR_COMPLIANCE_SETTINGS: process.env.NEXT_PUBLIC_LABOR_COMPLIANCE_SETTINGS_DOC || 'labor_compliance',

  // 📊 INTEREST COST CALCULATOR (ADR-234 Phase 4 — SPEC-234E)
  // Path: settings/euribor_rates — Cached ECB Euribor rates (24h TTL)
  EURIBOR_RATES: process.env.NEXT_PUBLIC_EURIBOR_RATES_DOC || 'euribor_rates',
  // Path: settings/bank_spreads — Bank spread configuration
  BANK_SPREADS: process.env.NEXT_PUBLIC_BANK_SPREADS_DOC || 'bank_spreads',

  // ⚙️ SYSTEM SETTINGS (ADR-245B: Hardcoded Strings Audit)
  // Path: system/settings — Global system configuration (admin config, email routing, etc.)
  SYSTEM_SETTINGS: process.env.NEXT_PUBLIC_SYSTEM_SETTINGS_DOC || 'settings',

  // 🤖 AI TOOL ANALYTICS (ADR-245B: Hardcoded Strings Audit)
  // Path: settings/ai_tool_analytics — Aggregated AI tool usage analytics
  AI_TOOL_ANALYTICS: process.env.NEXT_PUBLIC_AI_TOOL_ANALYTICS_DOC || 'ai_tool_analytics',

  // 📊 ACCOUNTING SETTINGS DOCUMENTS (ADR-245B: Hardcoded Strings Audit)
  // Path: accounting_settings/{docId} — Accounting subsystem singleton documents
  ACCT_COMPANY_PROFILE: process.env.NEXT_PUBLIC_ACCT_COMPANY_PROFILE_DOC || 'company_profile',
  ACCT_PARTNERS: process.env.NEXT_PUBLIC_ACCT_PARTNERS_DOC || 'partners',
  ACCT_MEMBERS: process.env.NEXT_PUBLIC_ACCT_MEMBERS_DOC || 'members',
  ACCT_SHAREHOLDERS: process.env.NEXT_PUBLIC_ACCT_SHAREHOLDERS_DOC || 'shareholders',
  ACCT_SERVICE_PRESETS: process.env.NEXT_PUBLIC_ACCT_SERVICE_PRESETS_DOC || 'service_presets',

  // 📊 ACCOUNTING EFKA CONFIG DOCUMENT (ADR-245B: Hardcoded Strings Audit)
  // Path: accounting_efka_config/user_config — EFKA user configuration
  ACCT_EFKA_USER_CONFIG: process.env.NEXT_PUBLIC_ACCT_EFKA_USER_CONFIG_DOC || 'user_config',

  // 🔄 ACCOUNTING MATCHING ENGINE CONFIG (Phase 2a — SAP/Midday pattern)
  // Path: accounting_settings/matching_config — Weighted scoring weights + thresholds
  ACCT_MATCHING_CONFIG: process.env.NEXT_PUBLIC_ACCT_MATCHING_CONFIG_DOC || 'matching_config',

  // 🔔 UI SYNC SIGNAL (Server→Client bridge for AI agent mutations)
  // Path: config/ui_sync_signal — Written by Admin SDK, read by client onSnapshot
  // Allows server-side AI operations to notify the client UI of Firestore changes
  UI_SYNC_SIGNAL: 'ui_sync_signal',
} as const;

// ============================================================================
// SUBCOLLECTION → PARENT MAPPING (ADR-313: Enterprise Backup & Restore)
// ============================================================================

/**
 * Maps each SUBCOLLECTIONS key to its parent COLLECTIONS key.
 * Used by BackupService to traverse subcollections during export.
 *
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */
export const SUBCOLLECTION_PARENTS: Record<string, string> = {
  // Contact subcollections → CONTACTS
  CONTACT_ACTIVITIES: 'CONTACTS',
  CONTACT_COMMUNICATIONS: 'CONTACTS',
  CONTACT_NOTES: 'CONTACTS',
  BANK_ACCOUNTS: 'CONTACTS',

  // Project subcollections → PROJECTS
  PROJECT_TASKS: 'PROJECTS',
  PROJECT_DOCUMENTS: 'PROJECTS',
  PROJECT_TIMELINE: 'PROJECTS',
  PROJECT_MEMBERS: 'PROJECTS',

  // Building subcollections → BUILDINGS
  BUILDING_FLOORS: 'BUILDINGS',
  BUILDING_PROPERTIES: 'BUILDINGS',
  BUILDING_MAINTENANCE: 'BUILDINGS',

  // Property subcollections → PROPERTIES
  PROPERTY_PHOTOS: 'PROPERTIES',
  PROPERTY_DOCUMENTS: 'PROPERTIES',
  PROPERTY_HISTORY: 'PROPERTIES',
  PROPERTY_PAYMENT_PLANS: 'PROPERTIES',
  PROPERTY_PAYMENTS: 'PROPERTIES',
  PROPERTY_GRANTS: 'PROPERTIES',

  // User subcollections → USERS
  USER_PREFERENCES: 'USERS',
  USER_SESSIONS: 'USERS',
  USER_NOTIFICATIONS: 'USERS',

  // Company subcollections → COMPANIES
  COMPANY_PROJECTS: 'COMPANIES',
  COMPANY_PROPERTIES: 'COMPANIES',
  COMPANY_MEMBERS: 'COMPANIES',
  COMPANY_AUDIT_LOGS: 'COMPANIES',

  // File subcollections → FILES
  FILE_VERSIONS: 'FILES',

  // Ownership table subcollections → OWNERSHIP_TABLES
  OWNERSHIP_REVISIONS: 'OWNERSHIP_TABLES',
} as const;

// ============================================================================
// IMMUTABLE COLLECTIONS (ADR-313: Enterprise Backup & Restore)
// ============================================================================

/**
 * Collections that are append-only / immutable by design.
 * During restore: existing documents are SKIPPED (no overwrite).
 * Only missing documents are inserted.
 *
 * @see adrs/ADR-313-enterprise-backup-restore.md §5.4
 */
export const IMMUTABLE_COLLECTIONS: readonly string[] = [
  'ENTITY_AUDIT_TRAIL',
  'AUDIT',
  'SYSTEM_AUDIT_LOGS',
  'CLOUD_FUNCTION_AUDIT_LOG',
  'ACCOUNTING_AUDIT_LOG',
  'FILE_AUDIT_LOG',
  'COMMUNICATIONS',
  'MESSAGES',
  'ATTENDANCE_EVENTS',
  'ATTENDANCE_QR_TOKENS',
  'EMAIL_INGESTION_QUEUE',
] as const;

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
// TYPE EXPORTS
// ============================================================================

export type CollectionKey = keyof typeof COLLECTIONS;
