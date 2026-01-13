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
  ROLES: process.env.NEXT_PUBLIC_ROLES_COLLECTION || 'roles',
  PERMISSIONS: process.env.NEXT_PUBLIC_PERMISSIONS_COLLECTION || 'permissions',

  // 🔄 RELATIONSHIPS
  RELATIONSHIPS: process.env.NEXT_PUBLIC_RELATIONSHIPS_COLLECTION || 'relationships',
  CONTACT_RELATIONSHIPS: process.env.NEXT_PUBLIC_CONTACT_RELATIONSHIPS_COLLECTION || 'contact_relationships',

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
  USER_NOTIFICATION_SETTINGS: process.env.NEXT_PUBLIC_USER_NOTIFICATION_SETTINGS_COLLECTION || 'user_notification_settings'
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
  USER_NOTIFICATIONS: process.env.NEXT_PUBLIC_USER_NOTIFICATIONS_SUBCOL || 'notifications'
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
  TENANT_CONFIG: process.env.NEXT_PUBLIC_TENANT_CONFIG_DOC || 'tenant'
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
  const customizedCount = Object.entries(COLLECTIONS).reduce((count, [key, value]) => {
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