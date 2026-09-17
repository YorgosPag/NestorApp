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
 * ⚠️ `toFileRecord` **ήταν** ο SSoT normalizer: το `file-record-links.ts` κουβαλούσε
 * ιδιωτικό αντίγραφό του μέχρι τις 2026-07-25 (N.0.2 Boy Scout — δεύτερο αντίγραφο
 * = δεύτερο σημείο να αποκλίνει ο κανόνας `Timestamp→ISO`).
 *
 * 🔑 **2026-09-16 (ADR-862 Φ0 Β9): το σπίτι μετακόμισε στο σύνορο.** Ο κανόνας ζει
 * πλέον στο `lib/files/file-record-read.ts` — τον **ίδιο** που χρησιμοποιεί και η
 * φρουρημένη ανάγνωση. Το `toFileRecord` **μένει** ως το όνομα που ξέρουν οι ~90
 * καταναλωτές, αλλά είναι πλέον **delegate**: μία γραμμή, μηδέν δεύτερη αλήθεια.
 *
 * @module services/file-record-queries
 * @enterprise ADR-031 — Canonical File Storage System, ADR-214 Phase 3
 * @see lib/files/file-record-read — ο θεματοφύλακας (CHECK 3.74)
 */

import { where, type DocumentData, type QueryConstraint } from 'firebase/firestore';

import { FILE_LIFECYCLE_STATES, FILE_STATUS } from '@/config/domain-constants';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { normalizeFileRecord } from '@/lib/files/file-record-read';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { FileRecord, FileRecordQuery } from '@/types/file-record';
import { FILE_COLLECTION, type FileCustody } from '@/lib/files/file-custody';
import { custodyKindOfScope, type CustodyKind } from '@/lib/workspace/custody-scope';

const logger = createModuleLogger('FILE_RECORD');

export interface GetFilesByEntityOptions {
  domain?: FileDomain;
  category?: FileCategory;
  purpose?: string;
  levelFloorId?: string;
  includeDeleted?: boolean;
  /**
   * **Ποιος κατέχει τα αρχεία** (ADR-866 §2.6.8 Β5) — ορίζει διαμέρισμα **και** φίλτρο κατόχου.
   * Απουσία ⇒ **εταιρεία** με το φίλτρο μισθωτή της υπηρεσίας (ό,τι ίσχυε πάντα για αναγνώστες ·
   * ίδιο δόγμα με το `custodyKindFromParam`).
   */
  custody?: FileCustody;
}

/**
 * **Το διαμέρισμα και το χειρόγραφο φίλτρο κατόχου ενός αναγνώστη.**
 *
 * 🔑 ADR-866 §2.6.8 Β1 — η υπηρεσία βάζει **ήδη** το φίλτρο κατόχου. Το χειρόγραφο `companyId`
 * μένει **μόνο** για εταιρεία: καλύπτει τον super admin χωρίς επιλεγμένη εταιρεία. Για άνθρωπο
 * **κανένα** — η υπηρεσία γράφει `userId == uid`, ακριβώς όσο ζητά ο κανόνας `files_personal`.
 */
export function fileOwnerConstraints(custody: FileCustody | undefined): QueryConstraint[] {
  return custody?.companyId !== undefined ? [where('companyId', '==', custody.companyId)] : [];
}

/** Το είδος κατόχου ενός αναγνώστη — απουσία ⇒ `company`. */
export function fileReadKindOf(custody: FileCustody | undefined): CustodyKind {
  return custody === undefined ? 'company' : custodyKindOfScope(custody);
}

// ============================================================================
// POST-QUERY NORMALIZATION HELPER (ADR-214 Phase 3)
// ============================================================================

/**
 * **Delegate προς τον θεματοφύλακα** (ADR-862 Φ0 Β9).
 *
 * ⚠️ **ΑΝΕΚΤΙΚΗ πόρτα, επίτηδες**: κανονικοποίηση + φρουρός σχήματος, **καμία**
 * κρίση κατάστασης. Ένα έγγραφο με ασυνεπές `cdeState` **συνεχίζει να εμφανίζεται**
 * στις λίστες, ακριβώς όπως σήμερα — η απόκρυψη ανήκει στο Β11, πίσω από τον κανόνα.
 * Για διαδρομή που πρόκειται να **γράψει**, χρησιμοποίησε `readFileRecord`.
 */
export function toFileRecord(raw: DocumentData): FileRecord | null {
  return normalizeFileRecord(raw);
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
  custody: CustodyKind,
): Promise<FileRecord[]> {
  const result = await firestoreQueryService.getAll<DocumentData>(FILE_COLLECTION[custody], { constraints });

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

  // 🔒 SECURITY: owner constraint required for Firestore Security Rules (ADR-866 §2.6.8 Β1)
  constraints.push(...fileOwnerConstraints(options?.custody));

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

  const validRecords = await runFileRecordQuery(constraints, 'query results', fileReadKindOf(options?.custody));

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

  return runFileRecordQuery(constraints, 'queryFileRecords', 'company');
}
