/**
 * =============================================================================
 * JOB: file-purge — εκκαθάριση κάδου αρχείων + ορφανών PENDING/FAILED
 * =============================================================================
 *
 * Φάση Α: οριστική διαγραφή αρχείων του κάδου που πέρασαν το `purgeAt`.
 * Φάση Β: εκκαθάριση ορφανών PENDING/FAILED παλαιότερων του TTL (προεπιλογή 48h).
 *
 * Οι δύο φάσεις τρέχουν **παράλληλα**: απαντούν σε διαφορετική ερώτηση πάνω στην ίδια
 * συλλογή και δεν εξαρτώνται μεταξύ τους.
 *
 * @module lib/cron/jobs/file-purge
 * @enterprise ADR-191 — Enterprise Document Management System (Phase 3.2)
 * @see ADR-740
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { FILE_STATUS } from '@/config/domain-constants';
import {
  purgeFileRecord,
  isFileHeld,
  PENDING_FILE_TTL_MS,
} from '@/services/file-record/file-purge-helpers';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('CronFilePurge');

/** Απολογισμός μιας φάσης. */
interface FilePurgeTally {
  purged: number;
  skipped: number;
  checked: number;
}

/** Ό,τι διαφέρει ανάμεσα στις δύο φάσεις — τα υπόλοιπα είναι κοινά. */
interface PurgePolicy {
  /** Ποιος καταγράφεται ως δράστης στο ίχνος ελέγχου. */
  readonly performedBy: string;
  /** Γιατί διαγράφηκε — ταξινομεί το ίχνος. */
  readonly purgeReason: string;
  /** Συμφραζόμενα του συγκεκριμένου εγγράφου για το ίχνος. */
  readonly metadata: (data: FirebaseFirestore.DocumentData) => Record<string, unknown>;
}

/**
 * Ο κοινός βρόχος εκκαθάρισης: παράλειψε ό,τι κρατείται, διάγραψε τα υπόλοιπα, μέτρα.
 *
 * ⚠️ Ήταν γραμμένος **δύο φορές** (μία ανά φάση) μέσα στο παλιό route — 19 γραμμές
 * byte-ίδιες, εντοπισμένες από το CHECK 3.28 (jscpd, ADR-584) τη στιγμή της
 * μετακόμισης. Δύο αντίγραφα σημαίνουν ότι ένας νέος κανόνας διατήρησης (π.χ. ένα
 * δεύτερο είδος legal hold) εφαρμόζεται στη μία φάση και ξεχνιέται στην άλλη —
 * δηλαδή αρχεία που έπρεπε να μείνουν, διαγράφονται **οριστικά** από τη μία μόνο
 * διαδρομή. Ο έλεγχος `isFileHeld` πρέπει να ζει σε **ένα** σημείο.
 */
async function purgeMatching(
  snapshot: FirebaseFirestore.QuerySnapshot,
  policy: PurgePolicy
): Promise<FilePurgeTally> {
  let purged = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Legal hold / retention lock — δεν αγγίζεται ό,τι κρατείται σκόπιμα.
    if (isFileHeld(data)) {
      skipped++;
      continue;
    }

    const result = await purgeFileRecord({
      fileId: doc.id,
      storagePath: data.storagePath as string | undefined,
      performedBy: policy.performedBy,
      purgeReason: policy.purgeReason,
      metadata: policy.metadata(data),
    });

    if (result.success) purged++;
    else skipped++;
  }

  return { purged, skipped, checked: snapshot.size };
}

/** Φάση Α: αρχεία του κάδου που πέρασαν την ημερομηνία διαγραφής. */
async function purgeExpiredTrash(
  db: FirebaseFirestore.Firestore,
  now: string
): Promise<FilePurgeTally> {
  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where(FIELDS.IS_DELETED, '==', true)
    .where('purgeAt', '<=', now)
    .limit(100)
    .get();

  return purgeMatching(snapshot, {
    performedBy: 'system:cron-purge',
    purgeReason: 'cron_trash',
    metadata: (data) => ({
      originalPurgeAt: data.purgeAt ?? null,
      category: data.category ?? null,
    }),
  });
}

/** Φάση Β: ορφανά PENDING/FAILED παλαιότερα του TTL. */
async function purgeOrphanPendingFiles(
  db: FirebaseFirestore.Firestore
): Promise<FilePurgeTally> {
  const cutoff = new Date(Date.now() - PENDING_FILE_TTL_MS).toISOString();

  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where('status', 'in', [FILE_STATUS.PENDING, FILE_STATUS.FAILED])
    .where('createdAt', '<', cutoff)
    .limit(50)
    .get();

  return purgeMatching(snapshot, {
    performedBy: 'system:cron-orphan-cleanup',
    purgeReason: 'ttl_expired',
    metadata: (data) => ({
      originalStatus: data.status ?? null,
      domain: data.domain ?? null,
      ageHours: Math.round((Date.now() - new Date(data.createdAt).getTime()) / 3_600_000),
    }),
  });
}

export interface FilePurgeReport {
  readonly trash: FilePurgeTally;
  readonly orphans: FilePurgeTally;
}

/** Εκτελεί και τις δύο φάσεις εκκαθάρισης αρχείων. */
export async function purgeFiles(): Promise<FilePurgeReport> {
  const db = getAdminFirestore();
  const now = nowISO();

  const [trash, orphans] = await Promise.all([
    purgeExpiredTrash(db, now),
    purgeOrphanPendingFiles(db),
  ]);

  logger.info('Daily file purge complete', {
    trashPurged: trash.purged,
    trashSkipped: trash.skipped,
    orphansPurged: orphans.purged,
    orphansSkipped: orphans.skipped,
  });

  return { trash, orphans };
}

/** Προσαρμογέας για τον χρονοπρογραμματιστή. */
export async function runFilePurge(): Promise<CronJobResult> {
  const { trash, orphans } = await purgeFiles();
  return {
    summary: `trash ${trash.purged}/${trash.checked}, orphans ${orphans.purged}/${orphans.checked}`,
    metrics: {
      trashPurged: trash.purged,
      trashSkipped: trash.skipped,
      orphansPurged: orphans.purged,
      orphansSkipped: orphans.skipped,
    },
  };
}
