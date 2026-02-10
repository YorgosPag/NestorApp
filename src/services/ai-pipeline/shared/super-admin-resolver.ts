/**
 * =============================================================================
 * SUPER ADMIN IDENTITY RESOLVER — ADR-145
 * =============================================================================
 *
 * Resolves whether an incoming message sender is a super admin.
 * Uses in-memory cache (5 min TTL) to avoid Firestore reads on every message.
 *
 * @module services/ai-pipeline/shared/super-admin-resolver
 * @see ADR-145 (Super Admin AI Assistant)
 * @see src/types/super-admin.ts (Type definitions)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type {
  SuperAdminRegistryDoc,
  SuperAdminResolution,
} from '@/types/super-admin';

const logger = createModuleLogger('SUPER_ADMIN_RESOLVER');

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

/** Cache TTL: 5 minutes (avoid Firestore read on every message) */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface RegistryCache {
  data: SuperAdminRegistryDoc | null;
  fetchedAt: number;
}

let registryCache: RegistryCache = {
  data: null,
  fetchedAt: 0,
};

/**
 * Fetch the super admin registry from Firestore (with cache)
 */
async function getRegistry(): Promise<SuperAdminRegistryDoc | null> {
  const now = Date.now();

  // Return cached if fresh
  if (registryCache.data && (now - registryCache.fetchedAt) < CACHE_TTL_MS) {
    return registryCache.data;
  }

  try {
    const adminDb = getAdminFirestore();
    const docRef = adminDb
      .collection(COLLECTIONS.SETTINGS)
      .doc(SYSTEM_DOCS.SUPER_ADMIN_REGISTRY);

    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      logger.warn('Super admin registry document not found', {
        path: `${COLLECTIONS.SETTINGS}/${SYSTEM_DOCS.SUPER_ADMIN_REGISTRY}`,
      });
      registryCache = { data: null, fetchedAt: now };
      return null;
    }

    const data = snapshot.data() as SuperAdminRegistryDoc;
    registryCache = { data, fetchedAt: now };

    logger.debug('Super admin registry loaded', {
      adminCount: data.admins?.length ?? 0,
      schemaVersion: data.schemaVersion,
    });

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch super admin registry', { error: errorMessage });
    // Return stale cache if available, otherwise null
    return registryCache.data;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a Telegram user is a super admin.
 *
 * @param telegramUserId - Telegram user ID (from webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminTelegram(
  telegramUserId: string
): Promise<SuperAdminResolution | null> {
  const registry = await getRegistry();
  if (!registry?.admins) return null;

  for (const admin of registry.admins) {
    if (!admin.isActive) continue;
    if (admin.channels.telegram?.userId === telegramUserId) {
      logger.info('Super admin identified via Telegram', {
        displayName: admin.displayName,
        telegramUserId,
      });
      return {
        identity: admin,
        resolvedVia: 'telegram_user_id',
      };
    }
  }

  return null;
}

/**
 * Check if an email sender is a super admin.
 *
 * @param emailAddress - Sender email address (from Mailgun webhook)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminEmail(
  emailAddress: string
): Promise<SuperAdminResolution | null> {
  const registry = await getRegistry();
  if (!registry?.admins) return null;

  const normalizedEmail = emailAddress.toLowerCase().trim();

  for (const admin of registry.admins) {
    if (!admin.isActive) continue;
    const addresses = admin.channels.email?.addresses ?? [];
    if (addresses.some(addr => addr.toLowerCase().trim() === normalizedEmail)) {
      logger.info('Super admin identified via Email', {
        displayName: admin.displayName,
        email: normalizedEmail,
      });
      return {
        identity: admin,
        resolvedVia: 'email_address',
      };
    }
  }

  return null;
}

/**
 * Check if a Firebase Auth user is a super admin.
 *
 * @param firebaseUid - Firebase Auth UID (from session/JWT)
 * @returns SuperAdminResolution if admin, null otherwise
 */
export async function isSuperAdminFirebaseUid(
  firebaseUid: string
): Promise<SuperAdminResolution | null> {
  const registry = await getRegistry();
  if (!registry?.admins) return null;

  for (const admin of registry.admins) {
    if (!admin.isActive) continue;
    if (admin.firebaseUid === firebaseUid) {
      logger.info('Super admin identified via Firebase UID', {
        displayName: admin.displayName,
        firebaseUid,
      });
      return {
        identity: admin,
        resolvedVia: 'firebase_uid',
      };
    }
  }

  return null;
}

/**
 * Force-refresh the registry cache.
 * Useful after updating the registry document.
 */
export function invalidateRegistryCache(): void {
  registryCache = { data: null, fetchedAt: 0 };
  logger.info('Super admin registry cache invalidated');
}
