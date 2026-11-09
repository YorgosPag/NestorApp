import 'server-only';

/**
 * =============================================================================
 * ΑΠΟΔΕΣΜΕΥΣΗ ΤΗΣ ΚΑΡΑΝΤΙΝΑΣ — περιεχόμενο που δεν το κρατά καμία ανοιχτή παρτίδα πάει στον κάδο (ADR-934 §5.2.2 Μ-β5)
 * =============================================================================
 *
 * Το περιεχόμενο καραντίνας είναι **κοινό**: τα ίδια bytes από δύο παρτίδες είναι ένα αρχείο. Άρα «η παρτίδα τελείωσε» **δεν**
 * σημαίνει «σβήσ' το» — σημαίνει «ρώτα αν το κρατά **άλλη** ανοιχτή παρτίδα» (μέτρηση αναφορών, πρότυπο mark-and-sweep):
 *   1. οι `ready` λήψεις της παρτίδας ⇒ τα διακριτά περιεχόμενα·
 *   2. για καθένα, οι `ready` λήψεις **κάθε** παρτίδας του χώρου που δείχνουν σε αυτό ⇒ οι παρτίδες τους·
 *   3. καμία ανοιχτή ⇒ **κάδος** (τα πεδία του \`fileTrashFields\`, \`purgeAt\` = +{@link CATALOG_MEDIA_QUARANTINE_TRASH_DAYS}).
 * Η οριστική διαγραφή μένει στη **μία** αγωγό (`file-purge` cron · `isFileHeld` · `purgeFileRecord`) — κανένας δεύτερος διαγραφέας.
 *
 * 🔑 **Ιδεμπότητο**: ό,τι δεν είναι πια ζωντανό δεν ξαναγράφεται (δεύτερος κάδος δεν μεταθέτει το ρολόι της εκκαθάρισης).
 * 🔑 **Αγώνας** με παρτίδα που κρατά τα ίδια bytes την ίδια στιγμή: **αυτο-θεραπεύεται** — η επόμενη ζήτηση τα επαναφέρει
 *   (`media-content-revival`). Γι' αυτό εδώ δεν χρειάζεται κλείδωμα πάνω σε όλες τις λήψεις του χώρου.
 * Καλούν: η εγκατάλειψη / το κλείσιμο παρτίδας (κύριος δρόμος) και το δίχτυ `catalog-media-quarantine-sweep` (cron).
 *
 * @module server/catalog/media-quarantine-release.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_LIFECYCLE_STATES } from '@/config/file-lifecycle-states';
import { nowISO } from '@/lib/date-local';
import { fileTrashFields } from '@/lib/files/file-trash-fields';
import { purgeDateAfterDays } from '@/lib/files/file-trash-state';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { mediaContentStateOf } from '@/subapps/catalog/import/media-content-state';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import { CATALOG_MEDIA_QUARANTINE_TRASH_DAYS } from '@/subapps/catalog/vocabulary/asset-fetch';
import { IMPORT_FINISHED_BATCH_STATUSES } from '@/subapps/catalog/vocabulary/catalog-import';
import { readOwnedOrNull } from './catalog-store.server';
import { mediaContentFileRef } from './media-content-revival.server';

const logger = createModuleLogger('CatalogMediaRelease');

/** Ο δράστης στο ίχνος: η αποδέσμευση είναι **συνέπεια** κανόνα, όχι πράξη ανθρώπου πάνω στο αρχείο. */
export const MEDIA_RELEASE_ACTOR = 'system:catalog-media-release';

/** Ποιον χώρο αφορά η αποδέσμευση, και γιατί (για το ίχνος). */
export interface MediaReleaseScope {
  readonly companyId: string;
  /** `batch` = τελείωσε η παρτίδα · `orphan` = περιεχόμενο που καμία λήψη δεν αναφέρει (δίχτυ). */
  readonly reason: 'batch' | 'orphan';
}

/** Απολογισμός — ονομασμένα, ποτέ boolean. */
export interface MediaReleaseTally {
  readonly released: number;
  readonly held: number;
  readonly checked: number;
}

/** Ποιος κρατά ένα περιεχόμενο: ανοιχτή παρτίδα · μόνο τελειωμένες · καμία λήψη. */
export type MediaContentHold = 'openBatch' | 'finishedOnly' | 'none';

type Data = Readonly<Record<string, unknown>>;

const readyFetches = (db: Firestore, companyId: string) =>
  db.collection(COLLECTIONS.CATALOG_IMPORT_ASSET_FETCHES).where('companyId', '==', companyId).where('status', '==', 'ready');

const contentOf = (data: Data): { fileId: string; sha256: string } | null => {
  const content = data.content;
  if (typeof content !== 'object' || content === null) return null;
  const { fileId, sha256 } = content as Data;
  return typeof fileId === 'string' && typeof sha256 === 'string' ? { fileId, sha256 } : null;
};

