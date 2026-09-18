/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Audit Trail Service
 * =============================================================================
 *
 * Records every file operation for compliance and traceability.
 * Stores audit entries in Firestore `file_audit_log` collection.
 *
 * Operations tracked:
 * - view, download, upload, rename, classify, delete, restore, rollback
 * - batch operations (batch_delete, batch_classify, batch_download)
 * - AI operations (ai_classify)
 *
 * @module services/file-audit.service
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 3.1)
 * @compliance ISO 27001 §A.12.4 (Logging and Monitoring)
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit as firestoreLimit,
  serverTimestamp,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { FILE_AUDIT_COLLECTION } from '@/lib/files/file-custody';
import {
  custodyKindOfScope,
  custodyOnly,
  type CustodyScope,
} from '@/lib/workspace/custody-scope';
// 🔑 ADR-862 Φ0 Β6 — το λεξιλόγιο μετακόμισε σε SSoT **ανεξάρτητο SDK**, ώστε να μπορεί
//    να το εισαγάγει ΚΑΙ ο γραφέας του διακομιστή. Δες `types/file-audit` για το τι
//    κόστισε όσο ήταν δεμένο εδώ: **πέντε** αποκλίνοντα admin-side δίδυμα.
import type {
  FileAuditActFields,
  FileAuditAction,
  FileAuditMetadata,
  FileAuditRecordFields,
} from '@/types/file-audit';

// ⚠️ **ΔΥΟ ΓΡΑΜΜΕΣ, ΟΧΙ ΜΙΑ** — ίδιο μάθημα με το `roles.ts` ↔ `role-catalogue.ts`
//    (ADR-806 §7 #1): το `export … from` **επανεξάγει, δεν εισάγει**, άρα χρειάζεται
//    και το `import type` από πάνω για να τρέξουν οι υπογραφές αυτού του αρχείου.
//    Έτσι κανένας από τους υπάρχοντες καταναλωτές δεν αγγίζεται.
export type { FileAuditAction, FileAuditMetadata } from '@/types/file-audit';

const logger = createModuleLogger('FileAuditService');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Η εγγραφή **όπως τη γράφει ο πελάτης** — το κοινό σχήμα, με τη χρονοσήμανση του
 * client SDK.
 *
 * 🔑 Ο τύπος του `timestamp` είναι το **μόνο** πεδίο που δεν μπορεί να είναι κοινό: ο
 * `FieldValue` του `firebase/firestore` και του `firebase-admin/firestore` είναι
 * **διαφορετικές κλάσεις**. Γι' αυτό ζει εδώ και όχι στο SSoT.
 */
export interface FileAuditEntry extends FileAuditRecordFields {
  /** Timestamp (server) — sentinel του client SDK. */
  readonly timestamp: ReturnType<typeof serverTimestamp>;
}

/** Audit entry as returned from Firestore (with resolved timestamp) */
export interface FileAuditRecord extends Omit<FileAuditEntry, 'timestamp'> {
  id: string;
  timestamp: Date | string;
  /** Ο κάτοχος του **προσωπικού** βιβλίου (ADR-866 §2.6.11) — απών στο εταιρικό. */
  userId?: string;
}

// ============================================================================
// COLLECTION NAME
// ============================================================================

const COMPANY_FILE_AUDIT_COLLECTION = COLLECTIONS.FILE_AUDIT_LOG;

// ============================================================================
// SERVICE
// ============================================================================

