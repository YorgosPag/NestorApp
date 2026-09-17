/**
 * =============================================================================
 * 🏢 ENTERPRISE: FILE RECORD CORE - SSoT FOR FILE RECORD SCHEMA
 * =============================================================================
 *
 * Pure module for FileRecord creation - NO SDK DEPENDENCIES.
 * Used by both client (FileRecordService) and server (Telegram webhook).
 *
 * This is the SINGLE SOURCE OF TRUTH for FileRecord schema construction.
 * SDK-specific operations (timestamps, writes) happen in adapters.
 *
 * @module services/file-record/file-record-core
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-055 - Enterprise Attachment Ingestion System
 *
 * Architecture:
 * - Core: Pure functions for schema construction (this file)
 * - Client Adapter: FileRecordService uses firebase/firestore
 * - Server Adapter: Webhook uses firebase-admin
 */

import {
  FILE_STATUS,
  FILE_LIFECYCLE_STATES,
} from '@/config/domain-constants';
import { BIRTH_READ_REACH } from '@/lib/auth/container-read-reach';
import { requireFileCustody, type FileCustody } from '@/lib/files/file-custody';
// 🏢 ENTERPRISE (2026-01-31): Direct imports to avoid barrel file
// The barrel '@/services/upload' re-exports pdf-utils which imports react-i18next
// This breaks API routes with "createContext is not a function" error
import {
  buildStoragePath,
  generateFileId,
  getFileExtension,
} from '@/services/upload/utils/storage-path';
import { buildFileDisplayName } from '@/services/upload/utils/file-display-name';
import type {
  BuildPendingFileRecordInput,
  BuildPendingFileRecordResult,
  CompanyFileRecordBase,
  CompanyPendingFileRecordInput,
  FileRecordBase,
  PersonalFileRecordBase,
  PersonalPendingFileRecordInput,
  BuildFinalizeUpdateInput,
  FinalizeUpdateData,
} from './file-record-core-types';

// Τα συμβόλαια ζουν στο `file-record-core-types` (N.7.1)· επανεξάγονται ώστε κανένας
// καταναλωτής να μην αλλάξει εισαγωγή.
export type {
  FileSourceMetadata,
  IngestionState,
  PendingFileRecordCoordinates,
  BuildPendingFileRecordInput,
  CompanyPendingFileRecordInput,
  PersonalPendingFileRecordInput,
  FileRecordCommonBase,
  CompanyFileRecordBase,
  PersonalFileRecordBase,
  FileRecordBase,
  BuildPendingFileRecordResult,
  BuildFinalizeUpdateInput,
  FinalizeUpdateData,
} from './file-record-core-types';

// ============================================================================
// CORE FUNCTIONS - PURE, NO SDK DEPENDENCIES
// ============================================================================

/**
 * **Τα πεδία κατόχου της γέννησης** — εταιρεία ⇒ `companyId` **+** ο φράχτης CDE· άνθρωπος ⇒
 * **μόνο** `userId` (Ε-Φ0-1: καμία φάση CDE — ο κανόνας `files_personal` αρνείται κάθε κλειδί του
 * `cdeCustodyKeys()`).
 */
function birthCustodyFields(
  custody: FileCustody,
): Pick<CompanyFileRecordBase, 'companyId' | 'cdeReadReach'> | Pick<PersonalFileRecordBase, 'userId'> {
  return custody.userId !== undefined
    ? { userId: custody.userId }
    : { companyId: custody.companyId, cdeReadReach: BIRTH_READ_REACH };
}

/**
 * 🏢 ENTERPRISE: Build pending FileRecord data
 *
 * Creates all deterministic FileRecord fields.
 * SDK adapters add timestamps and write to database.
 *
 * SINGLE SOURCE OF TRUTH for FileRecord schema construction.
 * Used by:
 * - FileRecordService (client SDK)
 * - Telegram webhook (admin SDK)
 * - Any future upload entry points
 *
 * 🔑 **Overloads** (ADR-866 §2.6.8 Β2): εταιρική είσοδος ⇒ εταιρική εγγραφή (`companyId: string`),
 * ώστε οι καλούντες διακομιστή που γεννούν **μόνο** εταιρικά αρχεία να μείνουν ανέγγιχτοι.
 *
 * @param input - Pure input (no SDK types)
 * @returns FileRecord base fields + metadata
 */
