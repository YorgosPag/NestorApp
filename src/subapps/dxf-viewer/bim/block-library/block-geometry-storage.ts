'use client';

/**
 * ADR-652 M2 — Block geometry blob: Storage IO (upload / fetch).
 *
 * Ο ΜΟΝΟΣ τόπος που ανεβάζει/κατεβάζει το «αρχείο» ενός block. Το path το χτίζει ο
 * κεντρικός `buildBlockLibraryGeometryPath` (storage-path SSoT) — ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ από
 * `(companyId, blockId)`, οπότε το κατέβασμα ΔΕΝ χρειάζεται να parse-άρει το `geometryUrl`
 * (το κρατάμε στο doc για εξωτερική χρήση/debug).
 *
 * Bytes contract: ίδιο με το scene blob του `dxf-firestore-storage.impl.ts` —
 * `TextEncoder` → `uploadBytes(..., { contentType: 'application/json' })`, και στο
 * διάβασμα `getBytes` → `TextDecoder` → parse+validate (`parseBlockGeometryBlob`).
 *
 * @see ./block-geometry-blob.ts — pure (de)serialisation + validation
 * @see @/services/upload/utils/storage-path — buildBlockLibraryGeometryPath (path SSoT)
 */

import { ref as makeStorageRef, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';

import { storage } from '@/lib/firebase';
import { buildBlockLibraryGeometryPath } from '@/services/upload/utils/storage-path';
import {
  parseBlockGeometryBlob,
  serializeBlockGeometry,
  type BlockGeometryBlob,
  type SerializeBlockGeometryInput,
} from './block-geometry-blob';

export interface BlockGeometryLocator {
  /** `null` ⇒ system/partner περιεχόμενο (ADR-652 M3) — δεν ανήκει σε εταιρεία. */
  readonly companyId: string | null;
  readonly blockId: string;
}

export interface BlockGeometryUploadResult {
  readonly storagePath: string;
  readonly downloadUrl: string;
  readonly sizeBytes: number;
}

/** Ανεβάζει τα BLOCK-LOCAL members ως JSON blob· επιστρέφει path + download URL. */
export async function uploadBlockGeometry(
  locator: BlockGeometryLocator,
  geometry: SerializeBlockGeometryInput,
): Promise<BlockGeometryUploadResult> {
  const storagePath = buildBlockLibraryGeometryPath(locator);
  const bytes = new TextEncoder().encode(serializeBlockGeometry(geometry));

  const snapshot = await uploadBytes(makeStorageRef(storage, storagePath), bytes, {
    contentType: 'application/json',
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return { storagePath, downloadUrl, sizeBytes: bytes.length };
}

/**
 * Κατεβάζει + επικυρώνει το blob ενός block. `null` όταν λείπει το αντικείμενο ή το
 * περιεχόμενο είναι άκυρο — ο καλών αποφασίζει τι σημαίνει αυτό για το UI (το palette
 * απλώς δεν ενεργοποιεί το tool).
 */
export async function fetchBlockGeometry(
  locator: BlockGeometryLocator,
): Promise<BlockGeometryBlob | null> {
  try {
    const bytes = await getBytes(makeStorageRef(storage, buildBlockLibraryGeometryPath(locator)));
    return parseBlockGeometryBlob(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
