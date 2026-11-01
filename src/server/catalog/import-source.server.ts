import 'server-only';

/**
 * Τα **bytes** της πηγής μιας παρτίδας (ADR-923 §5.5.1). Μόνο εδώ διαβάζεται ο κάδος για την εισαγωγή: κριτής αρχείου
 * (`judgeContainerFile`: ανήκει σε αυτή την παρτίδα αυτής της εταιρείας, είναι ζωντανό) και μετά λήψη.
 *
 * Ο πίνακας διαβάζεται **στον διακομιστή** με τον ίδιο αναγνώστη και το ίδιο προφίλ: η προεπισκόπηση του πελάτη είναι
 * βοήθεια, η αλήθεια είναι το αρχείο.
 * @module server/catalog/import-source.server
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { judgeContainerFile } from '@/lib/files/container-file-verdict';
import type { AuthContext } from '@/lib/auth';
import { openStorageObject } from '@/lib/storage/storage-object-stream';
import { readDelimitedText } from '@/lib/tabular-import/delimited-reader';
import { readExcelToTable } from '@/lib/tabular-import/excel-reader';
import type { RawTable } from '@/lib/tabular-import/tabular-types';
import { decodeSurveyText } from '@/lib/terrain/survey-import/survey-file-read';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import type { ImportBatchDefinition, ImportProfileDefinition } from '@/subapps/catalog/types/catalog-import';
import { CatalogWriteError } from './catalog-write-error';

const ANY_TYPE = (): boolean => true;

type FileData = Readonly<Record<string, unknown>>;

async function acceptedFileRecord(ctx: AuthContext, batchId: string, fileId: string): Promise<FileData | null> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).get();
  const data = snap.exists ? (snap.data() ?? null) : null;
  const verdict = judgeContainerFile(fileId, data, {
    owner: { kind: 'company', companyId: ctx.companyId },
    entityType: ENTITY_TYPES.CATALOG_IMPORT_BATCH,
    entityId: batchId,
    contentType: ANY_TYPE,
  });
  return verdict.kind === 'accepted' ? data : null;
}

/** Το έγγραφο του αρχείου, αν ανήκει σε αυτή την παρτίδα. Ξένο ≡ ανύπαρκτο. */
export async function readBatchFileRecord(ctx: AuthContext, batchId: string, fileId: string): Promise<FileData> {
  const data = await acceptedFileRecord(ctx, batchId, fileId);
  if (data === null) throw new CatalogWriteError('invalid', [{ code: 'fileNotFound', path: 'fileId' }]);
  return data;
}

export interface StoredBatchFile {
  readonly fileId: string;
  /** Η παρτίδα-κάτοχος: το αρχείο ανήκει σε αυτήν, όσες κι αν το διαβάζουν. */
  readonly ownerBatchId: string;
  readonly record: FileData;
}

/** Πόσες παρτίδες με το ίδιο περιεχόμενο εξετάζονται: αρκεί ένα ζωντανό αντίγραφο, και το ερώτημα μένει φραγμένο. */
const SAME_CONTENT_BATCHES = 20;

/**
 * Ζωντανό αρχείο με το ίδιο `contentSha256` στον ίδιο χώρο (§5.5.1, Storage): ίδιο PDF δεν ξανανεβαίνει σε κάθε παρτίδα. Το ίχνος έρχεται
 * από μετρημένο sha256 της σύνδεσης, και ο κριτής δοχείου ξαναρωτά για το ίδιο το αρχείο: ό,τι μπήκε στον κάδο δεν ξαναχρησιμοποιείται.
 */
export async function findStoredBatchFile(ctx: AuthContext, contentSha256: string, batchId: string): Promise<StoredBatchFile | null> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.CATALOG_IMPORT_BATCHES)
    .where('companyId', '==', ctx.companyId)
    .where('contentSha256', '==', contentSha256)
    .where('isDeleted', '==', false)
    .limit(SAME_CONTENT_BATCHES)
    .get();
  for (const doc of snap.docs) {
    const { fileId, fileBatchId } = doc.data() as Pick<ImportBatchDefinition, 'fileId' | 'fileBatchId'>;
    if (doc.id === batchId || !fileId) continue;
    const ownerBatchId = fileBatchId ?? doc.id;
    const record = await acceptedFileRecord(ctx, ownerBatchId, fileId);
    if (record !== null) return { fileId, ownerBatchId, record };
  }
  return null;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) chunks.push(next.value);
  return Buffer.concat(chunks);
}

export async function downloadBatchFile(data: FileData): Promise<Buffer> {
  const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
  const object = await openStorageObject(storagePath, null, { bucket: fileRecordBucket(data), singleRequest: true });
  if (object.kind !== 'found') throw new CatalogWriteError('invalid', [{ code: 'fileNotFound', path: 'fileId' }]);
  return streamToBuffer(object.stream);
}

const arrayBufferOf = (bytes: Buffer): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Ο πίνακας του αρχείου, με τις επιλογές του προφίλ. Το ελληνικό CSV των Windows (windows-1253) διαβάζεται σωστά. */
export function readBatchTable(
  batch: Pick<ImportBatchDefinition, 'sourceKind'>,
  bytes: Buffer,
  profile: Pick<ImportProfileDefinition, 'skipRows' | 'sheetIndex'>,
): Promise<RawTable> | RawTable {
  if (batch.sourceKind === 'spreadsheet') return readExcelToTable(arrayBufferOf(bytes), { sheetIndex: profile.sheetIndex, skipRows: profile.skipRows });
  return readDelimitedText(decodeSurveyText(bytes), { skipRows: profile.skipRows });
}
