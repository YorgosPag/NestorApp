/**
 * 🔗 ENTERPRISE FILE RECORD LINK & UPDATE OPERATIONS
 *
 * Entity linking, rename, description updates, and utility queries.
 * Extracted from file-record.service.ts (ADR-065 SRP split).
 *
 * @enterprise ADR-031 - Canonical File Storage System
 */

import {
  doc,
  getDoc,
  updateDoc,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fieldToISO } from '@/lib/date-local';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import {
  type EntityType,
  FILE_STATUS,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { isFileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import { FileAuditService } from '@/services/file-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('FILE_RECORD_LINKS');

// ============================================================================
// POST-QUERY NORMALIZATION (shared with main service)
// ============================================================================

function toFileRecord(raw: DocumentData): FileRecord | null {
  const record = {
    ...raw,
    id: raw.id as string,
    createdAt: fieldToISO(raw as Record<string, unknown>, 'createdAt') || raw.createdAt,
    updatedAt: fieldToISO(raw as Record<string, unknown>, 'updatedAt') || raw.updatedAt,
  };
  return isFileRecord(record) ? record : null;
}

// ============================================================================
// ENTITY LINKING OPERATIONS
// ============================================================================

/**
 * 🔗 Link file to another entity (e.g. Project file → Building)
 * Adds '{entityType}:{entityId}' to the linkedTo array using arrayUnion.
 * Idempotent — calling twice with same params has no effect.
 */
export async function linkFileToEntity(
  fileId: string,
  targetEntityType: EntityType,
  targetEntityId: string
): Promise<void> {
  const linkTag = `${targetEntityType}:${targetEntityId}`;

  logger.info('Linking file to entity', { fileId, linkTag });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  await updateDoc(docRef, {
    linkedTo: arrayUnion(linkTag),
    updatedAt: serverTimestamp(),
  });

  logger.info('File linked to entity', { fileId, linkTag });

  RealtimeService.dispatch('FILE_UPDATED', {
    fileId,
    updates: { status: 'ready' },
    timestamp: Date.now(),
  });
}

/**
 * 🔗 Unlink file from an entity
 * Removes '{entityType}:{entityId}' from the linkedTo array using arrayRemove.
 * Idempotent — calling twice with same params has no effect.
 */
export async function unlinkFileFromEntity(
  fileId: string,
  targetEntityType: EntityType,
  targetEntityId: string
): Promise<void> {
  const linkTag = `${targetEntityType}:${targetEntityId}`;

  logger.info('Unlinking file from entity', { fileId, linkTag });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  await updateDoc(docRef, {
    linkedTo: arrayRemove(linkTag),
    updatedAt: serverTimestamp(),
  });

  logger.info('File unlinked from entity', { fileId, linkTag });

  RealtimeService.dispatch('FILE_UPDATED', {
    fileId,
    updates: { status: 'ready' },
    timestamp: Date.now(),
  });
}

/**
 * 🔗 Get files linked to a specific entity
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function getLinkedFiles(
  targetEntityType: EntityType,
  targetEntityId: string,
  companyId: string // Required for Firestore Security Rules (tenant isolation)
): Promise<FileRecord[]> {
  const linkTag = `${targetEntityType}:${targetEntityId}`;

  // 🔒 SECURITY: companyId constraint is REQUIRED for Firestore Security Rules.
  // Without it, super admin queries fail with permission-denied because rules
  // require resource.data.keys().hasAny(['companyId']).
  const constraints = [
    where('linkedTo', 'array-contains', linkTag),
    where('companyId', '==', companyId),
    where('status', '==', FILE_STATUS.READY),
    where('isDeleted', '==', false),
  ];

  const result = await firestoreQueryService.getAll<DocumentData>('FILES', { constraints });

  const validRecords: FileRecord[] = [];
  for (const raw of result.documents) {
    const record = toFileRecord(raw);
    if (record) {
      validRecords.push(record);
    } else {
      logger.warn('Skipping invalid FileRecord in getLinkedFiles', { docId: raw.id });
    }
  }

  logger.info('Fetched linked files', { linkTag, count: validRecords.length });
  return validRecords;
}

// ============================================================================
// RENAME & DESCRIPTION OPERATIONS
// ============================================================================

/**
 * Rename file display name
 * @enterprise Updates displayName in Firestore — propagates to all views instantly
 */
export async function renameFile(fileId: string, newDisplayName: string, renamedBy: string): Promise<void> {
  if (!newDisplayName.trim()) {
    throw new Error('Display name cannot be empty');
  }

  logger.info('Renaming FileRecord', { fileId, newDisplayName, renamedBy });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  await updateDoc(docRef, {
    displayName: newDisplayName.trim(),
    updatedAt: serverTimestamp(),
  });

  logger.info('FileRecord renamed successfully', { fileId, newDisplayName });

  RealtimeService.dispatch('FILE_UPDATED', {
    fileId,
    updates: { displayName: newDisplayName.trim() },
    timestamp: Date.now(),
  });

  safeFireAndForget(FileAuditService.log(fileId, 'rename', renamedBy, undefined, { newDisplayName: newDisplayName.trim() }), 'FileRecord.renameFile', { fileId });
}

/**
 * Update file description / notes
 * Editable at any time — no restrictions
 */
export async function updateDescription(fileId: string, description: string): Promise<void> {
  logger.info('Updating FileRecord description', { fileId });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  await updateDoc(docRef, {
    description: description.trim() || null,
    updatedAt: serverTimestamp(),
  });

  logger.info('FileRecord description updated', { fileId });

  RealtimeService.dispatch('FILE_UPDATED', {
    fileId,
    updates: { description: description.trim() || undefined },
    timestamp: Date.now(),
  });
}

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Check if a file with the same hash already exists
 * 🏢 ADR-214 Phase 3: via FirestoreQueryService
 */
export async function findByHash(
  hash: string,
  _companyId?: string // kept for API compat — auto-injected by FirestoreQueryService
): Promise<FileRecord | null> {
  const constraints = [
    where('hash', '==', hash),
    where('status', '==', FILE_STATUS.READY),
    where('isDeleted', '==', false),
  ];

  const result = await firestoreQueryService.getAll<DocumentData>('FILES', {
    constraints,
    maxResults: 1,
  });

  if (result.isEmpty) return null;

  const record = toFileRecord(result.documents[0]);
  if (!record) {
    logger.warn('Invalid FileRecord data from findByHash', { hash, docId: result.documents[0].id });
    return null;
  }

  return record;
}
