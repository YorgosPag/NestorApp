/**
 * dxf-scene-storage-load — φόρτωση σκηνής από το Storage που λέει **ΓΙΑΤΙ** δεν βρέθηκε σκηνή (ADR-913 §2).
 *
 * Εξήχθη από το `dxf-firestore-storage.impl.ts` (N.7.1)· εκείνο το re-export-άρει, ώστε το `loadFromStorageImpl`
 * να μένει σταθερό για όλους τους καλούντες του `loadFileV2`.
 *
 * 🔴 Πριν (2026-11-15): το `loadFromStorageImpl` επέστρεφε **ένα** `null` για πέντε διαφορετικά πράγματα — λείπει το
 *    FileRecord · λείπει η πηγή σκηνής · δεν σώθηκε ποτέ σκηνή · σκηνή ρητά άδεια (`entities: []`) · σφάλμα/άκυρο
 *    περιεχόμενο. Ο loader του επιπέδου τα έκρινε **όλα** «ορφανό αρχείο» (ADR-469 latch) ⇒ ένα αρχείο που άδειασε
 *    μία φορά δεν ξαναδεχόταν ποτέ εγγραφή σε όλη τη συνεδρία, και η κατάσταση διαιωνιζόταν.
 *
 * Ο λόγος `empty` δίνεται **μόνο** όταν ΚΑΘΕ βαθμίδα που δοκιμάστηκε απάντησε «δεν υπάρχει» ή «ρητά άδεια», με
 * **κανένα** σφάλμα και **κανένα** άκυρο περιεχόμενο. Ό,τι δεν διαβάστηκε δεν δηλώνεται ποτέ «άδειο» — αλλιώς ένα
 * baseline 0 θα άνοιγε εγγραφή πάνω από γεωμετρία που απλώς δεν κατέβηκε (ADR-714).
 *
 * @module subapps/dxf-viewer/services/dxf-scene-storage-load
 */

import { getErrorMessage } from '@/lib/error-utils';
import { storage } from '../../../lib/firebase';
import { ref, getBytes } from 'firebase/storage';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import pako from 'pako';
import type { SceneModel } from '../types/scene';
import type { FileRecord } from '@/types/file-record';
import { dxfLogger, isExpectedError } from './dxf-firestore-logger';
import type { DxfFileMetadata, DxfFileRecord } from './dxf-firestore.types';
import { isFileRecordRetired, mapFileRecordToDxfMetadata } from './dxf-firestore.types';
import { inspectSceneJson } from './dxf-scene-json';

/** Το FileRecord ενός αρχείου χωρίς φορτωμένη σκηνή — αρκετό για να ανοίξει ο στόχος εγγραφής. */
export type StoredSceneFile = Omit<DxfFileRecord, 'scene'> & {
  /** ADR-913 — κάδος/αρχείο (`isFileRecordRetired`). */
  readonly retired: boolean;
};

/** Γιατί δεν υπάρχει σκηνή να φορτωθεί. */
export type SceneAbsenceReason = 'no-record' | 'no-source' | 'empty' | 'unreadable';

export type StorageSceneLoad =
  | { readonly kind: 'loaded'; readonly record: DxfFileRecord }
  | { readonly kind: 'absent'; readonly reason: SceneAbsenceReason; readonly file?: StoredSceneFile };

/**
 * Outcome of a Storage download attempt.
 *  - `ok`        — bytes retrieved
 *  - `not-found` — object does not exist (expected; e.g. a file linked to a
 *                  floor whose scene was never saved/processed yet)
 *  - `error`     — permission/network/unknown failure (a real problem)
 */
type StorageFetchResult =
  | { status: 'ok'; bytes: ArrayBuffer }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown };

/**
 * Try downloading bytes from a Storage path. Distinguishes a benign
 * object-not-found from a real (permission/network) error so callers can log at
 * the right severity — see the `@enterprise` contract on `loadFromStorageImpl`.
 */
async function tryGetBytes(path: string): Promise<StorageFetchResult> {
  try {
    const bytes = await getBytes(ref(storage, path));
    return { status: 'ok', bytes };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'storage/object-not-found') {
      return { status: 'not-found' };
    }
    return { status: 'error', error };
  }
}

/** Μία βαθμίδα αναζήτησης σκηνής. */
interface SceneTier {
  readonly path: string;
  readonly gzip: boolean;
  readonly source: string;
}

/** Τι απάντησε μία βαθμίδα. */
type TierRead =
  | { readonly outcome: 'scene'; readonly scene: SceneModel }
  | { readonly outcome: 'empty' | 'not-found' | 'invalid' }
  | { readonly outcome: 'error'; readonly error: unknown };

/**
 * Οι 3 βαθμίδες, με τη σειρά τους:
 *  1. `.scene.json`      — client auto-save (plain JSON)
 *  2. `processedDataPath` — server wizard (gzip `.processed.json`) ή plain `.scene.json` (bug διορθωμένο 2026-05-14)
 *  3. raw storagePath     — legacy fallback (plain JSON), μόνο αν διαφέρει από το 1
 */
function sceneTiers(rawPath: string, processedPath: string | undefined): SceneTier[] {
  const scenePath = rawPath.endsWith('.scene.json') ? rawPath : rawPath.replace(/\.[^/.]+$/, '.scene.json');
  const tiers: SceneTier[] = [{ path: scenePath, gzip: false, source: 'scene.json' }];
  if (processedPath) {
    const plain = processedPath.endsWith('.scene.json');
    tiers.push({ path: processedPath, gzip: !plain, source: plain ? 'processed-scene.json' : 'processed.json' });
  }
  if (scenePath !== rawPath) tiers.push({ path: rawPath, gzip: false, source: 'raw-path' });
  return tiers;
}