/** Τα διακριτά περιεχόμενα που κατέβασε μια παρτίδα (`fileId` → sha256). */
async function contentsOfBatch(db: Firestore, companyId: string, batchId: string): Promise<Map<string, string>> {
  const snapshot = await readyFetches(db, companyId).where('batchId', '==', batchId).get();
  const contents = new Map<string, string>();
  for (const doc of snapshot.docs) {
    const content = contentOf(doc.data());
    if (content !== null) contents.set(content.fileId, content.sha256);
  }
  return contents;
}

/** Ανοιχτή = δική μας, ζωντανή, και όχι σε τελική κατάσταση — η ανάγνωση περνά από τον **ίδιο** αναγνώστη ιδιοκτησίας του καταλόγου. */
async function anyOpenBatch(db: Firestore, companyId: string, batchIds: readonly string[]): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const scope = { db, tx, ctx: { companyId }, now: nowISO() };
    const batches = await Promise.all(batchIds.map((id) => readOwnedOrNull<ImportBatchDefinition>(scope, 'importBatch', id)));
    return batches.some((batch) => batch !== null && !IMPORT_FINISHED_BATCH_STATUSES.includes(batch.status));
  }, { readOnly: true });
}

/** **Ποιος κρατά αυτό το περιεχόμενο;** — από τις `ready` λήψεις **όλων** των παρτίδων του χώρου. */
export async function mediaContentHold(companyId: string, fileId: string): Promise<MediaContentHold> {
  const db = getAdminFirestore();
  const snapshot = await readyFetches(db, companyId).where('content.fileId', '==', fileId).get();
  const batchIds = [...new Set(snapshot.docs.map((doc) => doc.data().batchId).filter((id): id is string => typeof id === 'string'))];
  if (batchIds.length === 0) return 'none';
  return (await anyOpenBatch(db, companyId, batchIds)) ? 'openBatch' : 'finishedOnly';
}

/** Στον κάδο **μόνο** αν είναι ακόμη ζωντανό και δικό μας — σε συναλλαγή. `true` ⇒ πήγε τώρα. */
export async function trashQuarantinedContent(scope: MediaReleaseScope, fileId: string, sha256: string): Promise<boolean> {
  const ref = mediaContentFileRef(fileId);
  const purgeAt = purgeDateAfterDays(CATALOG_MEDIA_QUARANTINE_TRASH_DAYS).toISOString();
  const trashed = await getAdminFirestore().runTransaction(async (tx) => {
    const state = mediaContentStateOf({ companyId: scope.companyId, fileId, sha256 }, (await tx.get(ref)).data() ?? null);
    if (state !== 'live') return false;
    tx.update(ref, fileTrashFields({ trashedState: FILE_LIFECYCLE_STATES.TRASHED, by: MEDIA_RELEASE_ACTOR, purgeAt, now: FieldValue.serverTimestamp() }));
    return true;
  });
  if (trashed) {
    await recordFileAudit({ fileId, action: 'delete', performedBy: MEDIA_RELEASE_ACTOR, companyId: scope.companyId, metadata: { reason: `catalog-media-${scope.reason}`, purgeAt } });
  }
  return trashed;
}

/**
 * **Η παρτίδα τελείωσε** (εγκατάλειψη · κλείσιμο) ⇒ ό,τι κατέβασε και δεν το κρατά άλλη ανοιχτή παρτίδα πάει στον κάδο.
 * Ιδεμπότητο· το καλεί και το δίχτυ για όσες παρτίδες έχασε ο κύριος δρόμος.
 */
export async function releaseBatchMedia(companyId: string, batchId: string): Promise<MediaReleaseTally> {
  const contents = await contentsOfBatch(getAdminFirestore(), companyId, batchId);
  let released = 0;
  let held = 0;
  for (const [fileId, sha256] of contents) {
    if ((await mediaContentHold(companyId, fileId)) === 'openBatch') held++;
    else if (await trashQuarantinedContent({ companyId, reason: 'batch' }, fileId, sha256)) released++;
  }
  return { released, held, checked: contents.size };
}

/**
 * **Ο κύριος δρόμος**, όπως τον καλεί το τέλος μιας παρτίδας: η εγκατάλειψη/το κλείσιμο **έχει ήδη γίνει** και δεν ακυρώνεται
 * για λόγο αποθήκευσης — αποτυχία εδώ γράφεται στο log και την πιάνει το δίχτυ (`catalog-media-quarantine-sweep`).
 */
export async function releaseFinishedBatchMedia(companyId: string, batchId: string): Promise<void> {
  try {
    await releaseBatchMedia(companyId, batchId);
  } catch (error) {
    logger.warn('Quarantine release deferred to the sweep', { companyId, batchId, error: String(error) });
  }
}