export class FileAuditService {
  /**
   * Record a file operation in the audit log.
   *
   * @param entry - Audit entry (timestamp is added automatically)
   * @returns Firestore document ID
   */
  static async log(
    fileId: string,
    action: FileAuditAction,
    performedBy: string,
    metadata?: FileAuditMetadata,
  ): Promise<string>;
  static async log(
    fileId: string,
    action: FileAuditAction,
    performedBy: string,
    companyId?: string,
    metadata?: FileAuditMetadata,
  ): Promise<string>;
  static async log(
    fileId: string,
    action: FileAuditAction,
    performedBy: string,
    companyIdOrMetadata?: string | FileAuditMetadata,
    metadata?: FileAuditMetadata,
  ): Promise<string> {
    // Resolve overloaded parameters
    let companyId: string | undefined;
    let resolvedMetadata: FileAuditMetadata | undefined;

    if (typeof companyIdOrMetadata === 'string') {
      companyId = companyIdOrMetadata;
      resolvedMetadata = metadata;
    } else if (typeof companyIdOrMetadata === 'object' && companyIdOrMetadata !== null) {
      resolvedMetadata = companyIdOrMetadata;
    }

    try {
      // Resolve companyId from FileRecord when not provided (tenant isolation)
      if (!companyId && fileId) {
        try {
          const fileSnap = await getDoc(doc(db, COLLECTIONS.FILES, fileId));
          if (fileSnap.exists()) {
            companyId = (fileSnap.data().companyId as string) || undefined;
          }
        } catch {
          // Best-effort — continue without companyId if lookup fails
        }
      }

      const entry: FileAuditEntry = {
        fileId,
        action,
        performedBy,
        timestamp: serverTimestamp(),
        companyId: companyId ?? undefined,
        metadata: resolvedMetadata ?? undefined,
      };

      // Remove undefined values for Firestore
      const cleanEntry: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry)) {
        if (value !== undefined) {
          cleanEntry[key] = value;
        }
      }

      const { generateAuditId } = await import('@/services/enterprise-id.service');
      const enterpriseId = generateAuditId();
      const docRef = doc(db, COMPANY_FILE_AUDIT_COLLECTION, enterpriseId);
      await setDoc(docRef, cleanEntry);

