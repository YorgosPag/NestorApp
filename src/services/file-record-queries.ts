/**
 * =============================================================================
 * 🏢 FILE RECORD — READ SIDE (queries + normalization)
 * =============================================================================
 *
 * Every read path into the `FILES` collection lives here. Extracted from
 * `file-record.service.ts` (2026-07-25) under N.7.1, following the SRP split
 * that file already applies to `./file-record-lifecycle` and
 * `./file-record-links` (ADR-065) — the service now owns the *write* flow
 * (create → upload → finalize) and delegates reads here.
 *
 * `FileRecordService.getFileRecord/getFilesByEntity/queryFileRecords` delegate
 * to these functions, so no consumer import changes.
 *
 * ⚠️ `toFileRecord` is the SSoT normalizer: `file-record-links.ts` carried a
 * byte-for-byte private copy of it until 2026-07-25 and now imports it from
 * here (N.0.2 Boy Scout — a second copy is a second place for the Timestamp→ISO
 * rule to drift).
 *
 * @module services/file-record-queries
 * @enterprise ADR-031 — Canonical File Storage System, ADR-214 Phase 3
 */

import { where, type DocumentData, type QueryConstraint } from 'firebase/firestore';

import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { fieldToISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { FileRecord, FileRecordQuery } from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';

const logger = createModuleLogger('FILE_RECORD');

export interface GetFilesByEntityOptions {
  domain?: FileDomain;
  category?: FileCategory;
  purpose?: string;
  levelFloorId?: string;
  includeDeleted?: boolean;
  companyId?: string;
}

// ============================================================================
// POST-QUERY NORMALIZATION HELPER (ADR-214 Phase 3)
// ============================================================================

export function toFileRecord(raw: DocumentData): FileRecord | null {
  const record = {
    ...raw,
    id: raw.id as string,
    createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
    updatedAt: fieldToISO(raw as Record<string, unknown>, 'updatedAt') || raw.updatedAt,
  };
  return isFileRecord(record) ? record : null;
}

// ============================================================================
// QUERY PRIMITIVES — κοινά σε όλες τις αναζητήσεις FileRecord
// ============================================================================

/**
 * Οι δύο περιορισμοί που αποκρύπτουν τα διαγραμμένα αρχεία.
 *
 * Πάνε ΠΑΝΤΑ μαζί: το `isDeleted` καλύπτει το legacy flag και το `lifecycleState`
 * τον κύκλο ζωής. Αν κάποιο ερώτημα βάλει μόνο το ένα, επιστρέφει αρχεία που ο
 * χρήστης θεωρεί διαγραμμένα — γι' αυτό ορίζονται σε ΕΝΑ σημείο.
 */
export function activeOnlyConstraints(): QueryConstraint[] {
  return [
    where('isDeleted', '==', false),
    where('lifecycleState', '==', FILE_LIFECYCLE_STATES.ACTIVE),
  ];
}

/**
 * Εκτελεί ερώτημα στη συλλογή FILES και κρατά μόνο έγκυρα `FileRecord`.
 *
 * @param context ετικέτα για το warning όταν βρεθεί κατεστραμμένο document.
 */
export async function runFileRecordQuery(
  constraints: QueryConstraint[],
  context: string,
): Promise<FileRecord[]> {
  const result = await firestoreQueryService.getAll<DocumentData>('FILES', { constraints });

  const validRecords: FileRecord[] = [];
  for (const raw of result.documents) {
    const record = toFileRecord(raw);
    if (record) {
      validRecords.push(record);
    } else {
      logger.warn(`Skipping invalid FileRecord in ${context}`, { docId: raw.id });
    }
  }
  return validRecords;
}

// ============================================================================
// READS
// ============================================================================

/**
 * Get a single FileRecord by ID
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function getFileRecord(fileId: string): Promise<FileRecord | null> {
  const raw = await firestoreQueryService.getById<DocumentData>('FILES', fileId);
  if (!raw) return null;

  const record = toFileRecord(raw);
  if (!record) {
    logger.warn('Invalid FileRecord data from Firestore', { fileId });
    return null;
  }

  return record;
}

/**
 * Query FileRecords by entity
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function getFilesByEntity(
  entityType: EntityType,
  entityId: string,
  options?: GetFilesByEntityOptions,
): Promise<FileRecord[]> {
  const constraints = [
    where('entityType', '==', entityType),
    where('entityId', '==', entityId),
    where('status', '==', FILE_STATUS.READY),
  ];

  // 🔒 SECURITY: companyId constraint required for Firestore Security Rules
  // Rules enforce belongsToCompany(resource.data.companyId) — without this
  // filter, queries fail with PERMISSION_DENIED for non-super-admin users.
  if (options?.companyId) {
    constraints.push(where('companyId', '==', options.companyId));
  }

  if (options?.domain) {
    constraints.push(where('domain', '==', options.domain));
  }

  if (options?.category) {
    constraints.push(where('category', '==', options.category));
  }

  if (options?.purpose) {
    constraints.push(where('purpose', '==', options.purpose));
  }

  if (options?.levelFloorId) {
    constraints.push(where('levelFloorId', '==', options.levelFloorId));
  }

  if (!options?.includeDeleted) {
    constraints.push(...activeOnlyConstraints());
  }

  const validRecords = await runFileRecordQuery(constraints, 'query results');

  // ADR-351: sort by createdAt DESC (most recent first) — client-side to avoid
  // adding a composite index for every where() combination. Callers that pick
  // `result[0]` (e.g. FloorFloorplanService.loadFloorplan) MUST receive the
  // most recently created record, not the lexicographically first UUID.
  validRecords.sort((a, b) => {
    const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bMs - aMs;
  });

  return validRecords;
}

/**
 * Query FileRecords with flexible parameters
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function queryFileRecords(queryParams: FileRecordQuery): Promise<FileRecord[]> {
  const constraints = [];

  if (queryParams.projectId) {
    constraints.push(where('projectId', '==', queryParams.projectId));
  }

  if (queryParams.entityType) {
    constraints.push(where('entityType', '==', queryParams.entityType));
  }

  if (queryParams.entityId) {
    constraints.push(where('entityId', '==', queryParams.entityId));
  }

  if (queryParams.domain) {
    constraints.push(where('domain', '==', queryParams.domain));
  }

  if (queryParams.category) {
    constraints.push(where('category', '==', queryParams.category));
  }

  if (queryParams.status) {
    constraints.push(where('status', '==', queryParams.status));
  }

  if (!queryParams.includeDeleted) {
    constraints.push(...activeOnlyConstraints());
  }

  return runFileRecordQuery(constraints, 'queryFileRecords');
}