async function readTier(fileId: string, tier: SceneTier): Promise<TierRead> {
  const fetched = await tryGetBytes(tier.path);
  if (fetched.status === 'not-found') return { outcome: 'not-found' };
  if (fetched.status === 'error') return { outcome: 'error', error: fetched.error };
  let text: string;
  try {
    text = tier.gzip
      ? (pako.ungzip(new Uint8Array(fetched.bytes), { to: 'string' }) as unknown as string)
      : new TextDecoder().decode(fetched.bytes);
  } catch {
    dxfLogger.warn('Failed to decompress processed scene', { fileId, processedPath: tier.path });
    return { outcome: 'invalid' };
  }
  const inspected = inspectSceneJson(text);
  return inspected.kind === 'scene' ? { outcome: 'scene', scene: inspected.scene } : { outcome: inspected.kind };
}

/** Το FileRecord χωρίς σκηνή, με τα scope πεδία που χρειάζεται το save context (ADR-358 Phase 9). */
function storedSceneFile(record: FileRecord, metadata: DxfFileMetadata): StoredSceneFile {
  return {
    id: metadata.id,
    fileName: metadata.fileName,
    lastModified: metadata.lastModified,
    version: metadata.version,
    checksum: metadata.checksum,
    storagePath: metadata.storagePath,
    ...(record.companyId ? { companyId: record.companyId } : {}),
    ...(record.projectId ? { projectId: record.projectId } : {}),
    ...(record.entityType ? { entityType: record.entityType as string } : {}),
    ...(record.entityId ? { entityId: record.entityId } : {}),
    retired: isFileRecordRetired(record),
  };
}

/** Καμία σκηνή: σιωπηλό για το αναμενόμενο, θορυβώδες για πραγματικό σφάλμα (`@enterprise` contract). */
function logNoScene(fileId: string, rawPath: string, reads: readonly TierRead[]): void {
  const failure = reads.find((r): r is Extract<TierRead, { outcome: 'error' }> => r.outcome === 'error');
  if (/\.(pdf|png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(rawPath)) {
    dxfLogger.debug('File is PDF/image, not a DXF scene — skipping', { fileId });
  } else if (failure) {
    dxfLogger.error('Failed to load scene from Storage (permission/network error)', {
      fileId, rawPath, error: getErrorMessage(failure.error),
    });
  } else {
    // Αρχείο συνδεδεμένο, σκηνή δεν σώθηκε ακόμη ή είναι ρητά άδεια — αναμενόμενο.
    dxfLogger.debug('No scene blob in Storage yet (file linked, scene not saved or empty)', { fileId, rawPath });
  }
}

function logLoadFailure(fileId: string, error: unknown): void {
  if (error instanceof Error && isExpectedError(error)) {
    dxfLogger.debug('File not found in Storage (expected)', { fileId });
  } else if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
    dxfLogger.warn('Network error during load - retry may help', { fileId });
  } else {
    dxfLogger.error('Unexpected storage load error', { fileId, error: getErrorMessage(error) });
  }
}

/** ADR-913 §2 — φόρτωση σκηνής που, όταν αποτύχει, λέει ΓΙΑΤΙ. Ποτέ δεν πετάει. */
export async function loadSceneFromStorageWithReason(fileId: string): Promise<StorageSceneLoad> {
  try {
    dxfLogger.debug('Loading from Storage', { fileId });
    const record = await firestoreQueryService.getById<FileRecord>('FILES', fileId);
    if (!record) return { kind: 'absent', reason: 'no-record' };

    const metadata = mapFileRecordToDxfMetadata(record);
    if (!metadata.storagePath) {
      dxfLogger.error('DXF document missing storagePath (ADR-293)', { fileId });
      return { kind: 'absent', reason: 'no-source' };
    }

    const file = storedSceneFile(record, metadata);
    const reads: TierRead[] = [];
    for (const tier of sceneTiers(metadata.storagePath, record.processedData?.processedDataPath)) {
      const read = await readTier(fileId, tier);
      if (read.outcome === 'scene') {
        dxfLogger.debug('Storage load complete', { fileId, source: tier.source, entities: read.scene.entities.length });
        const { retired: _retired, ...loaded } = file;
        return { kind: 'loaded', record: { ...loaded, scene: read.scene } };
      }
      reads.push(read);
    }

    logNoScene(fileId, metadata.storagePath, reads);
    const unreadable = reads.some((r) => r.outcome === 'error' || r.outcome === 'invalid');
    return { kind: 'absent', reason: unreadable ? 'unreadable' : 'empty', file };
  } catch (error: unknown) {
    logLoadFailure(fileId, error);
    return { kind: 'absent', reason: 'unreadable' };
  }
}

/**
 * Load scene from Firebase Storage + metadata from Firestore — `null` όταν δεν υπάρχει σκηνή, για ΟΠΟΙΟΝΔΗΠΟΤΕ λόγο
 * (σταθερή σημασία για τους καλούντες του `loadFileV2`). Ο λόγος: {@link loadSceneFromStorageWithReason}.
 *
 * @enterprise Silent on expected failures (missing files), loud on real errors
 */
export async function loadFromStorageImpl(fileId: string): Promise<DxfFileRecord | null> {
  const result = await loadSceneFromStorageWithReason(fileId);
  return result.kind === 'loaded' ? result.record : null;
}
