/**
 * =============================================================================
 * DEV ENVIRONMENT CONFIG (SSoT)
 * =============================================================================
 *
 * Centralized configuration for development-only defaults.
 * All dev fallbacks must come from here (no scattered literals).
 *
 * Uses dynamic Firestore lookup instead of hardcoded values.
 * Leverages centralized systems: ADR-077 (Firebase Admin), COLLECTIONS (SSoT).
 *
 * @module config/dev-environment
 */

import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

 
const warn = (message: string) => console.warn(message);

// =============================================================================
// MODULE-LEVEL CACHE (avoid repeated Firestore queries)
// =============================================================================

let _cachedDevCompanyId: string | null = null;

/**
 * Get dev companyId for tenant isolation in development bypass flows.
 *
 * Resolution chain (enterprise pattern):
 * 1. Module-level cache (instant return if already resolved)
 * 2. Environment variables (DEV_COMPANY_ID / NEXT_PUBLIC_DEV_COMPANY_ID)
 * 3. Dynamic Firestore lookup (first company in the database)
 *
 * @returns companyId string from database or env
 * @throws Error if no company exists in Firestore and no env var is set
 */
export async function getDevCompanyId(): Promise<string> {
  // Priority 0: Return cached value (avoids repeated DB calls)
  if (_cachedDevCompanyId) {
    return _cachedDevCompanyId;
  }

  // Priority 1: Environment variables (explicit override)
  const envCompanyId =
    process.env.DEV_COMPANY_ID ||
    process.env.NEXT_PUBLIC_DEV_COMPANY_ID;

  if (envCompanyId) {
    _cachedDevCompanyId = envCompanyId;
    return envCompanyId;
  }

  // Priority 2: Dynamic Firestore lookup (extract companyId from data)
  if (isFirebaseAdminAvailable()) {
    const db = getAdminFirestore();

    // Strategy: Extract companyId from collections that HAVE a companyId field
    // This guarantees the resolved ID matches actual data in the database
    const collectionsWithCompanyIdField = [
      COLLECTIONS.PROJECTS,   // projects.companyId (primary business entity)
      COLLECTIONS.MESSAGES,   // messages.companyId (communications)
      COLLECTIONS.CONTACTS,   // contacts.companyId (CRM)
    ] as const;

    for (const collectionName of collectionsWithCompanyIdField) {
      try {
        const snapshot = await db
          .collection(collectionName)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          const companyId = docData.companyId as string | undefined;
          if (companyId) {
            _cachedDevCompanyId = companyId;
            console.log(`[DEV_ENV] Resolved companyId from ${collectionName}: ${companyId}`);
            return companyId;
          }
        }
      } catch (error) {
        warn(
          `[DEV_ENV] Firestore lookup in ${collectionName} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Fallback: Use document ID from company collections
    const companyCollections = [
      COLLECTIONS.NAVIGATION,  // navigation_companies
      COLLECTIONS.COMPANIES,   // companies (legacy)
    ] as const;

    for (const collectionName of companyCollections) {
      try {
        const snapshot = await db
          .collection(collectionName)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const companyId = snapshot.docs[0].id;
          _cachedDevCompanyId = companyId;
          console.log(`[DEV_ENV] Resolved companyId (doc ID) from ${collectionName}: ${companyId}`);
          return companyId;
        }
      } catch (error) {
        warn(
          `[DEV_ENV] Firestore lookup in ${collectionName} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  throw new Error(
    '[DEV_ENV] Cannot resolve dev companyId. ' +
    'No DEV_COMPANY_ID env var set and no companies found in Firestore. ' +
    'Ensure at least one document exists in projects, messages, contacts, or navigation_companies.'
  );
}
