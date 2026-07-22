'use client';

/**
 * imported-mesh-assets — ADR-683 Φ3β: πώς ένα εισαγόμενο `.glb` **φτάνει** στο Storage και πώς
 * γίνεται **ευρέσιμο** μετά.
 *
 * Δύο πράξεις, ένα αρχείο, γιατί είναι οι δύο όψεις του ίδιου συμβολαίου: ό,τι ανεβαίνει πρέπει να
 * δηλωθεί, αλλιώς δεν βρίσκεται ποτέ. Χωρισμένες σε δύο modules, η δεύτερη θα ξεχνιόταν — και η
 * αποτυχία της είναι **σιωπηλή** (βλ. παρακάτω).
 *
 * **Γιατί project-scoped δέντρο και όχι η βιβλιοθήκη:** το `bim-mesh-library/` είναι curated
 * κατάλογος με write **μόνο** super-admin (`storage.rules:500`). Κάθε προσπάθεια ανεβάσματος από
 * χρήστη εκεί θα σκόνταβε σε permission error. Τα εισαγόμενα ανήκουν σε **ένα έργο** και ανεβαίνουν
 * από μέλος της εταιρείας → `companies/…/projects/…/imported-meshes/` (`storage.rules:526`).
 *
 * **Ένα `.glb` ανά εισαγωγή** (απόφαση Giorgio, 2026-07-20 — μοντέλο linked-model του Revit): ένα
 * αρχείο περιέχει πολλά αντικείμενα, και κάθε οντότητα δείχνει σε **κόμβο** μέσα του μέσω
 * `<uploadId>#<nodeName>`. Γι' αυτό η δήλωση γίνεται ανά κόμβο ενώ το ανέβασμα ανά αρχείο.
 *
 * Μοτίβο upload ίδιο με το `bim/services/bim-material-texture-upload.service.ts` (validate → path
 * από SSoT → `uploadBytes` → typed error) — μηδέν νέο μονοπάτι.
 *
 * @see ./bim-mesh-url-resolver — `importedMeshStoragePath` / `registerMeshAssetPath`
 * @see ../../../bim/entities/imported-mesh/imported-mesh-types — `importedMeshAssetId`
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import { ref as makeStorageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { createModuleLogger } from '@/lib/telemetry';
import { IMPORTED_MESH_CATEGORY } from '../../../bim/entities/imported-mesh/imported-mesh-types';
import { importedMeshStoragePath, registerMeshAssetPath } from './bim-mesh-url-resolver';

const logger = createModuleLogger('ImportedMeshUpload');

/** Το `storage.rules` επιβάλλει το σκληρό όριο· εδώ κόβουμε νωρίς με σαφές μήνυμα. */
export const IMPORTED_MESH_MAX_BYTES = 100 * 1024 * 1024;

const GLB_CONTENT_TYPE = 'model/gltf-binary';

export interface ImportedMeshUploadInput {
  /** Τα bytes του `.glb` όπως διαβάστηκαν από τον χρήστη. */
  readonly data: ArrayBuffer | Blob;
  readonly companyId: string;
  readonly projectId: string;
  /** Enterprise id της **εισαγωγής** (`generateImportedMeshId()`), κοινό για όλους τους κόμβους. */
  readonly uploadId: string;
}

export interface ImportedMeshUploadResult {
  readonly uploadId: string;
  readonly storagePath: string;
}

export type ImportedMeshUploadErrorCode =
  | 'missing-company'
  | 'missing-project'
  | 'missing-upload-id'
  | 'empty'
  | 'size'
  | 'upload-failed';

export class ImportedMeshUploadError extends Error {
  readonly code: ImportedMeshUploadErrorCode;
  constructor(code: ImportedMeshUploadErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ImportedMeshUploadError';
  }
}

function byteLength(data: ArrayBuffer | Blob): number {
  return data instanceof Blob ? data.size : data.byteLength;
}

