/**
 * 🏗️ PROJECTS LIST ENDPOINT
 *
 * Enterprise-grade endpoint για loading ALL projects για audit grid.
 * Διαχωρισμένο από /api/audit/bootstrap (Option A architecture).
 *
 * @module api/projects/list
 * @version 1.0.0
 * @enterprise Phase 3 - Data Architecture Separation
 *
 * 🏢 ARCHITECTURE:
 * - Admin SDK (server-side, consistent latency)
 * - Short TTL caching (30s for near-realtime updates)
 * - Type-safe field extraction (no type assertions)
 */

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withErrorHandling, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';

// ============================================================================
// TYPES - Project List Response
// ============================================================================

interface ProjectListItem {
  id: string;
  name: string;
  title: string;
  status: string;
  company: string;
  companyId: string;
  address: string;
  city: string;
  progress: number;
  totalValue: number;
  totalArea: number;
  startDate: string;
  completionDate: string;
  lastUpdate: string;
}

interface ProjectListResponse {
  projects: ProjectListItem[];
  count: number;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = 'api:projects:list';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds (near-realtime for audit grid)

// ============================================================================
// TYPE-SAFE FIELD EXTRACTORS
// ============================================================================

/**
 * 🔒 ENTERPRISE: Type-safe string extraction (no type assertions)
 */
function getString(data: Record<string, unknown>, field: string, defaultValue: string = ''): string {
  const value = data[field];
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * 🔒 ENTERPRISE: Type-safe number extraction
 */
function getNumber(data: Record<string, unknown>, field: string, defaultValue: number = 0): number {
  const value = data[field];
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * 🔒 ENTERPRISE: Type-safe timestamp to ISO string
 */
function getTimestampString(data: Record<string, unknown>, field: string): string {
  const value = data[field];

  if (!value) return '';

  // Handle Firestore Timestamp
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const firestoreTimestamp = value as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  // Handle Date object
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle ISO string
  if (typeof value === 'string') {
    return value;
  }

  // Handle number (epoch ms)
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  return '';
}

// ============================================================================
// STATUS NORMALIZER
// ============================================================================

/**
 * 🔒 ENTERPRISE: Normalize status to canonical values
 */
function normalizeStatus(status: string): string {
  if (status === 'construction' || status === 'active') {
    return 'in_progress';
  }
  return status || 'unknown';
}

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const GET = withErrorHandling(async (_request: NextRequest) => {
  const startTime = Date.now();
  console.log('🏗️ [Projects/List] Starting projects list load...');

  // ============================================================================
  // 1. CHECK CACHE FIRST
  // ============================================================================

  const cache = EnterpriseAPICache.getInstance();
  const cachedData = cache.get<ProjectListResponse>(CACHE_KEY);

  if (cachedData) {
    const duration = Date.now() - startTime;
    console.log(`⚡ [Projects/List] CACHE HIT - ${cachedData.count} projects in ${duration}ms`);

    return apiSuccess<ProjectListResponse>({
      ...cachedData,
      source: 'cache'
    }, `Projects loaded from cache in ${duration}ms`);
  }

  console.log('🔍 [Projects/List] Cache miss - Fetching from Firestore...');

  // ============================================================================
  // 2. FETCH ALL PROJECTS (Admin SDK)
  // ============================================================================

  const projectsSnapshot = await adminDb
    .collection(COLLECTIONS.PROJECTS)
    .get();

  console.log(`🏗️ [Projects/List] Found ${projectsSnapshot.docs.length} total projects`);

  // ============================================================================
  // 3. MAP TO ProjectListItem (type-safe)
  // ============================================================================

  const projects: ProjectListItem[] = projectsSnapshot.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;

    return {
      id: doc.id,
      name: getString(data, 'name', 'Unnamed Project'),
      title: getString(data, 'title') || getString(data, 'name', 'Unnamed Project'),
      status: normalizeStatus(getString(data, 'status')),
      company: getString(data, 'company'),
      companyId: getString(data, 'companyId'),
      address: getString(data, 'address'),
      city: getString(data, 'city'),
      progress: getNumber(data, 'progress'),
      totalValue: getNumber(data, 'totalValue'),
      totalArea: getNumber(data, 'totalArea'),
      startDate: getTimestampString(data, 'startDate'),
      completionDate: getTimestampString(data, 'completionDate'),
      lastUpdate: getTimestampString(data, 'lastUpdate') || getTimestampString(data, 'updatedAt')
    };
  });

  // ============================================================================
  // 4. BUILD RESPONSE
  // ============================================================================

  const response: ProjectListResponse = {
    projects,
    count: projects.length,
    loadedAt: new Date().toISOString(),
    source: 'firestore'
  };

  // ============================================================================
  // 5. CACHE RESPONSE
  // ============================================================================

  cache.set(CACHE_KEY, response, CACHE_TTL_MS);

  const duration = Date.now() - startTime;
  console.log(`✅ [Projects/List] Complete: ${projects.length} projects in ${duration}ms (cached for 30s)`);

  return apiSuccess<ProjectListResponse>(response, `Projects loaded in ${duration}ms`);

}, {
  operation: 'listProjects',
  entityType: COLLECTIONS.PROJECTS,
  entityId: 'all'
});
