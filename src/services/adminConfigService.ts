/**
 * =============================================================================
 * 🏢 ENTERPRISE: Admin Configuration Service (Server-Side)
 * =============================================================================
 *
 * Server-side service for admin configuration.
 * Uses Firebase Admin SDK for secure server operations.
 *
 * Features:
 * - Firestore-based admin UID storage
 * - Caching with TTL (avoids repeated reads)
 * - Graceful fallback to environment variables
 * - Type-safe configuration
 *
 * @enterprise SAP/Salesforce-class configuration management
 * @created 2026-01-24
 */

import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// TYPES
// =============================================================================

export interface AdminConfiguration {
  /** Firebase UID of the primary admin user */
  primaryAdminUid: string;
  /** Email address for admin notifications */
  adminEmail: string;
  /** Additional admin UIDs for system notifications */
  additionalAdminUids: string[];
  /** Enable error report notifications to admin */
  enableErrorReporting: boolean;
  /** Last updated timestamp */
  updatedAt?: Date;
}

// =============================================================================
// CONFIGURATION DEFAULTS
// =============================================================================

const DEFAULT_ADMIN_CONFIG: AdminConfiguration = {
  primaryAdminUid: process.env.NEXT_PUBLIC_ADMIN_UID || '',
  adminEmail: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'georgios.pagonis@gmail.com',
  additionalAdminUids: [],
  enableErrorReporting: true
};

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let adminConfigCache: CacheEntry<AdminConfiguration> | null = null;

function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  if (!cache) return false;
  return (Date.now() - cache.timestamp) < CACHE_TTL_MS;
}

// =============================================================================
// ADMIN CONFIGURATION SERVICE
// =============================================================================

/**
 * Get admin configuration from Firestore
 * Server-side only - uses Admin SDK
 */
export async function getAdminConfiguration(): Promise<AdminConfiguration> {
  // Check cache first
  if (isCacheValid(adminConfigCache)) {
    console.log('📋 [AdminConfig] Using cached configuration');
    return adminConfigCache.data;
  }

  try {
    const docRef = adminDb.collection(COLLECTIONS.SYSTEM).doc('settings');
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn('⚠️ [AdminConfig] Settings document not found, using defaults');
      return DEFAULT_ADMIN_CONFIG;
    }

    const data = docSnap.data();
    const adminConfig: AdminConfiguration = {
      primaryAdminUid: data?.admin?.primaryAdminUid || DEFAULT_ADMIN_CONFIG.primaryAdminUid,
      adminEmail: data?.admin?.adminEmail || DEFAULT_ADMIN_CONFIG.adminEmail,
      additionalAdminUids: data?.admin?.additionalAdminUids || DEFAULT_ADMIN_CONFIG.additionalAdminUids,
      enableErrorReporting: data?.admin?.enableErrorReporting ?? DEFAULT_ADMIN_CONFIG.enableErrorReporting,
      updatedAt: data?.admin?.updatedAt?.toDate()
    };

    // Update cache
    adminConfigCache = {
      data: adminConfig,
      timestamp: Date.now()
    };

    console.log('✅ [AdminConfig] Loaded from Firestore:', {
      hasUid: !!adminConfig.primaryAdminUid,
      email: adminConfig.adminEmail
    });

    return adminConfig;

  } catch (error) {
    console.error('❌ [AdminConfig] Failed to load:', error);
    return DEFAULT_ADMIN_CONFIG;
  }
}

/**
 * Get primary admin UID for notifications
 * Throws error if not configured (fail loudly - enterprise pattern)
 */
export async function getAdminUid(): Promise<string> {
  const config = await getAdminConfiguration();

  if (!config.primaryAdminUid) {
    // In production, this is a critical error
    const errorMsg = 'CRITICAL: Admin UID not configured. Set NEXT_PUBLIC_ADMIN_UID or configure in Firestore.';
    console.error(`🚨 ${errorMsg}`);
    throw new Error(errorMsg);
  }

  return config.primaryAdminUid;
}

/**
 * Get admin email (for reference/display)
 */
export async function getAdminEmail(): Promise<string> {
  const config = await getAdminConfiguration();
  return config.adminEmail;
}

/**
 * Get all admin UIDs (primary + additional)
 */
export async function getAllAdminUids(): Promise<string[]> {
  const config = await getAdminConfiguration();
  return [config.primaryAdminUid, ...config.additionalAdminUids].filter(Boolean);
}

/**
 * Check if error reporting is enabled
 */
export async function isErrorReportingEnabled(): Promise<boolean> {
  const config = await getAdminConfiguration();
  return config.enableErrorReporting;
}

/**
 * Update admin configuration
 * Admin operation - should be called from admin UI
 */
export async function updateAdminConfiguration(
  updates: Partial<AdminConfiguration>
): Promise<void> {
  try {
    const docRef = adminDb.collection(COLLECTIONS.SYSTEM).doc('settings');

    await docRef.set({
      admin: {
        ...updates,
        updatedAt: new Date()
      }
    }, { merge: true });

    // Invalidate cache
    adminConfigCache = null;

    console.log('✅ [AdminConfig] Updated successfully');

  } catch (error) {
    console.error('❌ [AdminConfig] Update failed:', error);
    throw new Error(`Failed to update admin configuration: ${error}`);
  }
}

/**
 * Initialize admin configuration with current user
 * Call this during admin bootstrap
 */
export async function initializeAdminConfig(adminUid: string, adminEmail: string): Promise<void> {
  await updateAdminConfiguration({
    primaryAdminUid: adminUid,
    adminEmail,
    additionalAdminUids: [],
    enableErrorReporting: true
  });

  console.log(`✅ [AdminConfig] Initialized for: ${adminEmail} (${adminUid})`);
}

// =============================================================================
// EXPORTS
// =============================================================================

export const adminConfigService = {
  getConfiguration: getAdminConfiguration,
  getAdminUid,
  getAdminEmail,
  getAllAdminUids,
  isErrorReportingEnabled,
  updateConfiguration: updateAdminConfiguration,
  initializeAdminConfig
} as const;

export default adminConfigService;
