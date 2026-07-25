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
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { runFileRecordQuery, toFileRecord } from '@/services/file-record-queries';
import {
  type EntityType,
  FILE_STATUS,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import { FileAuditService } from '@/services/file-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import type { DisciplineCode, DocumentSeries, CdeState, SuitabilityCode } from '@/config/iso19650-constants';

const logger = createModuleLogger('FILE_RECORD_LINKS');

// POST-QUERY NORMALIZATION — SSoT in ./file-record-queries. This file kept a
// byte-for-byte private copy until 2026-07-25 (N.0.2 Boy Scout): two copies =
// two places for the Timestamp→ISO rule to drift.

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

  const validRecords = await runFileRecordQuery(constraints, 'getLinkedFiles');

  logger.info('Fetched linked files', { linkTag, count: validRecords.length });
  return validRecords;
}

// ============================================================================
// RENAME & DESCRIPTION OPERATIONS
// ============================================================================

/**
 * Existence-checked field update on a FileRecord + the realtime dispatch that
 * must follow it. Every editor of a single field goes through here so that
 * "does the doc still exist?" is asked in ONE place — `updateDoc` on a deleted
 * id would otherwise reject with a raw Firestore error instead of our message.
 */
async function updateFileRecordFields(
  fileId: string,
  updates: Record<string, unknown>,
  dispatched: Partial<FileRecord>,
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.FILES, fileId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });

  RealtimeService.dispatch('FILE_UPDATED', {
    fileId,
    updates: dispatched,
    timestamp: Date.now(),
  });
}

/**
 * Rename file display name
 * @enterprise Updates displayName in Firestore — propagates to all views instantly
 */
export async function renameFile(fileId: string, newDisplayName: string, renamedBy: string): Promise<void> {
  if (!newDisplayName.trim()) {
    throw new Error('Display name cannot be empty');
  }

  logger.info('Renaming FileRecord', { fileId, newDisplayName, renamedBy });

  const displayName = newDisplayName.trim();
  await updateFileRecordFields(fileId, { displayName }, { displayName });

  logger.info('FileRecord renamed successfully', { fileId, newDisplayName });

  safeFireAndForget(FileAuditService.log(fileId, 'rename', renamedBy, undefined, { newDisplayName: displayName }), 'FileRecord.renameFile', { fileId });
}

/**
 * Update file description / notes
 * Editable at any time — no restrictions
 */
export async function updateDescription(fileId: string, description: string): Promise<void> {
  logger.info('Updating FileRecord description', { fileId });

  const trimmed = description.trim();
  await updateFileRecordFields(fileId, { description: trimmed || null }, { description: trimmed || undefined });

  logger.info('FileRecord description updated', { fileId });
}

// ============================================================================
// ISO 19650 METADATA UPDATE — ADR-373 Phase 2
// ============================================================================

export interface Iso19650MetadataUpdate {
  disciplineCode?: DisciplineCode | null;
  documentSeries?: DocumentSeries | null;
  revisionCode?: string | null;
  suitabilityCode?: SuitabilityCode | null;
  cdeState?: CdeState | null;
  buildingCode?: string | null;
}

/**
 * Partial update of ISO 19650 metadata fields on a FileRecord.
 * Records iso19650Source.overriddenBy + overriddenAt + filledBy='user'.
 * Does NOT re-trigger AI enricher (Phase 2 manual override only).
 * @see ADR-373 §P2.1
 */
export async function updateIso19650Metadata(
  fileId: string,
  metadata: Iso19650MetadataUpdate,
  userId: string,
): Promise<void> {
  logger.info('Updating ISO 19650 metadata', { fileId, userId });

  const docRef = doc(db, COLLECTIONS.FILES, fileId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`FileRecord not found: ${fileId}`);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    'iso19650Source.filledBy': 'user',
    'iso19650Source.overriddenBy': userId,
    'iso19650Source.overriddenAt': serverTimestamp(),
    'iso19650Source.filledAt': serverTimestamp(),
  };

  if ('disciplineCode' in metadata) updateData['disciplineCode'] = metadata.disciplineCode ?? null;
  if ('documentSeries' in metadata) updateData['documentSeries'] = metadata.documentSeries ?? null;
  if ('revisionCode' in metadata) updateData['revisionCode'] = metadata.revisionCode ?? null;
  if ('suitabilityCode' in metadata) updateData['suitabilityCode'] = metadata.suitabilityCode ?? null;
  if ('cdeState' in metadata) updateData['cdeState'] = metadata.cdeState ?? null;
  if ('buildingCode' in metadata) updateData['buildingCode'] = metadata.buildingCode ?? null;

  await updateDoc(docRef, updateData);

  logger.info('ISO 19650 metadata updated', { fileId });

  RealtimeService.dispatch('FILE_UPDATED', {
    fileId,
    updates: { iso19650MetadataUpdated: true },
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
