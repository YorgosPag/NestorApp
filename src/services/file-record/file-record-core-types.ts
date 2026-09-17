/**
 * =============================================================================
 * 🏢 FILE RECORD CORE — ΣΥΜΒΟΛΑΙΑ ΕΙΣΟΔΟΥ/ΕΞΟΔΟΥ (μόνο τύποι)
 * =============================================================================
 *
 * Εξήχθη από το `file-record-core.ts` (N.7.1, ADR-866 §2.6.8 — 495 γρ. πριν δεχτεί κάτοχο
 * «εταιρεία Ή άνθρωπος»). Οι καταναλωτές εισάγουν **ακόμη** από το `file-record-core`, που τα
 * επανεξάγει — καμία αλλαγή εισαγωγών.
 *
 * @module services/file-record/file-record-core-types
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
// ADR-716 Φ5 — ΜΙΑ ονοματολογία μονάδων (SSoT: `utils/scene-units`). Type-only.
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
// ADR-845 Ο-25 — δανεικός τύπος, ποτέ δεύτερη διατύπωση. Type-only.
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import type { CdeReadReach } from '@/config/iso19650-constants';
import type { FileDisplayNameResult } from '@/services/upload/utils/file-display-name';
import type { FileCustody } from '@/lib/files/file-custody';

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
 * 🏢 ENTERPRISE: Input for building pending FileRecord data — **χωρίς** τον κάτοχο.
 * Pure input - no SDK types allowed
 */
export interface PendingFileRecordCoordinates {
  // Required fields
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

/** Κάτοχος **εταιρεία** — το μέλος του κοινού πρωτογενούς, όχι δεύτερη δήλωση. */
type CompanyFileCustody = Extract<FileCustody, { companyId: string }>;

/** Κάτοχος **άνθρωπος** — το μέλος του κοινού πρωτογενούς, όχι δεύτερη δήλωση. */
type PersonalFileCustody = Extract<FileCustody, { userId: string }>;

/**
 * 🏢 Είσοδος του builder: **ποιος κατέχει** (ADR-866 §5.2) **&** πού ανήκει το αρχείο.
 *
 * 🔑 Ίδιο ιδίωμα με το `StoragePathParams` (βήμα 2α): οι υπάρχοντες καλούντες με `{ companyId, … }`
 * **μεταγλωττίζονται ανέγγιχτοι**, γιατί είναι ήδη το μέλος εταιρείας.
 */
export type BuildPendingFileRecordInput = FileCustody & PendingFileRecordCoordinates;

/** Η είσοδος του builder με κάτοχο **εταιρεία**. */
export type CompanyPendingFileRecordInput = CompanyFileCustody & PendingFileRecordCoordinates;

/** Η είσοδος του builder με κάτοχο **άνθρωπο**. */
export type PersonalPendingFileRecordInput = PersonalFileCustody & PendingFileRecordCoordinates;

/**
 * 🏢 ENTERPRISE: Base FileRecord fields (deterministic, no timestamps) — **χωρίς** τον κάτοχο.
 * SDK adapters add timestamps and write to DB
 */
export interface FileRecordCommonBase {
  id: string;
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
 * Εγγραφή **εταιρείας** — φέρει τον φράχτη ανάγνωσης CDE.
 * ADR-862 Φ0 Β11 — ο φράχτης του κανόνα· στη γέννηση ΠΑΝΤΑ `BIRTH_READ_REACH`.
 */
export type CompanyFileRecordBase = FileRecordCommonBase & CompanyFileCustody & {
  cdeReadReach: CdeReadReach;
};

/**
 * Εγγραφή **ανθρώπου** — **κανένα** πεδίο θεματοφυλακής CDE (Ε-Φ0-1: εκδόσεις ναι, φάσεις όχι).
 * Ο κανόνας `files_personal` αρνείται γέννηση με οποιοδήποτε κλειδί του `cdeCustodyKeys()`.
 */
export type PersonalFileRecordBase = FileRecordCommonBase & PersonalFileCustody & {
  cdeReadReach?: never;
};

/** Η εγγραφή που γεννά ο builder — **ακριβώς ένας** κάτοχος. */
export type FileRecordBase = CompanyFileRecordBase | PersonalFileRecordBase;

/**
 * 🏢 ENTERPRISE: Result from buildPendingFileRecordData — η εγγραφή ακολουθεί τον κάτοχο της εισόδου.
 */
export interface BuildPendingFileRecordResult<TBase extends FileRecordBase = FileRecordBase> {
  /** Generated file ID */
  fileId: string;
  /** Generated storage path */
  storagePath: string;
  /** Display name generation result */
  displayNameResult: FileDisplayNameResult;
  /** Base FileRecord fields (add timestamps in adapter) */
  recordBase: TBase;
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
