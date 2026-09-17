'use client';

/**
 * @fileoverview **ΤΟ ΑΝΕΒΑΣΜΑ ΕΝΟΣ ΑΡΧΕΙΟΥ ΟΝΤΟΤΗΤΑΣ** — ο κανονικός αγωγός (ADR-054 · ADR-191 · ADR-292 · ADR-293), ως συνάρτηση.
 * @related components/shared/files/hooks/useFileUpload.ts · services/filesystem/file-mutation-gateway.ts
 * @module services/filesystem/upload-entity-file
 *
 * 🔑 **Εξήχθη όταν χρειάστηκε δεύτερος καταναλωτής** (N.0.2 · ADR-864 §18.4 Δ1): τα βήματα Α-Γ ζούσαν
 * **μέσα** στο `useFileUpload`, δεμένα στον διαχειριστή αρχείων (σημεία εισόδου, ειδοποιήσεις, ανανέωση
 * λίστας). Το υπογεγραμμένο έντυπο κλειστής διάθεσης χρειάζεται **τον ίδιο** αγωγό **και την ταυτότητα του
 * αρχείου** (`fileId`) που ο hook δεν επέστρεφε. Αντίγραφο των τριών βημάτων θα ήταν δεύτερος αγωγός.
 *
 * | Βήμα | Τι |
 * |---|---|
 * | Α | `FileRecord` σε `pending` — η διαδρομή αποθήκευσης **γεννιέται από τον διακομιστή** (`buildStoragePath`) |
 * | Β | bytes στο Storage (+ μικρογραφία, μη μπλοκάρουσα) |
 * | Γ | `ready` με `downloadUrl` + μέγεθος |
 *
 * ⚠️ Ο έλεγχος ταυτότητας (`validateUploadAuth`) **δεν** είναι εδώ: ο καλών διαλέγει πώς λέει την άρνηση.
 */

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type { EntityType, FileCategory, FileDomain } from '@/config/domain-constants';
import { storage } from '@/lib/firebase';
import type { FileCustody } from '@/lib/files/file-custody';
import { custodyKindOfScope } from '@/lib/workspace/custody-scope';
import { createModuleLogger } from '@/lib/telemetry';
import { buildThumbnailPath, generateUploadThumbnail } from '@/components/shared/files/utils/generate-upload-thumbnail';
import {
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import { getFileExtension } from '@/services/upload';

const logger = createModuleLogger('upload-entity-file');

/** Η αναμονή διάδοσης Firestore πριν το Storage — οι κανόνες αποθήκευσης διαβάζουν το `FileRecord`. */
const FIRESTORE_PROPAGATION_MS = 300;

interface EntityFileUploadSpec {
  /** **Ποιος κατέχει** το αρχείο (ADR-866 §5.2) — ορίζει ρίζα Storage **και** διαμέρισμα Firestore. */
  readonly custody: FileCustody;
  readonly projectId?: string;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly domain: FileDomain;
  readonly category: FileCategory;
  readonly entityLabel?: string;
  readonly purpose?: string;
  readonly levelFloorId?: string;
  readonly createdBy: string;
  readonly uploaderName?: string;
  readonly customTitle?: string;
}

interface UploadedEntityFile {
  readonly fileId: string;
  readonly displayName: string | undefined;
}

async function uploadThumbnail(file: File, storagePath: string): Promise<string | undefined> {
  try {
    const thumbBlob = await generateUploadThumbnail(file, file.type);
    if (!thumbBlob) return undefined;
    const thumbRef = ref(storage, buildThumbnailPath(storagePath));
    await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
    return await getDownloadURL(thumbRef);
  } catch (thumbErr) {
    logger.warn('Thumbnail generation failed (non-blocking)', { error: String(thumbErr) });
    return undefined;
  }
}

/** **Ένα αρχείο, τρία βήματα.** Πετά σε αποτυχία — ο καλών μετρά επιτυχίες/αποτυχίες όπως θέλει. */
export async function uploadEntityFile(spec: EntityFileUploadSpec, file: File): Promise<UploadedEntityFile> {
  const { fileId, storagePath, displayName } = await createPendingFileRecordWithPolicy({
    ...spec.custody,
    projectId: spec.projectId,
    entityType: spec.entityType,
    entityId: spec.entityId,
    domain: spec.domain,
    category: spec.category,
    entityLabel: spec.entityLabel,
    purpose: spec.purpose,
    ...(spec.levelFloorId ? { levelFloorId: spec.levelFloorId } : {}),
    originalFilename: file.name,
    ext: getFileExtension(file.name),
    contentType: file.type,
    createdBy: spec.createdBy,
    uploaderName: spec.uploaderName,
    customTitle: spec.customTitle,
  });

  await new Promise((resolve) => setTimeout(resolve, FIRESTORE_PROPAGATION_MS));

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  const thumbnailUrl = await uploadThumbnail(file, storagePath);

  await finalizeFileRecordWithPolicy({
    fileId,
    custody: custodyKindOfScope(spec.custody),
    sizeBytes: file.size,
    downloadUrl,
    thumbnailUrl,
  });
  return { fileId, displayName };
}
