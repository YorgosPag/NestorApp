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

/** Το έγγραφο του αρχείου, αν ανήκει σε αυτή την παρτίδα. Ξένο ≡ ανύπαρκτο. */
export async function readBatchFileRecord(ctx: AuthContext, batchId: string, fileId: string): Promise<FileData> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.FILES).doc(fileId).get();
  const data = snap.exists ? (snap.data() ?? null) : null;
  const verdict = judgeContainerFile(fileId, data, {
    owner: { kind: 'company', companyId: ctx.companyId },
    entityType: ENTITY_TYPES.CATALOG_IMPORT_BATCH,
    entityId: batchId,
    contentType: ANY_TYPE,
  });
  if (verdict.kind !== 'accepted' || data === null) throw new CatalogWriteError('invalid', [{ code: 'fileNotFound', path: 'fileId' }]);
  return data;
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
