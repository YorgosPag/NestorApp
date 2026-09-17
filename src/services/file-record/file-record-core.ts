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

import type {
  EntityType,
  FileDomain,
  FileCategory,
  FileStatus,
  FileLifecycleState,
  FileClassification,
} from '@/config/domain-constants';
import type { DocumentClassifyAnalysis } from '@/schemas/ai-analysis';
// ADR-716 Φ5 — ΜΙΑ ονοματολογία μονάδων (SSoT: `utils/scene-units`). Type-only ⇒ το
// «NO SDK DEPENDENCIES» συμβόλαιο αυτού του module μένει άθικτο (μηδέν runtime import).
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
// ADR-845 Ο-25 — δανεικός τύπος, ποτέ δεύτερη διατύπωση. Type-only ⇒ το «NO SDK
// DEPENDENCIES» συμβόλαιο αυτού του module μένει άθικτο.
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import {
  FILE_STATUS,
  FILE_LIFECYCLE_STATES,
  SYSTEM_IDENTITY,
} from '@/config/domain-constants';
import type { CdeReadReach } from '@/config/iso19650-constants';
import { BIRTH_READ_REACH } from '@/lib/auth/container-read-reach';
// 🏢 ENTERPRISE (2026-01-31): Direct imports to avoid barrel file
// The barrel '@/services/upload' re-exports pdf-utils which imports react-i18next
// This breaks API routes with "createContext is not a function" error
import {
  buildStoragePath,
  generateFileId,
  getFileExtension,
} from '@/services/upload/utils/storage-path';
import {
  buildFileDisplayName,
  type FileDisplayNameResult,
} from '@/services/upload/utils/file-display-name';

// ============================================================================
// TYPES - INPUT/OUTPUT CONTRACTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Source metadata for files from external systems
 * Used for traceability and deduplication (Telegram, Email, etc.)
 * MUST match FileRecord.source type in types/file-record.ts
 */
export interface FileSourceMetadata {
  /** Source system identifier */
  type: 'telegram' | 'email' | 'whatsapp' | 'web-form' | 'api';
  /** Chat/conversation ID (for Telegram) */
  chatId?: string;
  /** Message ID from source system */
  messageId?: string;
  /** Unique file ID from source (for deduplication) */
  fileUniqueId?: string;
  /** Telegram file_id for download (may change) */
  fileId?: string;
  /** User ID from source system */
  fromUserId?: string;
  /** Sender name for display */
  senderName?: string;
  /** When the file was received */
  receivedAt?: Date | string;
}

/**
 * 🏢 ENTERPRISE: Ingestion state for quarantine pipeline
 * MUST match FileRecord.ingestion type in types/file-record.ts
 */
export interface IngestionState {
  /** Current state in ingestion pipeline */
  state: 'received' | 'scanned' | 'classified';
  /** When state was last changed */
  stateChangedAt?: Date | string;
  /** Security scan result (if scanned) */
  scanResult?: {
    passed: boolean;
    scannedAt: Date | string;
    scannerVersion?: string;
    threats?: string[];
  };
  /** AI document classification (if available) */
  analysis?: DocumentClassifyAnalysis;
}

/**
 * 🏢 ENTERPRISE: Input for building pending FileRecord data
 * Pure input - no SDK types allowed
 */
export interface BuildPendingFileRecordInput {
  // Required fields
  companyId: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  originalFilename: string;
  contentType: string;
  createdBy: string;

  // Optional fields
  projectId?: string;
  ext?: string;

  /**
   * Προαιρετικό override του fileId για **idempotent** μεταφόρτωση.
   * Όταν δίνεται ντετερμινιστικό id (βλ. `generateDeterministicFileId`), μια
   * δεύτερη κλήση με το ίδιο αρχείο γράφει στο ΙΔΙΟ `files/{fileId}` και στο
   * ΙΔΙΟ storage path (το path εμπεριέχει το fileId) → κανένα διπλότυπο.
   * Χωρίς αυτό, η συμπεριφορά μένει ακριβώς όπως πριν (τυχαίο id).
   */
  fileId?: string;

