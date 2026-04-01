/**
 * @fileoverview Types and configuration for company ID migration (ADR-210)
 */

import { COLLECTIONS } from '@/config/firestore-collections';

// =============================================================================
// TYPES
// =============================================================================

export interface CollectionMigrationResult {
  collection: string;
  documentsFound: number;
  documentsUpdated: number;
  errors: string[];
}

export interface SubcollectionMigrationResult {
  path: string;
  documentsCopied: number;
  documentsDeleted: number;
  errors: string[];
}

export interface MigrationReport {
  oldCompanyId: string;
  newCompanyId: string;
  dryRun: boolean;
  timestamp: string;
  steps: {
    companyDocument: { status: string; details: string };
    customClaims: { status: string; usersUpdated: number; details: string };
    collections: CollectionMigrationResult[];
    subcollections: SubcollectionMigrationResult[];
    cleanup: { status: string; details: string };
  };
  totalDocumentsUpdated: number;
  errors: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum operations per Firestore batch write */
export const BATCH_LIMIT = 450;

/** Collections where documents have a `companyId` field to update */
export const COLLECTIONS_WITH_COMPANY_ID = [
  { key: 'PROJECTS' as const, name: 'projects' },
  { key: 'BUILDINGS' as const, name: 'buildings' },
  { key: 'CONTACTS' as const, name: 'contacts' },
  { key: 'PROPERTIES' as const, name: 'properties' },
  { key: 'FILES' as const, name: 'files' },
  { key: 'CONVERSATIONS' as const, name: 'conversations' },
  { key: 'MESSAGES' as const, name: 'messages' },
  { key: 'TASKS' as const, name: 'tasks' },
  { key: 'OBLIGATIONS' as const, name: 'obligations' },
  { key: 'LEADS' as const, name: 'leads' },
  { key: 'OPPORTUNITIES' as const, name: 'opportunities' },
  { key: 'ACTIVITIES' as const, name: 'activities' },
  { key: 'COMMUNICATIONS' as const, name: 'communications' },
  { key: 'AI_PIPELINE_QUEUE' as const, name: 'ai_pipeline_queue' },
  { key: 'FLOORS' as const, name: 'floors' },
  { key: 'PARKING_SPACES' as const, name: 'parking_spots' },
  { key: 'STORAGE' as const, name: 'storage_units' },
] as const;

/** navigation_companies uses `contactId` instead of `companyId` */
export const NAVIGATION_COLLECTION = COLLECTIONS.NAVIGATION;
