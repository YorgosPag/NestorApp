/**
 * Firebase Storage Client — MCP Server
 *
 * Singleton accessor for Firebase Storage bucket.
 * Reuses the Firebase App already initialized by firestore-client.ts.
 *
 * Bucket: pagonis-87766.firebasestorage.app
 */

import { getStorage, type Storage } from 'firebase-admin/storage';
import type { Bucket } from '@google-cloud/storage';
import { getDb } from './firestore-client.js';

// ============================================================================
// SINGLETON
// ============================================================================

let _storage: Storage | null = null;
let _bucket: Bucket | null = null;

const BUCKET_NAME = 'pagonis-87766.firebasestorage.app';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns the default Storage bucket.
 * Triggers Firebase App initialization via getDb() if not already done.
 */
export function getStorageBucket(): Bucket {
  if (!_bucket) {
    // Ensure Firebase App is initialized (getDb triggers initializeWithCredentialChain)
    getDb();

    _storage = getStorage();
    _bucket = _storage.bucket(BUCKET_NAME);
    console.error(`[MCP-Storage] Bucket initialized: ${BUCKET_NAME}`);
  }
  return _bucket;
}