  // Naming context (for displayName generation)
  entityLabel?: string;
  purpose?: string;
  descriptors?: string[];
  occurredAt?: Date;
  revision?: number;
  customTitle?: string;

  // Cross-entity visibility — parent entity links (e.g., unit → floor, building)
  linkedTo?: string[];

  // Multi-level unit floorplan (ADR-236 Phase 3)
  levelFloorId?: string;

  // Source metadata (for external ingestion)
  source?: FileSourceMetadata;

  // Ingestion state (for quarantine pipeline)
  ingestion?: IngestionState;

  // ADR-716 Φ5 — ρητή επιλογή μονάδων DXF (μόνο όταν ο χρήστης την έκανε)
  userDrawingUnits?: SceneUnits;

  // Language for display name
  language?: 'el' | 'en';

  // Display name of uploader (denormalized at creation time)
  uploaderName?: string;

  /**
   * **Επιτρέπεται αυτό το αρχείο να φύγει από την εταιρεία;** (ADR-845 §9 Ο-13)
   *
   * 🔴 **ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΟΤΑΝ Η ΑΝΘΡΩΠΙΝΗ ΠΡΑΞΗ ΕΧΕΙ ΗΔΗ ΣΥΜΒΕΙ.** Η απουσία σημαίνει
   * **ιδιωτικό** — ποτέ «άγνωστο»: ο φρουρός της δημοσίευσης ρωτά `=== 'public'`, οπότε
   * ό,τι δεν δηλώθηκε ρητά μένει μέσα στην εταιρεία. ⛔ Καμία προεπιλογή εδώ: μια
   * προεπιλογή θα σήμαινε ότι ο πρώτος που ξεχνά να απαντήσει **δημοσιεύει**.
   *
   * ⚠️ Ως το Ο-13 το πεδίο **δεν μπορούσε καν να δηλωθεί στη γέννηση** — έμπαινε μόνο
   * αργότερα, με ξεχωριστή πράξη στον διαχειριστή αρχείων. Μια διαδρομή που **είναι** η
   * ίδια η πράξη δημοσίευσης δεν είχε πού να το πει, και η πράξη έμενε **χωρίς ίχνος**.
   */
  classification?: FileClassification;

  /**
   * **Ποιο πράγμα δημοσιεύει αυτό το αρχείο;** (ADR-845 Ο-27) — δες
   * {@link FileRecord.publicationIdentity} για ολόκληρο το σκεπτικό.
   *
   * ⚠️ **Το κείμενο είναι αδιαφανές ΕΔΩ, επίτηδες**: αυτός ο builder δεν ξέρει από μοντέλα.
   * Η **παραγωγή** της τιμής ζει στον ειδικό γραφέα κάθε είδους *(για μοντέλα:
   * `lib/listings/model-publication-identity`)*, ώστε ένα δεύτερο είδος να μη χρειαστεί να
   * αλλάξει τίποτα εδώ — ακριβώς το ιδίωμα του `classification` από πάνω.
   */
  publicationIdentity?: string;

  /**
   * **Από ποια έκδοση σχεδίου παρήχθη** (ADR-845 Ο-25) — δες
   * {@link FileRecord.sourceRevisions} για ολόκληρο το σκεπτικό.
   *
   * ⚠️ **Ο τύπος είναι δανεικός, όχι ξαναγραμμένος**: μια δεύτερη διατύπωση του
   * `{ fileId, revision }` εδώ θα ήταν δεύτερο σχήμα για το ίδιο πράγμα — και τα δύο θα
   * μπορούσαν να αποκλίνουν χωρίς να το δει ο μεταγλωττιστής.
   */
  sourceRevisions?: readonly ModelSourceRevision[];
}

/**
 * 🏢 ENTERPRISE: Base FileRecord fields (deterministic, no timestamps)
 * SDK adapters add timestamps and write to DB
 */
