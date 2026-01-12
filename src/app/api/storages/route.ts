import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { CacheHelpers } from '@/lib/cache/enterprise-api-cache';
import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';

// ============================================================================
// 🏢 ENTERPRISE: Admin SDK Storages Endpoint
// ============================================================================
//
// ARCHITECTURE DECISION:
// Χρησιμοποιεί Admin SDK (server-side) αντί για Client SDK
//
// ΑΙΤΙΟΛΟΓΗΣΗ:
// 1. Τα Firestore Security Rules απαιτούν authentication (request.auth != null)
// 2. Το Client SDK στον server ΔΕΝ έχει authentication context
// 3. Μόνο το Admin SDK μπορεί να παρακάμψει τα security rules
//
// PATTERN: Data Mapper Pattern (Enterprise)
// - Separates domain model from persistence model
// - Type-safe transformation from Firestore to TypeScript
// - Validation at the boundary
//
// ============================================================================

// ============================================================================
// FIRESTORE RAW DATA INTERFACE
// ============================================================================

/**
 * 🏢 Enterprise: Raw Firestore storage document data interface
 * Represents the actual data structure stored in Firestore
 */
interface FirestoreStorageData {
  name?: string;
  type?: string;
  status?: string;
  building?: string;
  floor?: string;
  area?: number;
  description?: string;
  price?: number;
  projectId?: string;
  owner?: string;
  notes?: string;
  lastUpdated?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

// ============================================================================
// DATA MAPPER - ENTERPRISE PATTERN
// ============================================================================

/**
 * 🏢 Enterprise Data Mapper: Firestore → Storage
 *
 * Transforms raw Firestore data to type-safe Storage.
 * Follows the Data Mapper pattern used in SAP, Salesforce, Microsoft Dynamics.
 *
 * @param docId - Firestore document ID
 * @param data - Raw Firestore document data
 * @returns Type-safe Storage object
 */
function mapFirestoreToStorage(docId: string, data: FirestoreStorageData): Storage {
  // Validate and cast type
  const rawType = data.type || 'small';
  const type: StorageType = isValidStorageType(rawType) ? rawType : 'small';

  // Validate and cast status
  const rawStatus = data.status || 'available';
  const status: StorageStatus = isValidStorageStatus(rawStatus) ? rawStatus : 'available';

  // Convert timestamps
  const lastUpdated = parseFirestoreTimestamp(data.lastUpdated);

  return {
    id: docId,
    name: data.name || `Storage ${docId.substring(0, 6)}`,
    type,
    status,
    building: data.building || '',
    floor: data.floor || '',
    area: typeof data.area === 'number' ? data.area : 0,
    description: data.description,
    price: typeof data.price === 'number' ? data.price : undefined,
    projectId: data.projectId,
    owner: data.owner,
    notes: data.notes,
    lastUpdated: lastUpdated || undefined
  };
}

/**
 * 🔧 Helper: Validate StorageType
 */
function isValidStorageType(type: string): type is StorageType {
  return ['large', 'small', 'basement', 'ground', 'special'].includes(type);
}

/**
 * 🔧 Helper: Validate StorageStatus
 */
function isValidStorageStatus(status: string): status is StorageStatus {
  return ['available', 'occupied', 'maintenance', 'reserved'].includes(status);
}

/**
 * 🔧 Helper: Parse Firestore Timestamp to Date
 */
function parseFirestoreTimestamp(timestamp: unknown): Date | null {
  if (!timestamp) return null;

  // Handle Firestore Timestamp object
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    const firestoreTs = timestamp as { toDate: () => Date };
    return firestoreTs.toDate();
  }

  // Handle Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // Handle ISO string
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Handle epoch milliseconds
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  return null;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // 🏗️ ENTERPRISE: Extract projectId parameter for filtering
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (projectId) {
      console.log(`🏗️ API: Loading storages for project ${projectId} (Admin SDK)...`);
    } else {
      console.log('🏗️ API: Loading all storages (Admin SDK)...');
    }

    // =========================================================================
    // STEP 0: Check cache first (Enterprise Caching)
    // =========================================================================
    if (!projectId) {
      const cachedStorages = CacheHelpers.getCachedAllStorages();
      if (cachedStorages) {
        console.log(`⚡ API: CACHE HIT - Returning ${cachedStorages.length} cached storages`);
        return NextResponse.json({
          success: true,
          storages: cachedStorages,
          count: cachedStorages.length,
          cached: true
        });
      }
    }

    console.log('🔍 API: Cache miss - Fetching from Firestore with Admin SDK...');

    // =========================================================================
    // STEP 1: Query Firestore using Admin SDK
    // =========================================================================
    let snapshot;

    if (projectId) {
      // Filter by projectId
      snapshot = await adminDb
        .collection(COLLECTIONS.STORAGE)
        .where('projectId', '==', projectId)
        .get();
    } else {
      // Get all storages, ordered by createdAt
      snapshot = await adminDb
        .collection(COLLECTIONS.STORAGE)
        .orderBy('createdAt', 'desc')
        .get();
    }

    // =========================================================================
    // STEP 2: Map Firestore data using Data Mapper pattern
    // =========================================================================
    const storages: Storage[] = [];

    snapshot.docs.forEach(doc => {
      const rawData = doc.data() as FirestoreStorageData;
      const storage = mapFirestoreToStorage(doc.id, rawData);
      storages.push(storage);
    });

    // =========================================================================
    // STEP 3: Cache and return
    // =========================================================================
    if (!projectId) {
      CacheHelpers.cacheAllStorages(storages);
    }

    if (projectId) {
      console.log(`✅ API: Found ${storages.length} storages for project ${projectId}`);
    } else {
      console.log(`✅ API: Found ${storages.length} storages (cached for 2 minutes)`);
    }

    return NextResponse.json({
      success: true,
      storages,
      count: storages.length,
      cached: false,
      projectId: projectId || undefined
    });

  } catch (error) {
    console.error('❌ Error fetching storages:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch storages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}