      return enterpriseId;
    } catch (err) {
      // Audit failures should never break the main operation
      logger.error('Failed to record audit entry', {
        fileId,
        action,
        error: getErrorMessage(err),
      });
      return '';
    }
  }

  /**
   * **Βάλε τη γραμμή δραστηριότητας σε δέσμη** — στο βιβλίο **του κατόχου** (ADR-866 §2.6.11).
   *
   * 🔑 Δεν γράφει μόνη της: ο καλών (`commitFileActivity`) βάζει στην **ίδια** δέσμη την αλλαγή του
   * αρχείου με `lastActivityId` = το id που επιστρέφεται, και οι κανόνες ζευγαρώνουν τα δύο. Χρόνος
   * **διακομιστή** (`serverTimestamp()` ⇒ ο κανόνας ζητά `== request.time`) και **μόνο** το πεδίο του
   * κατόχου — ποτέ και τα δύο.
   *
   * ⚠️ Αντικατέστησε το `logForCustody`, που για προσωπικό αρχείο **σιωπούσε** (2β.2 → 2β.4).
   */
  static async stageActivity(batch: WriteBatch, owner: CustodyScope, act: FileAuditActFields): Promise<string> {
    const { generateAuditId } = await import('@/services/enterprise-id.service');
    const activityId = generateAuditId();
    batch.set(doc(db, COLLECTIONS[FILE_AUDIT_COLLECTION[custodyKindOfScope(owner)]], activityId), {
      fileId: act.fileId,
      action: act.action,
      performedBy: act.performedBy,
      ...custodyOnly(owner),
      timestamp: serverTimestamp(),
      ...(act.metadata === undefined ? {} : { metadata: act.metadata }),
    });
    return activityId;
  }

  /**
   * Record a batch operation (multiple files).
   */
  static async logBatch(
    fileIds: string[],
    action: FileAuditAction,
    performedBy: string,
    companyId?: string,
    metadata?: FileAuditMetadata,
  ): Promise<void> {
    // Log one entry per file for queryability
    await Promise.allSettled(
      fileIds.map((fileId) =>
        FileAuditService.log(fileId, action, performedBy, companyId, {
          ...metadata,
          batchSize: fileIds.length,
        }),
      ),
    );
  }

  /**
   * **ΤΟ ΕΝΑ ΕΡΩΤΗΜΑ ΙΣΤΟΡΙΚΟΥ** — αλλάζει **μόνο** ποιο είναι το δεύτερο κριτήριο.
   *
   * 🧹 **Εξήχθη 2026-09-16 (CHECK 3.28 / N.18)**: οι `getFileHistory` και `getUserHistory`
   * ήταν **ταυτόσημες** σε 20 γραμμές / 109 tokens — ίδιο `colRef`, ίδιο φίλτρο μισθωτή,
   * ίδια ταξινόμηση, και **byte-προς-byte** το ίδιο mapping σε {@link FileAuditRecord}.
   * Διέφεραν σε **δύο** πράγματα: το πεδίο του δεύτερου `where` και το προεπιλεγμένο όριο.
   *
   * ⚠️ Δεν ήταν κλώνος «από αμέλεια»: γεννήθηκε όταν το λεξιλόγιο μετακόμισε στο
   * `types/file-audit.ts` και οι δύο μέθοδοι **συνέκλιναν**. Ακριβώς το σχήμα που ο N.18
   * ονομάζει *«κεντρικοποιείς το Α, γράφεις Β+Γ ως δίδυμα»* — γι' αυτό το πιάνει πύλη
   * **μέσα στο ίδιο commit** και όχι ανασκόπηση.
   *
   * 🔑 **Οι δύο δημόσιες υπογραφές ΔΕΝ άλλαξαν** — κανένας καταναλωτής δεν αγγίχθηκε.
   *
   * ⚠️ Το φίλτρο κατόχου μένει **πρώτο και υποχρεωτικό**: είναι το κλειδί με το οποίο ρωτούν ο
   * αναγνώστης **και** ο κανόνας, και γραμμή χωρίς κάτοχο είναι **δομικά αόρατη** (δες
   * `types/file-audit.ts` για τις πέντε γραφές που το παρέλειπαν).
   *
   * 📒 ADR-866 §2.6.11 — **ένα** ερώτημα, δύο βιβλία: το διαμέρισμα από τον κάτοχο
   * (`FILE_AUDIT_COLLECTION`), και το φίλτρο κατόχου **κυριολεκτικό** ανά κλάδο, ώστε οι πύλες
   * 3.15/3.35 να το βλέπουν. Ο κανόνας του προσωπικού βιβλίου **δεν** φιλτράρει — το `userId` εδώ
   * είναι αυτό που κάνει το ερώτημα αποδεκτό.
   */
  private static async queryHistory(
    field: 'fileId' | 'performedBy',
    value: string,
    owner: CustodyScope,
    maxEntries: number,
  ): Promise<FileAuditRecord[]> {
    const colRef = collection(db, COLLECTIONS[FILE_AUDIT_COLLECTION[custodyKindOfScope(owner)]]);
    const q = query(
      colRef,
      owner.userId !== undefined
        ? where('userId', '==', owner.userId)
        : where('companyId', '==', owner.companyId),
      where(field, '==', value),
      orderBy('timestamp', 'desc'),
      firestoreLimit(maxEntries),
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fileId: data.fileId,
        action: data.action,
        performedBy: data.performedBy,
        timestamp: data.timestamp?.toDate?.() ?? data.timestamp ?? '',
        companyId: data.companyId,
        userId: data.userId,
        metadata: data.metadata,
      } as FileAuditRecord;
    });
  }

  /**
   * **Η δραστηριότητα ενός αρχείου** — στο βιβλίο του κατόχου του (ADR-866 §2.6.11).
   */
  static async getFileHistory(
    fileId: string,
    owner: CustodyScope,
    maxEntries = 50,
  ): Promise<FileAuditRecord[]> {
    return FileAuditService.queryHistory('fileId', fileId, owner, maxEntries);
  }

  /**
   * Retrieve audit history for a user (across all files).
   */
  static async getUserHistory(
    performedBy: string,
    companyId: string,
    maxEntries = 100,
  ): Promise<FileAuditRecord[]> {
    return FileAuditService.queryHistory('performedBy', performedBy, { companyId }, maxEntries);
  }
}