export function buildPendingFileRecordData(
  input: CompanyPendingFileRecordInput
): BuildPendingFileRecordResult<CompanyFileRecordBase>;
export function buildPendingFileRecordData(
  input: PersonalPendingFileRecordInput
): BuildPendingFileRecordResult<PersonalFileRecordBase>;
export function buildPendingFileRecordData(
  input: BuildPendingFileRecordInput
): BuildPendingFileRecordResult;
export function buildPendingFileRecordData(
  input: BuildPendingFileRecordInput
): BuildPendingFileRecordResult {
  // 1. Validate required fields
  const custody = requireFileCustody(input);
  if (!input.createdBy) {
    throw new Error('createdBy is REQUIRED for creating FileRecord');
  }

  // 2. File ID — ντετερμινιστικό override αν δόθηκε, αλλιώς τυχαίο (SSoT: N.6)
  const fileId = input.fileId || generateFileId();

  // 3. Get extension from originalFilename if not provided
  const ext = input.ext || getFileExtension(input.originalFilename);

  // 4. Build canonical storage path (IDs only, no names)
  // ADR-709: `input.projectId` is deliberately NOT passed. Project membership is
  // a mutable relationship and lives on the FileRecord (step 7), never in the
  // immutable object key — re-parenting must not require moving bytes.
  const { path: storagePath } = buildStoragePath({
    ...custody,
    entityType: input.entityType,
    entityId: input.entityId,
    domain: input.domain,
    category: input.category,
    fileId,
    ext,
  });

  // 5. Build display name (centralized naming)
  const displayNameResult = buildFileDisplayName({
    entityType: input.entityType,
    entityId: input.entityId,
    domain: input.domain,
    category: input.category,
    entityLabel: input.entityLabel,
    purpose: input.purpose,
    descriptors: input.descriptors,
    occurredAt: input.occurredAt,
    revision: input.revision,
    ext,
    originalFilename: input.originalFilename,
    customTitle: input.customTitle,
    language: input.language || 'el',
  });

  // 6. Build base FileRecord (deterministic fields only)
  const recordBase: FileRecordBase = {
    ...birthCustodyFields(custody),
    id: fileId,
    entityType: input.entityType,
    entityId: input.entityId,
    domain: input.domain,
    category: input.category,
    storagePath,
    displayName: displayNameResult.displayName,
    originalFilename: input.originalFilename,
    ext,
    contentType: input.contentType,
    status: FILE_STATUS.PENDING,
    lifecycleState: FILE_LIFECYCLE_STATES.ACTIVE,
    isDeleted: false,
    createdBy: input.createdBy,
  };

  // 7. Add optional fields only if defined (Firestore rejects undefined)
  if (input.projectId) {
    recordBase.projectId = input.projectId;
  }
  if (input.purpose) {
    recordBase.purpose = input.purpose;
  }
  if (input.entityLabel) {
    recordBase.entityLabel = input.entityLabel;
  }
  if (input.descriptors && input.descriptors.length > 0) {
    recordBase.descriptors = input.descriptors;
  }
  if (input.occurredAt) {
    recordBase.occurredAt = input.occurredAt.toISOString();
  }
  if (input.revision !== undefined) {
    recordBase.revision = input.revision;
  }
  if (input.customTitle) {
    recordBase.customTitle = input.customTitle;
  }
  if (input.linkedTo && input.linkedTo.length > 0) {
    recordBase.linkedTo = input.linkedTo;
  }
  if (input.levelFloorId) {
    recordBase.levelFloorId = input.levelFloorId;
  }
  if (input.source) {
    recordBase.source = input.source;
  }
  if (input.ingestion) {
    recordBase.ingestion = input.ingestion;
  }
  if (input.uploaderName) {
    recordBase.uploaderName = input.uploaderName;
  }
  // ADR-845 §9 Ο-13 — γράφεται ΜΟΝΟ όταν ο καλών το δηλώνει ρητά. Η σιωπή είναι
  // «ιδιωτικό» και το κρίνει ο φρουρός της δημοσίευσης, όχι μια προεπιλογή εδώ.
  if (input.classification) {
    recordBase.classification = input.classification;
  }
  // ADR-845 Ο-27 — γράφεται ΜΟΝΟ όταν ο παραγωγός ξέρει **τι πράγμα** δημοσιεύει. Η σιωπή
  // σημαίνει «αυτό το αρχείο δεν συμμετέχει σε διαδοχή» — ποτέ «είναι το ίδιο με κάτι άλλο».
  if (input.publicationIdentity) {
    recordBase.publicationIdentity = input.publicationIdentity;
  }
  // ADR-845 Ο-25 — γράφεται ΜΟΝΟ όταν ο παραγωγός ξέρει από ποια σχέδια βγήκε. Κενός πίνακας
  // δεν γράφεται: «δεν ξέρω» και «από κανένα σχέδιο» είναι δύο διαφορετικά πράγματα.
  if (input.sourceRevisions && input.sourceRevisions.length > 0) {
    recordBase.sourceRevisions = input.sourceRevisions;
  }
  // ADR-716 Φ5 — γράφεται ΜΟΝΟ όταν υπάρχει ρητή επιλογή· η απουσία σημαίνει
  // «αποφασίζει η σκάλα τεκμηρίων», όχι «άγνωστο».
  if (input.userDrawingUnits) {
    recordBase.userDrawingUnits = input.userDrawingUnits;
  }

  return {
    fileId,
    storagePath,
    displayNameResult,
    recordBase,
  };
}

/**
 * 🏢 ENTERPRISE: Build finalize update data
 *
 * Creates the update object for finalizing a FileRecord.
 * SDK adapters add timestamp and execute update.
 *
 * QUARANTINE GATE: Use nextStatus=PENDING for ingestion files
 * to keep them in quarantine until classification.
 *
 * @param input - Finalize parameters
 * @returns Update data (add timestamp in adapter)
 */
export function buildFinalizeFileRecordUpdate(
  input: BuildFinalizeUpdateInput
): FinalizeUpdateData {
  const updateData: FinalizeUpdateData = {
    status: input.nextStatus ?? FILE_STATUS.READY,
    sizeBytes: input.sizeBytes,
    downloadUrl: input.downloadUrl,
  };

  // Only include hash if provided
  if (input.hash !== undefined) {
    updateData.hash = input.hash;
  }

  // Include thumbnail URL if generated
  if (input.thumbnailUrl) {
    updateData.thumbnailUrl = input.thumbnailUrl;
  }

  return updateData;
}

// Ingestion functions extracted to file-record-ingestion.ts (SRP — ADR N.7.1)
export { buildIngestionStoragePath, buildIngestionFileRecordData } from './file-record-ingestion';

// Re-export utilities for convenience (direct import for server compatibility)
export { generateFileId, getFileExtension } from '@/services/upload/utils/storage-path';