export interface FileRecordBase {
  id: string;
  companyId: string;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  domain: FileDomain;
  category: FileCategory;
  storagePath: string;
  displayName: string;
  originalFilename: string;
  ext: string;
  contentType: string;
  status: FileStatus;
  lifecycleState?: FileLifecycleState;
  isDeleted?: boolean;
  createdBy: string;
  // ADR-862 Φ0 Β11 — ο φράχτης του κανόνα· στη γέννηση ΠΑΝΤΑ `BIRTH_READ_REACH`.
  cdeReadReach: CdeReadReach;

  // ADR-845 §9 Ο-13 — η εξουσιοδότηση εξόδου· απουσία = ιδιωτικό, ποτέ «άγνωστο».
  classification?: FileClassification;

  // ADR-845 Ο-27 — **ποιο πράγμα** δημοσιεύεται· απουσία = δεν συμμετέχει σε διαδοχή,
  // ποτέ «είναι το ίδιο με κάτι άλλο». Δες `FileRecord.publicationIdentity`.
  publicationIdentity?: string;

  // ADR-845 Ο-25 — από ποια έκδοση σχεδίου παρήχθη· απουσία = «δεν ξέρω», ποτέ «ισχύει».
  sourceRevisions?: readonly ModelSourceRevision[];

  // Entity linking — cross-entity file references
  linkedTo?: string[];

  // Optional naming metadata
  purpose?: string;
  entityLabel?: string;
  descriptors?: string[];
  occurredAt?: string;
  revision?: number;
  customTitle?: string;

  // Multi-level unit floorplan (ADR-236 Phase 3)
  levelFloorId?: string;

  // Source metadata (for external ingestion)
  source?: FileSourceMetadata;

  // Ingestion state (for quarantine pipeline)
  ingestion?: IngestionState;

  // Display name of uploader (denormalized at creation time)
  uploaderName?: string;

  // ADR-716 Φ5 — ρητή ετυμηγορία μονάδων· ιδιότητα του ΣΥΝΔΕΣΜΟΥ, όχι της στιγμής
  userDrawingUnits?: SceneUnits;
}

/**
 * 🏢 ENTERPRISE: Result from buildPendingFileRecordData
 */
export interface BuildPendingFileRecordResult {
  /** Generated file ID */
  fileId: string;
  /** Generated storage path */
  storagePath: string;
  /** Display name generation result */
  displayNameResult: FileDisplayNameResult;
  /** Base FileRecord fields (add timestamps in adapter) */
  recordBase: FileRecordBase;
}

/**
 * 🏢 ENTERPRISE: Input for building finalize update
 */
export interface BuildFinalizeUpdateInput {
  /** File size in bytes */
  sizeBytes: number;
  /** Download URL from Storage */
  downloadUrl: string;
  /** Content hash (optional) */
  hash?: string;
  /** Thumbnail preview URL (optional — generated at upload time for DXF/PDF) */
  thumbnailUrl?: string;
  /**
   * Next status after finalize
   * - READY: Normal uploads (default)
   * - PENDING: Ingestion files (quarantine gate)
   */
  nextStatus?: FileStatus;
}

/**
 * 🏢 ENTERPRISE: Finalize update data (add timestamp in adapter)
 */
export interface FinalizeUpdateData {
  status: FileStatus;
  sizeBytes: number;
  downloadUrl: string;
  hash?: string;
  thumbnailUrl?: string;
}

// ============================================================================
// CORE FUNCTIONS - PURE, NO SDK DEPENDENCIES
// ============================================================================

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
 * @param input - Pure input (no SDK types)
 * @returns FileRecord base fields + metadata
 */
export function buildPendingFileRecordData(
  input: BuildPendingFileRecordInput
): BuildPendingFileRecordResult {
  // 1. Validate required fields
  if (!input.companyId) {
    throw new Error('companyId is REQUIRED for creating FileRecord');
  }
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
    companyId: input.companyId,
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
    id: fileId,
    companyId: input.companyId,
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
    cdeReadReach: BIRTH_READ_REACH,
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
