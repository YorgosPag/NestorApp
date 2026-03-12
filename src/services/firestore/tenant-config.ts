/**
 * @fileoverview Tenant Configuration — Per-collection tenant isolation mapping
 * @description Static map defining which field each collection uses for tenant isolation (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 */

import type { CollectionKey } from '@/config/firestore-collections';
import type { TenantFieldConfig, TenantIsolationMode } from './firestore-query.types';

// ============================================================================
// TENANT FIELD CONFIGURATION MAP
// ============================================================================

/**
 * Explicit overrides for collections that do NOT use the default `companyId` field.
 *
 * - `tenantId` collections: multi-tenant enterprise config services
 * - `userId` collections: per-user data (notifications, preferences)
 * - `none`: system-level singletons / shared data (no tenant filter)
 *
 * Every CollectionKey NOT listed here defaults to `{ mode: 'companyId', fieldName: 'companyId' }`.
 */
const TENANT_OVERRIDES: Partial<Record<CollectionKey, TenantFieldConfig>> = {
  // --- tenantId collections ---
  TEAMS:            { mode: 'tenantId', fieldName: 'tenantId' },
  ROLES:            { mode: 'tenantId', fieldName: 'tenantId' },
  USER_PREFERENCES: { mode: 'tenantId', fieldName: 'tenantId' },
  WORKSPACES:       { mode: 'companyId', fieldName: 'companyId' },
  WORKSPACE_MEMBERS:{ mode: 'companyId', fieldName: 'companyId' },
  PERMISSIONS:      { mode: 'tenantId', fieldName: 'tenantId' },

  // --- userId collections ---
  NOTIFICATIONS:              { mode: 'userId', fieldName: 'userId' },
  USER_NOTIFICATION_SETTINGS: { mode: 'userId', fieldName: 'userId' },

  // --- system (no tenant filter) ---
  SYSTEM:           { mode: 'none', fieldName: '' },
  CONFIG:           { mode: 'none', fieldName: '' },
  NAVIGATION:       { mode: 'none', fieldName: '' },
  SETTINGS:         { mode: 'none', fieldName: '' },
  COUNTERS:         { mode: 'none', fieldName: '' },
  ESCO_CACHE:       { mode: 'none', fieldName: '' },
  ESCO_SKILLS_CACHE:{ mode: 'none', fieldName: '' },
  AI_CHAT_HISTORY:  { mode: 'none', fieldName: '' },
  AUDIT:            { mode: 'none', fieldName: '' },
  TRANSLATIONS:     { mode: 'none', fieldName: '' },
  LOCALES:          { mode: 'none', fieldName: '' },
} as const;

/** Default tenant configuration for collections not in the override map */
const DEFAULT_TENANT_CONFIG: TenantFieldConfig = {
  mode: 'companyId',
  fieldName: 'companyId',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns the tenant field configuration for a given collection.
 *
 * @param key - The CollectionKey to look up
 * @returns TenantFieldConfig with `mode` and `fieldName`
 */
export function getTenantConfig(key: CollectionKey): TenantFieldConfig {
  return TENANT_OVERRIDES[key] ?? DEFAULT_TENANT_CONFIG;
}

/**
 * Resolves the tenant filter value from the auth context based on the isolation mode.
 *
 * @param mode - The tenant isolation mode
 * @param ctx - Object containing uid and companyId
 * @returns The value to filter by, or `null` if no filter should be applied
 */
export function resolveTenantValue(
  mode: TenantIsolationMode,
  ctx: { uid: string; companyId: string | null }
): string | null {
  switch (mode) {
    case 'companyId':
    case 'tenantId':
      return ctx.companyId;
    case 'userId':
      return ctx.uid;
    case 'none':
      return null;
  }
}