/**
 * Ανεβάζει το `.glb` μιας εισαγωγής σε project-scoped path.
 *
 * Δεν επιστρέφει download URL: το URL το λύνει ο `resolveMeshUrl` **όταν χρειαστεί**, με in-flight
 * de-dup, και θα ήταν δεύτερη πηγή αλήθειας αν το κρατούσαμε κι εδώ. Επιστρέφει το **path**, που
 * είναι αυτό που αποθηκεύεται στην οντότητα και επιβιώνει του reload.
 */
export async function uploadImportedMeshFile(
  input: ImportedMeshUploadInput,
): Promise<ImportedMeshUploadResult> {
  const { data, companyId, projectId, uploadId } = input;
  if (!companyId) throw new ImportedMeshUploadError('missing-company');
  if (!projectId) throw new ImportedMeshUploadError('missing-project');
  if (!uploadId) throw new ImportedMeshUploadError('missing-upload-id');

  const size = byteLength(data);
  if (size === 0) throw new ImportedMeshUploadError('empty');
  if (size > IMPORTED_MESH_MAX_BYTES) throw new ImportedMeshUploadError('size');

  const storagePath = importedMeshStoragePath(companyId, projectId, uploadId);

  try {
    // ADR-683 §mesh-load-missing-file diagnostic — καταγράφουμε ΤΙ αποθηκεύτηκε πραγματικά (bucket,
    // path, μέγεθος από τη ΜΕΤΑΔΕΔΟΜΕΝΗ απάντηση του GCS), γιατί το `.glb` έλειπε 9s μετά από «επιτυχές»
    // upload — η απάντηση του server λέει αν πράγματι γράφτηκε, πού, και με πόσα bytes.
    const result = await uploadBytes(makeStorageRef(storage, storagePath), data, {
      contentType: GLB_CONTENT_TYPE,
    });
    logger.info('imported mesh uploaded', {
      requestedPath: storagePath,
      sentBytes: size,
      bucket: result.metadata.bucket,
      fullPath: result.metadata.fullPath,
      storedBytes: result.metadata.size,
    });
    return { uploadId, storagePath };
  } catch (err) {
    logger.error('imported mesh upload failed', {
      requestedPath: storagePath,
      sentBytes: size,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new ImportedMeshUploadError(
      'upload-failed',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Δηλώνει το **αρχείο** μιας εισαγωγής στον resolver — **ένα κλειδί ανά αρχείο** (`uploadId`).
 *
 * 🔴 **Χωρίς αυτή την κλήση το πλέγμα δεν βρίσκεται ποτέ — σιωπηλά.** Το μητρώο του resolver είναι
 * in-memory module singleton: μετά από refresh είναι άδειο, οπότε ο `resolveMeshUrl` πέφτει στη
 * σύμβαση της **βιβλιοθήκης** (`bim-mesh-library/imported/<uploadId>.glb`) — path που δεν υπάρχει
 * (τα εισαγόμενα ζουν project-scoped). Ο χρήστης βλέπει το placeholder κουτί και τίποτα άλλο.
 *
 * **Γιατί ανά αρχείο και όχι ανά κόμβο** (linked-model, Revit/C4D proxy): ένα `.glb` κουβαλά N
 * αντικείμενα αλλά κατεβαίνει **μία** φορά· ο `resolveMeshUrl` λύνει URL **ανά αρχείο** (`bundleId =
 * uploadId`, βλ. `bim-mesh-cache.loadScene`), η ανάθεση σε κόμβο γίνεται **μετά** τη φόρτωση
 * (`indexBundleNodes`). Registration ανά κόμβο θα γραφόταν σε κλειδί που **κανείς δεν διαβάζει** →
 * miss → 404. Οι δύο άξονες (file-resolve ↔ node-index) οφείλουν να μένουν συνεπείς.
 *
 * Idempotent: N κόμβοι της ίδιας εισαγωγής → ίδιο `uploadId` → ίδιο path → no-op. Καλείται σε **δύο**
 * σημεία: στην εισαγωγή (μία φορά ανά upload) και στο hydrate της persistence (ανά έγγραφο· idempotent).
 */
export function registerImportedMeshAsset(uploadId: string, storagePath: string): void {
  registerMeshAssetPath(IMPORTED_MESH_CATEGORY, uploadId, storagePath);
}
