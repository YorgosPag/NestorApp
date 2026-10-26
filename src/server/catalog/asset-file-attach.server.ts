import 'server-only';

/**
 * =============================================================================
 * ΣΥΝΔΕΣΗ ΑΡΧΕΙΟΥ ↔ ΜΕΣΟΥ ΚΑΤΑΛΟΓΟΥ — ο ενορχηστρωτής (ADR-923 §5.10.3 · Δ9 · Δ10)
 * =============================================================================
 *
 * Σειρά, **προληπτική** (N.7.2 #1 — τα δεδομένα δημιουργούνται στη σωστή στιγμή, όχι ως παρενέργεια):
 *   1. **Μέτρηση** του αντικειμένου από τον κάδο (`statStorageObject`) — το όριο ανά είδος κρίνεται πάνω σε αυτό, όχι
 *      στο `sizeBytes` που δήλωσε ο πελάτης.
 *   2. **Αποδόσεις** (web + εκτύπωση) για εικόνα που αποδίδεται — `ensureCatalogAssetRenditions`, ιδεμπότητο.
 *   3. **Συναλλαγή** (`attachCatalogAssetFile`): ξαναδιαβάζει μέσο **και** αρχείο, κρίνει (`judgeAssetFile`), γράφει `fileId`.
 *
 * 🔒 Τα βήματα 1–2 τρέχουν **μόνο** για αρχείο που ήδη ανήκει σε αυτό το μέσο της ίδιας εταιρείας και είναι ζωντανό
 *   (`judgeContainerFile`): ξένο `fileId` δεν προκαλεί ούτε μία λήψη ή κωδικοποίηση. Η **απόφαση** μένει στη συναλλαγή —
 *   τα 1–2 είναι προετοιμασία, όχι κρίση.
 * @module server/catalog/asset-file-attach.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { judgeContainerFile } from '@/lib/files/container-file-verdict';
import { statStorageObject } from '@/lib/storage/storage-object-stream';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { needsCatalogRenditions } from '@/subapps/catalog/renditions/catalog-renditions';
import { assetFileTypeFactsOf } from '@/subapps/catalog/schema/judge-asset-file';
import type { AttachAssetFileBody } from '@/subapps/catalog/schema/zod/asset.schema';
import { assetKindAcceptsFile } from '@/subapps/catalog/vocabulary/asset-files';
import { attachCatalogAssetFile } from './asset-writer.server';
import { ensureCatalogAssetRenditions, type CatalogRenditionRecord } from './catalog-asset-renditions.server';

/** Για την **προετοιμασία** ο τύπος δεν κρίνεται — τον κρίνει η συναλλαγή, με το είδος του μέσου. */
const ANY_TYPE = (): boolean => true;

type FileData = Readonly<Record<string, unknown>>;

function ownedLiveFile(ctx: AuthContext, assetId: string, fileId: string, data: FileData | null): data is FileData {
  const verdict = judgeContainerFile(fileId, data, {
    owner: { kind: 'company', companyId: ctx.companyId },
    entityType: ENTITY_TYPES.CATALOG_ASSET,
    entityId: assetId,
    contentType: ANY_TYPE,
  });
  return verdict.kind === 'accepted';
}

/** Εικόνα που αποδίδεται (όχι SVG, όχι PDF/BIM/βίντεο) — ίδια κρίση με εκείνη της συναλλαγής. */
function rendersAsImage(data: FileData): boolean {
  const facts = assetFileTypeFactsOf(data);
  return assetKindAcceptsFile('image', facts) === 'accepted' && needsCatalogRenditions('image', facts);
}

async function storedSizeOf(data: FileData): Promise<number | null> {
  const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
  if (storagePath === '') return null;
  const stat = await statStorageObject(storagePath, { bucket: fileRecordBucket(data) });
  return stat.kind === 'found' ? stat.size : null;
}

/** `POST /api/catalog/assets/[id]/file` — μέτρηση → αποδόσεις → συναλλαγή. */
export async function attachFileToCatalogAsset(ctx: AuthContext, assetId: string, body: AttachAssetFileBody) {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.FILES).doc(body.fileId).get();
  const data = snap.exists ? (snap.data() ?? null) : null;
  let storedSizeBytes: number | null = null;
  if (ownedLiveFile(ctx, assetId, body.fileId, data)) {
    storedSizeBytes = await storedSizeOf(data);
    if (rendersAsImage(data)) {
      await ensureCatalogAssetRenditions(db, { custody: 'company', fileId: body.fileId, record: data as CatalogRenditionRecord });
    }
  }
  return attachCatalogAssetFile(ctx, assetId, body.expectedRevision, body.fileId, { storedSizeBytes });
}
